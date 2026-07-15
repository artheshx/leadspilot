"""
Admin CRM — configuration and operations surface for LeadPilot admins.

Everything here requires profiles.role == 'admin' (see app/auth.py
require_admin). This is the backend for the previously fully-mocked
frontend/src/pages/admin/{AiProviders,AiPrompts,AuditLogs,MetaConfig,
ModelRouting,FeatureFlags,WhatsApp,SystemHealth,QueueMonitor,Admins,Plans,
KnowledgeBase}.tsx pages — those pages used to hold their entire "data" as
hardcoded useState() arrays with setTimeout()-faked saves and no server
round-trip at all. This router gives them a real one.

Every mutating endpoint writes an audit log entry (see admin_store.write_audit_log),
which is what powers GET /admin/audit-logs — a real log of real admin
actions, not seeded fake rows.
"""
import io
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader

from app import config
from app.auth import CurrentUser, get_current_user, require_admin
from app.db import admin_store
from app.services import crypto_service, health_service
from app.services.chunking import chunk_text

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _audit(request: Request, user: CurrentUser, action: str, target_type: str = None,
           target_id: str = None, metadata: dict = None):
    admin_store.write_audit_log(
        actor_id=user.id, actor_email=user.email, actor_role=user.role,
        action=action, target_type=target_type, target_id=target_id,
        ip_address=request.client.host if request.client else None, metadata=metadata,
    )


# ===========================================================================
# AI Providers
# ===========================================================================

class ProviderIn(BaseModel):
    name: str
    api_key: Optional[str] = None  # None/masked = keep existing; new plaintext = re-encrypt
    model: str = ""
    fallback_model: str = ""
    max_tokens: int = 4096
    temperature: float = 0.3
    active: bool = True


def _provider_out(row: dict) -> dict:
    key_encrypted = row.pop("api_key_encrypted", "")
    row["key_configured"] = bool(key_encrypted)
    row["key_masked"] = crypto_service.mask_secret(
        crypto_service.decrypt_secret(key_encrypted) if key_encrypted and config.ADMIN_SECRETS_KEY else ""
    ) if key_encrypted else ""
    return row


@router.get("/ai-providers")
def list_providers():
    return [_provider_out(p) for p in admin_store.list_providers()]


@router.put("/ai-providers/{provider_id}")
def save_provider(provider_id: str, payload: ProviderIn, request: Request,
                   user: CurrentUser = Depends(get_current_user)):
    api_key_encrypted = None
    if payload.api_key is not None and not crypto_service.looks_masked(payload.api_key):
        api_key_encrypted = crypto_service.encrypt_secret(payload.api_key)
    row = admin_store.upsert_provider(
        provider_id, payload.name, api_key_encrypted, payload.model, payload.fallback_model,
        payload.max_tokens, payload.temperature, payload.active,
    )
    _audit(request, user, f"Updated AI provider configuration: {payload.name}", "ai_provider", provider_id)
    return _provider_out(row)


@router.post("/ai-providers/{provider_id}/test")
def test_provider(provider_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    provider = admin_store.get_provider(provider_id)
    if not provider:
        raise HTTPException(404, f"No such provider: {provider_id}")

    if provider_id == "ollama":
        import requests as _rq
        try:
            resp = _rq.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=3)
            resp.raise_for_status()
            status, message = "success", f"Reached Ollama at {config.OLLAMA_BASE_URL}."
        except Exception as e:
            status, message = "failed", f"Could not reach Ollama: {e}"
    else:
        has_key = bool(provider.get("api_key_encrypted"))
        status = "success" if has_key else "failed"
        message = (
            "API key is configured. (A live call isn't made here to avoid spending "
            "provider credits on every 'Test Connection' click — the AI Manager will "
            "surface a real error if this key turns out to be invalid.)"
            if has_key else "No API key configured yet."
        )

    row = admin_store.set_provider_test_result(provider_id, status, message)
    _audit(request, user, f"Tested AI provider connection: {provider_id} -> {status}", "ai_provider", provider_id)
    return _provider_out(row)


# ===========================================================================
# AI Prompts
# ===========================================================================

