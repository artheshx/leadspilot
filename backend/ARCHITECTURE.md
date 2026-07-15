# LeadPilot AI Manager Architecture

This replaces the old fixed pipeline —

```
Business Agent → Strategy Agent → Creative Agent → Landing Page Agent →
Campaign Agent → Analytics Agent → Support Agent
```

— with a single **AI Manager (Brain)** reasoning over an independent **Tool Registry**,
Emergent-style:

```
                        ┌───────────────────────┐
   user message  ─────► │  LeadPilot AI Manager  │ ─────► final response
                        │        (Brain)         │
                        └──────────┬─────────────┘
                                   │  one tool call at a time
                                   ▼
                        ┌───────────────────────┐
                        │      Tool Registry     │
                        ├───────────────────────┤
                        │ business_analysis_tool │
                        │ strategy_tool          │
                        │ creative_tool          │
                        │ landing_page_tool      │
                        │ meta_ads_tool          │
                        │ analytics_tool         │
                        │ knowledge_tool         │
                        │ memory_tool            │
                        │ compliance_tool        │
                        │ support_tool           │
                        └───────────────────────┘
```

No tool ever calls another tool. Only the Manager decides what happens next,
one step at a time, and only the Manager decides when a write action is
actually confirmed.

## Where everything lives

```
app/
  tools/            Tool wrappers — one file per tool, each exposing a single
                     handler(**kwargs) -> dict. Every tool file imports only
                     from app.services / app.db, never from a sibling tool.
    base.py          Tool dataclass + ToolError
    registry.py      Aggregates all Tool instances; the only file that
                     imports every tool module together
    business_tool.py, strategy_tool.py, creative_tool.py,
    landingpage_tool.py, meta_ads_tool.py, analytics_tool.py,
    knowledge_tool.py, memory_tool.py, compliance_tool.py, support_tool.py

  manager/          The Brain
    prompts.py       System prompt: rules, tool catalog, business memory
    ai_manager.py    The reasoning loop (see below)

  services/         Unchanged business logic from the original build, plus
                     two new services the new tools needed:
    business_service.py     NEW — Business Analysis Tool's LLM call
    compliance_service.py   NEW — Compliance Tool's LLM call
    strategy_service.py, creative_service.py, landingpage_service.py,
    meta_ads_service.py, monitoring_service.py, recommendation_service.py,
    rag_service.py, support_service.py, llm_service.py   — all untouched
    (meta_ads_service.py gained get_pixels / create_pixel / delete_campaign,
    additively, to cover the full Meta Ads Tool responsibility list)

  db/               Storage, unchanged except three additions:
    memory_store.py         NEW — durable per-business facts + winning creatives
    conversation_store.py   NEW — rolling chat history per business
    pending_action_store.py NEW — generic human-approval gate for ad-hoc
                             mutating Meta actions (pixel create, pause,
                             budget change, delete) requested directly in chat
    approval_store.py, meta_store.py, landingpage_store.py,
    performance_store.py, recommendation_store.py, support_store.py
    — all untouched, and still the approval gates for campaign launch and
    performance-driven changes respectively

  routers/
    manager.py       NEW — POST /manager/chat, the conversational front door
    (all Phase 1-7 routers — strategy, creative, approvals, meta_ads,
    landingpage, monitoring, support, knowledgebase — are untouched and
    still work standalone, for direct/fine-grained or dashboard use)
```

## The reasoning loop (`app/manager/ai_manager.py`)

Each call to `POST /manager/chat` runs this loop (max 6 steps as a safety
valve):

1. Load the business's memory (`memory_tool`) and last ~12 conversation turns.
2. Ask the LLM, given the tool catalog + memory + transcript-so-far, to
   return **one** JSON decision:
   - `call_tool` — run exactly one tool with the given args
   - `ask_user` — stop and ask a clarifying question
   - `final_response` — stop and answer
