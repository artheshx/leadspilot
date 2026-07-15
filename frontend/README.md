# LeadPilot — Full SaaS Platform

Done-for-you Meta Ads platform with client dashboard + admin panel.

## Quick Start

```bash
npm install
cp .env.example .env        # Fill in your Supabase keys
npm run dev                 # http://localhost:5173
```

## Deploy

### Option 1 — Netlify (drag & drop, easiest)
```
1. npm run build
2. Drag dist/ folder to netlify.com/drop
3. Site settings → Environment variables → add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
4. Redeploy
```

### Option 2 — Vercel
```
1. Push to GitHub
2. Import on vercel.com
3. Add env vars → Deploy
```

## Supabase Setup

```
1. supabase.com → New project
2. SQL Editor → paste supabase-schema.sql → Run All
3. Authentication → Providers → Email → enable **Confirm email**
4. Authentication → URL Configuration → set Site URL and add `http://localhost:5173/login` plus your production `/login` URL to Redirect URLs
5. Disable the Phone provider if it is enabled (this app does not use SMS verification)
6. Run `supabase/migrations/002_supabase_email_confirmation.sql` in the SQL Editor for an existing database; new databases can use `supabase/schema.sql`
7. Copy URL + anon key to `.env`
```

## Edge Functions (Meta Sync)

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref your-project-id

# Set secrets
supabase secrets set META_SYSTEM_ACCESS_TOKEN=your-token

# Deploy functions
supabase functions deploy sync-meta-leads
```

## Make yourself admin
```sql
-- Run in Supabase SQL Editor after signing up
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## Phases Completed

| Phase | Feature |
|-------|---------|
| 1 | Marketing site (7 pages, SEO, animations) |
| 2 | Auth (Supabase email confirmation, login, password reset) |
| 3 | Client dashboard (campaigns, leads, billing, support, settings) |
| 4 | Admin panel (users, campaigns, billing, support, meta accounts) |
| 5 | Meta Ads API (insights sync, lead sync, edge functions) |

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/signup` | Register and confirm email |
| `/login` | Sign in |
| `/dashboard` | Client overview |
| `/dashboard/campaigns` | Campaign management |
| `/dashboard/leads` | Lead table + CSV export |
| `/dashboard/billing` | Wallet + transactions |
| `/dashboard/support` | Ticket system |
| `/admin` | Admin overview |
| `/admin/users` | User management |
| `/admin/campaigns` | Approve/reject campaigns |
| `/admin/billing` | Confirm fund requests |
| `/admin/meta` | Meta account linking + sync |