class PromptIn(BaseModel):
    name: str
    description: str = ""
    content: str


@router.get("/ai-prompts")
def list_prompts():
    return admin_store.list_prompts()


@router.put("/ai-prompts/{prompt_id}")
def save_prompt(prompt_id: str, payload: PromptIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    row = admin_store.upsert_prompt(prompt_id, payload.name, payload.description, payload.content, user.id)
    _audit(request, user, f"Updated AI prompt template: {payload.name}", "ai_prompt", prompt_id)
    return row


# ===========================================================================
# Model routing
# ===========================================================================

class RoutingRuleIn(BaseModel):
    task_label: str
    description: str = ""
    provider_id: Optional[str] = None
    fallback_provider_id: Optional[str] = None


@router.get("/model-routing")
def list_routing():
    return admin_store.list_routing_rules()


@router.put("/model-routing/{rule_id}")
def save_routing(rule_id: str, payload: RoutingRuleIn, request: Request,
                  user: CurrentUser = Depends(get_current_user)):
    row = admin_store.upsert_routing_rule(
        rule_id, payload.task_label, payload.description, payload.provider_id, payload.fallback_provider_id
    )
    _audit(request, user, f"Updated model routing rule: {payload.task_label}", "model_routing", rule_id)
    return row


# ===========================================================================
# Feature flags & permission rules
# ===========================================================================

class FlagIn(BaseModel):
    name: str
    description: str = ""
    enabled: bool


@router.get("/feature-flags")
def list_flags():
    return admin_store.list_feature_flags()


@router.put("/feature-flags/{flag_id}")
def save_flag(flag_id: str, payload: FlagIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    row = admin_store.set_feature_flag(flag_id, payload.name, payload.description, payload.enabled)
    _audit(request, user, f"{'Enabled' if payload.enabled else 'Disabled'} feature flag: {payload.name}",
           "feature_flag", flag_id)
    return row


class PermissionRuleIn(BaseModel):
    action: str
    description: str = ""
    allowed: bool


@router.get("/permission-rules")
def list_permission_rules():
    return admin_store.list_permission_rules()


@router.put("/permission-rules/{rule_id}")
def save_permission_rule(rule_id: str, payload: PermissionRuleIn, request: Request,
                          user: CurrentUser = Depends(get_current_user)):
    row = admin_store.set_permission_rule(rule_id, payload.action, payload.description, payload.allowed)
    _audit(request, user, f"{'Allowed' if payload.allowed else 'Blocked'} action: {payload.action}",
           "permission_rule", rule_id)
    return row


# ===========================================================================
# Audit logs
# ===========================================================================

@router.get("/audit-logs")
def get_audit_logs(limit: int = 200, q: Optional[str] = None):
    return admin_store.list_audit_logs(limit=limit, action_contains=q)


# ===========================================================================
# Meta app-level configuration
# ===========================================================================

class MetaConfigIn(BaseModel):
    app_id: str = ""
    app_secret: Optional[str] = None
    verify_token: str = ""
    webhook_secret: Optional[str] = None
    business_manager_id: str = ""
    default_pixel_id: str = ""


def _meta_config_out(row: dict) -> dict:
    if not row:
        return {
            "app_id": "", "verify_token": "", "business_manager_id": "", "default_pixel_id": "",
            "app_secret_configured": False, "app_secret_masked": "",
            "webhook_secret_configured": False, "webhook_secret_masked": "",
        }
    app_secret_enc = row.pop("app_secret_encrypted", "")
    webhook_secret_enc = row.pop("webhook_secret_encrypted", "")
    row["app_secret_configured"] = bool(app_secret_enc)
    row["webhook_secret_configured"] = bool(webhook_secret_enc)
    row["app_secret_masked"] = crypto_service.mask_secret(crypto_service.decrypt_secret(app_secret_enc)) if app_secret_enc else ""
    row["webhook_secret_masked"] = crypto_service.mask_secret(crypto_service.decrypt_secret(webhook_secret_enc)) if webhook_secret_enc else ""
    return row


@router.get("/meta-config")
def get_meta_config():
    return _meta_config_out(admin_store.get_meta_config())


@router.put("/meta-config")
def save_meta_config(payload: MetaConfigIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    app_secret_enc = None
    if payload.app_secret is not None and not crypto_service.looks_masked(payload.app_secret):
        app_secret_enc = crypto_service.encrypt_secret(payload.app_secret)
    webhook_secret_enc = None
    if payload.webhook_secret is not None and not crypto_service.looks_masked(payload.webhook_secret):
        webhook_secret_enc = crypto_service.encrypt_secret(payload.webhook_secret)

    row = admin_store.upsert_meta_config(
        payload.app_id, app_secret_enc, payload.verify_token, webhook_secret_enc,
        payload.business_manager_id, payload.default_pixel_id,
    )
    _audit(request, user, "Updated Meta App configuration", "meta_config", "default")
    return _meta_config_out(row)


# ===========================================================================
# WhatsApp configuration
# ===========================================================================

class WhatsAppConfigIn(BaseModel):
    access_token: Optional[str] = None
    phone_number_id: str = ""
    business_account_id: str = ""
    verify_token: str = ""


def _whatsapp_config_out(row: dict) -> dict:
    if not row:
        return {
            "phone_number_id": "", "business_account_id": "", "verify_token": "",
            "access_token_configured": False, "access_token_masked": "",
        }
    token_enc = row.pop("access_token_encrypted", "")
    row["access_token_configured"] = bool(token_enc)
    row["access_token_masked"] = crypto_service.mask_secret(crypto_service.decrypt_secret(token_enc)) if token_enc else ""
    return row


@router.get("/whatsapp-config")
def get_whatsapp_config():
    return _whatsapp_config_out(admin_store.get_whatsapp_config())


@router.put("/whatsapp-config")
def save_whatsapp_config(payload: WhatsAppConfigIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    token_enc = None
    if payload.access_token is not None and not crypto_service.looks_masked(payload.access_token):
        token_enc = crypto_service.encrypt_secret(payload.access_token)
    row = admin_store.upsert_whatsapp_config(
        token_enc, payload.phone_number_id, payload.business_account_id, payload.verify_token
    )
    _audit(request, user, "Updated WhatsApp Cloud API configuration", "whatsapp_config", "default")
    return _whatsapp_config_out(row)


# ===========================================================================
# Admin-managed Knowledge Base (playbooks/SOPs)
#
# Distinct from each business's own RAG KB (app/services/rag_service.py,
# POST /knowledgebase/upload) — this is admin-curated reference material.
# Per scope: parses + chunks the document and tracks status/versioning, but
# does NOT embed it into a vector store yet. chunk_count here is a real count
# from the same chunker rag_service uses (app/services/chunking.py), not a
# random placeholder number — embeddings are the next phase.
# ===========================================================================

KB_STORAGE_PATH = os.path.join(config.STORAGE_PATH, "admin_kb")


def _extract_text(filename: str, raw: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(raw))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(400, f"Could not read PDF: {e}")
    if lower.endswith(".docx"):
        try:
            import docx  # python-docx; see note in completion report if not installed
            document = docx.Document(io.BytesIO(raw))
            return "\n".join(p.text for p in document.paragraphs)
        except ImportError:
            raise HTTPException(
                503,
                "DOCX support requires the 'python-docx' package, which isn't installed "
                "in this environment yet. Upload as PDF/TXT/MD for now, or add "
                "python-docx to backend/requirements.txt.",
            )
        except Exception as e:
            raise HTTPException(400, f"Could not read DOCX: {e}")
    # .txt / .md / anything else: treat as plain text
    try:
        return raw.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(400, f"Could not read file as text: {e}")


@router.get("/knowledge-base")
def list_kb_documents(category: Optional[str] = None, search: Optional[str] = None):
    return admin_store.list_kb_documents(category=category, search=search)


@router.get("/knowledge-base/{doc_id}")
def get_kb_document(doc_id: str):
    doc = admin_store.get_kb_document(doc_id)
    if not doc:
        raise HTTPException(404, f"No such document: {doc_id}")
    return doc


@router.get("/knowledge-base/{doc_id}/versions")
def get_kb_document_versions(doc_id: str):
    if not admin_store.get_kb_document(doc_id):
        raise HTTPException(404, f"No such document: {doc_id}")
    return admin_store.list_kb_document_versions(doc_id)


@router.get("/knowledge-base/{doc_id}/preview")
def preview_kb_document(doc_id: str):
    """Returns extracted plain text (first 5000 chars) for in-admin preview,
    rather than serving the raw file — keeps this endpoint simple and safe
    regardless of original file type."""
    doc = admin_store.get_kb_document(doc_id)
    if not doc:
        raise HTTPException(404, f"No such document: {doc_id}")
    if not os.path.exists(doc["file_path"]):
        raise HTTPException(404, "Stored file is missing from disk.")
    with open(doc["file_path"], "rb") as f:
        raw = f.read()
    text = _extract_text(doc["original_filename"], raw)
    return {"id": doc_id, "preview": text[:5000], "truncated": len(text) > 5000}


@router.post("/knowledge-base/upload")
async def upload_kb_document(request: Request, name: str = Form(...), category: str = Form("General"),
                              file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(400, "File exceeds the 20MB limit.")

    os.makedirs(KB_STORAGE_PATH, exist_ok=True)
    stored_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(KB_STORAGE_PATH, stored_name)
    with open(file_path, "wb") as f:
        f.write(raw)

    try:
        text = _extract_text(file.filename, raw)
        chunks = chunk_text(text, chunk_size=config.DEFAULT_CHUNK_SIZE, overlap=config.DEFAULT_CHUNK_OVERLAP) if text.strip() else []
        doc = admin_store.create_kb_document(
            name=name, category=category, file_path=file_path, original_filename=file.filename,
            content_type=file.content_type, size_bytes=len(raw), chunk_count=len(chunks), uploaded_by=user.id,
        )
    except HTTPException as e:
        # Parsing failed — keep the doc record so the admin can see/retry, marked failed.
        doc = admin_store.create_kb_document(
            name=name, category=category, file_path=file_path, original_filename=file.filename,
            content_type=file.content_type, size_bytes=len(raw), chunk_count=0, uploaded_by=user.id,
        )
        admin_store.set_kb_document_status(doc["id"], "failed", e.detail)
        doc = admin_store.get_kb_document(doc["id"])

    _audit(request, user, f"Uploaded knowledge base document: {name}", "kb_document", doc["id"])
    return doc


@router.put("/knowledge-base/{doc_id}/replace")
async def replace_kb_document(doc_id: str, request: Request, file: UploadFile = File(...),
                               user: CurrentUser = Depends(get_current_user)):
    doc = admin_store.get_kb_document(doc_id)
    if not doc:
        raise HTTPException(404, f"No such document: {doc_id}")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Uploaded file is empty.")

    os.makedirs(KB_STORAGE_PATH, exist_ok=True)
    stored_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(KB_STORAGE_PATH, stored_name)
    with open(file_path, "wb") as f:
        f.write(raw)

    text = _extract_text(file.filename, raw)
    chunks = chunk_text(text, chunk_size=config.DEFAULT_CHUNK_SIZE, overlap=config.DEFAULT_CHUNK_OVERLAP) if text.strip() else []
    updated = admin_store.replace_kb_document(
        doc_id, file_path, file.filename, file.content_type, len(raw), len(chunks), user.id
    )
    _audit(request, user, f"Replaced knowledge base document: {doc['name']} (now v{updated['version']})",
           "kb_document", doc_id)
    return updated


@router.post("/knowledge-base/{doc_id}/rollback/{version}")
def rollback_kb_document(doc_id: str, version: int, request: Request, user: CurrentUser = Depends(get_current_user)):
    updated = admin_store.rollback_kb_document(doc_id, version)
    if not updated:
        raise HTTPException(404, "No such document/version.")
    _audit(request, user, f"Rolled back knowledge base document {doc_id} to v{version}", "kb_document", doc_id)
    return updated


@router.post("/knowledge-base/{doc_id}/toggle")
def toggle_kb_document(doc_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    doc = admin_store.get_kb_document(doc_id)
    if not doc:
        raise HTTPException(404, f"No such document: {doc_id}")
    updated = admin_store.set_kb_document_enabled(doc_id, not doc["enabled"])
    _audit(request, user, f"{'Enabled' if updated['enabled'] else 'Disabled'} knowledge base document: {doc['name']}",
           "kb_document", doc_id)
    return updated


@router.delete("/knowledge-base/{doc_id}")
def delete_kb_document(doc_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    doc = admin_store.get_kb_document(doc_id)
    if not doc:
        raise HTTPException(404, f"No such document: {doc_id}")
    admin_store.delete_kb_document(doc_id)
    try:
        if os.path.exists(doc["file_path"]):
            os.remove(doc["file_path"])
    except OSError:
        pass  # best-effort disk cleanup; DB record is already gone
    _audit(request, user, f"Deleted knowledge base document: {doc['name']}", "kb_document", doc_id)
    return {"deleted": True}


# ===========================================================================
# Admins (roles)
# ===========================================================================

class AdminRoleIn(BaseModel):
    id: str  # must be an existing profiles.id with role='admin'
    name: str
    email: str
    admin_role: str  # super_admin / support / billing


@router.get("/admins")
def list_admins():
    return admin_store.list_admin_roles()


@router.put("/admins/{user_id}")
def save_admin_role(user_id: str, payload: AdminRoleIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    if payload.admin_role not in ("super_admin", "support", "billing"):
        raise HTTPException(422, "admin_role must be one of super_admin/support/billing")
    row = admin_store.upsert_admin_role(user_id, payload.name, payload.email, payload.admin_role)
    _audit(request, user, f"Set admin role for {payload.email}: {payload.admin_role}", "admin_role", user_id)
    return row


@router.delete("/admins/{user_id}")
def remove_admin_role(user_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    admin_store.delete_admin_role(user_id)
    _audit(request, user, f"Removed admin role for user {user_id}", "admin_role", user_id)
    return {"deleted": True}


# ===========================================================================
# Plans
# ===========================================================================

class PlanIn(BaseModel):
    name: str
    price_monthly: int
    campaign_limit: int
    leads_limit: int
    features: list[str] = []
    active: bool = True


@router.get("/plans")
def list_plans():
    return admin_store.list_plans()


@router.post("/plans")
def create_plan(payload: PlanIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    row = admin_store.create_plan(payload.name, payload.price_monthly, payload.campaign_limit,
                                   payload.leads_limit, payload.features)
    _audit(request, user, f"Created plan: {payload.name}", "plan", row["id"])
    return row


@router.put("/plans/{plan_id}")
def update_plan(plan_id: str, payload: PlanIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    row = admin_store.update_plan(plan_id, payload.name, payload.price_monthly, payload.campaign_limit,
                                   payload.leads_limit, payload.features, payload.active)
    if not row:
        raise HTTPException(404, f"No such plan: {plan_id}")
    _audit(request, user, f"Updated plan: {payload.name}", "plan", plan_id)
    return row


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    admin_store.delete_plan(plan_id)
    _audit(request, user, f"Deleted plan {plan_id}", "plan", plan_id)
    return {"deleted": True}


# ===========================================================================
# System Health
# ===========================================================================

@router.get("/system-health")
def system_health():
    return {"checks": health_service.run_all_checks()}


# ===========================================================================
# Queue Monitor
#
# NOTE ON SCOPE: this codebase has no background job queue (no Celery/Redis/
# RQ) — every AI Manager action (creative generation, campaign publish, KB
# processing, ...) currently runs synchronously inside the request/response
# cycle, in the existing service modules. Per the "do not modify existing
# business logic" instruction, this endpoint does NOT instrument those
# modules to write job-log rows (that would mean editing creative_service.py,
# meta_ads_service.py, etc.). What's here is real, working infrastructure —
# the ai_job_log table + these endpoints — so a real queue/worker can start
# writing to it the moment one exists; today it will legitimately show
# "no jobs logged yet" rather than fabricated rows. See the completion
# report for what real background-job wiring would require.
# ===========================================================================

@router.get("/queue")
def list_queue_jobs(limit: int = 100):
    return admin_store.list_jobs(limit=limit)
