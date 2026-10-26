"""
question.py — Pydantic schemas for Question Generation Agent and frontend game contracts.
"""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

QuestionType = Literal[
    "concept_clarity",
    "technical_deep_dive",
    "scenario_defense",
    "elevator_pitch",
]

DifficultyLevel = Literal["beginner", "intermediate", "advanced"]


class GeneratedQuestionItem(BaseModel):
    id: str = Field(..., description="Unique question identifier")
    topic_id: str = Field(..., description="Associated topic ID")
    topic_name: str = Field(..., min_length=1, description="Readable topic name")
    question: str = Field(..., min_length=10, description="Spoken question text prompt")
    question_type: QuestionType = Field("concept_clarity", description="Format or game mode of question")
    difficulty: DifficultyLevel = Field("intermediate", description="Difficulty level")
    target_duration_seconds: int = Field(90, ge=30, le=180, description="Preferred answer duration in seconds")
    expected_concepts: list[str] = Field(..., min_length=1, description="Key concepts expected in spoken response")
    evaluation_hints: str = Field(..., min_length=1, description="Guidance for the Evaluator Agent")


class QuestionListResponse(BaseModel):
    questions: list[GeneratedQuestionItem]


class GenerateQuestionsRequest(BaseModel):
    count: int = Field(10, ge=1, le=20)
    topic_ids: list[str] | None = None
