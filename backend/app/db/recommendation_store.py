"""
Storage for the Recommendation Engine (Phase 6) and Approval Gate #2.

Mirrors app/db/approval_store.py's Golden Rule pattern exactly, because the
spec's Golden Rule applies here too: "No AI-suggested action reaches Meta Ads
API in a write capacity without an explicit user approval event recorded in
the database. This applies to ... budget changes, creative swaps, targeting
changes, and campaign pause/resume." A recommendation cannot be re-decided
once approved/rejected, and cannot be applied unless its current status is
exactly 'approved', and cannot be applied twice.
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_recommendations (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                business_id TEXT NOT NULL,
                type TEXT NOT NULL,
                reasoning TEXT NOT NULL,
                suggested_change_json TEXT NOT NULL,
                confidence TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected / applied
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_recommendation_decisions (
                id TEXT PRIMARY KEY,
                recommendation_id TEXT NOT NULL REFERENCES ai_recommendations(id),
                decision TEXT NOT NULL,          -- approved / rejected
                decided_by TEXT NOT NULL,
                reason TEXT,
                decided_at TEXT NOT NULL
            )
        """)


def create_recommendation(campaign_id: str, business_id: str, rec: dict) -> str:
    rec_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            """INSERT INTO ai_recommendations
               (id, campaign_id, business_id, type, reasoning, suggested_change_json, confidence, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (rec_id, campaign_id, business_id, rec["type"], rec["reasoning"],
             json.dumps(rec.get("suggested_change", {})), rec.get("confidence", "medium"), _now()),
        )
    return rec_id


def get_recommendation(rec_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_recommendations WHERE id = ?", (rec_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_pending(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_recommendations WHERE business_id = ? AND status = 'pending' ORDER BY created_at DESC",
            (business_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def record_decision(rec_id: str, decision: str, decided_by: str, reason: str = None) -> dict:
    """The ONLY way a recommendation's status changes from pending. Same
    non-bypassable Golden Rule enforcement as approval_store.record_decision."""
    if decision not in ("approved", "rejected"):
        raise ValueError("decision must be 'approved' or 'rejected'")

    rec = get_recommendation(rec_id)
    if rec is None:
        raise LookupError(f"No such recommendation: {rec_id}")
    if rec["status"] != "pending":
        raise PermissionError(
            f"Recommendation {rec_id} already has a final decision ('{rec['status']}') — cannot be re-decided."
        )

    decision_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_recommendation_decisions (id, recommendation_id, decision, decided_by, reason, decided_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (decision_id, rec_id, decision, decided_by, reason, _now()),
        )
        conn.execute("UPDATE ai_recommendations SET status = ? WHERE id = ?", (decision, rec_id))

    return {"decision_id": decision_id, "recommendation_id": rec_id, "decision": decision}


def mark_applied(rec_id: str) -> None:
    """Called only after the approved change has actually been sent to Meta's
    API (or simulated in DRY_RUN). Refuses unless status is exactly 'approved' —
    this is what prevents a recommendation from ever being auto-applied or
    applied twice."""
    rec = get_recommendation(rec_id)
    if rec is None:
        raise LookupError(f"No such recommendation: {rec_id}")
    if rec["status"] != "approved":
        raise PermissionError(
            f"Recommendation {rec_id} has status '{rec['status']}', not 'approved' — refusing to apply."
        )
    with _conn() as conn:
        conn.execute("UPDATE ai_recommendations SET status = 'applied' WHERE id = ?", (rec_id,))


def get_decision_history(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT dec.*, r.business_id, r.type, r.campaign_id FROM ai_recommendation_decisions dec
            JOIN ai_recommendations r ON r.id = dec.recommendation_id
            WHERE r.business_id = ?
            ORDER BY dec.decided_at DESC
            """,
            (business_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["suggested_change"] = json.loads(d.pop("suggested_change_json"))
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
