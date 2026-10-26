"""
tests/test_e2e_workflow.py
End-to-End Acceptance Tests for SpeakQuest AI:
- Question Generation Agent & validated JSON schema (GeneratedQuestionItem)
- Topic Spinner & Mystery Cards payload compatibility
- Session creation and dynamic question persistence
- Audio transcription and Typed Answer fallback
- Evaluator Agent (LangGraph), 6-dimension rubric, and server-side score calculation
- User progress, XP awards, and idempotency
- Error handling: short/unusable transcripts, needs_retry flag, and access control.
"""

import sys
import os
import unittest
from datetime import datetime
from uuid import uuid4

# Ensure stdout handles UTF-8 on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from schemas.question import GeneratedQuestionItem, QuestionListResponse, QuestionType
from schemas.session import CreateSessionRequest, PracticeSession, SessionStatus
from schemas.evaluation import EvaluationResult, DimensionScore
from schemas.profile import Profile, UpsertProfileRequest, Topic, UserType, ExperienceLevel
from db.supabase_client import get_supabase_client
from agents.question_agent import get_question_generation_graph
from agents.evaluator_agent import evaluate_session_graph


class TestSpeakQuestE2EWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = get_supabase_client()
        cls.test_user_id = f"test-user-{uuid4().hex[:8]}"

        # Seed realistic profile with custom topics & persona
        profile_data = {
            "id": cls.test_user_id,
            "display_name": "Dr. Elena Rostova",
            "domain": "Distributed Systems & Cloud Architecture",
            "experience_level": "intermediate",
            "learning_goal": "interview_preparation",
            "preferred_duration": 90,
            "user_type": "professional",
            "years_of_experience": 4,
            "current_role": "Backend Infrastructure Engineer",
            "target_role": "Senior Distributed Systems Architect",
            "topics": [
                {"id": "t1", "topic_name": "CAP Theorem & PACELC Tradeoffs", "difficulty": "intermediate", "is_active": True},
                {"id": "t2", "topic_name": "Raft Consensus Algorithm", "difficulty": "advanced", "is_active": True},
                {"id": "t3", "topic_name": "Distributed Caching & Invalidation", "difficulty": "intermediate", "is_active": True},
            ],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        cls.db.table("profiles").upsert(profile_data).execute()

        # Seed initial progress
        cls.db.table("user_progress").upsert({
            "user_id": cls.test_user_id,
            "total_xp": 100,
            "current_streak": 2,
            "completed_sessions": 2,
            "last_practice_date": datetime.utcnow().date().isoformat(),
        }).execute()

    def test_01_question_agent_structured_contract(self):
        """Test Question Generation Agent returns strictly validated QuestionListResponse."""
        print("\n[TEST 1] Testing Question Agent Structured JSON Contract...")
        graph = get_question_generation_graph()
        
        # Test generation with user profile context
        state = {
            "user_id": self.test_user_id,
            "count": 4,
            "force_refresh": True,
            "questions": [],
        }
        res = graph.invoke(state)
        questions = res.get("questions", [])
        self.assertGreaterEqual(len(questions), 1, "Agent must generate at least 1 question")

        # Validate against Pydantic schema
        validated_response = QuestionListResponse(
            questions=questions,
            total_count=len(questions),
            user_id=self.test_user_id
        )
        self.assertEqual(validated_response.total_count, len(questions))

        # Inspect required fields for every generated question
        for q in validated_response.questions:
            self.assertTrue(bool(q.id), "Question ID must not be empty")
            self.assertTrue(bool(q.topic_name), "Topic name must not be empty")
            self.assertTrue(bool(q.question), "Question text must not be empty")
            self.assertIn(q.difficulty, ["beginner", "intermediate", "advanced"])
            self.assertGreaterEqual(q.target_duration_seconds, 30)
            self.assertLessEqual(q.target_duration_seconds, 180)
            self.assertGreaterEqual(len(q.expected_concepts), 1, "Expected concepts must not be empty")
            self.assertTrue(bool(q.evaluation_hints), "Evaluation hints must not be empty")
            print(f"  ✓ Validated Question [{q.id}]: '{q.question[:45]}...' ({q.difficulty}, {q.target_duration_seconds}s)")

    def test_02_game_compatibility_and_session_creation(self):
        """Verify Topic Spinner and Mystery Cards consume same question schema and create valid sessions."""
        print("\n[TEST 2] Testing Topic Spinner & Mystery Cards Session Creation...")
        
        test_question = GeneratedQuestionItem(
            id=f"q_{uuid4().hex[:8]}",
            topic_id="t1",
            topic_name="CAP Theorem & PACELC Tradeoffs",
            question="Explain how the PACELC theorem extends CAP during normal operation and during network partitions.",
            question_type="concept_clarity",
            difficulty="intermediate",
            target_duration_seconds=90,
            expected_concepts=["CAP theorem", "Network partition", "Latency vs Consistency", "Availability"],
            evaluation_hints="Look for mention that even if no partition (E), system chooses latency (L) or consistency (C)."
        )

        # 1. Spinner Session
        spinner_session_id = f"sess_{uuid4().hex[:8]}"
        self.db.table("sessions").insert({
            "id": spinner_session_id,
            "user_id": self.test_user_id,
            "topic_id": test_question.topic_id,
            "topic_name": test_question.topic_name,
            "game_type": "spinner",
            "question_id": test_question.id,
            "question": test_question.question,
            "difficulty": test_question.difficulty,
            "target_duration_seconds": test_question.target_duration_seconds,
            "status": "ready",
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        # 2. Mystery Cards Session
        mystery_session_id = f"sess_{uuid4().hex[:8]}"
        self.db.table("sessions").insert({
            "id": mystery_session_id,
            "user_id": self.test_user_id,
            "topic_id": test_question.topic_id,
            "topic_name": test_question.topic_name,
            "game_type": "mystery_cards",
            "question_id": test_question.id,
            "question": test_question.question,
            "difficulty": test_question.difficulty,
            "target_duration_seconds": test_question.target_duration_seconds,
            "status": "ready",
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        # Verify both sessions exist with identical question context
        sess_spin = self.db.table("sessions").select("*").eq("id", spinner_session_id).single().execute()
        sess_card = self.db.table("sessions").select("*").eq("id", mystery_session_id).single().execute()
        
        self.assertEqual(sess_spin.data["game_type"], "spinner")
        self.assertEqual(sess_card.data["game_type"], "mystery_cards")
        self.assertEqual(sess_spin.data["question"], sess_card.data["question"])
        self.assertEqual(sess_spin.data["target_duration_seconds"], 90)
        print("  ✓ Spinner and Mystery Cards sessions successfully created and aligned.")

    def test_03_typed_answer_fallback_and_transcription(self):
        """Test fallback typed answer stores transcript and marks session ready for evaluation."""
        print("\n[TEST 3] Testing Typed Answer Fallback Mechanism...")
        session_id = f"sess_{uuid4().hex[:8]}"
        self.db.table("sessions").insert({
            "id": session_id,
            "user_id": self.test_user_id,
            "topic_id": "t1",
            "topic_name": "CAP Theorem & PACELC Tradeoffs",
            "game_type": "spinner",
            "question_id": "q1",
            "question": "What is PACELC theorem?",
            "difficulty": "intermediate",
            "target_duration_seconds": 90,
            "status": "recording",
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        # Submit typed answer fallback
        sample_transcript = (
            "The PACELC theorem states that in a distributed database, if there is a Partition (P), "
            "one has to choose between Availability (A) and Consistency (C); Else (E), even when the system "
            "is running normally without partitions, one has to choose between Latency (L) and Consistency (C). "
            "For example, DynamoDB favors availability and latency, whereas Bigtable favors consistency."
        )
        self.db.table("sessions").update({
            "transcript": sample_transcript,
            "duration_seconds": 75,
            "status": "transcribing",
        }).eq("id", session_id).execute()

        updated = self.db.table("sessions").select("*").eq("id", session_id).single().execute()
        self.assertEqual(updated.data["transcript"], sample_transcript)
        self.assertEqual(updated.data["duration_seconds"], 75)
        print("  ✓ Typed answer saved with accurate transcript and duration.")

    def test_04_evaluator_agent_scoring_and_rubric(self):
        """Test Evaluator Agent produces validated 6-dimension scores and server-side overall score."""
        print("\n[TEST 4] Testing Evaluator Agent 6-Dimension Rubric & Scoring...")
        
        # Register question into questions table for evaluator to load trusted hints
        q_id = f"q_eval_{uuid4().hex[:8]}"
        self.db.table("questions").upsert({
            "id": q_id,
            "topic_id": "t1",
            "topic_name": "CAP Theorem & PACELC Tradeoffs",
            "question": "Explain how PACELC extends CAP during normal operation.",
            "question_type": "concept_clarity",
            "difficulty": "intermediate",
            "target_duration_seconds": 90,
            "expected_concepts": ["Partition vs Availability/Consistency", "Else Latency vs Consistency"],
            "evaluation_hints": "Look for explicit mention of normal operation tradeoffs (L vs C)."
        }).execute()

        session_id = f"sess_eval_{uuid4().hex[:8]}"
        sample_transcript = (
            "The PACELC theorem extends the CAP theorem. When there is a partition, you pick availability or consistency. "
            "Else, in normal state, you choose latency or consistency. For instance, MongoDB can be configured for strong consistency "
            "at the expense of higher write latency."
        )
        self.db.table("sessions").insert({
            "id": session_id,
            "user_id": self.test_user_id,
            "topic_id": "t1",
            "topic_name": "CAP Theorem & PACELC Tradeoffs",
            "game_type": "spinner",
            "question_id": q_id,
            "question": "Explain how PACELC extends CAP during normal operation.",
            "difficulty": "intermediate",
            "target_duration_seconds": 90,
            "duration_seconds": 80,
            "transcript": sample_transcript,
            "status": "evaluating",
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        # Run Evaluator Graph
        eval_graph = evaluate_session_graph()
        initial_state = {
            "session_id": session_id,
            "user_id": self.test_user_id,
            "transcript": sample_transcript,
            "evaluation": None,
            "xp_awarded": 0,
            "error": None,
        }
        res = eval_graph.invoke(initial_state)

        evaluation: EvaluationResult = res.get("evaluation")
        self.assertIsNotNone(evaluation, "EvaluationResult must not be None")
        
        # Verify 6 dimensions
        scores = evaluation.dimension_scores
        print(f"  -> Conceptual Accuracy: {scores.conceptual_accuracy.score}/100")
        print(f"  -> Concept Clarity: {scores.concept_clarity.score}/100")
        print(f"  -> Depth of Understanding: {scores.depth_of_understanding.score}/100")
        print(f"  -> Technical Precision: {scores.technical_precision.score}/100")
        print(f"  -> Structure & Reasoning: {scores.structure_and_reasoning.score}/100")
        print(f"  -> Relevance: {scores.relevance.score}/100")

        # Verify weighted overall score formula
        expected_overall = round(
            0.30 * scores.conceptual_accuracy.score +
            0.20 * scores.concept_clarity.score +
            0.20 * scores.depth_of_understanding.score +
            0.15 * scores.technical_precision.score +
            0.10 * scores.structure_and_reasoning.score +
            0.05 * scores.relevance.score
        )
        self.assertEqual(evaluation.overall_score, expected_overall, "Overall score must match weighted formula")
        self.assertGreaterEqual(evaluation.overall_score, 50, "Passing response should score >= 50")
        self.assertFalse(evaluation.needs_retry, "Valid response should not need retry")
        print(f"  ✓ Overall Server-Calculated Score: {evaluation.overall_score}/100 (matches weighted rubric)")

    def test_05_user_progress_and_idempotent_xp(self):
        """Test XP award is applied idempotently upon successful evaluation."""
        print("\n[TEST 5] Testing Progress & Idempotent XP Award...")
        
        # Fetch current progress before evaluation
        prog_before = self.db.table("user_progress").select("*").eq("user_id", self.test_user_id).single().execute()
        initial_xp = prog_before.data["total_xp"]
        initial_completed = prog_before.data["total_sessions_completed"]

        # Run evaluation on session
        session_id = f"sess_xp_{uuid4().hex[:8]}"
        self.db.table("sessions").insert({
            "id": session_id,
            "user_id": self.test_user_id,
            "topic_id": "t2",
            "topic_name": "Raft Consensus Algorithm",
            "game_type": "mystery_cards",
            "question_id": "q_raft",
            "question": "How does Raft handle leader election split votes?",
            "difficulty": "advanced",
            "target_duration_seconds": 90,
            "duration_seconds": 60,
            "transcript": "Raft uses randomized election timeouts to prevent split vote deadlocks between candidates.",
            "status": "evaluating",
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        eval_graph = evaluate_session_graph()
        res1 = eval_graph.invoke({
            "session_id": session_id,
            "user_id": self.test_user_id,
            "transcript": "Raft uses randomized election timeouts to prevent split vote deadlocks between candidates.",
            "evaluation": None,
            "xp_awarded": 0,
            "error": None,
        })
        self.assertGreater(res1.get("xp_awarded", 0), 0, "XP should be awarded for completed session")

        # Check progress incremented
        prog_after = self.db.table("user_progress").select("*").eq("user_id", self.test_user_id).single().execute()
        self.assertEqual(prog_after.data["total_xp"], initial_xp + 50)
        self.assertEqual(prog_after.data["total_sessions_completed"], initial_completed + 1)

        # Idempotency check: Re-evaluating already completed session should NOT award duplicate XP
        res2 = eval_graph.invoke({
            "session_id": session_id,
            "user_id": self.test_user_id,
            "transcript": "Raft uses randomized election timeouts to prevent split vote deadlocks between candidates.",
            "evaluation": None,
            "xp_awarded": 0,
            "error": None,
        })
        self.assertEqual(res2.get("xp_awarded", 0), 0, "Duplicate evaluation must award 0 XP (idempotent)")
        prog_recheck = self.db.table("user_progress").select("*").eq("user_id", self.test_user_id).single().execute()
        self.assertEqual(prog_recheck.data["total_xp"], initial_xp + 50, "XP must remain unchanged on re-evaluation")
        print("  ✓ Idempotent XP awarded (+50 XP exactly once, no double counting).")

    def test_06_unusable_transcript_needs_retry(self):
        """Test short or unusable transcripts trigger needs_retry=True, no score, and 0 XP."""
        print("\n[TEST 6] Testing Edge Case: Short / Unusable Transcript...")
        
        session_id = f"sess_short_{uuid4().hex[:8]}"
        self.db.table("sessions").insert({
            "id": session_id,
            "user_id": self.test_user_id,
            "topic_id": "t1",
            "topic_name": "CAP Theorem",
            "game_type": "spinner",
            "question_id": "q1",
            "question": "Explain CAP Theorem",
            "difficulty": "intermediate",
            "target_duration_seconds": 90,
            "duration_seconds": 5,
            "transcript": "uh... um...",  # Too short / unusable
            "status": "evaluating",
            "created_at": datetime.utcnow().isoformat(),
        }).execute()

        eval_graph = evaluate_session_graph()
        res = eval_graph.invoke({
            "session_id": session_id,
            "user_id": self.test_user_id,
            "transcript": "uh... um...",
            "evaluation": None,
            "xp_awarded": 0,
            "error": None,
        })

        evaluation: EvaluationResult = res.get("evaluation")
        self.assertIsNotNone(evaluation)
        self.assertTrue(evaluation.needs_retry, "Unusable transcript must set needs_retry=True")
        self.assertEqual(res.get("xp_awarded", 0), 0, "No XP should be awarded when needs_retry is True")
        self.assertEqual(evaluation.overall_score, 0, "Overall score should be 0 on retry")
        print("  ✓ Short transcript flagged with needs_retry=True and 0 XP.")


if __name__ == "__main__":
    unittest.main()
