"""
questions.py — GET /api/questions, POST /api/questions/generate
Exposes validated Question Generation Agent output to frontend games.
"""
from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, Query, status, HTTPException

from backend.agents.question_agent import QuestionAgent
from backend.config import AppConfig, get_config
from backend.middleware.auth import get_current_user_id
from backend.schemas.profile import Profile
from backend.schemas.question import (
    GeneratedQuestionItem,
    GenerateQuestionsRequest,
    QuestionListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["questions"])


def _load_user_profile(user_id: str, cfg: AppConfig) -> dict[str, Any]:
    from backend.db.supabase_client import get_service_client
    db = get_service_client(cfg)

    p_row = db.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    topics_rows = db.table("topics").select("*").eq("user_id", user_id).eq("is_active", True).execute()
    topics = topics_rows.data or []

    if p_row.data:
        profile_data = dict(p_row.data)
        profile_data["topics"] = topics
        return profile_data

    # Baseline default profile if user has not filled out profile yet
    return {
        "id": user_id,
        "display_name": "Practitioner",
        "domain": "Software Engineering & Architecture",
        "experience_level": "intermediate",
        "learning_goal": "interview_preparation",
        "preferred_duration": 90,
        "user_type": "professional",
        "topics": topics,
    }


def _persist_generated_questions(questions: list[dict[str, Any]], user_id: str, cfg: AppConfig) -> None:
    """Store generated questions in the trusted database for lookup during evaluation."""
    from backend.db.supabase_client import get_service_client
    db = get_service_client(cfg)

    for q in questions:
        try:
            db.table("questions").upsert({
                "id": q["id"],
                "domain": q.get("topic_name", "Software Engineering"),
                "topic": q.get("topic_name", "General"),
                "difficulty": q.get("difficulty", "intermediate"),
                "question_text": q["question"],
                "expected_concepts": q.get("expected_concepts", []),
                "evaluation_hints": q.get("evaluation_hints", ""),
                "is_active": True,
            }, on_conflict="id").execute()
        except Exception as e:
            logger.debug("Non-critical question upsert warning: %s", e)


@router.get("/questions", response_model=QuestionListResponse)
async def get_questions_for_user(
    count: int = Query(10, ge=1, le=20),
    force_refresh: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> QuestionListResponse:
    """
    Generate personalized questions for the authenticated user based on their saved
    profile, domain, experience level, college/seniority, and preferred duration.
    """
    profile_data = _load_user_profile(user_id, cfg)
    agent = QuestionAgent(cfg)

    try:
        result = agent.run(profile_data, requested_question_count=count)
        raw_questions = result.get("questions", [])

        # Validate each item through the schema
        validated_items: list[GeneratedQuestionItem] = []
        for q in raw_questions:
            item = GeneratedQuestionItem(
                id=str(q.get("id")),
                topic_id=str(q.get("topic_id", "topic_001")),
                topic_name=str(q.get("topic_name") or q.get("topic", "General")),
                question=str(q.get("question")),
                question_type=q.get("question_type") or q.get("game_type") or "concept_clarity",
                difficulty=q.get("difficulty", "intermediate"),
                target_duration_seconds=int(q.get("target_duration_seconds") or q.get("suggested_duration_seconds") or 90),
                expected_concepts=list(q.get("expected_concepts") or q.get("reference_concepts") or ["core mechanism"]),
                evaluation_hints=str(q.get("evaluation_hints") or q.get("hint") or "Assess clarity and trade-offs."),
            )
            validated_items.append(item)

        # Persist questions so Evaluator Agent can access trusted metadata
        _persist_generated_questions([item.model_dump() for item in validated_items], user_id, cfg)

        return QuestionListResponse(questions=validated_items)
    except Exception as e:
        logger.error("Failed to generate questions: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question generation failed: {str(e)}",
        )


@router.post("/questions/generate", response_model=QuestionListResponse)
async def generate_questions_custom(
    body: GenerateQuestionsRequest,
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> QuestionListResponse:
    """Generate questions with custom count or topic filters."""
    return await get_questions_for_user(
        count=body.count,
        force_refresh=True,
        user_id=user_id,
        cfg=cfg,
    )
