"""
Pydantic schemas for evaluation input / output.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ── Rubric dimension names (matches model.yaml) ───────────────────────────────

DimensionName = Literal[
    "conceptual_accuracy",
    "concept_clarity",
    "depth_of_understanding",
    "technical_precision",
    "structure_and_reasoning",
    "relevance",
]

DIMENSION_WEIGHTS: dict[DimensionName, float] = {
    "conceptual_accuracy": 0.30,
    "concept_clarity": 0.20,
    "depth_of_understanding": 0.20,
    "technical_precision": 0.15,
    "structure_and_reasoning": 0.10,
    "relevance": 0.05,
}


# ── LLM output schema (structured JSON from evaluator) ───────────────────────

class DimensionScore(BaseModel):
    score: float = Field(..., ge=0, le=5)
    evidence: str = Field(..., min_length=1)


class EvaluatorOutput(BaseModel):
    """
    Structured JSON expected from the LLM evaluator.
    The server re-computes overall_score from dimension_scores.
    """

    dimension_scores: dict[DimensionName, DimensionScore]
    strengths: list[str]
    improvement_areas: list[str]
    misconceptions: list[str]
    missing_concepts: list[str]
    improved_answer: str
    confidence: Literal["low", "medium", "high"]
    needs_retry: bool = False
    retry_reason: str | None = None

    # Optionally returned by LLM for diagnostics; server ignores this value
    overall_score: float | None = Field(None, ge=0, le=100)

    @field_validator("dimension_scores")
    @classmethod
    def all_dimensions_present(
        cls, v: dict[DimensionName, DimensionScore]
    ) -> dict[DimensionName, DimensionScore]:
        required = set(DIMENSION_WEIGHTS.keys())
        missing = required - set(v.keys())
        if missing:
            raise ValueError(f"Missing dimension scores: {missing}")
        return v


# ── Server-computed result ─────────────────────────────────────────────────────

class EvaluationResult(BaseModel):
    session_id: str
    transcript: str
    dimension_scores: dict[DimensionName, DimensionScore]
    overall_score: float = Field(..., ge=0, le=100)
    strengths: list[str]
    improvement_areas: list[str]
    misconceptions: list[str]
    missing_concepts: list[str]
    improved_answer: str
    confidence: Literal["low", "medium", "high"]
    xp_awarded: int = 0
    needs_retry: bool = False
    retry_reason: str | None = None


# ── API request / response ────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    session_id: str


class EvaluateResponse(BaseModel):
    success: bool
    result: EvaluationResult | None = None
    error: str | None = None
    needs_retry: bool = False
    retry_reason: str | None = None
