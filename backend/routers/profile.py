"""
profile.py — PUT /api/profile, GET /api/profile
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend.config import AppConfig, get_config
from backend.middleware.auth import get_current_user_id
from backend.schemas.profile import Profile, UpsertProfileRequest

router = APIRouter(prefix="/api", tags=["profile"])


@router.put("/profile", response_model=Profile)
async def upsert_profile(
    body: UpsertProfileRequest,
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> Profile:
    """Save or update user profile and topic preferences."""
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)

    # Upsert profile
    profile_row = db.table("profiles").upsert({
        "id": user_id,
        "display_name": body.display_name,
        "domain": body.domain,
        "experience_level": body.experience_level,
        "learning_goal": body.learning_goal,
        "preferred_duration": body.preferred_duration,
    }, on_conflict="id").execute()

    if not profile_row.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Profile save failed")

    # Replace topics: deactivate all, then upsert new ones
    db.table("topics").update({"is_active": False}).eq("user_id", user_id).execute()

    for topic in body.topics:
        db.table("topics").upsert({
            "user_id": user_id,
            "topic_name": topic.topic_name,
            "difficulty": topic.difficulty,
            "is_active": True,
        }).execute()

    # Fetch saved topics
    topics_row = db.table("topics").select("*").eq("user_id", user_id).eq("is_active", True).execute()

    p = profile_row.data[0]
    from backend.schemas.profile import Topic

    return Profile(
        id=p["id"],
        display_name=p["display_name"],
        domain=p["domain"],
        experience_level=p["experience_level"],
        learning_goal=p["learning_goal"],
        preferred_duration=p["preferred_duration"],
        topics=[
            Topic(
                id=t["id"],
                topic_name=t["topic_name"],
                difficulty=t["difficulty"],
                is_active=t["is_active"],
            )
            for t in (topics_row.data or [])
        ],
        created_at=p.get("created_at"),
        updated_at=p.get("updated_at"),
    )


@router.get("/profile", response_model=Profile)
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> Profile:
    """Fetch the authenticated user's profile."""
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)
    profile_row = (
        db.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    )
    if not profile_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    topics_row = db.table("topics").select("*").eq("user_id", user_id).eq("is_active", True).execute()
    p = profile_row.data[0]
    from backend.schemas.profile import Topic

    return Profile(
        id=p["id"],
        display_name=p["display_name"],
        domain=p["domain"],
        experience_level=p["experience_level"],
        learning_goal=p["learning_goal"],
        preferred_duration=p["preferred_duration"],
        topics=[
            Topic(id=t["id"], topic_name=t["topic_name"], difficulty=t["difficulty"], is_active=t["is_active"])
            for t in (topics_row.data or [])
        ],
        created_at=p.get("created_at"),
        updated_at=p.get("updated_at"),
    )
