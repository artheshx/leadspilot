from app.models import StrategyOutput, BrandKit
from app.services import creative_service
from app.tools.base import Tool


def _run(business_id: str, strategy: dict = None, brand: dict = None, **_kwargs) -> dict:
    if not strategy:
        raise ValueError("strategy is required — call strategy_tool first.")
    strategy_obj = StrategyOutput(**strategy)
    brand_obj = BrandKit(**(brand or {"business_name": business_id}))
    creative = creative_service.generate_creative(strategy_obj, brand_obj)
    return {"creative": creative.model_dump()}


TOOL = Tool(
    name="creative_tool",
    description=(
        "Generates ad creative for a strategy + brand: an on-brand image, headline, primary "
        "text, and CTA. Requires the strategy object produced by strategy_tool."
    ),
    args_schema={
        "strategy": "the strategy object returned by strategy_tool (object)",
        "brand": "optional brand kit: business_name, logo_path, primary_color, secondary_color (object)",
    },
    handler=_run,
)
