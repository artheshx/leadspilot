"""
Storage for the Memory Tool.

Two tables:
- ai_business_memory: one row per business_id, a JSON "bag" of durable facts
  (business profile, brand kit, preferences, last strategy, etc.) that gets
  shallow-merged on every update() call — never wiped wholesale.
- ai_winning_creatives: append-only log of creatives the business owner has
  flagged as good performers, so future Creative Tool runs / the AI Manager
  can reuse what already works instead of starting from a blank page.

Same SQLite file as the rest of the app (single local DB for the MVP).
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_business_memory (
                business_id TEXT PRIMARY KEY,
                memory_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_winning_creatives (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL,
                creative_json TEXT NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL
            )
        """)


def get_memory(business_id: str) -> dict:
    with _conn() as conn:
        row = conn.execute(
            "SELECT memory_json FROM ai_business_memory WHERE business_id = ?", (business_id,)
        ).fetchone()
    return json.loads(row["memory_json"]) if row else {}


def update_memory(business_id: str, patch: dict) -> dict:
    """Shallow-merges `patch` into the business's stored memory and returns
    the resulting full memory dict. Existing keys not present in `patch` are
    left untouched; keys present in `patch` overwrite the old value."""
    current = get_memory(business_id)
    current.update(patch)
    with _conn() as conn:
        conn.execute(
            """INSERT INTO ai_business_memory (business_id, memory_json, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(business_id) DO UPDATE SET memory_json = excluded.memory_json, updated_at = excluded.updated_at""",
            (business_id, json.dumps(current), _now()),
        )
    return current


def add_winning_creative(business_id: str, creative: dict, note: str = "") -> str:
    creative_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_winning_creatives (id, business_id, creative_json, note, created_at) VALUES (?, ?, ?, ?, ?)",
            (creative_id, business_id, json.dumps(creative), note, _now()),
        )
    return creative_id


def list_winning_creatives(business_id: str, limit: int = 10) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_winning_creatives WHERE business_id = ? ORDER BY created_at DESC LIMIT ?",
            (business_id, limit),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["creative"] = json.loads(d.pop("creative_json"))
        out.append(d)
    return out


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
