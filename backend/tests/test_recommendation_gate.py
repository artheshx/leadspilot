import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_rec_test"
os.environ["META_DRY_RUN"] = "true"
os.makedirs("/tmp/leadspilot_rec_test", exist_ok=True)
db_file = "/tmp/leadspilot_rec_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from app.db import recommendation_store, meta_store, performance_store

REC_PAUSE = {
    "type": "pause_creative",
    "reasoning": "CTR has been below 1% for 3 consecutive days, well under the 1.5% KPI target.",
    "suggested_change": {},
    "confidence": "high",
}
REC_BUDGET = {
    "type": "increase_budget",
    "reasoning": "CTR and conversions have been strong for 5 days; scaling budget should capture more leads.",
    "suggested_change": {"new_daily_budget_inr": 400},
    "confidence": "medium",
}

recommendation_store.init_db()
meta_store.init_db()
performance_store.init_db()


def test_full_lifecycle_approve_and_apply():
    rec_id = recommendation_store.create_recommendation("camp_1", "biz_rec1", REC_PAUSE)

    pending = recommendation_store.list_pending("biz_rec1")
    assert any(r["id"] == rec_id for r in pending)

    decision = recommendation_store.record_decision(rec_id, "approved", "owner@example.com")
    assert decision["decision"] == "approved"

    rec = recommendation_store.get_recommendation(rec_id)
    assert rec["status"] == "approved"

    # not applied yet -> still absent from pending, but not yet 'applied'
    recommendation_store.mark_applied(rec_id)
    rec_after = recommendation_store.get_recommendation(rec_id)
    assert rec_after["status"] == "applied"

    history = recommendation_store.get_decision_history("biz_rec1")
    assert len(history) == 1
    assert history[0]["decision"] == "approved"


def test_cannot_redecide_already_decided_recommendation():
    rec_id = recommendation_store.create_recommendation("camp_2", "biz_rec2", REC_BUDGET)
    recommendation_store.record_decision(rec_id, "rejected", "owner@example.com", reason="too aggressive")

    try:
        recommendation_store.record_decision(rec_id, "approved", "someone_else@example.com")
        assert False, "expected PermissionError — Golden Rule violated on Approval Gate #2!"
    except PermissionError:
        pass

    history = recommendation_store.get_decision_history("biz_rec2")
    assert len(history) == 1
    assert history[0]["decision"] == "rejected"


def test_cannot_apply_without_approval():
    rec_id = recommendation_store.create_recommendation("camp_3", "biz_rec3", REC_PAUSE)
    # never approved — still 'pending'
    try:
        recommendation_store.mark_applied(rec_id)
        assert False, "expected PermissionError — applied a non-approved recommendation!"
    except PermissionError:
        pass


def test_cannot_apply_twice():
    rec_id = recommendation_store.create_recommendation("camp_4", "biz_rec4", REC_BUDGET)
    recommendation_store.record_decision(rec_id, "approved", "owner@example.com")
    recommendation_store.mark_applied(rec_id)

    try:
        recommendation_store.mark_applied(rec_id)
        assert False, "expected PermissionError on second apply attempt"
    except PermissionError:
        pass


def test_rejected_recommendation_cannot_be_applied():
    rec_id = recommendation_store.create_recommendation("camp_5", "biz_rec5", REC_PAUSE)
    recommendation_store.record_decision(rec_id, "rejected", "owner@example.com")
    try:
        recommendation_store.mark_applied(rec_id)
        assert False, "expected PermissionError — a rejected recommendation must never be applied"
    except PermissionError:
        pass


if __name__ == "__main__":
    test_full_lifecycle_approve_and_apply()
    test_cannot_redecide_already_decided_recommendation()
    test_cannot_apply_without_approval()
    test_cannot_apply_twice()
    test_rejected_recommendation_cannot_be_applied()
    print("ALL recommendation gate (Approval Gate #2) tests passed")
