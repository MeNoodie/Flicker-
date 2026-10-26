"""
question_agent.py — LangGraph agent for generating profile-tailored topics and practice questions.

Workflow:
  START -> generate_topics -> generate_questions -> END

Takes user profile data (domain, experience_level, learning_goal) and produces:
  1. Relevant learning & interview topics
  2. 10 curated spoken practice questions across the topics with reference concepts and scoring guidelines
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal, TypedDict
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from backend.config import AppConfig, get_config
from backend.providers.llm_provider import get_llm
from backend.schemas.profile import ExperienceLevel, LearningGoal, Profile, Topic

logger = logging.getLogger(__name__)


# ─── Pydantic Schemas for Structured Output ────────────────────────────────────

class GeneratedTopic(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4())[:8])
    topic_name: str
    difficulty: ExperienceLevel = "intermediate"
    key_focus_areas: list[str] = Field(default_factory=list)
    description: str = ""


class GeneratedQuestion(BaseModel):
    id: str
    topic_id: str = "topic_001"
    topic_name: str = ""
    question: str
    question_type: str = "concept_clarity"
    difficulty: ExperienceLevel = "intermediate"
    target_duration_seconds: int = 90
    expected_concepts: list[str] = Field(default_factory=list)
    evaluation_hints: str = ""

    # Compatibility properties for existing code/tests
    @property
    def topic(self) -> str:
        return self.topic_name

    @property
    def game_type(self) -> str:
        return self.question_type

    @property
    def reference_concepts(self) -> list[str]:
        return self.expected_concepts

    @property
    def suggested_duration_seconds(self) -> int:
        return self.target_duration_seconds

    @property
    def hint(self) -> str:
        return self.evaluation_hints

    def model_dump(self, *args, **kwargs) -> dict[str, Any]:
        d = super().model_dump(*args, **kwargs)
        # Populate compatibility aliases into dict output
        d["topic"] = self.topic_name
        d["game_type"] = self.question_type
        d["reference_concepts"] = self.expected_concepts
        d["suggested_duration_seconds"] = self.target_duration_seconds
        d["hint"] = self.evaluation_hints
        return d


class QuestionAgentState(TypedDict, total=False):
    profile: dict[str, Any]
    requested_topic_count: int
    requested_question_count: int
    topics: list[dict[str, Any]]
    questions: list[dict[str, Any]]
    error: str | None


# ─── Helper: Clean JSON extraction ─────────────────────────────────────────────

def _extract_json_payload(text: str) -> Any:
    """Extract JSON from markdown code fences or raw text, with robust object recovery."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try slice from first '[' to last ']'
    start_bracket = text.find("[")
    end_bracket = text.rfind("]")
    if start_bracket != -1 and end_bracket != -1 and end_bracket > start_bracket:
        candidate = text[start_bracket : end_bracket + 1]
        # Clean trailing commas before brackets
        cleaned_candidate = re.sub(r",\s*([\]}])", r"\1", candidate)
        try:
            return json.loads(cleaned_candidate)
        except json.JSONDecodeError:
            pass

    # Fallback: Extract individual JSON objects { ... } using regex
    object_matches = re.findall(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text)
    extracted_objects = []
    for obj_str in object_matches:
        try:
            extracted_objects.append(json.loads(obj_str))
        except json.JSONDecodeError:
            cleaned = re.sub(r",\s*\}", "}", obj_str)
            try:
                extracted_objects.append(json.loads(cleaned))
            except json.JSONDecodeError:
                continue

    if extracted_objects:
        return extracted_objects

    raise ValueError("Could not parse JSON payload from response")


# ─── Persona & Context Builders ───────────────────────────────────────────────

def _build_user_persona_summary(profile: dict[str, Any]) -> str:
    """Format rich background details for student vs professional candidates."""
    user_type = profile.get("user_type", "student")
    domain = profile.get("domain", "Software Engineering")
    experience_level = profile.get("experience_level", "intermediate")
    learning_goal = profile.get("learning_goal", "interview_preparation")

    if user_type == "student":
        college_year = profile.get("college_year") or "undergraduate"
        college_year_clean = college_year.replace("_", " ").title()
        major = profile.get("major_degree") or "Computer Science/Engineering"
        institution = profile.get("institution_name") or "University"
        return (
            f"STUDENT CANDIDATE:\n"
            f"- Status: {college_year_clean} student studying {major} at {institution}\n"
            f"- Domain: {domain}\n"
            f"- Overall Stated Level: {experience_level}\n"
            f"- Learning Goal: {learning_goal}\n"
            f"- Calibration Directive: Questions should evaluate foundational conceptual clarity, algorithm/system mechanism intuition, "
            f"and core trade-offs suitable for college placement or internship interviews without assuming years of production on-call experience."
        )
    else:
        yoe = profile.get("years_of_experience")
        yoe_str = f"{yoe} years" if yoe is not None else "several years"
        current_role = profile.get("current_role") or "Software Engineer"
        target_role = profile.get("target_role") or "Senior Engineer"
        return (
            f"PROFESSIONAL CANDIDATE:\n"
            f"- Status: Industry Professional with {yoe_str} of experience\n"
            f"- Current Role: {current_role} | Target Role: {target_role}\n"
            f"- Domain: {domain}\n"
            f"- Overall Stated Level: {experience_level}\n"
            f"- Learning Goal: {learning_goal}\n"
            f"- Calibration Directive: Questions must reflect industry-grade technical rigor, production architecture decisions, "
            f"scalability bottlenecks, disaster recovery, and design justification expected for a {target_role} role."
        )


