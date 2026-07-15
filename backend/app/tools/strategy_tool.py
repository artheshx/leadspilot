from app.services import strategy_service
from app.tools.base import Tool


def _run(business_id: str, business_prompt: str = "", **_kwargs) -> dict:
    if not business_prompt:
        raise ValueError("business_prompt is required to generate a strategy.")
    strategy = strategy_service.generate_strategy(business_id, business_prompt)
    return {"strategy": strategy.model_dump()}


TOOL = Tool(
    name="strategy_tool",
    description=(
        "Produces a structured Meta Ads strategy: campaign objective, target audience, "
        "budget recommendation, tone, creative direction, landing page type, and KPIs. "
        "Needs a business description (reuse the one already in memory if available)."
    ),
    args_schema={
        "business_prompt": "business description to strategize for (string)",
    },
    handler=_run,
)
