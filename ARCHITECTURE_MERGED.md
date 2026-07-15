# LeadPilot — Unified Architecture

This repo merges the two previous projects into **one** codebase:

- **LeadPilot Complete** → `frontend/` (React + Vite + Supabase Auth) — unchanged UI, unchanged auth/billing.
- **LeadPilot AI Manager** → `backend/` (FastAPI) — unchanged AI Manager, Tool Registry, and all 9 tools/services.
- `supabase/` — the existing Supabase schema, migrations, and edge functions (unchanged).

```
leadpilot/
├── backend/     # single FastAPI backend — API + AI Manager + serves the built frontend in prod
├── frontend/    # single React dashboard — unchanged UI, now also talks to backend/
└── supabase/    # existing schema.sql, migrations, edge functions (unchanged)
```

## What changed, and why

### 1. One backend
`backend/app/main.py` is the single server process. In production it serves the API
*and* the built React app (`app.mount("/", StaticFiles(...))`) so there is exactly one
deployable backend, not two. In local dev, Vite's dev server serves the frontend on
`:5173` and talks to FastAPI on `:8000` via `VITE_API_BASE_URL` (CORS-enabled, not proxied,
to keep the two dev servers decoupled).

### 2. One database
Previously: LeadPilot Complete used Supabase Postgres; the AI Manager used a second,
separate SQLite file (`storage/leadspilot.db`). Now both live in the **same Postgres
database** (the existing Supabase Postgres instance):

- `backend/app/db/base.py` is a shared connection layer. It deliberately mimics the
  sqlite3 API (`.execute()` with `?` placeholders, dict-like rows) so **none of the 9
  store modules' actual SQL had to be rewritten** — only their connection boilerplate
  changed (`import sqlite3` + a local `_conn()` became `from app.db.base import get_conn as _conn`).
- AI-Manager-owned tables with no dashboard equivalent are prefixed `ai_`
  (`ai_campaign_drafts`, `ai_approvals`, `ai_business_memory`, `ai_conversation_turns`,
  `ai_pending_actions`, `ai_performance_logs`, `ai_recommendations`,
  `ai_recommendation_decisions`, `ai_support_tickets`) so they can't collide with
  LeadPilot Complete's own tables in the same database.
- Set `DATABASE_URL` in `backend/.env` to the Supabase project's Postgres connection
  string (Project Settings → Database → Connection string).

