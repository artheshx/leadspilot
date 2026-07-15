import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_meta_test"
os.environ["META_DRY_RUN"] = "true"
os.makedirs("/tmp/leadspilot_meta_test", exist_ok=True)
db_file = "/tmp/leadspilot_meta_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from app.db import approval_store, meta_store
from app.services import meta_ads_service
from app.services.meta_ads_service import MetaAdsError

STRATEGY = {
    "business_type": "home bakery", "target_audience": "women 25-45 Indore",
    "goal": "lead generation", "budget_suggestion_inr": 9000, "tone": "friendly",
    "creative_direction": "custom cake close-up", "landing_page_type": "lead-gen-local-service",
    "kpis": ["CTR > 1.5%"],
}
CREATIVE = {"image_path": "/tmp/fake.png", "headline": "Custom Cakes, Made With Love",
            "primary_text": "Order your dream cake today.", "cta": "Contact Us"}

approval_store.init_db()
meta_store.init_db()


def test_dry_run_launch_full_flow():
    draft_id = approval_store.create_draft("biz_meta1", STRATEGY, CREATIVE)
    approval_store.record_decision(draft_id, "approved", "owner@example.com")
    meta_store.save_meta_account("biz_meta1", "act_test", "fake_token", ["ads_management"])

    account = meta_store.get_meta_account("biz_meta1")
    result = meta_ads_service.launch_campaign(account["access_token"], account["ad_account_id"], STRATEGY, CREATIVE)
    assert result["campaign_id"].startswith("dryrun_campaign_")
    assert result["adset_id"].startswith("dryrun_adset_")
    assert result["ad_id"].startswith("dryrun_ad_")
    assert abs(result["daily_budget_inr"] - 9000 / 30) < 0.01

    campaign_id = meta_store.save_campaign("biz_meta1", draft_id, result, result["name"], result["objective"],
                                            result["daily_budget_inr"], dry_run=True)
    approval_store.mark_launched(draft_id)

    draft = approval_store.get_draft(draft_id)
    assert draft["status"] == "launched"

    campaigns = meta_store.list_campaigns("biz_meta1")
    assert len(campaigns) == 1
    assert campaigns[0]["id"] == campaign_id


def test_cannot_mark_launched_without_prior_approval():
    draft_id = approval_store.create_draft("biz_meta2", STRATEGY, CREATIVE)
    # never approved — still 'pending'
    try:
        approval_store.mark_launched(draft_id)
        assert False, "expected PermissionError — launched a non-approved draft!"
    except PermissionError:
        pass


def test_cannot_double_launch_same_draft():
    draft_id = approval_store.create_draft("biz_meta3", STRATEGY, CREATIVE)
    approval_store.record_decision(draft_id, "approved", "owner@example.com")
    meta_store.save_meta_account("biz_meta3", "act_test3", "fake_token", ["ads_management"])
    account = meta_store.get_meta_account("biz_meta3")

    result = meta_ads_service.launch_campaign(account["access_token"], account["ad_account_id"], STRATEGY, CREATIVE)
    meta_store.save_campaign("biz_meta3", draft_id, result, result["name"], result["objective"],
                              result["daily_budget_inr"], dry_run=True)
    approval_store.mark_launched(draft_id)

    # simulate the router's guard: check before attempting a second launch
    assert meta_store.campaign_already_launched_for_draft(draft_id) is True
    # and mark_launched itself should now refuse (status is 'launched', not 'approved')
    try:
        approval_store.mark_launched(draft_id)
        assert False, "expected PermissionError on second launch attempt"
    except PermissionError:
        pass


def test_budget_safety_cap_enforced_at_launch_layer():
    bad_strategy = dict(STRATEGY, budget_suggestion_inr=999999)  # pretend it slipped past the schema somehow
    try:
        meta_ads_service.launch_campaign("fake_token", "act_test", bad_strategy, CREATIVE)
        assert False, "expected MetaAdsError — budget cap should block launch"
    except MetaAdsError as e:
        assert "safety cap" in str(e)


if __name__ == "__main__":
    test_dry_run_launch_full_flow()
    test_cannot_mark_launched_without_prior_approval()
    test_cannot_double_launch_same_draft()
    test_budget_safety_cap_enforced_at_launch_layer()
    print("ALL meta ads launch gate tests passed")
