"""
Monitoring Module (Phase 6, Layer 6 part 1).
In production this is what n8n's scheduled job (every 6-24hr) calls per active
campaign. For this build there's no scheduler yet, so it's exposed as a plain
endpoint -- wire it to cron / n8n / a background task runner whenever you're
ready; the pull-and-store logic itself doesn't change.
"""
from app.db import meta_store, performance_store
from app.services import meta_ads_service


class MonitoringError(Exception):
    pass


def pull_and_store(campaign_id: str) -> dict:
    campaign = meta_store.get_campaign(campaign_id)
    if campaign is None:
        raise MonitoringError(f"No such campaign: {campaign_id}")

    business_id = campaign["business_id"]
    meta_account = meta_store.get_meta_account(business_id)
    if meta_account is None:
        raise MonitoringError(f"No Meta account connected for business_id={business_id}")

    metrics = meta_ads_service.get_insights(meta_account["access_token"], campaign["meta_campaign_id"])

    log_id = performance_store.insert_log(campaign_id, business_id, metrics)
    return {"log_id": log_id, "campaign_id": campaign_id, **metrics}
