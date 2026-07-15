"""
LLM access for every tool/service in the app (Strategy, Creative, Landing
Page, Compliance, Recommendations, the AI Manager's own reasoning loop, ...).

Started as a wrapper around Ollama's local /api/chat endpoint only. That's
still the default (zero-cost, no API key, good for local dev) but is not
something you'd want to be the only brain behind a hosted, multi-tenant
SaaS — no one else can reach your laptop's Ollama server. Set LLM_PROVIDER
in .env to switch to a hosted provider; every caller in this codebase uses
only `chat_json()`, `embed()`, and `LLMError` from this module, and none of
them needed to change — the provider is chosen once, here.

    LLM_PROVIDER=ollama     (default) — self-hosted, see README for setup
    LLM_PROVIDER=anthropic  — needs ANTHROPIC_API_KEY
    LLM_PROVIDER=openai     — needs OPENAI_API_KEY

Embeddings (used only by the Knowledge/RAG tool) have their own provider
knob, EMBED_PROVIDER, since Anthropic has no embeddings API.
"""
import json
import requests

from app import config


class LLMError(Exception):
    pass


# --------------------------------------------------------------------------
# Public API — unchanged signatures, used throughout the app.
# --------------------------------------------------------------------------

def chat(prompt: str, system: str = None, json_mode: bool = False, temperature: float = 0.4) -> str:
    """Send a single-turn prompt to the configured LLM provider, return raw text."""
    provider = config.LLM_PROVIDER
    if provider == "ollama":
        return _ollama_chat(prompt, system, json_mode, temperature)
    if provider == "anthropic":
        return _anthropic_chat(prompt, system, json_mode, temperature)
    if provider == "openai":
        return _openai_chat(prompt, system, json_mode, temperature)
    if provider == "groq":
        return _groq_chat(prompt, system, json_mode, temperature)
    raise LLMError(f"Unknown LLM_PROVIDER '{provider}'. Use 'ollama', 'anthropic', 'openai', or 'groq'.")


