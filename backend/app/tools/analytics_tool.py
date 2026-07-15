from app.db import approval_store, meta_store, performance_store, recommendation_store
from app.services import monitoring_service, recommendation_service
from app.tools.base import Tool


def _run(business_id: str, action: str = "get_performance", campaign_id: str = None, **_kwargs) -> dict:
    if action == "pull_insights":
        if not campaign_id:
            raise ValueError("campaign_id is required for action='pull_insights'.")
        return {"pulled": monitoring_service.pull_and_store(campaign_id)}

    if action == "get_performance":
        if not campaign_id:
            campaigns = meta_store.list_campaigns(business_id)
            if not campaigns:
                return {"campaigns": [], "note": "No campaigns launched yet for this business."}
            return {"campaigns": campaigns}
        return {"logs": performance_store.list_logs(campaign_id, limit=14)}

    if action == "get_recommendation":
        if not campaign_id:
            raise ValueError("campaign_id is required for action='get_recommendation'.")
        campaign = meta_store.get_campaign(campaign_id)
        if campaign is None:
            raise LookupError(f"No such campaign: {campaign_id}")
        draft = approval_store.get_draft(campaign["draft_id"])
        if draft is None:
            raise LookupError("Could not find the originating strategy for this campaign.")
        logs = performance_store.list_logs(campaign_id, limit=14)
        if not logs:
            raise ValueError("No performance data yet — use action='pull_insights' first.")

        rec = recommendation_service.generate_recommendation(draft["strategy"], logs)
        rec_id = recommendation_store.create_recommendation(campaign_id, business_id, rec.model_dump())
        return {"recommendation_id": rec_id, "status": "pending_approval", **rec.model_dump()}

    raise ValueError(
        f"Unknown analytics_tool action '{action}'. Supported: pull_insights, get_performance, get_recommendation."
    )


TOOL = Tool(
    name="analytics_tool",
    description=(
        "Reads campaign performance (impressions/CTR/CPC/spend/conversions) and generates "
        "pause/budget/targeting recommendations. actions: 'pull_insights' (campaign_id) pulls a "
        "fresh snapshot from Meta; 'get_performance' (campaign_id optional — omit to list all "
        "campaigns) reads stored logs; 'get_recommendation' (campaign_id) reasons over recent logs "
        "and stages a recommendation. Recommendations are never auto-applied — after the user "
        "approves, call meta_ads_tool action='apply_recommendation'."
    ),
    args_schema={
        "action": "pull_insights|get_performance|get_recommendation (string)",
        "campaign_id": "campaign id, required for pull_insights and get_recommendation (string)",
    },
    handler=_run,
)
