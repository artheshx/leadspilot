"""
Storage for the Admin CRM: AI provider configuration, model routing, prompt
templates, feature flags/permission rules, audit log, Meta/WhatsApp app-level
config, the admin-managed Knowledge Base (playbooks/SOPs — distinct from each
business's own RAG KB in app/services/rag_service.py), admin user roles,
subscription plans, and a background-job log for the Queue Monitor.

Follows the same convention as every other *_store.py module (see
app/db/support_store.py): tables are prefixed `ai_` so they can't collide
with LeadPilot Complete's own dashboard tables in the same shared Postgres
database (see app/db/base.py's module docstring).
"""
import json
import uuid
from datetime import datetime, timezone

from app.db.base import get_conn as _conn


def init_db():
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_providers (
                id TEXT PRIMARY KEY,             -- e.g. 'openai', 'claude', 'gemini', 'openrouter', 'ollama'
                name TEXT NOT NULL,
                api_key_encrypted TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                fallback_model TEXT NOT NULL DEFAULT '',
                max_tokens INTEGER NOT NULL DEFAULT 4096,
                temperature REAL NOT NULL DEFAULT 0.3,
                active BOOLEAN NOT NULL DEFAULT true,
                last_test_status TEXT,           -- 'success' / 'failed' / NULL (never tested)
                last_test_message TEXT,
                last_tested_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_prompts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                updated_by TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_model_routing (
                id TEXT PRIMARY KEY,             -- task key, e.g. 'analysis', 'strategy', 'creative'
                task_label TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                provider_id TEXT,
                fallback_provider_id TEXT,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_feature_flags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                enabled BOOLEAN NOT NULL DEFAULT false,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_permission_rules (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                allowed BOOLEAN NOT NULL DEFAULT true,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_audit_logs (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                actor_id TEXT,
                actor_email TEXT,
                actor_role TEXT,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                ip_address TEXT,
                metadata TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_meta_config (
                id TEXT PRIMARY KEY DEFAULT 'default',
                app_id TEXT NOT NULL DEFAULT '',
                app_secret_encrypted TEXT NOT NULL DEFAULT '',
                verify_token TEXT NOT NULL DEFAULT '',
                webhook_secret_encrypted TEXT NOT NULL DEFAULT '',
                business_manager_id TEXT NOT NULL DEFAULT '',
                default_pixel_id TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_whatsapp_config (
                id TEXT PRIMARY KEY DEFAULT 'default',
                access_token_encrypted TEXT NOT NULL DEFAULT '',
                phone_number_id TEXT NOT NULL DEFAULT '',
                business_account_id TEXT NOT NULL DEFAULT '',
                verify_token TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_kb_documents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'General',
                version INTEGER NOT NULL DEFAULT 1,
                enabled BOOLEAN NOT NULL DEFAULT true,
                status TEXT NOT NULL DEFAULT 'processing',  -- processing / healthy / failed
                status_message TEXT,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                file_path TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                content_type TEXT,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                uploaded_by TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_kb_document_versions (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                created_by TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_admin_roles (
                id TEXT PRIMARY KEY,             -- == profiles.id (must already have profiles.role = 'admin')
                name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL,
                admin_role TEXT NOT NULL DEFAULT 'support',  -- super_admin / support / billing
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price_monthly INTEGER NOT NULL DEFAULT 0,
                campaign_limit INTEGER NOT NULL DEFAULT 0,
                leads_limit INTEGER NOT NULL DEFAULT 0,
                features TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
                active BOOLEAN NOT NULL DEFAULT true,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_job_log (
                id TEXT PRIMARY KEY,
                task TEXT NOT NULL,
                payload TEXT,
                status TEXT NOT NULL DEFAULT 'running',  -- running / completed / failed
                retries INTEGER NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                error TEXT
            )
        """)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# AI Providers
# ---------------------------------------------------------------------------

def list_providers() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_providers ORDER BY name").fetchall()
    return [dict(r) for r in rows]


def get_provider(provider_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_providers WHERE id = ?", (provider_id,)).fetchone()
    return dict(row) if row else None


def upsert_provider(provider_id: str, name: str, api_key_encrypted: str | None, model: str,
                     fallback_model: str, max_tokens: int, temperature: float, active: bool) -> dict:
    existing = get_provider(provider_id)
    now = _now()
    with _conn() as conn:
        if existing:
            if api_key_encrypted is not None:
                conn.execute(
                    "UPDATE ai_providers SET name=?, api_key_encrypted=?, model=?, fallback_model=?, "
                    "max_tokens=?, temperature=?, active=?, updated_at=? WHERE id=?",
                    (name, api_key_encrypted, model, fallback_model, max_tokens, temperature, active, now, provider_id),
                )
            else:
                conn.execute(
                    "UPDATE ai_providers SET name=?, model=?, fallback_model=?, max_tokens=?, "
                    "temperature=?, active=?, updated_at=? WHERE id=?",
                    (name, model, fallback_model, max_tokens, temperature, active, now, provider_id),
                )
        else:
            conn.execute(
                "INSERT INTO ai_providers (id, name, api_key_encrypted, model, fallback_model, max_tokens, "
                "temperature, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (provider_id, name, api_key_encrypted or "", model, fallback_model, max_tokens,
                 temperature, active, now, now),
            )
    return get_provider(provider_id)


def set_provider_test_result(provider_id: str, status: str, message: str) -> dict | None:
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_providers SET last_test_status=?, last_test_message=?, last_tested_at=? WHERE id=?",
            (status, message, _now(), provider_id),
        )
    return get_provider(provider_id)


# ---------------------------------------------------------------------------
# AI Prompts
# ---------------------------------------------------------------------------

def list_prompts() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_prompts ORDER BY name").fetchall()
    return [dict(r) for r in rows]


def get_prompt(prompt_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_prompts WHERE id = ?", (prompt_id,)).fetchone()
    return dict(row) if row else None


def upsert_prompt(prompt_id: str, name: str, description: str, content: str, updated_by: str | None) -> dict:
    existing = get_prompt(prompt_id)
    now = _now()
    with _conn() as conn:
        if existing:
            conn.execute(
                "UPDATE ai_prompts SET name=?, description=?, content=?, updated_at=?, updated_by=? WHERE id=?",
                (name, description, content, now, updated_by, prompt_id),
            )
        else:
            conn.execute(
                "INSERT INTO ai_prompts (id, name, description, content, updated_at, updated_by) "
                "VALUES (?,?,?,?,?,?)",
                (prompt_id, name, description, content, now, updated_by),
            )
    return get_prompt(prompt_id)


# ---------------------------------------------------------------------------
# Model routing
# ---------------------------------------------------------------------------

def list_routing_rules() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_model_routing ORDER BY task_label").fetchall()
    return [dict(r) for r in rows]


def upsert_routing_rule(rule_id: str, task_label: str, description: str,
                         provider_id: str | None, fallback_provider_id: str | None) -> dict:
    now = _now()
    with _conn() as conn:
        existing = conn.execute("SELECT id FROM ai_model_routing WHERE id=?", (rule_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE ai_model_routing SET task_label=?, description=?, provider_id=?, "
                "fallback_provider_id=?, updated_at=? WHERE id=?",
                (task_label, description, provider_id, fallback_provider_id, now, rule_id),
            )
        else:
            conn.execute(
                "INSERT INTO ai_model_routing (id, task_label, description, provider_id, "
                "fallback_provider_id, updated_at) VALUES (?,?,?,?,?,?)",
                (rule_id, task_label, description, provider_id, fallback_provider_id, now),
            )
        row = conn.execute("SELECT * FROM ai_model_routing WHERE id=?", (rule_id,)).fetchone()
    return dict(row)


# ---------------------------------------------------------------------------
# Feature flags & permission rules
# ---------------------------------------------------------------------------

def list_feature_flags() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_feature_flags ORDER BY name").fetchall()
    return [dict(r) for r in rows]


def set_feature_flag(flag_id: str, name: str, description: str, enabled: bool) -> dict:
    now = _now()
    with _conn() as conn:
        existing = conn.execute("SELECT id FROM ai_feature_flags WHERE id=?", (flag_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE ai_feature_flags SET name=?, description=?, enabled=?, updated_at=? WHERE id=?",
                (name, description, enabled, now, flag_id),
            )
        else:
            conn.execute(
                "INSERT INTO ai_feature_flags (id, name, description, enabled, updated_at) VALUES (?,?,?,?,?)",
                (flag_id, name, description, enabled, now),
            )
        row = conn.execute("SELECT * FROM ai_feature_flags WHERE id=?", (flag_id,)).fetchone()
    return dict(row)


def list_permission_rules() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_permission_rules ORDER BY action").fetchall()
    return [dict(r) for r in rows]


def set_permission_rule(rule_id: str, action: str, description: str, allowed: bool) -> dict:
    now = _now()
    with _conn() as conn:
        existing = conn.execute("SELECT id FROM ai_permission_rules WHERE id=?", (rule_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE ai_permission_rules SET action=?, description=?, allowed=?, updated_at=? WHERE id=?",
                (action, description, allowed, now, rule_id),
            )
        else:
            conn.execute(
                "INSERT INTO ai_permission_rules (id, action, description, allowed, updated_at) VALUES (?,?,?,?,?)",
                (rule_id, action, description, allowed, now),
            )
        row = conn.execute("SELECT * FROM ai_permission_rules WHERE id=?", (rule_id,)).fetchone()
    return dict(row)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def write_audit_log(actor_id: str | None, actor_email: str | None, actor_role: str | None,
                     action: str, target_type: str | None = None, target_id: str | None = None,
                     ip_address: str | None = None, metadata: dict | None = None) -> dict:
    log_id = _new_id()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_audit_logs (id, created_at, actor_id, actor_email, actor_role, action, "
            "target_type, target_id, ip_address, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (log_id, _now(), actor_id, actor_email, actor_role, action, target_type, target_id,
             ip_address, json.dumps(metadata) if metadata else None),
        )
    return {"id": log_id}


def list_audit_logs(limit: int = 200, action_contains: str | None = None) -> list:
    query = "SELECT * FROM ai_audit_logs WHERE 1=1"
    params: list = []
    if action_contains:
        query += " AND action ILIKE ?"
        params.append(f"%{action_contains}%")
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with _conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Meta app-level config (singleton row, id='default')
# ---------------------------------------------------------------------------

def get_meta_config() -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_meta_config WHERE id='default'").fetchone()
    return dict(row) if row else None


def upsert_meta_config(app_id: str, app_secret_encrypted: str | None, verify_token: str,
                        webhook_secret_encrypted: str | None, business_manager_id: str,
                        default_pixel_id: str) -> dict:
    existing = get_meta_config()
    now = _now()
    with _conn() as conn:
        if existing:
            sets = ["app_id=?", "verify_token=?", "business_manager_id=?", "default_pixel_id=?", "updated_at=?"]
            params = [app_id, verify_token, business_manager_id, default_pixel_id, now]
            if app_secret_encrypted is not None:
                sets.append("app_secret_encrypted=?")
                params.append(app_secret_encrypted)
            if webhook_secret_encrypted is not None:
                sets.append("webhook_secret_encrypted=?")
                params.append(webhook_secret_encrypted)
            params.append("default")
            conn.execute(f"UPDATE ai_meta_config SET {', '.join(sets)} WHERE id=?", params)
        else:
            conn.execute(
                "INSERT INTO ai_meta_config (id, app_id, app_secret_encrypted, verify_token, "
                "webhook_secret_encrypted, business_manager_id, default_pixel_id, updated_at) "
                "VALUES ('default',?,?,?,?,?,?,?)",
                (app_id, app_secret_encrypted or "", verify_token, webhook_secret_encrypted or "",
                 business_manager_id, default_pixel_id, now),
            )
    return get_meta_config()


# ---------------------------------------------------------------------------
# WhatsApp config (singleton row, id='default')
# ---------------------------------------------------------------------------

def get_whatsapp_config() -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_whatsapp_config WHERE id='default'").fetchone()
    return dict(row) if row else None


def upsert_whatsapp_config(access_token_encrypted: str | None, phone_number_id: str,
                            business_account_id: str, verify_token: str) -> dict:
    existing = get_whatsapp_config()
    now = _now()
    with _conn() as conn:
        if existing:
            sets = ["phone_number_id=?", "business_account_id=?", "verify_token=?", "updated_at=?"]
            params = [phone_number_id, business_account_id, verify_token, now]
            if access_token_encrypted is not None:
                sets.append("access_token_encrypted=?")
                params.append(access_token_encrypted)
            params.append("default")
            conn.execute(f"UPDATE ai_whatsapp_config SET {', '.join(sets)} WHERE id=?", params)
        else:
            conn.execute(
                "INSERT INTO ai_whatsapp_config (id, access_token_encrypted, phone_number_id, "
                "business_account_id, verify_token, updated_at) VALUES ('default',?,?,?,?,?)",
                (access_token_encrypted or "", phone_number_id, business_account_id, verify_token, now),
            )
    return get_whatsapp_config()


# ---------------------------------------------------------------------------
# Admin-managed Knowledge Base (playbooks/SOPs)
# ---------------------------------------------------------------------------

def list_kb_documents(category: str | None = None, search: str | None = None) -> list:
    query = "SELECT * FROM ai_kb_documents WHERE 1=1"
    params: list = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if search:
        query += " AND name ILIKE ?"
        params.append(f"%{search}%")
    query += " ORDER BY updated_at DESC"
    with _conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def get_kb_document(doc_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_kb_documents WHERE id=?", (doc_id,)).fetchone()
    return dict(row) if row else None


def create_kb_document(name: str, category: str, file_path: str, original_filename: str,
                        content_type: str | None, size_bytes: int, chunk_count: int,
                        uploaded_by: str | None) -> dict:
    doc_id = _new_id()
    now = _now()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_kb_documents (id, name, category, version, enabled, status, chunk_count, "
            "file_path, original_filename, content_type, size_bytes, uploaded_by, created_at, updated_at) "
            "VALUES (?,?,?,1,true,'healthy',?,?,?,?,?,?,?,?)",
            (doc_id, name, category, chunk_count, file_path, original_filename, content_type,
             size_bytes, uploaded_by, now, now),
        )
        conn.execute(
            "INSERT INTO ai_kb_document_versions (id, document_id, version, file_path, original_filename, "
            "chunk_count, created_at, created_by) VALUES (?,?,1,?,?,?,?,?)",
            (_new_id(), doc_id, file_path, original_filename, chunk_count, now, uploaded_by),
        )
    return get_kb_document(doc_id)


def replace_kb_document(doc_id: str, file_path: str, original_filename: str, content_type: str | None,
                         size_bytes: int, chunk_count: int, uploaded_by: str | None) -> dict | None:
    existing = get_kb_document(doc_id)
    if not existing:
        return None
    new_version = existing["version"] + 1
    now = _now()
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_kb_documents SET version=?, status='healthy', status_message=NULL, chunk_count=?, "
            "file_path=?, original_filename=?, content_type=?, size_bytes=?, updated_at=? WHERE id=?",
            (new_version, chunk_count, file_path, original_filename, content_type, size_bytes, now, doc_id),
        )
        conn.execute(
            "INSERT INTO ai_kb_document_versions (id, document_id, version, file_path, original_filename, "
            "chunk_count, created_at, created_by) VALUES (?,?,?,?,?,?,?,?)",
            (_new_id(), doc_id, new_version, file_path, original_filename, chunk_count, now, uploaded_by),
        )
    return get_kb_document(doc_id)


def list_kb_document_versions(doc_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_kb_document_versions WHERE document_id=? ORDER BY version DESC", (doc_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def rollback_kb_document(doc_id: str, target_version: int) -> dict | None:
    with _conn() as conn:
        version_row = conn.execute(
            "SELECT * FROM ai_kb_document_versions WHERE document_id=? AND version=?",
            (doc_id, target_version),
        ).fetchone()
        if not version_row:
            return None
        conn.execute(
            "UPDATE ai_kb_documents SET version=?, file_path=?, original_filename=?, chunk_count=?, "
            "status='healthy', status_message=?, updated_at=? WHERE id=?",
            (version_row["version"], version_row["file_path"], version_row["original_filename"],
             version_row["chunk_count"], f"Rolled back to v{target_version}", _now(), doc_id),
        )
    return get_kb_document(doc_id)


def set_kb_document_enabled(doc_id: str, enabled: bool) -> dict | None:
    with _conn() as conn:
        conn.execute("UPDATE ai_kb_documents SET enabled=?, updated_at=? WHERE id=?", (enabled, _now(), doc_id))
    return get_kb_document(doc_id)


def set_kb_document_status(doc_id: str, status: str, message: str | None = None) -> dict | None:
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_kb_documents SET status=?, status_message=?, updated_at=? WHERE id=?",
            (status, message, _now(), doc_id),
        )
    return get_kb_document(doc_id)


def delete_kb_document(doc_id: str) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM ai_kb_document_versions WHERE document_id=?", (doc_id,))
        conn.execute("DELETE FROM ai_kb_documents WHERE id=?", (doc_id,))
    return True


# ---------------------------------------------------------------------------
# Admin roles
# ---------------------------------------------------------------------------

def list_admin_roles() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_admin_roles ORDER BY created_at").fetchall()
    return [dict(r) for r in rows]


def upsert_admin_role(user_id: str, name: str, email: str, admin_role: str) -> dict:
    with _conn() as conn:
        existing = conn.execute("SELECT id FROM ai_admin_roles WHERE id=?", (user_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE ai_admin_roles SET name=?, email=?, admin_role=? WHERE id=?",
                (name, email, admin_role, user_id),
            )
        else:
            conn.execute(
                "INSERT INTO ai_admin_roles (id, name, email, admin_role, created_at) VALUES (?,?,?,?,?)",
                (user_id, name, email, admin_role, _now()),
            )
        row = conn.execute("SELECT * FROM ai_admin_roles WHERE id=?", (user_id,)).fetchone()
    return dict(row)


def delete_admin_role(user_id: str) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM ai_admin_roles WHERE id=?", (user_id,))
    return True


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------

def list_plans() -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_plans ORDER BY price_monthly").fetchall()
    return [{**dict(r), "features": json.loads(r["features"] or "[]")} for r in rows]


def get_plan(plan_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM ai_plans WHERE id=?", (plan_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["features"] = json.loads(d["features"] or "[]")
    return d


def create_plan(name: str, price_monthly: int, campaign_limit: int, leads_limit: int, features: list) -> dict:
    plan_id = _new_id()
    now = _now()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_plans (id, name, price_monthly, campaign_limit, leads_limit, features, "
            "active, created_at, updated_at) VALUES (?,?,?,?,?,?,true,?,?)",
            (plan_id, name, price_monthly, campaign_limit, leads_limit, json.dumps(features), now, now),
        )
    return get_plan(plan_id)


def update_plan(plan_id: str, name: str, price_monthly: int, campaign_limit: int,
                 leads_limit: int, features: list, active: bool) -> dict | None:
    if not get_plan(plan_id):
        return None
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_plans SET name=?, price_monthly=?, campaign_limit=?, leads_limit=?, features=?, "
            "active=?, updated_at=? WHERE id=?",
            (name, price_monthly, campaign_limit, leads_limit, json.dumps(features), active, _now(), plan_id),
        )
    return get_plan(plan_id)


def delete_plan(plan_id: str) -> bool:
    with _conn() as conn:
        conn.execute("DELETE FROM ai_plans WHERE id=?", (plan_id,))
    return True


# ---------------------------------------------------------------------------
# Background job log (Queue Monitor)
# ---------------------------------------------------------------------------

def log_job_start(task: str, payload: str | None = None) -> str:
    job_id = _new_id()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO ai_job_log (id, task, payload, status, retries, started_at) "
            "VALUES (?,?,?, 'running', 0, ?)",
            (job_id, task, payload, _now()),
        )
    return job_id


def log_job_finish(job_id: str, status: str, error: str | None = None) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE ai_job_log SET status=?, finished_at=?, error=? WHERE id=?",
            (status, _now(), error, job_id),
        )


def list_jobs(limit: int = 100) -> list:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM ai_job_log ORDER BY started_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