def _format_topics_context(topics: list[dict[str, Any]]) -> str:
    """Format topics with user-specified custom difficulty levels."""
    if not topics:
        return "General Domain Topics"
    lines = []
    for t in topics:
        name = t.get("topic_name") or "Topic"
        diff = t.get("difficulty") or "intermediate"
        lines.append(f"- {name} (Target Difficulty: {diff})")
    return "\n".join(lines)


# ─── System Prompts ───────────────────────────────────────────────────────────

TOPIC_SYSTEM_PROMPT = """You are a senior technical interviewer and curriculum architect for SpeakQuest AI.
Your role is to analyze a candidate's background and generate the most high-impact, relevant interview topics.

CANDIDATE PERSONA:
{persona}

RULES:
1. Produce exactly {count} sub-topics tailored to the candidate's exact background, seniority, and domain.
2. Topics must be practical, industry-relevant, and calibrated to their student/professional stage.
3. Return ONLY a valid JSON array of objects. No markdown intro or outro text.

JSON Schema:
[
  {{
    "topic_name": "Topic Title",
    "difficulty": "beginner|intermediate|advanced",
    "key_focus_areas": ["area1", "area2", "area3"],
    "description": "Brief 1-sentence summary of why this topic matters for their career stage"
  }}
]
"""

# ─── System Prompts ───────────────────────────────────────────────────────────

QUESTION_SYSTEM_PROMPT = """You are an expert spoken technical interview coach for SpeakQuest AI.
Your goal is to generate exactly {count} stimulating, realistic verbal interview questions.

CANDIDATE PERSONA & CALIBRATION:
{persona}

TARGET TOPICS & CUSTOM DIFFICULTY LEVELS:
{topics_context}

QUESTION DESIGN PRINCIPLES:
1. Rigor Calibration:
   - For student profiles: Emphasize fundamental mechanics, conceptual clarity, data structures/OS/networking concepts, and clear explanation.
   - For professional profiles: Emphasize production trade-offs, scaling limits, failure modes, concurrency, latency vs throughput, and architectural defense.
2. Respect Custom Topic Difficulties:
   - If a topic has Target Difficulty "beginner": focus on core principles and clean analogies.
   - If a topic has Target Difficulty "intermediate": focus on mechanics and practical implementation.
   - If a topic has Target Difficulty "advanced": probe edge cases, subtle gotchas, scale bottlenecks, and distributed consensus.
3. Spoken suitability: Questions must prompt clear verbal answers (60-120 seconds).
4. Variety of question formats:
   - "elevator_pitch": Quick 60s summary of a concept or architecture.
   - "concept_clarity": Explain a fundamental principle clearly without jargon overload.
   - "technical_deep_dive": Explain internal mechanics, trade-offs, and failure modes.
   - "scenario_defense": Given a problem/constraint, justify a design decision.
5. Expected concepts: Provide 3-5 key concepts or keywords expected in a strong spoken response.
6. Evaluation hints: Provide guidance for the Evaluator Agent on what distinguishes a good vs weak answer.
7. Return ONLY a valid JSON array of {count} question objects. No markdown intro or outro text.

JSON Schema:
[
  {{
    "id": "q_001",
    "topic_name": "Name of one of the provided topics",
    "question": "The spoken interview question prompt...",
    "question_type": "concept_clarity|technical_deep_dive|scenario_defense|elevator_pitch",
    "difficulty": "beginner|intermediate|advanced",
    "target_duration_seconds": 60|90|120,
    "expected_concepts": ["concept 1", "concept 2", "concept 3"],
    "evaluation_hints": "What the evaluator should check for in the answer..."
  }}
]
"""


# ─── Graph Node Implementations ───────────────────────────────────────────────

