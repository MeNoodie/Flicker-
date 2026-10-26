"""
test.py — Test script to verify QuestionAgent with:
  1. Student Persona Profile (Dynamic Topic Gen -> 10 Questions Gen)
  2. Professional Persona Profile with Custom Topics & Custom Difficulties from UI
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Fix Windows console encoding for UTF-8
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to path
ROOT_DIR = Path(__file__).parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.agents.question_agent import QuestionAgent
from backend.schemas.profile import Topic
from tests.seed import generate_random_user_profile


def test_scenario(profile, scenario_title: str):
    print("\n" + "=" * 70)
    print(f" [TEST SCENARIO] {scenario_title}")
    print("=" * 70)

    print(f"\n[Profile Info]:")
    print(f"   * Name             : {profile.display_name}")
    print(f"   * User Type        : {profile.user_type.upper()}")
    print(f"   * Domain           : {profile.domain}")
    print(f"   * Level            : {profile.experience_level}")
    print(f"   * Learning Goal    : {profile.learning_goal}")

    if profile.user_type == "student":
        print(f"   * College Year     : {profile.college_year}")
        print(f"   * Major            : {profile.major_degree}")
        print(f"   * University       : {profile.institution_name}")
    else:
        print(f"   * Experience (YoE) : {profile.years_of_experience} years")
        print(f"   * Current Role     : {profile.current_role}")
        print(f"   * Target Role      : {profile.target_role}")

    if profile.topics:
        print(f"   * User-Fed Topics  : {len(profile.topics)} custom topics provided via UI")
        for t in profile.topics:
            print(f"     -> {t.topic_name} [Difficulty: {t.difficulty}]")

    print(f"\n[Running QuestionAgent Pipeline]...")
    agent = QuestionAgent()
    result = agent.run(profile, requested_topic_count=4, requested_question_count=10)

    topics = result.get("topics", [])
    questions = result.get("questions", [])

    print(f"\n[Topics in Context] ({len(topics)} topics):")
    assert len(topics) > 0, "No topics found or generated!"
    for i, t in enumerate(topics, 1):
        print(f"   {i}. [{t.get('difficulty', '').upper()}] {t.get('topic_name')}")
        if t.get("description"):
            print(f"      {t.get('description')}")

    print(f"\n[Generated Questions] ({len(questions)} questions):")
    assert len(questions) == 10, f"Expected 10 questions, got {len(questions)}!"

    for i, q in enumerate(questions, 1):
        concepts = ", ".join(q.get("reference_concepts", []))
        print(f"\n   ------------------------------------------------------------")
        print(f"   Q{i:02d} [{q.get('game_type')}] -- Topic: {q.get('topic')} ({q.get('suggested_duration_seconds')}s) [Level: {q.get('difficulty')}]")
        print(f"   Question : {q.get('question')}")
        print(f"   Concepts : {concepts}")
        if q.get("hint"):
            print(f"   Hint     : {q.get('hint')}")

        assert "id" in q and q["id"]
        assert "question" in q and len(q["question"]) > 10
        assert "reference_concepts" in q
        assert "suggested_duration_seconds" in q

    return {"profile": profile.model_dump(mode="json"), "topics": topics, "questions": questions}


def run_all_tests():
    print("\n" + "#" * 70)
    print(" SPEAKQUEST AI -- PERSONA & CUSTOM UI TOPICS AGENT TEST SUITE")
    print("#" * 70)

    # Scenario 1: College Student (e.g. 3rd year student preparing for interviews, auto-generating topics)
    student_profile = generate_random_user_profile(user_type="student", with_custom_ui_topics=False)
    out_1 = test_scenario(student_profile, "1. STUDENT PROFILE WITH DYNAMIC TOPIC GENERATION")

    # Scenario 2: Industry Professional with custom UI-fed topics & custom difficulties
    prof_profile = generate_random_user_profile(user_type="professional", with_custom_ui_topics=False)
    # Simulate user custom topics fed from UI with specific difficulties
    prof_profile.topics = [
        Topic(topic_name="Kafka Partition Rebalancing & Consumer Lag", difficulty="advanced"),
        Topic(topic_name="gRPC vs REST Microservices Architecture", difficulty="intermediate"),
        Topic(topic_name="Distributed Caching & Cache Invalidation", difficulty="intermediate"),
        Topic(topic_name="Zero-Downtime Database Migration Strategies", difficulty="advanced"),
    ]
    out_2 = test_scenario(prof_profile, "2. PROFESSIONAL PROFILE WITH CUSTOM UI-FED TOPICS & DIFFICULTIES")

    # Save outputs
    out_file = Path(__file__).parent / "test_output.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"student_scenario": out_1, "professional_scenario": out_2}, f, indent=2)

    print("\n" + "=" * 70)
    print(" [SUCCESS] BOTH STUDENT & PROFESSIONAL (WITH CUSTOM UI TOPICS) TESTS PASSED!")
    print(f" Saved full test output to: {out_file}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_all_tests()
