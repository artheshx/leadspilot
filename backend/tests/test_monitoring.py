import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_mon_test"
os.environ["META_DRY_RUN"] = "true"
os.makedirs("/tmp/leadspilot_mon_test", exist_ok=True)
db_file = "/tmp/leadspilot_mon_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from app.db import meta_store, performance_store, approval_store
from app.services import meta_ads_service, monitoring_service
from app.services.monitoring_service import MonitoringError

meta_store.init_db()
performance_store.init_db()
approval_store.init_db()

STRATEGY = {
    "business_type": "home bakery", "target_audience": "women 25-45 Indore",
    "goal": "lead generation", "budget_suggestion_inr": 9000, "tone": "friendly",
    "creative_direction": "custom cake close-up", "landing_page_type": "lead-gen-local-service",
    "kpis": ["CTR > 1.5%"],
}
CREATIVE = {"image_path": "/tmp/fake.png", "headline": "Custom Cakes, Made With Love",
            "primary_text": "Order your dream cake today.", "cta": "Contact Us"}


def _make_launched_campaign(business_id: str) -> str:
    draft_id = approval_store.create_draft(business_id, STRATEGY, CREATIVE)
    approval_store.record_decision(draft_id, "approved", "owner@example.com")
    meta_store.save_meta_account(business_id, "act_test", "fake_token", ["ads_management"])
    result = {
        "campaign_id": "dryrun_campaign_abc", "adset_id": "dryrun_adset_abc", "ad_id": "dryrun_ad_abc",
        "name": "Test Campaign", "objective": "OUTCOME_LEADS", "daily_budget_inr": 300.0,
    }
    campaign_id = meta_store.save_campaign(business_id, draft_id, result, result["name"],
                                            result["objective"], result["daily_budget_inr"], dry_run=True)
    approval_store.mark_launched(draft_id)
    return campaign_id


def test_get_insights_dry_run_shape():
    metrics = meta_ads_service.get_insights("fake_token", "dryrun_campaign_abc")
    for key in ("impressions", "clicks", "ctr", "cpc", "spend", "conversions"):
        assert key in metrics
    assert metrics["impressions"] >= 0
    assert metrics["clicks"] >= 1  # dry run always simulates at least one click


def test_pull_and_store_appends_log():
    campaign_id = _make_launched_campaign("biz_mon1")

    result = monitoring_service.pull_and_store(campaign_id)
    assert result["campaign_id"] == campaign_id
    assert "log_id" in result

    logs = performance_store.list_logs(campaign_id)
    assert len(logs) == 1
    assert logs[0]["campaign_id"] == campaign_id

    # a second pull appends, it does not overwrite
    monitoring_service.pull_and_store(campaign_id)
    logs_after = performance_store.list_logs(campaign_id)
    assert len(logs_after) == 2


def test_pull_for_unknown_campaign_raises():
    try:
        monitoring_service.pull_and_store("does-not-exist")
        assert False, "expected MonitoringError"
    except MonitoringError:
        pass


def test_pause_and_budget_update_dry_run():
    result = meta_ads_service.pause_campaign("fake_token", "dryrun_campaign_abc")
    assert result["status"] == "PAUSED"
    assert result["dry_run"] is True

    result2 = meta_ads_service.update_adset_daily_budget("fake_token", "dryrun_adset_abc", 450.0)
    assert result2["daily_budget_inr"] == 450.0
    assert result2["dry_run"] is True


if __name__ == "__main__":
    test_get_insights_dry_run_shape()
    test_pull_and_store_appends_log()
    test_pull_for_unknown_campaign_raises()
    test_pause_and_budget_update_dry_run()
    print("ALL monitoring module tests passed")