def generate_topics_node(state: QuestionAgentState, cfg: AppConfig | None = None) -> dict[str, Any]:
    """Node 1: Generate tailored topics if not provided in profile, or preserve user-fed topics."""
    if cfg is None:
        cfg = get_config()

    profile = state.get("profile", {})
    existing_topics = profile.get("topics", [])
    count = state.get("requested_topic_count", 4)

    # If the user already provided custom topics via UI, PRESERVE and USE THEM directly!
    if existing_topics and len(existing_topics) > 0:
        logger.info("Using %d custom user-fed topics with custom difficulties from profile/UI", len(existing_topics))
        normalized_topics: list[dict[str, Any]] = []
        for i, t in enumerate(existing_topics):
            t_dict = t if isinstance(t, dict) else t.model_dump()
            normalized_topics.append({
                "id": t_dict.get("id") or f"user_top_{i+1}",
                "topic_name": t_dict.get("topic_name", f"Custom Topic {i+1}"),
                "difficulty": t_dict.get("difficulty", profile.get("experience_level", "intermediate")),
                "key_focus_areas": t_dict.get("key_focus_areas", [t_dict.get("topic_name", "Core Concept")]),
                "description": t_dict.get("description", "User-specified custom topic from UI"),
            })
        return {"topics": normalized_topics}

    persona = _build_user_persona_summary(profile)
    user_prompt = (
        f"{persona}\n\n"
        f"Generate {count} specific, modern interview and practice topics tailored to this candidate."
    )

    llm = get_llm(cfg)
    messages = [
        SystemMessage(content=TOPIC_SYSTEM_PROMPT.format(persona=persona, count=count)),
        HumanMessage(content=user_prompt),
    ]

    domain = profile.get("domain", "Software Engineering")
    experience_level = profile.get("experience_level", "intermediate")

    try:
        response = llm.invoke(messages)
        parsed = _extract_json_payload(response.content)
        topics: list[dict[str, Any]] = []
        if isinstance(parsed, list):
            for i, item in enumerate(parsed[:count]):
                topic_obj = GeneratedTopic(
                    id=f"top_{i+1}",
                    topic_name=item.get("topic_name", f"{domain} Focus {i+1}"),
                    difficulty=item.get("difficulty", experience_level),
                    key_focus_areas=item.get("key_focus_areas", []),
                    description=item.get("description", ""),
                )
                topics.append(topic_obj.model_dump())
        return {"topics": topics}
    except Exception as e:
        logger.warning("Topic generation via LLM encountered error: %s. Using default domain topics.", e)
        fallback_topics = [
            GeneratedTopic(
                id=f"top_{i+1}",
                topic_name=f"{domain} - Core Area {i+1}",
                difficulty=experience_level,
                key_focus_areas=["Fundamentals", "Design Patterns", "Performance"],
                description=f"Essential principles of {domain}",
            ).model_dump()
            for i in range(count)
        ]
        return {"topics": fallback_topics}


