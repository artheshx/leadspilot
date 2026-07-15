import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routers import knowledgebase, strategy, creative, approvals, meta_ads, landingpage, monitoring, support, manager, admin
from app.db import (
    approval_store, meta_store, landingpage_store, performance_store, recommendation_store,
    support_store, memory_store, conversation_store, pending_action_store, admin_store,
)
from app.db.base import close_pool

app = FastAPI(
    title="LeadPilot API",
    version="1.0.0-unified",
    description="Unified LeadPilot backend: LeadPilot Complete's dashboard/auth/billing/"
                 "campaigns data model plus the LeadPilot AI Manager architecture — one "
                 "AI Manager (Brain) reasoning over a Tool Registry (Business Analysis, "
                 "Strategy, Creative, Landing Page, Meta Ads, Analytics, Knowledge, Memory, "
                 "Compliance, Support). The dashboard frontend only ever calls POST "
                 "/manager/chat for AI actions; the phase-specific endpoints below remain "
                 "for internal/admin fine-grained use, never called by the frontend directly.",
)

# Only the configured frontend origin(s) may call this API — see
# ALLOWED_ORIGINS in app/config.py. Was allow_origins=["*"] before the merge;
# tightened now that every route here serves authenticated, per-client data.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    approval_store.init_db()
    meta_store.init_db()
    landingpage_store.init_db()
    performance_store.init_db()
    recommendation_store.init_db()
    support_store.init_db()
    memory_store.init_db()
    conversation_store.init_db()
    pending_action_store.init_db()
    admin_store.init_db()


@app.on_event("shutdown")
def _shutdown():
    close_pool()


# AI Manager — the single AI entrypoint the dashboard frontend talks to.
app.include_router(manager.router)

# Original phase-specific endpoints — internal/admin fine-grained use only.
# The Tool Registry (app/tools/registry.py) calls the underlying *_service
# modules directly, not these HTTP routes, so this isn't a second code path
# for the same logic — it's a thin HTTP surface over the same services, kept
# for ops tooling / debugging / future admin screens.
app.include_router(knowledgebase.router)
app.include_router(strategy.router)
app.include_router(creative.router)
app.include_router(approvals.router)
app.include_router(meta_ads.router)
app.include_router(landingpage.router)
app.include_router(monitoring.router)
app.include_router(support.router)

# Admin CRM — configuration/ops surface for profiles.role == 'admin' users
# (AI providers, prompts, model routing, feature flags, audit log, Meta/
# WhatsApp app config, admin-managed Knowledge Base, admin roles, plans,
# system health, queue monitor). See app/routers/admin.py.
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# In production, one process serves both the API (above) and the built
# React dashboard (frontend/dist) — "keep one backend" means the frontend
# isn't deployed as its own separate server. Registered last so it never
# shadows an API route (FastAPI/Starlette match routes in registration
# order). Local dev instead runs `npm run dev` (Vite) with its own dev
# server — see frontend/vite.config.ts — so this block is a no-op unless
# FRONTEND_DIST_PATH is set (e.g. in the Docker image).
#
# Deliberately NOT `app.mount("/", StaticFiles(html=True))`: that only
# auto-serves index.html for directory-root requests, not for arbitrary
# client-side routes like /dashboard/campaigns — a hard refresh on any
# React Router sub-page would 404 instead of loading the app. This
# catch-all serves the real file when one exists at that path (JS/CSS/
# favicon/...) and falls back to index.html for everything else, letting
# React Router take over client-side as usual.
if config.FRONTEND_DIST_PATH and os.path.isdir(config.FRONTEND_DIST_PATH):
    from fastapi.responses import FileResponse

    _INDEX_HTML = os.path.join(config.FRONTEND_DIST_PATH, "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        candidate = os.path.join(config.FRONTEND_DIST_PATH, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(_INDEX_HTML)
