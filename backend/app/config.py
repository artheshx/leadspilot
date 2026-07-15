"""
Central config. All values overridable via .env / environment variables.
Zero-cost defaults: Ollama (local LLM), ChromaDB (local vector store), Pollinations (free image-gen).
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ---- Ollama (free local LLM) ----
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "llama3.1:8b")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))

# ---- LLM provider (production launch note) ----
# "ollama" (default) needs a self-hosted Ollama server — fine for local dev/demo,
# not something you stand behind as a hosted SaaS's only brain. Set LLM_PROVIDER
# to switch the AI Manager's reasoning + all tools (Strategy, Creative, Landing
# Page, Compliance, Recommendations, ...) to a hosted API with no infra to run.
# "anthropic" and "openai" both work with just an API key — no other code changes.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # "ollama" | "anthropic" | "openai" | "groq"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))

# Embeddings (used only by the Knowledge tool / RAG) have their own provider
# knob since Anthropic doesn't offer an embeddings API — default stays on
# Ollama unless you point it at OpenAI's.
EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "ollama")  # "ollama" | "openai"
OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")

# ---- ChromaDB (free local vector store) ----
CHROMA_PATH = os.getenv("CHROMA_PATH", str(BASE_DIR / "storage" / "chroma"))

# ---- Image generation ----
# "pollinations" = free, no key. "ideogram" / "dalle" = paid, for later upgrade.
IMAGE_GEN_PROVIDER = os.getenv("IMAGE_GEN_PROVIDER", "pollinations")
POLLINATIONS_BASE_URL = os.getenv("POLLINATIONS_BASE_URL", "https://image.pollinations.ai/prompt")
IDEOGRAM_API_KEY = os.getenv("IDEOGRAM_API_KEY", "")  # only needed if provider = ideogram
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")      # only needed if provider = dalle

# ---- Storage ----
STORAGE_PATH = os.getenv("STORAGE_PATH", str(BASE_DIR / "storage"))
GENERATED_IMAGES_PATH = os.path.join(STORAGE_PATH, "generated")

# ---- Unified app: single Postgres database + Supabase auth bridge ----
# See app/db/base.py and app/auth.py. Required in production; app/db/base.py
# and app/auth.py raise a clear error at import time if these are missing.
DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# ---- Admin CRM: secrets-at-rest encryption ----
# Fernet key that encrypts admin-entered secrets (AI provider API keys, Meta
# app secret, WhatsApp access token, ...) before they're stored in Postgres.
# See app/services/crypto_service.py. Required in production; empty by
# default so local dev without the Admin CRM configured still boots.
ADMIN_SECRETS_KEY = os.getenv("ADMIN_SECRETS_KEY", "")

# Comma-separated list of allowed frontend origins, e.g.
# "https://app.leadpilot.com,http://localhost:5173". Replaces the old
# CORS allow_origins=["*"] now that this backend handles authenticated,
# per-client business data.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Where the built frontend (frontend/dist, from `npm run build`) lives so
# this one backend process can serve both the API and the dashboard UI in
# production. Left unset (empty) in local dev, where Vite's own dev server
# serves the frontend instead and proxies /api to this backend.
FRONTEND_DIST_PATH = os.getenv("FRONTEND_DIST_PATH", "")

# ---- App ----
DEFAULT_CHUNK_SIZE = int(os.getenv("DEFAULT_CHUNK_SIZE", "800"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("DEFAULT_CHUNK_OVERLAP", "120"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))

# ---- Meta Marketing API ----
META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "http://localhost:8000/meta/oauth/callback")
META_API_VERSION = os.getenv("META_API_VERSION", "v20.0")
META_GRAPH_BASE_URL = os.getenv("META_GRAPH_BASE_URL", "https://graph.facebook.com")
# DRY_RUN=true (default) simulates every Meta API call and returns fake IDs instead
# of hitting the real Graph API. Keep this on until: (1) you have META_APP_ID/SECRET,
# (2) your app has ads_management approved in App Review. Flip to "false" only then.
META_DRY_RUN = os.getenv("META_DRY_RUN", "true").lower() == "true"
# Hard safety cap enforced again at the launch layer (defense in depth alongside
# the StrategyOutput validator) — no campaign can ever be launched above this.
META_MAX_MONTHLY_BUDGET_INR = int(os.getenv("META_MAX_MONTHLY_BUDGET_INR", "200000"))
