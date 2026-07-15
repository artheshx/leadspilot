# LeadsPilot — LeadPilot AI Manager Architecture

> **Architecture note:** the app is now orchestrated by one AI Manager reasoning over an
> independent Tool Registry (Business Analysis, Strategy, Creative, Landing Page, Meta Ads,
> Analytics, Knowledge, Memory, Compliance, Support) instead of a fixed agent pipeline.
> See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full design. Talk to it via
> `POST /manager/chat`. All endpoints below still work standalone for direct/fine-grained use.

## Original Phase 1-7 build (still fully functional underneath the AI Manager)

Zero ongoing API cost build: **Ollama** (local LLM + embeddings) + **ChromaDB** (local vector DB)
+ **Pollinations.ai** (free image-gen, no key) + **Pillow** (logo/brand overlay) + **Jinja2** (landing page templates) + **SQLite** (local DB).

## What's included in this build
- ✅ Knowledge Base module — upload PDF/text → chunk → embed → store (RAG)
- ✅ Strategy Engine — business prompt + RAG → validated structured Strategy JSON
- ✅ Creative Engine — AI image + logo/brand-color overlay + AI ad copy
- ✅ Approval Gate #1 — Golden Rule enforced in code (no re-deciding, permanent audit log) + dashboard UI
- ✅ Meta Ads Launch — OAuth connection flow + Campaign/AdSet/Ad creation via Graph API, gated so it can
  **only** fire on an already-approved draft, can't double-launch, and re-checks the budget cap at the launch layer too. Ships in **DRY_RUN mode by default**.
- ✅ **Landing Page Engine** — 3 parameterized templates (`lead-gen-local-service`, `ecommerce-product`,
  `coaching-signup`) + a `generic` fallback, AI content-fill (headline/offer/bullets/CTA/form fields),
  rendered to static HTML and served at `/lp/{id}`. Optionally attached to a draft so it shows up
  alongside Strategy + Creative at Approval Gate #1.
- ✅ **Monitoring Module** — pulls a daily performance snapshot per campaign (real Graph API Insights,
  or realistic simulated numbers in DRY_RUN) and appends it to an audit-friendly `performance_logs` table.
- ✅ **Recommendation Engine** — LLM compares recent performance vs. the campaign's own KPIs and produces
  a plain-language recommendation (`pause_creative` / `increase_budget` / `decrease_budget` /
  `change_targeting` / `no_action`) with a confidence level.
- ✅ **Approval Gate #2** — same non-bypassable Golden Rule pattern as Gate #1: a recommendation can't be
  re-decided once approved/rejected, and can only be *applied* to the real Meta campaign after it's
  approved — approving and applying are two separate, deliberate actions.
- ✅ **Support Escalation** — auto-files a ticket on any API failure or low-confidence AI output across
  every module (strategy, creative, landing page, launch, recommendations), plus a dashboard for filing
  and resolving tickets manually.
