"""Supabase session authentication and application-role authorization."""
import os
from functools import lru_cache
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
    role: str = "client"


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    """Return a cached verifier for Supabase's current asymmetric signing keys."""
    if not SUPABASE_URL:
        raise HTTPException(500, "Server misconfigured: SUPABASE_URL is not set.")
    return jwt.PyJWKClient(f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json")


def _decode_token(token: str) -> dict:
    """Verify a Supabase access token using its declared signing algorithm."""
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")

        if algorithm == "ES256":
            # Modern Supabase projects publish public keys through JWKS. The
            # token's `kid` selects the correct key, enabling safe key rotation.
            signing_key = _jwks_client().get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL.rstrip('/')}/auth/v1",
            )

        if algorithm == "HS256":
            # Backward-compatible support for legacy Supabase JWT secrets.
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    500,
                    "Server received a legacy HS256 token but SUPABASE_JWT_SECRET is not set.",
                )
            return jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )

        raise HTTPException(401, f"Unsupported Supabase JWT signing algorithm: {algorithm!r}.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired. Please sign in again.")
    except HTTPException:
        raise
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or tampered auth token.")


def _lookup_profile_role(user_id: str) -> str:
    """Read the application role from the shared Supabase Postgres database."""
    with get_conn() as conn:
        row = conn.execute("SELECT role FROM profiles WHERE id = ?", (user_id,)).fetchone()
    return row["role"] if row and row.get("role") else "client"


def get_current_user(request: Request) -> CurrentUser:
    """Extract and verify the signed-in user's Supabase access token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization: Bearer <supabase_access_token> header.")

    claims = _decode_token(auth_header.removeprefix("Bearer ").strip())
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Auth token missing subject (user id).")

    return CurrentUser(
        id=user_id,
        email=claims.get("email"),
        role=_lookup_profile_role(user_id),
    )


def require_business_access(business_id: str, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Permit clients to access only their business; admins can access all."""
    assert_business_access(business_id, user)
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Restrict Admin CRM routes to profiles.role == 'admin'."""
    if user.role != "admin":
        raise HTTPException(403, "Admin access required.")
    return user


def assert_business_access(business_id: str, user: CurrentUser) -> None:
    if user.role != "admin" and business_id != user.id:
        raise HTTPException(403, "You may only access your own business account.")
