import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["STORAGE_PATH"] = "/tmp/leadspilot_support_test"
os.makedirs("/tmp/leadspilot_support_test", exist_ok=True)
db_file = "/tmp/leadspilot_support_test/leadspilot.db"
if os.path.exists(db_file):
    os.remove(db_file)

from app.db import support_store
from app.services import support_service

support_store.init_db()


def test_create_and_list_ticket():
    ticket_id = support_store.create_ticket("biz_sup1", "api_error", "Meta API timed out during launch.")
    ticket = support_store.get_ticket(ticket_id)
    assert ticket["status"] == "open"
    assert ticket["issue_type"] == "api_error"

    open_tickets = support_store.list_tickets(business_id="biz_sup1", status="open")
    assert any(t["id"] == ticket_id for t in open_tickets)


def test_resolve_ticket_sets_resolved_at():
    ticket_id = support_store.create_ticket("biz_sup2", "user_flagged", "Campaign preview looks wrong.")
    resolved = support_store.update_status(ticket_id, "resolved")
    assert resolved["status"] == "resolved"
    assert resolved["resolved_at"] is not None


def test_invalid_status_rejected():
    ticket_id = support_store.create_ticket("biz_sup3", "low_confidence_ai", "AI output seemed off.")
    try:
        support_store.update_status(ticket_id, "not_a_real_status")
        assert False, "expected ValueError for invalid status"
    except ValueError:
        pass


def test_resolve_nonexistent_ticket_raises():
    try:
        support_store.update_status("does-not-exist", "resolved")
        assert False, "expected LookupError"
    except LookupError:
        pass


def test_escalate_helper_never_raises():
    # support_service.escalate is deliberately best-effort — it must not raise
    # even if given garbage, because it's called from other modules' except blocks.
    ticket_id = support_service.escalate("biz_sup4", "api_error", "Something broke downstream.")
    assert ticket_id is not None
    ticket = support_store.get_ticket(ticket_id)
    assert ticket["business_id"] == "biz_sup4"


def test_multi_tenant_ticket_isolation():
    t1 = support_store.create_ticket("biz_sup_A", "api_error", "issue A")
    t2 = support_store.create_ticket("biz_sup_B", "api_error", "issue B")

    tickets_a = support_store.list_tickets(business_id="biz_sup_A")
    tickets_b = support_store.list_tickets(business_id="biz_sup_B")

    assert any(t["id"] == t1 for t in tickets_a)
    assert not any(t["id"] == t1 for t in tickets_b)
    assert any(t["id"] == t2 for t in tickets_b)


if __name__ == "__main__":
    test_create_and_list_ticket()
    test_resolve_ticket_sets_resolved_at()
    test_invalid_status_rejected()
    test_resolve_nonexistent_ticket_raises()
    test_escalate_helper_never_raises()
    test_multi_tenant_ticket_isolation()
    print("ALL support escalation tests passed")