**Meta ad accounts, launched campaigns, and landing pages are collapsed onto LeadPilot
Complete's own tables** instead of kept as separate shadow copies:
- `app/db/meta_store.py` reads/writes `public.meta_accounts` and `public.campaigns`
  directly. Added columns: `access_token`, `permissions_granted` on `meta_accounts`;
  `ai_draft_id`, `meta_adset_id`, `meta_ad_id`, `dry_run` on `campaigns`. Status
  vocabularies are translated at the boundary (AI Manager's `live`/`paused`/`completed`
  ↔ the dashboard's `pending_review`/`active`/`paused`/`completed`/`rejected`) so the
  dashboard's existing CHECK constraints are never violated — nothing in the codebase
  compared raw status strings across the boundary, so this translation is safe.
- `app/db/landingpage_store.py` reads/writes `public.landing_pages` directly. Added
  columns: `ai_draft_id`, `template_id`, `content_json`, `file_path`. Same status
  translation pattern (`draft`/`published` ↔ the dashboard's `draft`/`live`/`paused`).
- A subtlety this surfaced: the dashboard's tables use native Postgres `timestamptz`
  columns (psycopg2 returns real `datetime` objects), while the old `ai_*` tables stored
  dates as plain `TEXT`. The AI Manager's own scratchpad logging does a raw
  `json.dumps()` on tool results, which can't serialize a `datetime`. Fixed with a
  `stringify_dates()` helper in `app/db/base.py`, applied to every row these two stores
  return.

**Left as-is, deliberately not collapsed:** `ai_campaign_drafts` and the rest of the AI
Manager's working-memory tables (conversation history, business memory, pending actions,
recommendations, support tickets) have no dashboard-facing equivalent — they're
genuinely AI-Manager-internal concepts, not duplicates of anything LeadPilot Complete
already had.

**New setup-order dependency this introduces:** because `meta_store` and
`landingpage_store` now `ALTER TABLE` the dashboard's own tables instead of
`CREATE TABLE IF NOT EXISTS`-ing their own, `supabase/schema.sql` must be applied to the
database *before* the backend's `init_db()` calls run for the first time. See
"Running locally" below.

### 3. One orchestrator — the frontend never calls tools directly
- `backend/app/routers/manager.py` (`POST /manager/chat`) is the **only** AI endpoint
  the frontend calls. `frontend/src/lib/aiManager.ts` is the **only** file in the
  frontend allowed to call it, and `frontend/src/components/dashboard/AiManagerWidget.tsx`
  (mounted globally in `DashboardLayout.tsx`) is the one UI surface for every AI action —
  strategy, creative, landing pages, Meta Ads, analytics, compliance, knowledge, memory,
  and support all go through this single chat interface, and the Manager decides
  internally which tool to run.
- The original fine-grained endpoints (`/strategy/generate`, `/creative/generate`,
  `/meta/campaigns/launch/...`, etc.) still exist, unmodified in behavior, for
  internal/admin/debug use — but nothing in the frontend calls them. They are not a
  second orchestration path: the Tool Registry calls the same `app/services/*` functions
  the Manager calls, this HTTP surface is just a thin, optional layer on top for ops
  tooling — now with the same auth + ownership enforcement as `/manager/chat` (see #4).

### 4. Authentication bridged, not rebuilt — plus a full ownership-check pass
Sign-up/sign-in/OTP/password reset are **unchanged** — still 100% Supabase Auth,
client-side, exactly as in LeadPilot Complete. `backend/app/auth.py` verifies the same
Supabase-issued JWT (via `SUPABASE_JWT_SECRET`) on every backend request. `profiles.role`
isn't in the JWT by default, so admin detection looks it up from the shared database
rather than trusting a claim that was never actually there.

Every fine-grained router (`approvals`, `creative`, `landingpage`, `meta_ads`,
`monitoring`, `strategy`, `support`, `knowledgebase`) now enforces per-business ownership
(`app/auth.assert_business_access` / `require_business_access`) the same way
`/manager/chat` does — not just "is logged in." A regular user can no longer read or act
on another business's drafts, campaigns, tickets, recommendations, or landing pages by
guessing an id; admins still can.

**Two real bugs were caught while doing this pass and fixed before shipping:** applying
auth at the *router* level (`dependencies=[Depends(get_current_user)]` on the whole
router) accidentally locked two genuinely public endpoints behind a login:
- `GET /lp/{page_id}` — the actual landing page real visitors land on after clicking a
  live Meta ad. It had zero reason to know about a LeadPilot session; router-wide auth
  would have 401'd every real lead, silently breaking the entire landing-page feature.
- `GET /meta/oauth/callback` — hit by Meta's own server redirecting the user's browser
  after they approve the ad-account connection. It carries no Bearer token at all;
  router-wide auth would have broken the Meta OAuth connect flow completely.

Both routers were switched to per-route auth so these two stay public while everything
else in the same file stays protected — see the comments at the top of
`app/routers/landingpage.py` and `app/routers/meta_ads.py`.

### 5. CORS tightened
`allow_origins=["*"]` → `config.ALLOWED_ORIGINS` (from env), since routes now carry
real client data instead of being an open local MVP.

### 6. Duplicate UI removed
The AI Manager's old standalone placeholder dashboard (`backend/app/static/*.html` —
plain HTML pages for approvals/recommendations/support, meant only for manually testing
the FastAPI backend before this merge) was deleted. LeadPilot Complete's React dashboard
is the one preserved, production UI, and it's now wired to the AI Manager instead.

### 7. Connection pooling, a SPA-routing bug, and a small leak — found on a closer pass
Three more real issues, caught by re-reading what was already shipped rather than
adding new surface area:
- **No connection pooling.** `app/db/base.py` opened a brand-new TCP connection to
  Postgres on every single store call (and, after #4 above, on every authenticated
  request too, since role lookup hits the DB). Under any real concurrent traffic that's
  needless latency per call and risks exhausting Supabase's connection limit. Now uses
  `psycopg2.pool.ThreadedConnectionPool` (sized via `DB_POOL_MIN`/`DB_POOL_MAX`), closed
  cleanly on FastAPI shutdown.
- **SPA client-side routing would 404 on refresh.** The frontend was originally served
  via `app.mount("/", StaticFiles(html=True))`, which only auto-serves `index.html` for
  directory-root requests — not for arbitrary React Router routes like
  `/dashboard/campaigns`. A hard refresh on any dashboard sub-page in production would
  have 404'd instead of loading the app. Replaced with an explicit catch-all route that
  serves the real file when one exists at that path (JS/CSS/favicon/...) and falls back
  to `index.html` otherwise.
- **Rate limiter memory growth.** `app/rate_limit.py`'s in-memory dict kept one entry
  per distinct user forever, even once their request history aged out — an unbounded,
  never-freed dict over the life of a long-running process. Added a cheap periodic sweep
  of empty entries.

### 8. Pluggable LLM provider
`app/services/llm_service.py` (used by the AI Manager's reasoning loop and every tool
that generates content) previously only supported a self-hosted Ollama server. That's
still the default for local dev, but is not something you'd want as the only brain
behind a hosted, multi-tenant SaaS — nobody else can reach your laptop's Ollama server.
Set `LLM_PROVIDER=anthropic` or `LLM_PROVIDER=openai` (with the matching API key) to
switch — every caller in the codebase only ever used `chat_json()`, `embed()`, and
`LLMError`, and none of them needed to change; the provider is chosen once, in this one
file. Embeddings (Knowledge/RAG tool only) have their own `EMBED_PROVIDER` knob since
Anthropic has no embeddings API.

### 9. Rate limiting on `/manager/chat`
`app/rate_limit.py` — a small in-process sliding-window limiter (20 requests/60s per
user by default), since each chat message can trigger multiple tool + LLM calls
internally and this endpoint previously had no limit at all. It's single-process only by
design; swap for a Redis-backed limiter (e.g. `slowapi`) if you run more than one
backend replica.

### 10. Deployment tooling
- `Dockerfile` — multi-stage build: builds the React frontend, then serves both the API
  and the built frontend from one backend container (matching "keep one backend"). Note:
  `frontend/.env` has local-dev values baked in (`VITE_API_BASE_URL=http://localhost:8000`)
  — the Dockerfile overrides this at build time via `--build-arg VITE_API_BASE_URL=""` so
  production doesn't ship pointing at localhost.
- `docker-compose.yml` — one-command local run against your real Supabase Postgres
  (doesn't run Postgres/Supabase itself).
- `.github/workflows/ci.yml` — backend syntax check + tests (if a `TEST_DATABASE_URL`
  secret is configured — see Follow-up) + frontend type-check and build.
- `.gitignore`, `backend/requirements-dev.txt` (adds `pytest`).

## Environment variables (new)
See `backend/.env.example` and `frontend/.env`:
- `DATABASE_URL` — the shared Postgres connection string
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET` — to verify frontend session tokens
- `ALLOWED_ORIGINS` — frontend origin(s) allowed to call the API
- `FRONTEND_DIST_PATH` — set only in production builds so FastAPI also serves the built React app
- `LLM_PROVIDER`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, `EMBED_PROVIDER` — see #8 above
- `VITE_API_BASE_URL` (frontend) — where the FastAPI backend lives in dev; leave empty in prod (same origin)

## Running locally
```bash
# 0. Apply supabase/schema.sql to your Postgres database first (Supabase SQL Editor,
#    or `psql $DATABASE_URL -f supabase/schema.sql`) — the backend's own tables now
#    ALTER a couple of these, so they must exist first.

# Backend
cd backend
pip install -r requirements.txt --break-system-packages
cp .env.example .env   # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_JWT_SECRET
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173, talks to the backend above via VITE_API_BASE_URL
```

Or with Docker (still needs your own Postgres/Supabase — see docker-compose.yml):
```bash
cp backend/.env.example .env   # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_JWT_SECRET
docker compose up --build
```

## Follow-up work (not done in this pass — scoped out, documented so it isn't silently missing)

1. **Apply `supabase/schema.sql` before first backend startup.** Now required (see
   "New setup-order dependency" above) — `meta_store.init_db()` and
   `landingpage_store.init_db()` will fail with "relation does not exist" against a
   database that doesn't have LeadPilot Complete's tables yet.
2. **Wire `frontend/src/lib/supabase.ts` reads to show AI-generated content.** Now
   that landing pages and Meta campaigns are the same rows, the dashboard's existing
   Landing Pages / Campaigns pages will already show AI Manager-created ones with no
   further backend change — worth a quick pass to make sure their UI handles the new
   optional fields (`ai_draft_id`, `template_id`, etc.) gracefully.
3. **Choose and configure a real LLM provider for production** (`LLM_PROVIDER=anthropic`
   or `openai` — see #8 above) and, if using Meta Ads for real, get
   `META_APP_ID`/`META_APP_SECRET` + App Review approval and flip `META_DRY_RUN=false`.
4. **CI tests need a `TEST_DATABASE_URL` repo secret** (a disposable Postgres instance —
   not production) to actually run; without it CI only does syntax/build checks. The
   test suite itself still assumes it can freely write/clean up rows, so point it at a
   throwaway database, not anything with real data.
5. **This has been carefully reviewed but not executed end-to-end** — no live Postgres,
   Ollama, or Meta sandbox was available in the environment this was built in. Before
   real users touch it: run it, sign up, chat with the AI Manager, generate a strategy,
   approve it, and (dry-run) launch a campaign, end to end, once.