def chat_json(prompt: str, system: str = None, temperature: float = 0.3, max_retries: int = 2) -> dict:
    """
    Ask the model for strict JSON and parse it. Retries with a corrective
    instruction if the model returns malformed JSON (this happens more with
    small local Ollama models than with hosted ones, but the retry is cheap
    insurance either way).
    """
    last_error = None
    attempt_prompt = prompt

    for attempt in range(max_retries + 1):
        raw = chat(attempt_prompt, system=system, json_mode=True, temperature=temperature)
        cleaned = _strip_code_fences(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_error = e
            attempt_prompt = (
                f"{prompt}\n\nYour previous response was not valid JSON. "
                f"Respond with ONLY a valid JSON object, no prose, no markdown fences. "
                f"Previous invalid output was:\n{raw[:500]}"
            )

    raise LLMError(f"Model failed to return valid JSON after {max_retries + 1} attempts: {last_error}")


def embed(text: str) -> list:
    """Get an embedding vector for a piece of text, via the configured embed provider."""
    if config.EMBED_PROVIDER == "openai":
        return _openai_embed(text)
    return _ollama_embed(text)


# --------------------------------------------------------------------------
# Ollama (default; self-hosted, no API key)
# --------------------------------------------------------------------------

def _ollama_chat(prompt: str, system: str, json_mode: bool, temperature: float) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": config.OLLAMA_LLM_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if json_mode:
        payload["format"] = "json"

    try:
        resp = requests.post(
            f"{config.OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=config.OLLAMA_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError as e:
        raise LLMError(
            "Could not reach Ollama. Is it running? Start it with `ollama serve` "
            f"and make sure model '{config.OLLAMA_LLM_MODEL}' is pulled. "
            f"(Set LLM_PROVIDER=anthropic or openai instead if you don't want to run your own LLM server.)"
        ) from e
    except requests.exceptions.RequestException as e:
        raise LLMError(f"Ollama request failed: {e}") from e

    data = resp.json()
    content = data.get("message", {}).get("content", "")
    if not content:
        raise LLMError(f"Ollama returned an empty response: {data}")
    return content


def _ollama_embed(text: str) -> list:
    try:
        resp = requests.post(
            f"{config.OLLAMA_BASE_URL}/api/embeddings",
            json={"model": config.OLLAMA_EMBED_MODEL, "prompt": text},
            timeout=config.OLLAMA_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError as e:
        raise LLMError(
            "Could not reach Ollama for embeddings. Is it running? "
            f"Make sure model '{config.OLLAMA_EMBED_MODEL}' is pulled."
        ) from e
    except requests.exceptions.RequestException as e:
        raise LLMError(f"Ollama embeddings request failed: {e}") from e

    data = resp.json()
    vector = data.get("embedding")
    if not vector:
        raise LLMError(f"Ollama returned no embedding: {data}")
    return vector


# --------------------------------------------------------------------------
# Anthropic (hosted; LLM_PROVIDER=anthropic, needs ANTHROPIC_API_KEY)
# --------------------------------------------------------------------------

def _anthropic_chat(prompt: str, system: str, json_mode: bool, temperature: float) -> str:
    if not config.ANTHROPIC_API_KEY:
        raise LLMError("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. See backend/.env.example.")

    effective_system = system or ""
    if json_mode:
        # Anthropic's API has no forced JSON-mode flag (unlike Ollama's `format: json`) —
        # the instruction does the same job chat_json()'s retry loop already expects.
        effective_system = (effective_system + "\n\nRespond with ONLY a valid JSON object. "
                            "No prose, no markdown code fences.").strip()

    payload = {
        "model": config.ANTHROPIC_MODEL,
        "max_tokens": 4096,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if effective_system:
        payload["system"] = effective_system

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        detail = getattr(e.response, "text", "") if getattr(e, "response", None) is not None else ""
        raise LLMError(f"Anthropic API request failed: {e} {detail}".strip()) from e

    data = resp.json()
    blocks = data.get("content", [])
    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    if not text:
        raise LLMError(f"Anthropic returned no text content: {data}")
    return text


# --------------------------------------------------------------------------
# OpenAI (hosted; LLM_PROVIDER=openai and/or EMBED_PROVIDER=openai, needs OPENAI_API_KEY)
# --------------------------------------------------------------------------

def _openai_chat(prompt: str, system: str, json_mode: bool, temperature: float) -> str:
    if not config.OPENAI_API_KEY:
        raise LLMError("LLM_PROVIDER=openai but OPENAI_API_KEY is not set. See backend/.env.example.")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": config.OPENAI_CHAT_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}", "content-type": "application/json"},
            json=payload,
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        detail = getattr(e.response, "text", "") if getattr(e, "response", None) is not None else ""
        raise LLMError(f"OpenAI API request failed: {e} {detail}".strip()) from e

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError) as e:
        raise LLMError(f"OpenAI returned an unexpected response shape: {data}") from e


def _openai_embed(text: str) -> list:
    if not config.OPENAI_API_KEY:
        raise LLMError("EMBED_PROVIDER=openai but OPENAI_API_KEY is not set. See backend/.env.example.")

    try:
        resp = requests.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}", "content-type": "application/json"},
            json={"model": config.OPENAI_EMBED_MODEL, "input": text},
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        detail = getattr(e.response, "text", "") if getattr(e, "response", None) is not None else ""
        raise LLMError(f"OpenAI embeddings request failed: {e} {detail}".strip()) from e

    data = resp.json()
    try:
        return data["data"][0]["embedding"]
    except (KeyError, IndexError) as e:
        raise LLMError(f"OpenAI returned an unexpected embeddings response shape: {data}") from e


# --------------------------------------------------------------------------
# Groq (hosted, free tier; LLM_PROVIDER=groq, needs GROQ_API_KEY)
# OpenAI-compatible chat completions API, same shape as _openai_chat above.
# --------------------------------------------------------------------------

def _groq_chat(prompt: str, system: str, json_mode: bool, temperature: float) -> str:
    if not config.GROQ_API_KEY:
        raise LLMError("LLM_PROVIDER=groq but GROQ_API_KEY is not set. See backend/.env.example.")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": config.GROQ_CHAT_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {config.GROQ_API_KEY}", "content-type": "application/json"},
            json=payload,
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        detail = getattr(e.response, "text", "") if getattr(e, "response", None) is not None else ""
        raise LLMError(f"Groq API request failed: {e} {detail}".strip()) from e

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError) as e:
        raise LLMError(f"Groq returned an unexpected response shape: {data}") from e


# --------------------------------------------------------------------------
def _strip_code_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1] if "```" in t[3:] else t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
    return t.strip()