def generate_questions_node(state: QuestionAgentState, cfg: AppConfig | None = None) -> dict[str, Any]:
    """Node 2: Generate 10 curated questions factoring in persona & custom topic difficulties."""
    if cfg is None:
        cfg = get_config()

    profile = state.get("profile", {})
    topics = state.get("topics", [])
    count = state.get("requested_question_count", 10)

    # Build topic lookup maps
    topic_difficulty_map = {
        t.get("topic_name", ""): t.get("difficulty", profile.get("experience_level", "intermediate"))
        for t in topics
    }
    topic_id_map = {
        t.get("topic_name", ""): t.get("id", f"topic_{i+1:03d}")
        for i, t in enumerate(topics)
    }
    topic_names = list(topic_difficulty_map.keys()) or [profile.get("domain", "Software Engineering")]

    persona = _build_user_persona_summary(profile)
    topics_context = _format_topics_context(topics)

    system_prompt = QUESTION_SYSTEM_PROMPT.format(
        count=count,
        persona=persona,
        topics_context=topics_context,
    )

    user_prompt = (
        f"Generate exactly {count} distinct spoken practice questions.\n"
        f"Distribute them across the target topics above.\n"
        f"Match the difficulty of each question to the topic's Target Difficulty and candidate persona."
    )

    llm = get_llm(cfg)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    default_difficulty = profile.get("experience_level", "intermediate")
    default_duration = int(profile.get("preferred_duration", 90))

    try:
        response = llm.invoke(messages)
        parsed = _extract_json_payload(response.content)
        questions: list[dict[str, Any]] = []

        if isinstance(parsed, list):
            for i, item in enumerate(parsed):
                assigned_topic = item.get("topic_name") or item.get("topic") or topic_names[i % len(topic_names)]
                assigned_topic_id = item.get("topic_id") or topic_id_map.get(assigned_topic, f"topic_{i+1:03d}")
                target_diff = topic_difficulty_map.get(assigned_topic, item.get("difficulty", default_difficulty))
                q_type = item.get("question_type") or item.get("game_type") or "concept_clarity"
                duration = int(item.get("target_duration_seconds") or item.get("suggested_duration_seconds") or default_duration)
                concepts = item.get("expected_concepts") or item.get("reference_concepts") or [assigned_topic, "trade-offs", "core mechanism"]
                hints = item.get("evaluation_hints") or item.get("hint") or f"Evaluate conceptual understanding and practical trade-offs of {assigned_topic}."

                q_obj = GeneratedQuestion(
                    id=item.get("id") or f"q_{i+1:03d}",
                    topic_id=assigned_topic_id,
                    topic_name=assigned_topic,
                    question=item.get("question", f"Explain the core architectural trade-offs in {assigned_topic}."),
                    question_type=q_type,
                    difficulty=target_diff,
                    target_duration_seconds=duration,
                    expected_concepts=concepts if isinstance(concepts, list) and len(concepts) > 0 else [assigned_topic, "mechanism"],
                    evaluation_hints=hints,
                )
                questions.append(q_obj.model_dump())

        # If model returned fewer than requested, fill up to count
        while len(questions) < count:
            idx = len(questions) + 1
            t_name = topic_names[idx % len(topic_names)]
            t_id = topic_id_map.get(t_name, f"topic_{idx:03d}")
            t_diff = topic_difficulty_map.get(t_name, default_difficulty)
            questions.append(
                GeneratedQuestion(
                    id=f"q_{idx:03d}",
                    topic_id=t_id,
                    topic_name=t_name,
                    question=f"In the context of {t_name}, how would you approach diagnosing and resolving a severe performance or reliability bottleneck?",
                    question_type="technical_deep_dive",
                    difficulty=t_diff,
                    target_duration_seconds=default_duration,
                    expected_concepts=["bottleneck identification", "metrics/monitoring", "mitigation strategy"],
                    evaluation_hints="Break answer into: 1) Detection, 2) Root cause isolation, 3) Actionable resolution.",
                ).model_dump()
            )

        return {"questions": questions[:count]}

    except Exception as e:
        logger.warning("Question generation via LLM failed: %s. Using structured fallback questions.", e)
        fallback_questions = []
        q_types = ["elevator_pitch", "concept_clarity", "technical_deep_dive", "scenario_defense"]
        for i in range(count):
            t_name = topic_names[i % len(topic_names)]
            t_id = topic_id_map.get(t_name, f"topic_{i+1:03d}")
            t_diff = topic_difficulty_map.get(t_name, default_difficulty)
            q_type = q_types[i % len(q_types)]
            dur = 60 if q_type == "elevator_pitch" else default_duration
            fallback_questions.append(
                GeneratedQuestion(
                    id=f"q_{i+1:03d}",
                    topic_id=t_id,
                    topic_name=t_name,
                    question=f"Explain the key principles, trade-offs, and failure modes when working with {t_name}.",
                    question_type=q_type,
                    difficulty=t_diff,
                    target_duration_seconds=dur,
                    expected_concepts=[t_name, "consistency vs availability", "fault tolerance", "throughput"],
                    evaluation_hints="Structure with: Definition -> Primary trade-off -> Real-world scenario.",
                ).model_dump()
            )
        return {"questions": fallback_questions}


# ─── LangGraph Builder ─────────────────────────────────────────────────────────

def build_question_agent_graph(cfg: AppConfig | None = None):
    """Build and compile the LangGraph workflow."""
    workflow = StateGraph(QuestionAgentState)

    # Add nodes with closure over cfg
    workflow.add_node("generate_topics", lambda state: generate_topics_node(state, cfg))
    workflow.add_node("generate_questions", lambda state: generate_questions_node(state, cfg))

    # Add edges
    workflow.add_edge(START, "generate_topics")
    workflow.add_edge("generate_topics", "generate_questions")
    workflow.add_edge("generate_questions", END)

    return workflow.compile()


class QuestionAgent:
    """Convenience wrapper around the compiled LangGraph pipeline."""

    def __init__(self, cfg: AppConfig | None = None) -> None:
        self.cfg = cfg or get_config()
        self.graph = build_question_agent_graph(self.cfg)

    def run(
        self,
        profile: Profile | dict[str, Any],
        requested_topic_count: int = 4,
        requested_question_count: int = 10,
    ) -> dict[str, Any]:
        """
        Execute the agent pipeline.
        Returns a dict containing 'topics' and 'questions' (exactly 10 questions).
        """
        profile_dict = profile.model_dump() if isinstance(profile, Profile) else profile

        initial_state: QuestionAgentState = {
            "profile": profile_dict,
            "requested_topic_count": requested_topic_count,
            "requested_question_count": requested_question_count,
            "topics": [],
            "questions": [],
        }

        final_state = self.graph.invoke(initial_state)
        return {
            "topics": final_state.get("topics", []),
            "questions": final_state.get("questions", []),
        }
