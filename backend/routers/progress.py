"""
progress.py — GET /api/progress
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend.config import AppConfig, get_config
from backend.middleware.auth import get_current_user_id
from backend.schemas.profile import UserProgress

router = APIRouter(prefix="/api", tags=["progress"])


@router.get("/progress", response_model=UserProgress)
async def get_progress(
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> UserProgress:
    """Return the user's XP, session count, and streak."""
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)
    row = (
        db.table("user_progress")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not row.data:
        # Return zeroed progress for new users
        return UserProgress(user_id=user_id)

    p = row.data
    return UserProgress(
        user_id=p["user_id"],
        total_xp=p["total_xp"],
        completed_sessions=p["completed_sessions"],
        current_streak=p["current_streak"],
        last_practice_date=p.get("last_practice_date"),
        updated_at=p.get("updated_at"),
    )