3. If `call_tool`: run it through the registry, append the result (or error)
   to the turn's scratchpad, and go back to step 2. A failing tool is
   retried once; a second failure gets logged to `support_tool.escalate`
   and surfaced to the Manager on its next reasoning step so it can explain,
   ask for what's missing, or try a different approach.
4. Stop on `ask_user` / `final_response`, or after 6 steps as a fallback.

This mirrors exactly the two examples in the spec — "I want more leads"
walks Business → Strategy → Creative → Landing → Compliance → Meta Ads;
"My ROAS dropped" walks Meta Ads (read) → Analytics → Knowledge → Strategy —
except which tools fire, and in what order, is a runtime decision made by
the LLM each turn, not a hardcoded call chain.

## Human approval, kept non-bypassable

The original build's Golden Rule — *no write action on a client's ad account
ever executes without a logged human approval* — is preserved and
centralized in `meta_ads_tool.py`, reusing the two existing gates and adding
a third for everything else:

| Write action | Gate | Table |
|---|---|---|
| Initial campaign launch | `stage_campaign` → `approve_and_launch` | `campaign_drafts` / `approvals` (existing) |
| Pause / budget change from a recommendation | `analytics_tool` stages it → `apply_recommendation` | `recommendations` / `recommendation_decisions` (existing) |
| Pixel creation, ad-hoc pause, ad-hoc budget change, delete | `create_pixel` / `pause_campaign` / `update_budget` / `delete_campaign` → `confirm_pending_action` | `pending_actions` (new) |

Staging a write action is always safe — it just writes a "pending" row.
**Executing** one only ever happens via an `approve_and_launch` /
`apply_recommendation` / `confirm_pending_action` tool call, and the Manager's
system prompt explicitly forbids making that call unless the user's most
recent message is an unambiguous approval. This is defense in depth on top
of (not instead of) the original per-action safety checks already inside
`meta_ads_service.py` (budget cap, no double-launch, etc.) — those are
untouched.

## Memory

`memory_tool` / `db/memory_store.py` gives the Manager durable, cross-session
recall: business profile, brand, preferences, and winning creatives are
loaded automatically at the start of every turn (shown in the system
prompt) so the user never has to repeat their business description, and the
Manager can say things like "reuse the same audience as last time."
`business_analysis_tool` writes into this store automatically the first
time a business describes itself.

## Compliance

`compliance_tool` / `services/compliance_service.py` is new: an LLM check of
ad/landing copy against Meta policy risk areas (personal attribute claims,
prohibited/unrealistic claims, restricted categories, misleading pricing),
returning a risk level, specific issues, safer rewritten alternatives, and a
rejection-risk estimate. It optionally pulls extra context from a shared
`meta_policies` knowledge-base collection if your team ingests Meta's own
policy docs there via the existing `/knowledgebase/upload` endpoint. The
Manager is instructed to run this on creative/landing copy before staging a
campaign.

## Error handling

Every tool call goes through `Tool.run()`, which normalizes any failure into
a single `ToolError`. The Manager's loop retries once, then surfaces the
error as part of the transcript for its *next* reasoning step — so a broken
tool never crashes the whole turn, and the Manager can decide to ask the
user for missing info, try a different tool, or (via `support_tool`) file a
ticket, instead of the request just failing.

## Using it

```
POST /manager/chat
{"business_id": "biz_123", "message": "I run a home bakery in Indore and want more leads"}
```//
returns
```
{"message": "...", "awaiting_user": true, "trace": []}
```
Pass `"debug": true` to get the step-by-step tool-call trace back for
inspection. All the original Phase 1-7 endpoints keep working exactly as
before for direct calls or the existing dashboards — `/manager/chat` is an
additional conversational layer on top, not a replacement for them.

## Extending it

Adding a new tool is: write `app/tools/my_tool.py` exposing a `TOOL = Tool(...)`,
add it to the list in `app/tools/registry.py`. Nothing else changes — the
Manager picks it up automatically because it reasons over
`render_tool_catalog()`, not a hardcoded call graph.
