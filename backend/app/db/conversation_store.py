"""
Storage for the AI Manager's conversation turns. Append-only per business_id
so the Manager can rebuild a short rolling transcript on every /manager/chat
call without the frontend having to resend history itself.
"""
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_conversation_turns (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL,
                role TEXT NOT NULL,            -- 'user' or 'assistant'
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


def append(business_id: str, role: str, content: str) -> str:
    turn_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_conversation_turns (id, business_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (turn_id, business_id, role, content, _now()),
        )
    return turn_id


def get_history(business_id: str, limit: int = 12) -> list:
    """Most recent `limit` turns, oldest first, ready to render into a transcript."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT role, content FROM ai_conversation_turns WHERE business_id = ? ORDER BY created_at DESC LIMIT ?",
            (business_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
