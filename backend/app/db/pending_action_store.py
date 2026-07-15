"""
Generic human-approval gate for AI-Manager-triggered Meta Ads write actions
that aren't already covered by ai_campaign_drafts (initial launch) or
ai_recommendations (performance-driven changes) — e.g. a user asking mid-chat
to "pause campaign X" or "create a pixel".

Same Golden Rule as approval_store / recommendation_store: a pending action
can only be decided once, and can only be executed after it is 'approved'.
The AI Manager must never execute the underlying tool call itself when
staging one of these — only meta_ads_tool's confirm step, triggered by an
explicit user approval, is allowed to do that.
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_pending_actions (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL,
                tool TEXT NOT NULL,
                action TEXT NOT NULL,
                args_json TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected / executed
                result_json TEXT,
                created_at TEXT NOT NULL,
                decided_at TEXT
            )
        """)


def create(business_id: str, tool: str, action: str, args: dict, description: str) -> str:
    pending_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            """INSERT INTO ai_pending_actions
               (id, business_id, tool, action, args_json, description, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (pending_id, business_id, tool, action, json.dumps(args), description, _now()),
        )
    return pending_id


def get(pending_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_pending_actions WHERE id = ?", (pending_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_pending(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_pending_actions WHERE business_id = ? AND status = 'pending' ORDER BY created_at DESC",
            (business_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def record_decision(pending_id: str, decision: str) -> dict:
    if decision not in ("approved", "rejected"):
        raise ValueError("decision must be 'approved' or 'rejected'")
    pending = get(pending_id)
    if pending is None:
        raise LookupError(f"No such pending action: {pending_id}")
    if pending["status"] != "pending":
        raise PermissionError(
            f"Pending action {pending_id} already has a final decision ('{pending['status']}') — cannot be re-decided."
        )
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_pending_actions SET status = ?, decided_at = ? WHERE id = ?",
            (decision, _now(), pending_id),
        )
    return get(pending_id)


def mark_executed(pending_id: str, result: dict) -> None:
    pending = get(pending_id)
    if pending is None:
        raise LookupError(f"No such pending action: {pending_id}")
    if pending["status"] != "approved":
        raise PermissionError(
            f"Pending action {pending_id} has status '{pending['status']}', not 'approved' — refusing to execute."
        )
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_pending_actions SET status = 'executed', result_json = ? WHERE id = ?",
            (json.dumps(result), pending_id),
        )


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["args"] = json.loads(d.pop("args_json"))
    result_json = d.pop("result_json", None)
    d["result"] = json.loads(result_json) if result_json else None
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
