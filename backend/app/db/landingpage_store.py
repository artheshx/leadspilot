"""
Storage for the Landing Page Engine — now backed by the dashboard's own
`public.landing_pages` table (LeadPilot Complete) instead of a separate
`ai_landing_pages` shadow copy. This collapses the duplication flagged in
ARCHITECTURE_MERGED.md: a landing page the AI Manager generates now shows
up in the dashboard's own Landing Pages page, and vice versa, since it's
the same row.

New columns added to `landing_pages` for the AI Manager's own needs (added
via idempotent ALTER TABLE, safe against a database that already has this
table from LeadPilot Complete):
  ai_draft_id   TEXT  — the approval draft this page was generated for, if any
  template_id   TEXT  — which template the content was filled into
  content_json  TEXT  — the generated LandingPageOutput, as JSON
  file_path     TEXT  — where the rendered static HTML file lives on disk

Dashboard-native columns are reused rather than duplicated:
  user_id  <- business_id (LeadPilot Complete has no separate "businesses"
              table; a business IS a profile/user — see app/auth.py)
  url      <- set only once published (the AI Manager's old "published_url")
  status   <- dashboard's own enum is 'draft'/'live'/'paused'; the AI
              Manager's vocabulary ('draft'/'published') is translated at
              the boundary in _row_to_dict/mark_published so the table's
              existing CHECK constraint is never violated.
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn, stringify_dates


def init_db():
    with _conn() as conn:
        conn.execute("ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS ai_draft_id TEXT")
        conn.execute("ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS template_id TEXT")
        conn.execute("ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS content_json TEXT")
        conn.execute("ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS file_path TEXT")


def create_landing_page(business_id: str, template_id: str, content: dict, file_path: str,
                         draft_id: str = None) -> str:
    page_id = str(uuid.uuid4())
    name = content.get("headline") or f"AI Landing Page ({template_id})"
    with _conn() as conn:
        conn.execute(
            "INSERT INTO landing_pages "
            "(id, user_id, name, status, ai_draft_id, template_id, content_json, file_path) "
            "VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)",
            (page_id, business_id, name, draft_id, template_id, json.dumps(content), file_path),
        )
    return page_id


def get_landing_page(page_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM landing_pages WHERE id = ?", (page_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_by_business(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM landing_pages WHERE user_id = ? ORDER BY created_at DESC", (business_id,)
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def mark_published(page_id: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE landing_pages SET status = 'live', url = ? WHERE id = ?",
            (f"/lp/{page_id}", page_id),
        )


def _row_to_dict(row) -> dict:
    d = stringify_dates(dict(row))
    d["business_id"] = d.get("user_id")
    d["draft_id"] = d.get("ai_draft_id")
    d["published_url"] = d.get("url")
    # Dashboard's enum is 'draft'/'live'/'paused'; callers written against the
    # AI Manager's original 'draft'/'published' vocabulary still see that.
    d["status"] = "published" if d.get("status") == "live" else d.get("status")
    if d.get("content_json"):
        d["content"] = json.loads(d.pop("content_json"))
    else:
        d.pop("content_json", None)
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
