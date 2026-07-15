"""
Encryption for admin-configured secrets (AI provider API keys, Meta app
secret/webhook secret, WhatsApp access token, ...) so the Admin CRM never
writes plaintext credentials to Postgres.

Uses Fernet (AES-128-CBC + HMAC, from the `cryptography` package) with a
single symmetric key read from ADMIN_SECRETS_KEY (see app/config.py).
Mirrors the fail-fast pattern app/db/base.py uses for DATABASE_URL: any
endpoint that actually needs to encrypt/decrypt a secret raises a clear
500 if the key isn't configured, rather than silently storing plaintext.
"""
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app import config


def _require_key() -> bytes:
    if not config.ADMIN_SECRETS_KEY:
        raise HTTPException(
            500,
            "Server misconfigured: ADMIN_SECRETS_KEY is not set, so admin-configured "
            "secrets (AI provider keys, Meta/WhatsApp credentials) cannot be encrypted "
            "for storage. Generate one with: python -c \"from cryptography.fernet import "
            "Fernet; print(Fernet.generate_key().decode())\" and set it in the backend's "
            "environment. See backend/.env.example.",
        )
    return config.ADMIN_SECRETS_KEY.encode()


@lru_cache(maxsize=1)
def _fernet_for(key: bytes) -> Fernet:
    try:
        return Fernet(key)
    except Exception as e:
        raise HTTPException(500, f"ADMIN_SECRETS_KEY is not a valid Fernet key: {e}")


def encrypt_secret(plaintext: str) -> str:
    """Returns an opaque encrypted token safe to store in Postgres."""
    if plaintext is None:
        return ""
    f = _fernet_for(_require_key())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str) -> str:
    """Server-side only — never returned directly to the frontend. Used when
    the backend itself needs the real credential (e.g. to call a provider)."""
    if not token:
        return ""
    f = _fernet_for(_require_key())
    try:
        return f.decrypt(token.encode()).decode()
    except InvalidToken:
        raise HTTPException(500, "Stored secret could not be decrypted — ADMIN_SECRETS_KEY may have changed.")


def mask_secret(plaintext_or_none: str) -> str:
    """Display-safe masked form, e.g. 'sk-ab********************f9x2'.
    Never send the real secret to the frontend — only this."""
    if not plaintext_or_none:
        return ""
    s = plaintext_or_none
    if len(s) <= 8:
        return "*" * len(s)
    return f"{s[:4]}{'*' * 16}{s[-4:]}"


def looks_masked(value: str) -> bool:
    """True if `value` is (or looks like) an already-masked display value,
    meaning the caller didn't actually type a new secret and we should keep
    the existing stored one unchanged. Used by PATCH endpoints so re-saving
    a form without touching the key field doesn't wipe/overwrite it."""
    return not value or "*" in value
