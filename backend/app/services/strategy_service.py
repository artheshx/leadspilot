"""
Strategy Engine (Layer 2: AI Reasoning).
Business prompt + KB retrieval -> structured campaign strategy (validated JSON).
"""
from pydantic import ValidationError

from app.models import StrategyOutput
from app.services import llm_service, rag_service

SYSTEM_PROMPT = """You are LeadsPilot's Strategy Engine, an expert Meta Ads strategist for \
small businesses in India. Given a business description and (optionally) reference strategy \
notes, produce ONE JSON object — nothing else — with exactly these fields:

{
  "business_type": string,
  "target_audience": string (be specific: age range, location, interests),
  "goal": string (one of: "lead generation", "sales", "awareness", "store visits"),
  "budget_suggestion_inr": integer (monthly, between 3000 and 100000, realistic for a small business),
  "tone": string (e.g. "friendly", "premium", "urgent", "playful"),
  "creative_direction": string (a short, concrete visual description usable as an image-gen prompt),
  "landing_page_type": string (one of: "lead-gen-local-service", "ecommerce-product", "coaching-signup"),
  "kpis": array of 2-4 short strings (e.g. "CTR > 1.5%", "CPC under 15 INR")
}

Respond with ONLY the JSON object. No prose, no markdown fences."""


def generate_strategy(business_id: str, business_prompt: str, max_validation_retries: int = 2) -> StrategyOutput:
    kb_chunks = rag_service.retrieve(business_id, business_prompt)
    kb_context = "\n---\n".join(kb_chunks) if kb_chunks else "(No uploaded strategy notes — use general Meta Ads best practices for Indian SMBs.)"

    user_prompt = (
        f"Business description:\n\"{business_prompt}\"\n\n"
        f"Reference strategy notes (from this client's knowledge base):\n{kb_context}\n\n"
        f"Produce the JSON strategy object now."
    )

    last_error = None
    for attempt in range(max_validation_retries + 1):
        raw_json = llm_service.chat_json(user_prompt, system=SYSTEM_PROMPT)
        try:
            return StrategyOutput(**raw_json)
        except ValidationError as e:
            last_error = e
            user_prompt = (
                f"{user_prompt}\n\nYour previous JSON failed validation with this error:\n{e}\n"
                f"Fix the fields and return a corrected JSON object only."
            )

    raise ValueError(f"Strategy generation failed validation after retries: {last_error}")
