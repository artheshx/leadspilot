import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_manager_test"
os.environ["META_DRY_RUN"] = "true"
os.makedirs("/tmp/leadspilot_manager_test", exist_ok=True)
db_file = "/tmp/leadspilot_manager_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from unittest.mock import patch

from app.db import (
    approval_store, meta_store, memory_store, conversation_store,
    pending_action_store, landingpage_store,
)
from app.manager import ai_manager

for store in (approval_store, meta_store, memory_store, conversation_store, pending_action_store, landingpage_store):
    store.init_db()

BUSINESS_ID = "biz_manager_test"

STRATEGY = {
    "business_type": "home bakery", "target_audience": "women 25-45 Indore",
    "goal": "lead generation", "budget_suggestion_inr": 8000, "tone": "friendly",
    "creative_direction": "custom cake close-up", "landing_page_type": "lead-gen-local-service",
    "kpis": ["CTR > 1.5%"],
}
CREATIVE = {"image_path": "/tmp/fake.png", "headline": "Custom Cakes, Made With Love",
            "primary_text": "Order your dream cake today.", "cta": "Contact Us"}
PROFILE = {
    "business_name": "Sweet Treats Bakery", "business_type": "home bakery",
    "niche": "custom cakes in Indore", "primary_goal": "more leads",
    "target_customer": "women 25-45 planning celebrations", "notes": None,
}


def _make_llm_router(manager_decisions):
    """business_service / strategy_service / creative_service / ai_manager all
    call the SAME app.services.llm_service.chat_json — so one router, keyed
    on a snippet of the system prompt, stands in for all of them."""
    decisions = iter(manager_decisions)

    def fake_chat_json(prompt, system=None, **kwargs):
        system = system or ""
        if "Business Analysis engine" in system:
            return PROFILE
        if "Strategy Engine" in system:
            return STRATEGY
        if "ad copywriter" in system:
            return {"headline": CREATIVE["headline"], "primary_text": CREATIVE["primary_text"], "cta": CREATIVE["cta"]}
        if "LeadPilot AI Manager" in system:
            return next(decisions)
        raise AssertionError(f"Unexpected system prompt in test: {system[:80]}")

    return fake_chat_json


def test_manager_stages_and_launches_campaign_only_after_explicit_approval():
    # Turn 1: user describes their business and asks for more leads.
    decisions_turn1 = [
        {"thought": "New business, analyze it first.", "action": "call_tool",
         "tool": "business_analysis_tool", "args": {"business_prompt": "I run a home bakery in Indore, want more leads"}},
        {"thought": "Have a profile now, generate a strategy.", "action": "call_tool",
         "tool": "strategy_tool", "args": {"business_prompt": "I run a home bakery in Indore, want more leads"}},
        {"thought": "Now generate creative.", "action": "call_tool",
         "tool": "creative_tool", "args": {"strategy": STRATEGY, "brand": {"business_name": "Sweet Treats Bakery"}}},
        {"thought": "Stage the campaign for approval.", "action": "call_tool",
         "tool": "meta_ads_tool", "args": {"action": "stage_campaign", "strategy": STRATEGY, "creative": CREATIVE}},
        {"thought": "Summarize and ask for approval.", "action": "final_response",
         "message": "Here's your campaign plan — ₹8000/month, lead generation. Shall I launch it?"},
    ]

    with patch("app.services.llm_service.chat_json", side_effect=_make_llm_router(decisions_turn1)), \
         patch("app.services.creative_service._generate_base_image") as mock_img:
        from PIL import Image
        mock_img.return_value = Image.new("RGBA", (64, 64))

        result1 = ai_manager.run_turn(BUSINESS_ID, "I run a home bakery in Indore, want more leads", include_trace=True)

    assert not result1.awaiting_user or "launch" in result1.message.lower() or "shall" in result1.message.lower()
    assert "launch" in result1.message.lower() or "campaign" in result1.message.lower()

    # Memory should now have the business profile stored automatically.
    memory = memory_store.get_memory(BUSINESS_ID)
    assert memory["business_profile"]["business_type"] == "home bakery"

    # A draft should exist and be pending — nothing launched yet.
    pending_drafts = approval_store.list_pending_drafts(BUSINESS_ID)
    assert len(pending_drafts) == 1
    draft_id = pending_drafts[0]["id"]
    assert meta_store.list_campaigns(BUSINESS_ID) == []

    # Turn 2: user explicitly approves. Manager should call approve_and_launch.
    decisions_turn2 = [
        {"thought": "User approved, launch it.", "action": "call_tool",
         "tool": "meta_ads_tool", "args": {"action": "approve_and_launch", "draft_id": draft_id, "decided_by": "owner@example.com"}},
        {"thought": "Confirm to the user.", "action": "final_response",
         "message": "Your campaign is live (simulated in dry-run mode)."},
    ]

    # meta_ads_tool needs a connected account first.
    meta_store.save_meta_account(BUSINESS_ID, "act_123", "dryrun_token_abc", ["ads_management"])

    with patch("app.services.llm_service.chat_json", side_effect=_make_llm_router(decisions_turn2)):
        result2 = ai_manager.run_turn(BUSINESS_ID, "Yes, go ahead and launch it", include_trace=True)

    assert "live" in result2.message.lower()
    campaigns = meta_store.list_campaigns(BUSINESS_ID)
    assert len(campaigns) == 1
    draft = approval_store.get_draft(draft_id)
    assert draft["status"] == "launched"


def test_manager_gates_mutating_meta_action_behind_confirmation():
    biz_id = "biz_manager_test_pause"
    meta_store.save_meta_account(biz_id, "act_999", "dryrun_token_xyz", ["ads_management"])

    # Stage a pause without confirming.
    stage_decision = [
        {"thought": "Stage a pause.", "action": "call_tool",
         "tool": "meta_ads_tool", "args": {"action": "pause_campaign", "campaign_id": "fake_campaign_id"}},
        {"thought": "Ask for confirmation.", "action": "final_response",
         "message": "I'm ready to pause this campaign — confirm?"},
    ]
    with patch("app.services.llm_service.chat_json", side_effect=_make_llm_router(stage_decision)):
        result = ai_manager.run_turn(biz_id, "Pause my campaign", include_trace=True)

    assert "confirm" in result.message.lower() or "pause" in result.message.lower()
    pending = pending_action_store.list_pending(biz_id)
    assert len(pending) == 1
    assert pending[0]["action"] == "pause_campaign"
    assert pending[0]["status"] == "pending"
