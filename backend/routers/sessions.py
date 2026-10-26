"""
sessions.py — POST /api/sessions, GET /api/sessions
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.config import AppConfig, get_config
from backend.middleware.auth import get_current_user_id
from backend.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    PracticeSession,
    SessionListResponse,
)

router = APIRouter(prefix="/api", tags=["sessions"])


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(
    body: CreateSessionRequest,
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> CreateSessionResponse:
    """
    Create a new practice session for a selected question.
    Supports both curated questions and dynamically generated agent questions.
    """
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)

    question_text = body.question
    difficulty = body.difficulty or "intermediate"
    target_duration = body.target_duration_seconds or 90
    expected_concepts = body.expected_concepts or []
    evaluation_hints = body.evaluation_hints or ""

    # Check if question exists in trusted DB
    q_row = (
        db.table("questions")
        .select("id, question_text, topic, difficulty, expected_concepts, evaluation_hints")
        .eq("id", body.question_id)
        .maybe_single()
        .execute()
    )

    if q_row.data:
        question_text = q_row.data.get("question_text", question_text)
        difficulty = q_row.data.get("difficulty", difficulty)
        expected_concepts = q_row.data.get("expected_concepts", expected_concepts)
        evaluation_hints = q_row.data.get("evaluation_hints", evaluation_hints)
    elif question_text:
        # Register the dynamic question into trusted storage
        db.table("questions").upsert({
            "id": body.question_id,
            "domain": "General Practice",
            "topic": body.topic_id,
            "difficulty": difficulty,
            "question_text": question_text,
            "expected_concepts": expected_concepts,
            "evaluation_hints": evaluation_hints,
            "is_active": True,
        }, on_conflict="id").execute()
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Enforce safe duration limits (hard max: 180s, min: 30s)
    safe_duration = max(30, min(180, target_duration))

    row = (
        db.table("practice_sessions")
        .insert({
            "user_id": user_id,
            "topic_id": body.topic_id,
            "question_id": body.question_id,
            "game_type": body.game_type,
            "question": question_text,
            "difficulty": difficulty,
            "target_duration_seconds": safe_duration,
            "status": "ready",
        })
        .execute()
    )

    sess = row.data[0]
    return CreateSessionResponse(
        session=PracticeSession(
            id=sess["id"],
            user_id=sess["user_id"],
            topic_id=sess["topic_id"],
            game_type=sess["game_type"],
            question_id=sess.get("question_id"),
            question=sess["question"],
            difficulty=sess.get("difficulty", difficulty),
            target_duration_seconds=sess.get("target_duration_seconds", safe_duration),
            status=sess["status"],
            created_at=sess.get("created_at"),
        )
    )


class SubmitTypedAnswerRequest(CreateSessionRequest):
    transcript: str


@router.post("/sessions/{session_id}/typed-answer")
async def submit_typed_answer(
    session_id: str,
    payload: dict[str, str],
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
):
    """
    Fallback for when microphone is unavailable: submit typed answer directly.
    """
    from backend.db.supabase_client import get_service_client
    db = get_service_client(cfg)

    transcript = payload.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Answer cannot be empty")

    session_row = db.table("practice_sessions").select("*").eq("id", session_id).eq("user_id", user_id).maybe_single().execute()
    if not session_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Store transcript in evaluations table
    db.table("evaluations").upsert({
        "session_id": session_id,
        "transcript": transcript,
        "score_breakdown": {},
        "overall_score": 0,
        "feedback": {},
        "confidence": "medium",
        "needs_retry": len(transcript.split()) < 5,
    }, on_conflict="session_id").execute()

    # Transition to evaluating status
    db.table("practice_sessions").update({
        "status": "evaluating",
        "duration_seconds": int(payload.get("duration_seconds", 60)),
    }).eq("id", session_id).execute()

    return {"status": "ok", "session_id": session_id, "transcript": transcript}


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> SessionListResponse:
    """Return the authenticated user's practice history."""
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)
    rows = (
        db.table("practice_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    sessions = [
        PracticeSession(
            id=r["id"],
            user_id=r["user_id"],
            topic_id=r["topic_id"] or "",
            game_type=r["game_type"],
            question=r["question"],
            status=r["status"],
            duration_seconds=r.get("duration_seconds"),
            created_at=r.get("created_at"),
            completed_at=r.get("completed_at"),
        )
        for r in (rows.data or [])
    ]

    return SessionListResponse(sessions=sessions, total=len(sessions))
