"""
Storage for the Monitoring Module (Phase 6, Layer 6 part 1).
Each pull from Meta Insights (real or simulated) is appended here — never
overwritten — so the Recommendation Engine can look at trends over time
(e.g. "CTR dropped below 1% for 3 days"), not just a single snapshot.
"""
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_performance_logs (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                business_id TEXT NOT NULL,
                date TEXT NOT NULL,
                impressions INTEGER,
                clicks INTEGER,
                ctr REAL,
                cpc REAL,
                spend REAL,
                conversions INTEGER,
                fetched_at TEXT NOT NULL
            )
        """)


def insert_log(campaign_id: str, business_id: str, metrics: dict) -> str:
    log_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).date().isoformat()
    with _conn() as conn:
        conn.execute(
            """INSERT INTO ai_performance_logs
               (id, campaign_id, business_id, date, impressions, clicks, ctr, cpc, spend, conversions, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (log_id, campaign_id, business_id, today, metrics["impressions"], metrics["clicks"],
             metrics["ctr"], metrics["cpc"], metrics["spend"], metrics["conversions"], _now()),
        )
    return log_id


def list_logs(campaign_id: str, limit: int = 30) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_performance_logs WHERE campaign_id = ? ORDER BY fetched_at DESC LIMIT ?",
            (campaign_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
