"""
A minimal, dependency-free rate limiter for POST /manager/chat.

Every message can trigger several tool calls and LLM calls internally, so
this endpoint is the one place real cost/abuse exposure lives once
LLM_PROVIDER points at a paid API instead of a free local Ollama server —
and previously had zero limit on it.

This is a single-process, in-memory sliding window — intentionally simple.
It's the right amount of protection for a single backend instance; it does
NOT coordinate across multiple instances/replicas. If you deploy more than
one backend process behind a load balancer, swap this for a shared store
(Redis, e.g. via the `slowapi` package) — the interface below
(`check(key) -> None | raises`) is small enough to swap without touching
callers.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException

# Generous defaults for a chat-style endpoint; tune via env if needed.
MAX_REQUESTS = 20
WINDOW_SECONDS = 60

_lock = Lock()
_hits: dict[str, deque] = defaultdict(deque)


def check_rate_limit(key: str, max_requests: int = MAX_REQUESTS, window_seconds: int = WINDOW_SECONDS) -> None:
    """Raises HTTPException(429) if `key` (e.g. a user id) has made more than
    `max_requests` calls in the trailing `window_seconds`. Call this at the
    top of a route handler — cheap (no I/O), safe under concurrent requests."""
    now = time.monotonic()
    with _lock:
        hits = _hits[key]
        cutoff = now - window_seconds
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= max_requests:
            retry_after = int(window_seconds - (now - hits[0])) + 1
            raise HTTPException(
                429,
                f"Too many requests to the AI Manager — please wait {retry_after}s and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)

        # _hits keeps one deque per distinct key forever otherwise — with many
        # distinct users that's an unbounded, never-freed dict over the life
        # of the process. Occasionally sweep out keys with nothing recent.
        if len(_hits) > 1000 and int(now) % 50 == 0:
            stale = [k for k, v in _hits.items() if not v]
            for k in stale:
                del _hits[k]
