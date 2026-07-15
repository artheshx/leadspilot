"""
Postgres storage for the Approval Gate module (see app/db/base.py — this
uses the same shared Postgres database as the rest of the unified app).

GOLDEN RULE (from the product spec): no write-action on a client's ad account
ever executes without a logged human approval. This module is that gate:
- ai_campaign_drafts: strategy + creative + budget, sitting in "pending" until approved
- ai_approvals: an append-only audit log — rows are never updated or deleted
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_campaign_drafts (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL,
                strategy_json TEXT NOT NULL,
                creative_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_approvals (
                id TEXT PRIMARY KEY,
                draft_id TEXT NOT NULL REFERENCES ai_campaign_drafts(id),
                decision TEXT NOT NULL,          -- approved / rejected
                decided_by TEXT NOT NULL,
                reason TEXT,
                decided_at TEXT NOT NULL
            )
        """)
        # Phase 5 addition: a draft can optionally carry the landing page shown
        # alongside strategy + creative at Approval Gate #1. Uses
        # IF NOT EXISTS so existing databases upgrade in place without data loss.
        conn.execute("ALTER TABLE ai_campaign_drafts ADD COLUMN IF NOT EXISTS landing_page_json TEXT")


def create_draft(business_id: str, strategy: dict, creative: dict, landing_page: dict | None = None) -> str:
    draft_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_campaign_drafts (id, business_id, strategy_json, creative_json, landing_page_json, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, 'pending', ?)",
            (draft_id, business_id, json.dumps(strategy), json.dumps(creative),
             json.dumps(landing_page) if landing_page else None, _now()),
        )
    return draft_id


def get_draft(draft_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_campaign_drafts WHERE id = ?", (draft_id,)).fetchone()
    return _draft_row_to_dict(row) if row else None


def list_pending_drafts(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_campaign_drafts WHERE business_id = ? AND status = 'pending' ORDER BY created_at DESC",
            (business_id,),
        ).fetchall()
    return [_draft_row_to_dict(r) for r in rows]


def record_decision(draft_id: str, decision: str, decided_by: str, reason: str = None) -> dict:
    """
    The ONLY way a draft's status changes. Writes an append-only audit row
    (ai_approvals table is never updated or deleted from) then flips the draft's
    status. A draft that is already approved/rejected cannot be decided again
    — this is what makes the gate non-bypassable.
    """
    if decision not in ("approved", "rejected"):
        raise ValueError("decision must be 'approved' or 'rejected'")

    draft = get_draft(draft_id)
    if draft is None:
        raise LookupError(f"No such draft: {draft_id}")
    if draft["status"] != "pending":
        raise PermissionError(
            f"Draft {draft_id} already has a final decision ('{draft['status']}') — "
            f"cannot be re-decided. This is enforced to keep the approval log trustworthy."
        )

    approval_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_approvals (id, draft_id, decision, decided_by, reason, decided_at) VALUES (?, ?, ?, ?, ?, ?)",
            (approval_id, draft_id, decision, decided_by, reason, _now()),
        )
        conn.execute("UPDATE ai_campaign_drafts SET status = ? WHERE id = ?", (decision, draft_id))

    return {"approval_id": approval_id, "draft_id": draft_id, "decision": decision}


def mark_launched(draft_id: str) -> None:
    """Called only after a real (or dry-run) Meta campaign has been created.
    Refuses to run unless the draft's current status is exactly 'approved' —
    this is the second half of the launch safety gate, alongside the
    campaign_already_launched_for_draft() check in meta_store."""
    draft = get_draft(draft_id)
    if draft is None:
        raise LookupError(f"No such draft: {draft_id}")
    if draft["status"] != "approved":
        raise PermissionError(
            f"Draft {draft_id} has status '{draft['status']}', not 'approved' — refusing to mark as launched."
        )
    with _conn() as conn:
        conn.execute("UPDATE ai_campaign_drafts SET status = 'launched' WHERE id = ?", (draft_id,))


def get_audit_history(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT a.*, d.business_id FROM ai_approvals a
            JOIN ai_campaign_drafts d ON d.id = a.draft_id
            WHERE d.business_id = ?
            ORDER BY a.decided_at DESC
            """,
            (business_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def _draft_row_to_dict(row) -> dict:
    d = dict(row)
    d["strategy"] = json.loads(d.pop("strategy_json"))
    d["creative"] = json.loads(d.pop("creative_json"))
    lp_json = d.pop("landing_page_json", None)
    d["landing_page"] = json.loads(lp_json) if lp_json else None
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
