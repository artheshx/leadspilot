"""
Authentication bridge between LeadPilot Complete's existing auth (Supabase
Auth, unchanged — see requirement "keep authentication ... working") and
the AI Manager backend.

Sign-up/sign-in/email confirmation/password reset all happen client-side
against Supabase. What's new is that every request the frontend makes to *this*
backend (AI Manager chat + all tool routers) must carry the Supabase
session's access token, e.g.:

    const { data: { session } } = await supabase.auth.getSession()
    fetch(`${API_BASE_URL}/manager/chat`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      ...
    })

`get_current_user` verifies that token's signature against Supabase's JWT
secret and returns the caller's Supabase user id. Every router in this app
that touches business data now depends on it (see app/main.py), so the
frontend can never reach an AI Manager tool anonymously or on someone
else's behalf — closing the gap where /manager/chat used to accept any
business_id from an unauthenticated caller.

A note on `role`: Supabase's access token does NOT contain `profiles.role`
(admin/client) by default — that column lives only in Postgres. The JWT's
own top-level "role" claim is always the Postgres role "authenticated",
not the app's admin flag, so trusting claims for this would silently make
"is this user an admin?" always false. Since this backend now shares the
same Postgres database as the rest of the app (see app/db/base.py), we
just look `profiles.role` up directly instead.

business_id <-> user identity
------------------------------
LeadPilot Complete has no separate "businesses" table — `profiles.id`
(== `auth.users.id`) already identifies one client account. So the AI
Manager's `business_id` concept is simply that same Supabase user id.
`require_business_access` enforces that a request's `business_id` always
equals the token's own user id (regular users can only ever act on their
own business; a `role: admin` profile — see profiles.role in schema.sql —
is allowed through for support/admin tooling).
"""
import os
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from app.db.base import get_conn

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "client"  # from profiles.role ('client' | 'admin') — looked up in Postgres, not trusted from the JWT


def _decode_token(token: str) -> dict:
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            500,
            "Server misconfigured: SUPABASE_JWT_SECRET is not set. See backend/.env.example "
            "(Supabase Dashboard > Project Settings > API > JWT Settings).",
        )
    try:
        # Supabase access tokens are HS256, audience "authenticated".
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired — please sign in again.")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or tampered auth token.")


def _lookup_profile_role(user_id: str) -> str:
    """profiles.role isn't in the JWT (see module docstring) — read it from
    the same Postgres database this backend now shares with the dashboard."""
    with get_conn() as conn:
        row = conn.execute("SELECT role FROM profiles WHERE id = ?", (user_id,)).fetchone()
    return row["role"] if row and row.get("role") else "client"


def get_current_user(request: Request) -> CurrentUser:
    """FastAPI dependency: extracts + verifies the Supabase access token from
    the Authorization header. Use on every route that reads/writes business
    data — never trust a business_id the frontend sends unauthenticated."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization: Bearer <supabase_access_token> header.")
    token = auth_header.removeprefix("Bearer ").strip()
    claims = _decode_token(token)

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Auth token missing subject (user id).")

    role = _lookup_profile_role(user_id)

    return CurrentUser(id=user_id, email=claims.get("email"), role=role)


def require_business_access(business_id: str, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """A regular user may only act on their own business_id (== their own
    Supabase user id). Admins (profiles.role = 'admin') may act on any
    business_id, mirroring the admin dashboard's existing Supabase RLS
    policies (see supabase/schema.sql). Works as a FastAPI dependency when
    business_id is a path/query param FastAPI can auto-bind."""
    assert_business_access(business_id, user)
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """FastAPI dependency for admin-only routes (the Admin CRM router).
    Unlike require_business_access, there's no business_id to compare
    against here — admin routes act on global config / cross-tenant data,
    so the only check is profiles.role == 'admin'."""
    if user.role != "admin":
        raise HTTPException(403, "Admin access required.")
    return user


def assert_business_access(business_id: str, user: CurrentUser) -> None:
    """Same check as require_business_access, callable directly inside a
    handler — for when business_id comes from a request body field or has
    to be looked up from a related record (e.g. a draft's owning business)
    rather than being a plain path/query param FastAPI can auto-bind."""
    if user.role != "admin" and business_id != user.id:
        raise HTTPException(403, "You may only act on your own business account.")
