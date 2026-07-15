"""
Business Analysis Engine (Business Analysis Tool).
Reads a free-text business description and turns it into a structured
profile, then persists it via the Memory store so every other tool/turn can
use it without the user repeating themselves.
"""
from pydantic import ValidationError

from app.models import BusinessProfile
from app.services import llm_service
from app.db import memory_store

SYSTEM_PROMPT = """You are LeadsPilot's Business Analysis engine. Given a short description of a \
small business, produce ONE JSON object — nothing else — with exactly these fields:

{
  "business_name": string or null (only if a name is clearly given),
  "business_type": string (e.g. "local service", "ecommerce", "coaching", "restaurant"),
  "niche": string (specific niche, e.g. "home cleaning services in Indore"),
  "primary_goal": string (best guess at what the owner wants: "more leads", "more sales", "brand awareness", etc.),
  "target_customer": string (best guess at who buys from them),
  "notes": string or null (anything else useful for a Meta Ads strategist to know)
}

Respond with ONLY the JSON object. No prose, no markdown fences."""


def analyze_business(business_id: str, business_prompt: str, max_validation_retries: int = 2) -> BusinessProfile:
    prompt = f"Business description:\n\"{business_prompt}\"\n\nProduce the JSON business profile now."

    last_error = None
    profile = None
    for _ in range(max_validation_retries + 1):
        raw_json = llm_service.chat_json(prompt, system=SYSTEM_PROMPT)
        try:
            profile = BusinessProfile(**raw_json)
            break
        except ValidationError as e:
            last_error = e
            prompt = (
                f"{prompt}\n\nYour previous JSON failed validation with this error:\n{e}\n"
                f"Fix the fields and return a corrected JSON object only."
            )

    if profile is None:
        raise ValueError(f"Business analysis failed validation after retries: {last_error}")

    memory_store.update_memory(business_id, {
        "business_profile": profile.model_dump(),
        "raw_business_prompt": business_prompt,
    })
    return profile
