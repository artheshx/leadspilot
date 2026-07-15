from app.services import business_service
from app.tools.base import Tool


def _run(business_id: str, business_prompt: str = "", **_kwargs) -> dict:
    if not business_prompt:
        raise ValueError("business_prompt is required — pass the user's business description.")
    profile = business_service.analyze_business(business_id, business_prompt)
    return {"business_profile": profile.model_dump()}


TOOL = Tool(
    name="business_analysis_tool",
    description=(
        "Analyzes a free-text business description to determine business type, niche, primary "
        "goal, and target customer, and automatically saves the result to memory. Use this the "
        "first time a business describes itself, or when its description has clearly changed. "
        "Skip it if the business profile is already present in memory."
    ),
    args_schema={
        "business_prompt": "the user's description of their business, verbatim or lightly cleaned up (string)",
    },
    handler=_run,
)
