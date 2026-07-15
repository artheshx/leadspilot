import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_approval_test"
os.makedirs("/tmp/leadspilot_approval_test", exist_ok=True)
db_file = "/tmp/leadspilot_approval_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from app.db import approval_store

STRATEGY = {
    "business_type": "home bakery", "target_audience": "women 25-45 Indore",
    "goal": "lead generation", "budget_suggestion_inr": 8000, "tone": "friendly",
    "creative_direction": "custom cake close-up", "landing_page_type": "lead-gen-local-service",
    "kpis": ["CTR > 1.5%"],
}
CREATIVE = {"image_path": "/tmp/fake.png", "headline": "Custom Cakes, Made With Love",
            "primary_text": "Order your dream cake today.", "cta": "Contact Us"}


def test_full_lifecycle_approve():
    approval_store.init_db()
    draft_id = approval_store.create_draft("biz_test1", STRATEGY, CREATIVE)

    pending = approval_store.list_pending_drafts("biz_test1")
    assert any(d["id"] == draft_id for d in pending)

    result = approval_store.record_decision(draft_id, "approved", "owner@example.com")
    assert result["decision"] == "approved"

    draft = approval_store.get_draft(draft_id)
    assert draft["status"] == "approved"

    pending_after = approval_store.list_pending_drafts("biz_test1")
    assert not any(d["id"] == draft_id for d in pending_after)

    history = approval_store.get_audit_history("biz_test1")
    assert len(history) == 1
    assert history[0]["decision"] == "approved"
    assert history[0]["decided_by"] == "owner@example.com"


def test_cannot_redecide_already_decided_draft():
    approval_store.init_db()
    draft_id = approval_store.create_draft("biz_test2", STRATEGY, CREATIVE)
    approval_store.record_decision(draft_id, "rejected", "owner@example.com", reason="wrong tone")

    try:
        approval_store.record_decision(draft_id, "approved", "someone_else@example.com")
        assert False, "expected PermissionError — Golden Rule violated!"
    except PermissionError:
        pass

    # audit log must still show exactly one entry (the original rejection), not two
    history = approval_store.get_audit_history("biz_test2")
    assert len(history) == 1
    assert history[0]["decision"] == "rejected"
    assert history[0]["reason"] == "wrong tone"


def test_decide_on_nonexistent_draft_raises():
    approval_store.init_db()
    try:
        approval_store.record_decision("does-not-exist", "approved", "someone@example.com")
        assert False, "expected LookupError"
    except LookupError:
        pass


def test_multi_tenant_isolation():
    approval_store.init_db()
    d1 = approval_store.create_draft("biz_A", STRATEGY, CREATIVE)
    d2 = approval_store.create_draft("biz_B", STRATEGY, CREATIVE)

    pending_a = approval_store.list_pending_drafts("biz_A")
    pending_b = approval_store.list_pending_drafts("biz_B")

    assert any(d["id"] == d1 for d in pending_a)
    assert not any(d["id"] == d1 for d in pending_b)
    assert any(d["id"] == d2 for d in pending_b)
    assert not any(d["id"] == d2 for d in pending_a)


if __name__ == "__main__":
    test_full_lifecycle_approve()
    test_cannot_redecide_already_decided_draft()
    test_decide_on_nonexistent_draft_raises()
    test_multi_tenant_isolation()
    print("ALL approval gate tests passed")