- ✅ Three linked dashboards: `/dashboard/index.html` (Approval Gate #1), `/dashboard/recommendations.html`
  (Approval Gate #2), `/dashboard/support.html` (ticket triage).

## 1. Install Ollama (one-time, free)
Download from https://ollama.com for your OS, then:
```bash
ollama serve                      # starts the local LLM server
ollama pull llama3.1:8b           # main reasoning model (~4.7GB)
ollama pull nomic-embed-text      # embedding model for RAG (~270MB)
```
No account, no API key, no per-request cost. Runs on CPU (slower) or GPU (faster) — whatever machine you deploy this on.

> If `llama3.1:8b` is too heavy for your server's RAM, swap to a lighter model in `.env`:
> `OLLAMA_LLM_MODEL=qwen2.5:7b` or even `OLLAMA_LLM_MODEL=phi3:mini`

## 2. Install Python dependencies
```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Configure
```bash
cp .env.example .env
# defaults already point to local Ollama + local Chroma + local SQLite + free Pollinations — no keys needed
```

## 4. Run the API
```bash
uvicorn app.main:app --reload --port 8000
```
- Swagger docs: http://localhost:8000/docs
- **Approval dashboard: http://localhost:8000/dashboard/**

## 5. Try the full flow
```bash
# 1) Upload a strategy PDF (optional — works fine without one too)
curl -X POST http://localhost:8000/knowledgebase/upload \
  -F "business_id=biz_123" -F "file=@your_strategy_notes.pdf"

# 2) Generate a strategy from a one-line business description
curl -X POST http://localhost:8000/strategy/generate \
  -H "Content-Type: application/json" \
  -d '{"business_id":"biz_123","business_prompt":"I run a home bakery in Indore, want more orders for custom cakes"}'

# 3) Take that strategy JSON + your brand kit and generate a creative
curl -X POST http://localhost:8000/creative/generate \
  -H "Content-Type: application/json" \
  -d '{
        "business_id":"biz_123",
        "strategy": { ...output from step 2... },
        "brand": {"business_name":"Sweet Treats Bakery","logo_path":"/path/to/logo.png","primary_color":"#D9455F"}
      }'

# 4) Put strategy + creative in front of the human for approval
curl -X POST http://localhost:8000/approvals/drafts \
  -H "Content-Type: application/json" \
  -d '{"business_id":"biz_123","strategy":{...},"creative":{...}}'

# 5) Open http://localhost:8000/dashboard/, type "biz_123", click Load,
#    and Approve or Reject the campaign — the decision is now permanently logged.

# 6) Connect a Meta Ad Account (in DRY_RUN mode this is simulated — no real Facebook needed to test)
curl "http://localhost:8000/meta/oauth/url?business_id=biz_123"
# -> open the returned oauth_url in a browser, approve, Meta redirects to /meta/oauth/callback automatically

# 7) Launch the approved draft — ONLY works if step 5 approved it
curl -X POST http://localhost:8000/meta/campaigns/launch/{draft_id} \
  -H "Content-Type: application/json" \
  -d '{"launched_by":"owner@example.com"}'

# 8) (Optional, can happen any time after step 2) Generate a landing page for the same strategy+brand
curl -X POST http://localhost:8000/landingpage/generate \
  -H "Content-Type: application/json" \
  -d '{"business_id":"biz_123","strategy":{...from step 2...},"brand":{...same brand as step 3...}}'
# -> open the returned published_url (e.g. http://localhost:8000/lp/{id}) to preview it

# 9) Pull a performance snapshot for a launched campaign (simulated numbers in DRY_RUN)
curl -X POST http://localhost:8000/monitoring/pull/{campaign_id}

# 10) Ask the Recommendation Engine what to do about it
curl -X POST http://localhost:8000/monitoring/recommend/{campaign_id}

# 11) Open http://localhost:8000/dashboard/recommendations.html, type "biz_123", Load,
#     and Approve/Reject — this is Approval Gate #2, same Golden Rule as the campaign gate.

# 12) Only after approving, apply it to the real (or simulated) Meta campaign:
curl -X POST http://localhost:8000/monitoring/recommendations/{rec_id}/apply \
  -H "Content-Type: application/json" -d '{"applied_by":"owner@example.com"}'

# 13) File or review support tickets (auto-filed on failures across every module above)
curl "http://localhost:8000/support/tickets?business_id=biz_123"
# or open http://localhost:8000/dashboard/support.html
```

## Going live for real on Meta (when you're ready)
1. Create a Meta App at developers.facebook.com → add the Marketing API product
2. Submit for App Review requesting `ads_management` (this takes 1-2 weeks — start early)
3. Fill in `.env`: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (must match what you register in the App)
4. Set `META_DRY_RUN=false`
5. Everything else — the OAuth flow, launch endpoint, safety gates — is unchanged

## Running the automated tests
These test pure logic and run without Ollama or real Meta credentials:
```bash
python3 tests/test_chunking.py
python3 tests/test_creative_overlay.py
python3 tests/test_strategy_schema.py
python3 tests/test_approval_store.py         # Golden Rule + audit log integrity (Approval Gate #1)
python3 tests/test_meta_ads_launch.py        # launch gate: no-launch-without-approval, no double-launch, budget cap
python3 tests/test_landingpage.py            # landing page store + template selection
python3 tests/test_monitoring.py             # performance pull/store, dry-run insights, pause/budget-update
python3 tests/test_recommendation_gate.py    # Golden Rule + audit log integrity (Approval Gate #2)
python3 tests/test_support.py                # ticket lifecycle + escalate() helper
```
(All were run and verified during this build — all passing. Note: `test_creative_overlay.py` and
`test_strategy_schema.py` need `pydantic`/`Pillow` installed — run `pip install -r requirements.txt`
first if those two specifically fail to import.)

## Upgrading later (when budget allows)
Swap providers via `.env` only — no code changes needed in routers:
- `IMAGE_GEN_PROVIDER=ideogram` + `IDEOGRAM_API_KEY=...` → sharper creatives with in-image text
- Point `OLLAMA_BASE_URL` at a hosted Ollama instance, or switch `llm_service.py` to call Claude/OpenAI directly, when you want stronger reasoning than a local 7-8B model gives you.
- SQLite → Postgres: swap the connection logic in `app/db/approval_store.py` only; function signatures stay the same so nothing else changes.

## Safety rails already built in
- `budget_suggestion_inr` has a hard cap (₹2,00,000) — the AI cannot suggest an absurd budget even by mistake, per the PRD's #1 risk.
- Strategy JSON is schema-validated with automatic retry if the model returns malformed output.
- **Golden Rule enforced at the database layer (Approval Gate #1)**: `record_decision()` refuses to act on a draft that already has a final decision — this can't be bypassed by calling the API twice or racing requests.
- **Launch gate (Phase 4)**: the launch endpoint checks (1) draft status is exactly `approved`, (2) this draft hasn't already been launched, (3) a Meta account is connected, (4) budget is within cap — again, independently of the Strategy validator. All four checks are covered by automated tests.
- **Golden Rule enforced again for the Recommendation Engine (Approval Gate #2)**: `recommendation_store.record_decision()` refuses to re-decide a recommendation, and `mark_applied()` refuses unless status is exactly `approved` — so nothing the AI recommends (pausing a campaign, changing budget) ever reaches Meta without an explicit, logged, one-time approval, and approving is a separate action from applying.
- Campaigns are created **PAUSED** on Meta's side even in live mode — going properly live is always a distinct, deliberate action.
- `META_DRY_RUN=true` by default — nothing can hit the real Meta API or spend real money until you explicitly turn this off. This also applies to Insights pulls (simulated data) and pause/budget-update calls.
- Every failure path (strategy/creative/landing-page generation, Meta OAuth, campaign launch, recommendation generation/apply) auto-files a Support ticket via `support_service.escalate()` so a business owner is never just staring at a raw error.
- Every module is isolated by `business_id` (multi-tenant safe) — verified by test.

## Folder structure
```
leadspilot/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # all settings (env-driven)
│   ├── models.py            # Pydantic schemas
│   ├── services/
│   │   ├── chunking.py           # KB text chunker
│   │   ├── rag_service.py        # ChromaDB + Ollama embeddings
│   │   ├── llm_service.py        # Ollama chat/JSON/embeddings wrapper
│   │   ├── strategy_service.py
│   │   ├── creative_service.py
│   │   ├── meta_ads_service.py   # Graph API client, DRY_RUN-safe (launch, insights, pause, budget update)
│   │   ├── landingpage_service.py   # template select + AI content-fill + render-to-HTML
│   │   ├── monitoring_service.py    # pulls performance snapshots
│   │   ├── recommendation_service.py # LLM analysis of performance vs KPIs
│   │   └── support_service.py       # best-effort ticket escalation helper
│   ├── db/
│   │   ├── approval_store.py     # SQLite: campaign_drafts + append-only approvals log (Gate #1)
│   │   ├── meta_store.py         # SQLite: meta_accounts + launched campaigns
│   │   ├── landingpage_store.py  # SQLite: landing_pages
│   │   ├── performance_store.py  # SQLite: performance_logs (append-only)
│   │   ├── recommendation_store.py # SQLite: recommendations + append-only decisions log (Gate #2)
│   │   └── support_store.py      # SQLite: support_tickets
│   ├── routers/
│   │   ├── knowledgebase.py
│   │   ├── strategy.py
│   │   ├── creative.py
│   │   ├── approvals.py
│   │   ├── meta_ads.py
│   │   ├── landingpage.py    # /landingpage/*, and /lp/{id} which serves the static HTML
│   │   ├── monitoring.py     # /monitoring/* — pull, recommend, approve/reject/apply
│   │   └── support.py        # /support/tickets*
│   └── static/
│       ├── index.html            # Approval Gate #1 dashboard
│       ├── recommendations.html  # Approval Gate #2 dashboard
│       └── support.html          # ticket triage dashboard
├── tests/
├── requirements.txt
└── .env.example
```
