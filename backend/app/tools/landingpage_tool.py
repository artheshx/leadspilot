from app.db import landingpage_store
from app.models import StrategyOutput, BrandKit
from app.services import landingpage_service
from app.tools.base import Tool


def _run(business_id: str, strategy: dict = None, brand: dict = None, draft_id: str = None, **_kwargs) -> dict:
    if not strategy:
        raise ValueError("strategy is required — call strategy_tool first.")
    strategy_obj = StrategyOutput(**strategy)
    brand_obj = BrandKit(**(brand or {"business_name": business_id}))

    template_id, content, file_path = landingpage_service.generate_landing_page(strategy_obj, brand_obj)
    page_id = landingpage_store.create_landing_page(
        business_id, template_id, content.model_dump(), file_path, draft_id=draft_id
    )
    return {
        "landing_page": {
            "id": page_id,
            "template_id": template_id,
            "content": content.model_dump(),
            "preview_url": f"/lp/{page_id}",
            "status": "draft",
        }
    }


TOOL = Tool(
    name="landing_page_tool",
    description=(
        "Selects the best landing page template for a strategy, fills it with AI-generated copy, "
        "and renders a draft preview (served at preview_url). Does not publicly publish by itself — "
        "publishing/pixel injection happens once the campaign draft is approved."
    ),
    args_schema={
        "strategy": "the strategy object returned by strategy_tool (object)",
        "brand": "optional brand kit (object)",
        "draft_id": "optional campaign draft id to link this page to, if one already exists (string)",
    },
    handler=_run,
)
