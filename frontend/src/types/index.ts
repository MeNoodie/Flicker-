/**
 * types/index.ts
 * Shared TypeScript types mirroring the Python Pydantic schemas.
 */

// ── Games ─────────────────────────────────────────────────────────────────────
export type GameType = "spinner" | "mystery_cards";

export type SessionStatus =
  | "ready"
  | "recording"
  | "submitting"
  | "transcribing"
  | "evaluating"
  | "completed"
  | "failed";

// ── Profile ───────────────────────────────────────────────────────────────────
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type LearningGoal =
  | "interview_preparation"
  | "concept_clarity"
  | "communication_practice";
export type PreferredDuration = 60 | 90 | 120;
export type UserType = "student" | "professional";
export type CollegeYear =
  | "1st_year"
  | "2nd_year"
  | "3rd_year"
  | "4th_year"
  | "postgraduate"
  | "other";

export interface Topic {
  id?: string;
  topic_name: string;
  difficulty: ExperienceLevel;
  is_active?: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
  domain: string;
  experience_level: ExperienceLevel;
  learning_goal: LearningGoal;
  preferred_duration: PreferredDuration;
  user_type: UserType;
  // Student fields
  college_year?: CollegeYear;
  institution_name?: string;
  major_degree?: string;
  // Professional fields
  years_of_experience?: number;
  current_role?: string;
  target_role?: string;
  topics: Topic[];
  created_at?: string;
  updated_at?: string;
}

export interface UpsertProfileRequest {
  display_name: string;
  domain: string;
  experience_level: ExperienceLevel;
  learning_goal: LearningGoal;
  preferred_duration: PreferredDuration;
  user_type: UserType;
  college_year?: CollegeYear;
  institution_name?: string;
  major_degree?: string;
  years_of_experience?: number;
  current_role?: string;
  target_role?: string;
  topics: Topic[];
}

// ── Questions ─────────────────────────────────────────────────────────────────
export type QuestionType =
  | "concept_clarity"
  | "technical_deep_dive"
  | "scenario_defense"
  | "elevator_pitch";

export interface GeneratedQuestionItem {
  id: string;
  topic_id: string;
  topic_name: string;
  question: string;
  question_type: QuestionType;
  difficulty: ExperienceLevel;
  target_duration_seconds: number;
  expected_concepts: string[];
  evaluation_hints: string;
}

export interface QuestionListResponse {
  questions: GeneratedQuestionItem[];
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export interface PracticeSession {
  id: string;
  user_id: string;
  topic_id: string;
  game_type: GameType;
  question_id?: string;
  question: string;
  difficulty?: ExperienceLevel;
  target_duration_seconds?: number;
  status: SessionStatus;
  duration_seconds?: number;
  created_at?: string;
  completed_at?: string;
}

export interface CreateSessionRequest {
  topic_id: string;
  game_type: GameType;
  question_id: string;
  question?: string;
  difficulty?: ExperienceLevel;
  target_duration_seconds?: number;
  expected_concepts?: string[];
  evaluation_hints?: string;
}

export interface CreateSessionResponse {
  session: PracticeSession;
}

export interface SessionListResponse {
  sessions: PracticeSession[];
  total: number;
}

// ── Questions ─────────────────────────────────────────────────────────────────
export interface Question {
  id: string;
  domain: string;
  topic: string;
  difficulty: ExperienceLevel;
  question_text: string;
  expected_concepts: string[];
  evaluation_hints: string;
}

// ── Transcription ─────────────────────────────────────────────────────────────
export interface TranscribeResponse {
  session_id: string;
  transcript: string;
  language?: string;
  word_count: number;
  needs_retry: boolean;
}

// ── Evaluation ────────────────────────────────────────────────────────────────
export type DimensionName =
  | "conceptual_accuracy"
  | "concept_clarity"
  | "depth_of_understanding"
  | "technical_precision"
  | "structure_and_reasoning"
  | "relevance";

export interface DimensionScore {
  score: number;
  evidence: string;
}

export interface EvaluationResult {
  session_id: string;
  transcript: string;
  dimension_scores: Record<DimensionName, DimensionScore>;
  overall_score: number;
  strengths: string[];
  improvement_areas: string[];
  misconceptions: string[];
  missing_concepts: string[];
  improved_answer: string;
  confidence: "low" | "medium" | "high";
  xp_awarded: number;
  needs_retry: boolean;
  retry_reason?: string;
}

export interface EvaluateRequest {
  session_id: string;
}

export interface EvaluateResponse {
  success: boolean;
  result?: EvaluationResult;
  error?: string;
  needs_retry: boolean;
  retry_reason?: string;
}

// ── Progress ──────────────────────────────────────────────────────────────────
export interface UserProgress {
  user_id: string;
  total_xp: number;
  completed_sessions: number;
  current_streak: number;
  last_practice_date?: string;
  updated_at?: string;
}

// ── Dimension display labels ──────────────────────────────────────────────────
export const DIMENSION_LABELS: Record<DimensionName, string> = {
  conceptual_accuracy: "Conceptual Accuracy",
  concept_clarity: "Concept Clarity",
  depth_of_understanding: "Depth of Understanding",
  technical_precision: "Technical Precision",
  structure_and_reasoning: "Structure & Reasoning",
  relevance: "Relevance",
};

export const DIMENSION_WEIGHTS: Record<DimensionName, number> = {
  conceptual_accuracy: 30,
  concept_clarity: 20,
  depth_of_understanding: 20,
  technical_precision: 15,
  structure_and_reasoning: 10,
  relevance: 5,
};
