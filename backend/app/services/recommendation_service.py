"""
Recommendation Engine (Phase 6, Layer 6 part 2).
Compares recent performance_logs against the campaign's own strategy_json
(KPIs, goal, tone) and produces a plain-language recommendation. Never applies
anything itself — Approval Gate #2 (recommendation_store + monitoring router)
is what stands between this and the Meta API.
"""
from pydantic import ValidationError

from app.models import RecommendationOutput
from app.services import llm_service

SYSTEM_PROMPT = """You are LeadsPilot's Recommendation Engine, an expert Meta Ads analyst. \
Given a campaign's strategy (including its target KPIs) and its recent daily performance logs, \
decide whether any change should be recommended. Produce ONE JSON object — nothing else — with \
exactly these fields:

{
  "type": string (one of: "pause_creative", "increase_budget", "decrease_budget", "change_targeting", "no_action"),
  "reasoning": string (plain language a non-technical business owner can understand — 1-3 sentences, cite the actual numbers),
  "suggested_change": object (concrete parameters for the change, e.g. {"new_daily_budget_inr": 350} or {} for no_action/pause_creative),
  "confidence": string (one of: "low", "medium", "high")
}

Be conservative: only recommend "pause_creative" if CTR has clearly and repeatedly underperformed \
the KPI target, and only recommend budget changes if there's a clear, sustained signal in the data. \
When the data is thin (fewer than 3 days) or mixed, prefer "no_action" with low/medium confidence \
rather than guessing. Respond with ONLY the JSON object. No prose, no markdown fences."""


def generate_recommendation(strategy: dict, logs: list, max_validation_retries: int = 2) -> RecommendationOutput:
    if not logs:
        raise ValueError("No performance logs available yet — pull insights before requesting a recommendation.")

    logs_summary = "\n".join(
        f"- {l['date']}: impressions={l['impressions']}, clicks={l['clicks']}, ctr={l['ctr']}%, "
        f"cpc=₹{l['cpc']}, spend=₹{l['spend']}, conversions={l['conversions']}"
        for l in logs
    )

    prompt = (
        f"Business type: {strategy.get('business_type')}\n"
        f"Goal: {strategy.get('goal')}\n"
        f"Target KPIs: {', '.join(strategy.get('kpis', []))}\n"
        f"Monthly budget: ₹{strategy.get('budget_suggestion_inr')}\n\n"
        f"Recent performance logs (most recent first):\n{logs_summary}\n\n"
        f"Produce the JSON recommendation now."
    )

    last_error = None
    for _ in range(max_validation_retries + 1):
        raw_json = llm_service.chat_json(prompt, system=SYSTEM_PROMPT)
        try:
            return RecommendationOutput(**raw_json)
        except ValidationError as e:
            last_error = e
            prompt = (
                f"{prompt}\n\nYour previous JSON failed validation with this error:\n{e}\n"
                f"Fix the fields and return a corrected JSON object only."
            )

    raise ValueError(f"Recommendation generation failed validation after retries: {last_error}")
