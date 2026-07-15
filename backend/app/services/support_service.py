"""
Support Escalation (Layer 7 — Safety Net).

`escalate()` is called from other routers whenever something goes wrong that a
non-technical business owner shouldn't have to debug themselves: a Meta API
failure, a low-confidence/failed AI generation, etc. It is deliberately
best-effort and swallows its own errors — a broken support-ticket write must
never be the thing that turns an already-handled error into an unhandled 500.
"""
from app.db import support_store


def escalate(business_id: str, issue_type: str, description: str, campaign_id: str = None) -> str | None:
    try:
        return support_store.create_ticket(business_id, issue_type, description, campaign_id)
    except Exception:
        # Best-effort: never let ticket creation itself crash the calling request.
        return None
