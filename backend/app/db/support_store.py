"""
Storage for the Support Escalation module (Phase 7 / Layer 7 "Safety Net").
Tickets are created automatically on API failures or low-confidence AI output,
and can also be filed directly by a user ("I'm stuck, help").
"""
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_support_tickets (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL,
                campaign_id TEXT,
                issue_type TEXT NOT NULL,        -- api_error / low_confidence_ai / user_flagged
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',  -- open / in_progress / resolved
                created_at TEXT NOT NULL,
                resolved_at TEXT
            )
        """)


def create_ticket(business_id: str, issue_type: str, description: str, campaign_id: str = None) -> str:
    ticket_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_support_tickets (id, business_id, campaign_id, issue_type, description, "
            "status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
            (ticket_id, business_id, campaign_id, issue_type, description, _now()),
        )
    return ticket_id


def get_ticket(ticket_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_support_tickets WHERE id = ?", (ticket_id,)).fetchone()
    return dict(row) if row else None


def list_tickets(business_id: str = None, status: str = None) -> list:
    query = "SELECT * FROM ai_support_tickets WHERE 1=1"
    params = []
    if business_id:
        query += " AND business_id = ?"
        params.append(business_id)
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY created_at DESC"
    with _conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def update_status(ticket_id: str, status: str) -> dict:
    if status not in ("open", "in_progress", "resolved"):
        raise ValueError("status must be one of open/in_progress/resolved")
    ticket = get_ticket(ticket_id)
    if ticket is None:
        raise LookupError(f"No such ticket: {ticket_id}")

    with _conn() as conn:
        if status == "resolved":
            conn.execute(
                "UPDATE ai_support_tickets SET status = ?, resolved_at = ? WHERE id = ?",
                (status, _now(), ticket_id),
            )
        else:
            conn.execute("UPDATE ai_support_tickets SET status = ? WHERE id = ?", (status, ticket_id))
    return get_ticket(ticket_id)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
