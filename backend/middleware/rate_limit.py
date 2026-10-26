"""
rate_limit.py — Per-user rate limiting using slowapi.
Applied to transcribe and evaluate endpoints.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Keyed by IP for now; can be extended to user_id by replacing key_func
limiter = Limiter(key_func=get_remote_address)
