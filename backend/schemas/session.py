"""
Pydantic schemas for practice sessions.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

GameType = Literal["spinner", "mystery_cards"]

SessionStatus = Literal[
    "ready",
    "recording",
    "submitting",
    "transcribing",
    "evaluating",
    "completed",
    "failed",
]

# Valid status transitions (server-side enforcement)
VALID_TRANSITIONS: dict[SessionStatus, list[SessionStatus]] = {
    "ready": ["recording"],
    "recording": ["submitting", "failed"],
    "submitting": ["transcribing", "failed"],
    "transcribing": ["evaluating", "failed"],
    "evaluating": ["completed", "failed"],
    "completed": [],
    "failed": [],
}


class PracticeSession(BaseModel):
    id: str
    user_id: str
    topic_id: str
    game_type: GameType
    question_id: str | None = None
    question: str
    difficulty: str = "intermediate"
    target_duration_seconds: int = 90
    status: SessionStatus = "ready"
    duration_seconds: int | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None


class CreateSessionRequest(BaseModel):
    topic_id: str
    game_type: GameType
    question_id: str
    question: str | None = None
    difficulty: str | None = "intermediate"
    target_duration_seconds: int | None = 90
    expected_concepts: list[str] | None = None
    evaluation_hints: str | None = None


class CreateSessionResponse(BaseModel):
    session: PracticeSession


class SessionListResponse(BaseModel):
    sessions: list[PracticeSession]
    total: int
