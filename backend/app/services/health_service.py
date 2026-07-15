"""
Real system health checks for the Admin CRM's System Health page.

Every previous version of this page (frontend/src/pages/admin/SystemHealth.tsx)
was hardcoded fake data ("Online", "42ms", ...) with no backend behind it.
This module actually probes each dependency:
  - Postgres (the shared DB every store module uses)
  - the configured LLM provider (live ping for Ollama; config-presence check
    for hosted providers, since we don't want a health check to spend money
    on every admin page load)
  - Meta Marketing API configuration (app-level config + DRY_RUN state)
  - WhatsApp Cloud API configuration
  - the Knowledge Base's Chroma vector store path
  - local file storage

No network call blocks longer than a couple seconds; every check is wrapped
so one dependency being down doesn't 500 the whole page.
"""
import os
import time

import requests

from app import config
from app.db.base import get_conn
from app.db import admin_store


def _timed(fn):
    start = time.monotonic()
    try:
        ok, detail = fn()
    except Exception as e:
        ok, detail = False, str(e)
    latency_ms = int((time.monotonic() - start) * 1000)
    return ok, detail, latency_ms


def _check_database():
    def run():
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return True, "Connected via the shared Postgres pool (app/db/base.py)."
    return _timed(run)


def _check_llm_provider():
    def run():
        provider = config.LLM_PROVIDER
        if provider == "ollama":
            resp = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=3)
            resp.raise_for_status()
            return True, f"Ollama reachable at {config.OLLAMA_BASE_URL}."
        if provider == "anthropic":
            configured = bool(config.ANTHROPIC_API_KEY)
            return configured, ("ANTHROPIC_API_KEY is set." if configured else "ANTHROPIC_API_KEY is not set.")
        if provider == "openai":
            configured = bool(config.OPENAI_API_KEY)
            return configured, ("OPENAI_API_KEY is set." if configured else "OPENAI_API_KEY is not set.")
        return False, f"Unknown LLM_PROVIDER: {provider}"
    return _timed(run)


def _check_meta_api():
    def run():
        db_config = admin_store.get_meta_config()
        has_env = bool(config.META_APP_ID and config.META_APP_SECRET)
        has_db = bool(db_config and db_config.get("app_id"))
        if not has_env and not has_db:
            return False, "No Meta App ID/Secret configured (env or Admin CRM)."
        mode = "DRY-RUN (simulated, no real spend)" if config.META_DRY_RUN else "LIVE"
        return True, f"Meta App configured. Mode: {mode}."
    return _timed(run)


def _check_whatsapp():
    def run():
        cfg = admin_store.get_whatsapp_config()
        if not cfg or not cfg.get("phone_number_id"):
            return False, "WhatsApp not configured in Admin CRM yet."
        return True, "WhatsApp Cloud API config present."
    return _timed(run)


def _check_vector_store():
    def run():
        os.makedirs(config.CHROMA_PATH, exist_ok=True)
        writable = os.access(config.CHROMA_PATH, os.W_OK)
        return writable, f"Chroma path: {config.CHROMA_PATH} ({'writable' if writable else 'NOT writable'})."
    return _timed(run)


def _check_storage():
    def run():
        os.makedirs(config.STORAGE_PATH, exist_ok=True)
        writable = os.access(config.STORAGE_PATH, os.W_OK)
        return writable, f"Storage path: {config.STORAGE_PATH} ({'writable' if writable else 'NOT writable'})."
    return _timed(run)


def run_all_checks() -> list:
    checks = [
        ("LeadPilot Backend Server", lambda: (True, "Process is up and answering this request.", 0)),
        ("Postgres Database", _check_database),
        (f"LLM Provider ({config.LLM_PROVIDER})", _check_llm_provider),
        ("Meta Marketing API", _check_meta_api),
        ("WhatsApp Cloud API", _check_whatsapp),
        ("Knowledge Vector Store (Chroma)", _check_vector_store),
        ("Local File Storage", _check_storage),
    ]
    results = []
    for name, fn in checks:
        ok, detail, latency_ms = fn()
        results.append({
            "name": name,
            "status": "healthy" if ok else "degraded",
            "latency_ms": latency_ms,
            "detail": detail,
        })
    return results
