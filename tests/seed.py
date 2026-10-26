"""
seed.py — Generates realistic randomized user profile data for testing,
supporting both Students and Industry Professionals, as well as custom UI topics.
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path
from uuid import uuid4

# Windows UTF-8 console output
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from backend.schemas.profile import (
    CollegeYear,
    ExperienceLevel,
    LearningGoal,
    PreferredDuration,
    Profile,
    Topic,
    UserType,
)

SAMPLE_NAMES = [
    "Alex Rivera",
    "Priya Sharma",
    "Marcus Vance",
    "Elena Rostova",
    "Liam Tanaka",
    "Amina Al-Mansoor",
    "Jordan Lee",
    "Sophia Kovacs",
]

DOMAINS = [
    "Distributed Systems & Cloud Backend",
    "Generative AI & LLM Systems",
    "Data Engineering & Real-Time Streaming",
    "Frontend Architecture & Web Performance",
    "Database Internals & Storage Engines",
    "DevOps & Kubernetes Infrastructure",
]

COLLEGE_YEARS: list[CollegeYear] = ["1st_year", "2nd_year", "3rd_year", "4th_year", "postgraduate"]
MAJORS = [
    "Computer Science & Engineering",
    "Information Technology",
    "Data Science & AI",
    "Software Systems",
    "Electrical & Computer Engineering",
]
UNIVERSITIES = [
    "UC Berkeley",
    "IIT Delhi",
    "University of Toronto",
    "Technical University of Munich",
    "National University of Singapore",
    "Carnegie Mellon University",
]

ROLES = [
    ("Junior Backend Developer", "Mid-Level Distributed Systems Engineer", 1.5),
    ("Software Engineer II", "Senior Backend Architect", 3.5),
    ("DevOps Engineer", "Staff Site Reliability Engineer", 5.0),
    ("Frontend Engineer", "Fullstack Tech Lead", 4.0),
    ("Data Analyst", "Machine Learning Platform Engineer", 2.0),
    ("Senior Software Engineer", "Principal Infrastructure Engineer", 8.0),
]

EXPERIENCE_LEVELS: list[ExperienceLevel] = ["beginner", "intermediate", "advanced"]
LEARNING_GOALS: list[LearningGoal] = [
    "interview_preparation",
    "concept_clarity",
    "communication_practice",
]
DURATIONS: list[PreferredDuration] = [60, 90, 120]


def generate_random_user_profile(
    user_type: UserType | None = None,
    domain: str | None = None,
    experience_level: ExperienceLevel | None = None,
    learning_goal: LearningGoal | None = None,
    with_custom_ui_topics: bool = False,
) -> Profile:
    """
    Generate a random user profile for either a Student or a Professional.
    If with_custom_ui_topics is True, adds user-chosen topics with custom difficulties
    simulating what a user feeds through the UI.
    """
    user_id = str(uuid4())
    display_name = random.choice(SAMPLE_NAMES)
    selected_domain = domain or random.choice(DOMAINS)
    selected_level = experience_level or random.choice(EXPERIENCE_LEVELS)
    selected_goal = learning_goal or random.choice(LEARNING_GOALS)
    selected_duration = random.choice(DURATIONS)
    selected_user_type: UserType = user_type or random.choice(["student", "professional"])

    # Student specific data
    college_year: CollegeYear | None = None
    institution_name: str | None = None
    major_degree: str | None = None

    # Professional specific data
    years_of_experience: float | None = None
    current_role: str | None = None
    target_role: str | None = None

    if selected_user_type == "student":
        college_year = random.choice(COLLEGE_YEARS)
        major_degree = random.choice(MAJORS)
        institution_name = random.choice(UNIVERSITIES)
    else:
        curr, targ, yoe = random.choice(ROLES)
        current_role = curr
        target_role = targ
        years_of_experience = yoe

    # Optional custom topics fed from UI
    topics: list[Topic] = []
    if with_custom_ui_topics:
        topics = [
            Topic(
                topic_name=f"{selected_domain} Fundamentals",
                difficulty="beginner",
            ),
            Topic(
                topic_name=f"{selected_domain} Deep Dive Mechanics",
                difficulty="intermediate",
            ),
            Topic(
                topic_name=f"{selected_domain} High-Scale Failure Modes",
                difficulty="advanced",
            ),
        ]

    return Profile(
        id=user_id,
        display_name=display_name,
        domain=selected_domain,
        experience_level=selected_level,
        learning_goal=selected_goal,
        preferred_duration=selected_duration,
        user_type=selected_user_type,
        college_year=college_year,
        institution_name=institution_name,
        major_degree=major_degree,
        years_of_experience=years_of_experience,
        current_role=current_role,
        target_role=target_role,
        topics=topics,
    )


def save_seed_to_file(profile: Profile, filepath: str | Path | None = None) -> Path:
    """Save the generated seed profile to a JSON file."""
    if filepath is None:
        filepath = Path(__file__).parent / "seed_profile.json"
    else:
        filepath = Path(filepath)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(profile.model_dump(mode="json"), f, indent=2)
    return filepath


if __name__ == "__main__":
    profile = generate_random_user_profile()
    out_path = save_seed_to_file(profile)
    print("=" * 60)
    print(f"Generated Random Profile for: {profile.display_name} ({profile.user_type.upper()})")
    print("=" * 60)
    print(f"User ID        : {profile.id}")
    print(f"Type           : {profile.user_type}")
    if profile.user_type == "student":
        print(f"College Year   : {profile.college_year}")
        print(f"Major          : {profile.major_degree}")
        print(f"Institution    : {profile.institution_name}")
    else:
        print(f"Experience     : {profile.years_of_experience} years")
        print(f"Current Role   : {profile.current_role}")
        print(f"Target Role    : {profile.target_role}")
    print(f"Domain         : {profile.domain}")
    print(f"Level          : {profile.experience_level}")
    print(f"Learning Goal  : {profile.learning_goal}")
    print(f"Custom Topics  : {len(profile.topics)} custom topics provided")
    print(f"Saved to       : {out_path}")
