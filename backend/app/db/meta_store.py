"""
Storage for Meta OAuth connections and launched campaigns — now backed by
the dashboard's own `public.meta_accounts` and `public.campaigns` tables
(LeadPilot Complete) instead of separate `ai_meta_accounts`/`ai_campaigns`
shadow copies. This collapses the duplication flagged in
ARCHITECTURE_MERGED.md: a campaign the AI Manager launches now shows up in
the dashboard's own Campaigns page, and the Meta account a client connects
is the same row the admin-side Meta tooling sees.

New columns (idempotent ALTER TABLE, safe against a database that already
has these tables from LeadPilot Complete):
  meta_accounts.access_token         TEXT — OAuth token for this ad account
  meta_accounts.permissions_granted  TEXT — JSON list of granted scopes
  campaigns.ai_draft_id   TEXT    — the approval draft this campaign came from
  campaigns.meta_adset_id TEXT    — needed for budget/targeting updates
  campaigns.meta_ad_id    TEXT
  campaigns.dry_run       BOOLEAN — was this launch simulated (no real spend)?

Dashboard-native columns are reused rather than duplicated:
  user_id / assigned_user_id  <- business_id
  daily_budget                <- the AI Manager's old budget_daily_inr
  meta_campaign_id            <- already existed on campaigns; unchanged
  status ('pending_review'/'active'/'paused'/'completed'/'rejected')
      <- the AI Manager's old status ('live'/'paused'/'completed') is
         translated at the boundary ('live' -> 'active') so the table's
         existing CHECK constraint on campaigns.status is never violated.
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn, stringify_dates

_CAMPAIGN_STATUS_FROM_DB = {"active": "live", "paused": "paused", "completed": "completed",
                            "pending_review": "live", "rejected": "paused"}


def init_db():
    with _conn() as conn:
        conn.execute("ALTER TABLE meta_accounts ADD COLUMN IF NOT EXISTS access_token TEXT")
        conn.execute("ALTER TABLE meta_accounts ADD COLUMN IF NOT EXISTS permissions_granted TEXT")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ai_draft_id TEXT")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_adset_id TEXT")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_ad_id TEXT")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT true")


# --------------------------------------------------------------------------
# Meta ad account connections
# --------------------------------------------------------------------------

def save_meta_account(business_id: str, ad_account_id: str, access_token: str, permissions: list,
                       account_name: str = None) -> str:
    """Upsert — a business reconnecting overwrites its previous token."""
    with _conn() as conn:
        existing = conn.execute(
            "SELECT id FROM meta_accounts WHERE assigned_user_id = ?", (business_id,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE meta_accounts SET account_id=?, account_name=COALESCE(?, account_name), "
                "access_token=?, permissions_granted=?, status='active' WHERE id=?",
                (ad_account_id, account_name, access_token, json.dumps(permissions), existing["id"]),
            )
            return existing["id"]
        account_row_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO meta_accounts "
            "(id, account_id, account_name, assigned_user_id, status, access_token, permissions_granted) "
            "VALUES (?, ?, ?, ?, 'active', ?, ?)",
            (account_row_id, ad_account_id, account_name or f"Meta Ad Account {ad_account_id}",
             business_id, access_token, json.dumps(permissions)),
        )
        return account_row_id


def get_meta_account(business_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM meta_accounts WHERE assigned_user_id = ? AND status != 'disconnected' "
            "ORDER BY created_at DESC LIMIT 1",
            (business_id,),
        ).fetchone()
    if not row:
        return None
    d = stringify_dates(dict(row))
    d["business_id"] = d.get("assigned_user_id")
    d["ad_account_id"] = d.get("account_id")
    d["permissions_granted"] = json.loads(d.get("permissions_granted") or "[]")
    return d


# --------------------------------------------------------------------------
# Launched campaigns
# --------------------------------------------------------------------------

def save_campaign(business_id: str, draft_id: str, meta_ids: dict, name: str, objective: str,
                   budget_daily_inr: float, dry_run: bool) -> str:
    campaign_id = str(uuid.uuid4())
    with _conn() as conn:
        conn.execute(
            """INSERT INTO campaigns
               (id, user_id, name, objective, daily_budget, status, meta_campaign_id,
                ai_draft_id, meta_adset_id, meta_ad_id, dry_run)
               VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)""",
            (campaign_id, business_id, name, objective, budget_daily_inr, meta_ids.get("campaign_id"),
             draft_id, meta_ids.get("adset_id"), meta_ids.get("ad_id"), dry_run),
        )
    return campaign_id


def list_campaigns(business_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC", (business_id,)
        ).fetchall()
    return [_campaign_row_to_dict(r) for r in rows]


def get_campaign(campaign_id: str) -> dict | None:
    """Look up a single launched campaign by its id (used by the Monitoring
    Module to find which Meta campaign/ad account to pull insights for)."""
    with _conn() as conn:
        row = conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
    return _campaign_row_to_dict(row) if row else None


def campaign_already_launched_for_draft(draft_id: str) -> bool:
    """Guards against double-launch if the launch endpoint is called twice for the same draft."""
    with _conn() as conn:
        row = conn.execute("SELECT id FROM campaigns WHERE ai_draft_id = ?", (draft_id,)).fetchone()
    return row is not None


def _campaign_row_to_dict(row) -> dict:
    d = stringify_dates(dict(row))
    d["business_id"] = d.get("user_id")
    d["draft_id"] = d.get("ai_draft_id")
    d["budget_daily_inr"] = d.get("daily_budget")
    d["launched_at"] = d.get("created_at")
    d["status"] = _CAMPAIGN_STATUS_FROM_DB.get(d.get("status"), d.get("status"))
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
