# LeadPilot — Unified

One codebase: LeadPilot Complete's dashboard/auth/billing frontend, powered internally
by the LeadPilot AI Manager backend. Previously two separate projects/repos; see
[`ARCHITECTURE_MERGED.md`](./ARCHITECTURE_MERGED.md) for exactly what changed and why,
and what's intentionally left as documented follow-up.

```
leadpilot/
├── backend/      FastAPI — API, AI Manager, Tool Registry, and (in prod) serves frontend/dist
├── frontend/     React/Vite dashboard — unchanged UI, now calls backend/ for all AI actions
└── supabase/     Existing schema, migrations, edge functions (unchanged)
```

- Auth, billing, campaigns/leads CRUD, and the dashboard UI: **unchanged**, still Supabase.
- Every AI action in the dashboard (the sparkle button, bottom-right, on every dashboard
  page): calls `POST /manager/chat` on the FastAPI backend — the **one** orchestrator —
  which decides which of its 9 tools (Business, Strategy, Creative, Landing Page, Meta
  Ads, Analytics, Compliance, Knowledge, Memory, Support) to use.
- One Postgres database for everything (see `backend/app/db/base.py`).

## Quick start
```bash
cd backend && pip install -r requirements.txt --break-system-packages
cp backend/.env.example backend/.env   # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_JWT_SECRET
uvicorn app.main:app --reload --port 8000 --app-dir backend

cd frontend && npm install && npm run dev
```

Full details, env vars, and the merge rationale: [`ARCHITECTURE_MERGED.md`](./ARCHITECTURE_MERGED.md).
Backend-specific internals (the AI Manager's own design): [`backend/ARCHITECTURE.md`](./backend/ARCHITECTURE.md).
