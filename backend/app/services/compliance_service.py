"""
Compliance Engine (Compliance Tool).
Checks ad copy / landing page copy against Meta Ads policy risk areas before
anything is staged for launch. LLM-reasoning based, augmented with any policy
notes present in a shared 'meta_policies' knowledge base collection if the
team has ingested Meta's own policy docs there via the Knowledge Tool's
underlying ingest endpoint.
"""
from pydantic import ValidationError

from app.models import ComplianceResult
from app.services import llm_service, rag_service

POLICY_KB_ID = "meta_policies"  # shared, non-business-specific collection

SYSTEM_PROMPT = """You are LeadsPilot's Compliance Engine, an expert on Meta (Facebook/Instagram) \
Ads policies. Given ad copy and/or landing page copy, flag anything that risks ad rejection or \
account restriction — especially: personal attribute claims/targeting ("are you struggling with X"), \
prohibited or unrealistic claims (before/after, guaranteed income/health results), misleading \
pricing, restricted categories (alcohol, gambling, financial services, healthcare, weight loss), \
and generally deceptive or clickbait phrasing. Produce ONE JSON object — nothing else — with \
exactly these fields:

{
  "risk_level": string (one of "low", "medium", "high"),
  "issues": array of short strings, one per concern (empty array if none),
  "safer_alternatives": array of short rewritten suggestions addressing the flagged issues (empty array if none),
  "rejection_risk_estimate": string (a short plain-language estimate, e.g. "low - no major concerns", "moderate - reword the health claim", "high - likely rejected as-is")
}

Be proportionate: everyday small-business ad copy with no red flags should get risk_level "low" \
and empty issues/safer_alternatives arrays. Respond with ONLY the JSON object. No prose, no markdown fences."""


def check_compliance(text_fields: dict, max_validation_retries: int = 2) -> ComplianceResult:
    if not any(v for v in text_fields.values()):
        raise ValueError("No text fields provided to check for compliance.")

    content = "\n".join(f"{k}: {v}" for k, v in text_fields.items() if v)
    reference = _reference_notes()
    prompt = (
        f"Ad/landing page content to review:\n{content}\n\n"
        f"Relevant policy notes (if any):\n{reference}\n\n"
        f"Produce the JSON compliance review now."
    )

    last_error = None
    for _ in range(max_validation_retries + 1):
        raw_json = llm_service.chat_json(prompt, system=SYSTEM_PROMPT)
        try:
            return ComplianceResult(**raw_json)
        except ValidationError as e:
            last_error = e
            prompt = (
                f"{prompt}\n\nYour previous JSON failed validation with this error:\n{e}\n"
                f"Fix the fields and return a corrected JSON object only."
            )

    raise ValueError(f"Compliance check failed validation after retries: {last_error}")


def _reference_notes() -> str:
    try:
        chunks = rag_service.retrieve(POLICY_KB_ID, "Meta ads policy risky content", top_k=3)
    except Exception:
        chunks = []
    return "\n---\n".join(chunks) if chunks else (
        "(No custom policy documents uploaded to the shared policy knowledge base — "
        "using general Meta Ads policy knowledge.)"
    )
