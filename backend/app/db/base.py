"""
Shared database connection layer for every AI Manager store module.

UNIFICATION NOTE
-----------------
Before the merge, each store module (approval_store, conversation_store,
landingpage_store, memory_store, meta_store, pending_action_store,
performance_store, recommendation_store, support_store) opened its own
SQLite file at storage/leadspilot.db. LeadPilot Complete (the dashboard /
frontend project) already has its own Postgres database, provisioned via
Supabase, holding profiles/campaigns/leads/creatives/etc.

Per the "keep one database" requirement, all AI Manager tables now live in
that SAME Postgres database instead of a second local SQLite file. Only
this module changed — every store module's actual SQL (its table
definitions and queries) is untouched. That's possible because this file
exposes a `get_conn()` context manager whose `.execute()` accepts the same
'?' placeholder style sqlite3 used, and whose row results behave like
sqlite3.Row (dict-like, `dict(row)`-able). Store modules import `get_conn`
as `_conn` and otherwise didn't need to change.

Table names: every AI-Manager-owned table that has NO dashboard equivalent is
prefixed `ai_` (ai_campaign_drafts, ai_approvals, ai_business_memory,
ai_winning_creatives, ai_conversation_turns, ai_pending_actions,
ai_performance_logs, ai_recommendations, ai_recommendation_decisions,
ai_support_tickets) so they cannot collide with LeadPilot Complete's own
tables in the same database. Meta ad account connections, launched
campaigns, and generated landing pages are NOT ai_-prefixed — those are
collapsed directly onto LeadPilot Complete's own `meta_accounts`,
`campaigns`, and `landing_pages` tables (see app/db/meta_store.py and
app/db/landingpage_store.py) rather than kept as shadow copies, since they
are the same real-world objects the dashboard already tracks.
"""
import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
import psycopg2.pool

DATABASE_URL = os.getenv("DATABASE_URL", "")
# Every store call — and now every authenticated request too, since role
# lookup hits the DB (see app/auth.py) — used to open a brand-new TCP
# connection via psycopg2.connect() and close it immediately after. Under
# any real concurrent traffic that both adds needless latency per call and
# risks exhausting Supabase's connection limit (the free tier caps direct
# Postgres connections fairly low). A small pool fixes both.
_POOL_MIN = int(os.getenv("DB_POOL_MIN", "1"))
_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))
_pool: "psycopg2.pool.ThreadedConnectionPool | None" = None


def _require_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. The unified LeadPilot backend uses ONE "
            "Postgres database — the same one the frontend/Supabase project "
            "uses — instead of a separate local SQLite file. Set DATABASE_URL "
            "to that database's connection string (Supabase Dashboard > "
            "Project Settings > Database > Connection string > URI, using the "
            "'Session pooler' or direct connection string), e.g.:\n"
            "  postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres\n"
            "See backend/.env.example."
        )
    return DATABASE_URL


def _get_pool() -> "psycopg2.pool.ThreadedConnectionPool":
    global _pool
    if _pool is None:
        # ThreadedConnectionPool (not SimpleConnectionPool) because FastAPI
        # runs sync route handlers in a thread pool — multiple requests can
        # call get_conn() concurrently from different threads.
        _pool = psycopg2.pool.ThreadedConnectionPool(_POOL_MIN, _POOL_MAX, _require_database_url())
    return _pool


class _CompatCursor:
    """Makes a psycopg2 cursor accept sqlite3-style '?' placeholders and
    return dict-like rows, so unmodified store-module SQL keeps working."""

    __slots__ = ("_cur",)

    def __init__(self, raw_cursor):
        self._cur = raw_cursor

    def execute(self, sql, params=()):
        self._cur.execute(sql.replace("?", "%s"), params)
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        return [dict(r) for r in self._cur.fetchall()]


class _CompatConnection:
    """sqlite3.Connection-shaped wrapper around a psycopg2 connection."""

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def execute(self, sql, params=()):
        cur = _CompatCursor(
            self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        )
        return cur.execute(sql, params)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


@contextmanager
def get_conn():
    pool = _get_pool()
    raw = pool.getconn()
    conn = _CompatConnection(raw)
    broken = False
    try:
        yield conn
        conn.commit()
    except Exception:
        try:
            raw.rollback()
        except Exception:
            broken = True  # connection itself is unusable — don't return it to the pool
        raise
    finally:
        pool.putconn(raw, close=broken)


def close_pool() -> None:
    """Called on FastAPI shutdown so connections aren't left dangling."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
    """Postgres-safe replacement for the old
    `try: ALTER TABLE ... ADD COLUMN ...; except sqlite3.OperationalError: pass`
    pattern used for in-place upgrades of existing tables."""
    conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl_type}")


def stringify_dates(row: dict) -> dict:
    """
    The original ai_* tables stored every timestamp as TEXT (an ISO string
    written by hand via `datetime.now(timezone.utc).isoformat()`), so
    sqlite3.Row always handed store modules plain strings. Now that some
    stores read from LeadPilot Complete's own tables (landing_pages,
    meta_accounts, campaigns, ...), which use native Postgres `timestamptz`
    columns, psycopg2 returns real `datetime` objects for those columns
    instead — and `json.dumps()` (used e.g. by the AI Manager's scratchpad
    logging in app/manager/ai_manager.py) doesn't know how to serialize
    those. Call this on every row dict a store function returns to convert
    any date/datetime value back to an ISO string, matching the original
    behavior every caller already expects.
    """
    import datetime as _dt
    for key, value in row.items():
        if isinstance(value, (_dt.datetime, _dt.date)):
            row[key] = value.isoformat()
    return row
