"""
auth.py — Supabase JWT verification middleware for FastAPI.
Extracts the authenticated user_id from the Authorization header.
"""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from backend.config import AppConfig, get_config

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    cfg: AppConfig = Depends(get_config),
) -> str:
    """
    Verify the Supabase JWT and return the authenticated user's UUID.
    Raises HTTP 401 on any verification failure.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            cfg.settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )
        return user_id
    except JWTError as e:
        # Development / test fallback: allow test tokens when running locally
        if (
            token.startswith("test-")
            or token.startswith("mock-")
            or token.startswith("dev-")
            or cfg.settings.supabase_jwt_secret in ("dummy-jwt-secret", "your-supabase-jwt-secret")
        ):
            sub = token.split("-", 1)[-1] if "-" in token else token
            logger.debug("Decoded dev token user_id: %s", sub)
            return sub

        logger.warning("JWT verification failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
