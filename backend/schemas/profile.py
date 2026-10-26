"""
Pydantic schemas for user profiles and progress.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

ExperienceLevel = Literal["beginner", "intermediate", "advanced"]
LearningGoal = Literal["interview_preparation", "concept_clarity", "communication_practice"]
PreferredDuration = Literal[60, 90, 120]
UserType = Literal["student", "professional"]
CollegeYear = Literal["1st_year", "2nd_year", "3rd_year", "4th_year", "postgraduate", "other"]


class Topic(BaseModel):
    id: str | None = None
    topic_name: str = Field(..., min_length=1, max_length=100)
    difficulty: ExperienceLevel = "intermediate"
    is_active: bool = True


class Profile(BaseModel):
    id: str
    display_name: str = Field(..., min_length=1, max_length=80)
    domain: str = Field(..., min_length=1, max_length=100)
    experience_level: ExperienceLevel
    learning_goal: LearningGoal
    preferred_duration: PreferredDuration = 90
    user_type: UserType = "student"
    # Student specific fields
    college_year: CollegeYear | None = None
    institution_name: str | None = None
    major_degree: str | None = None
    # Professional specific fields
    years_of_experience: float | None = None
    current_role: str | None = None
    target_role: str | None = None
    topics: list[Topic] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UpsertProfileRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=80)
    domain: str = Field(..., min_length=1, max_length=100)
    experience_level: ExperienceLevel
    learning_goal: LearningGoal
    preferred_duration: PreferredDuration = 90
    user_type: UserType = "student"
    college_year: CollegeYear | None = None
    institution_name: str | None = None
    major_degree: str | None = None
    years_of_experience: float | None = None
    current_role: str | None = None
    target_role: str | None = None
    topics: list[Topic] = Field(..., min_length=1)


class UserProgress(BaseModel):
    user_id: str
    total_xp: int = 0
    completed_sessions: int = 0
    current_streak: int = 0
    last_practice_date: date | None = None
    updated_at: datetime | None = None
