# syntax=docker/dockerfile:1

# ---- Stage 1: build the React dashboard ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

# frontend/.env (committed) has local-dev values (VITE_API_BASE_URL=http://localhost:8000)
# — wrong for a production build, where the backend serves the frontend itself
# (same origin). .env.production.local overrides it and is gitignored/build-only.
# Supabase URL/anon key are safe to keep as-is (public by design).
ARG VITE_API_BASE_URL=""
RUN echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production.local
RUN npm run build

# ---- Stage 2: the backend, serving the API + the built frontend ----
FROM python:3.11-slim AS backend
WORKDIR /app/backend

# psycopg2-binary needs libpq at runtime; kept minimal on purpose.
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV FRONTEND_DIST_PATH=/app/frontend/dist
ENV STORAGE_PATH=/app/backend/storage
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
