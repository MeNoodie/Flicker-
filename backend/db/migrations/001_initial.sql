-- ─────────────────────────────────────────────────────────────────────────────
-- SpeakQuest AI — Initial Database Schema
-- Run in Supabase SQL editor or via migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ────────────────────────────────────────────────────────────────
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE learning_goal AS ENUM ('interview_preparation', 'concept_clarity', 'communication_practice');
CREATE TYPE game_type AS ENUM ('spinner', 'mystery_cards');
CREATE TYPE session_status AS ENUM (
  'ready', 'recording', 'submitting', 'transcribing', 'evaluating', 'completed', 'failed'
);
CREATE TYPE eval_confidence AS ENUM ('low', 'medium', 'high');

CREATE TYPE user_type AS ENUM ('student', 'professional');
CREATE TYPE college_year AS ENUM ('1st_year', '2nd_year', '3rd_year', '4th_year', 'postgraduate', 'other');

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  domain              TEXT NOT NULL CHECK (char_length(domain) BETWEEN 1 AND 100),
  experience_level    experience_level NOT NULL,
  learning_goal       learning_goal NOT NULL,
  preferred_duration  INTEGER NOT NULL DEFAULT 90 CHECK (preferred_duration IN (60, 90, 120)),
  user_type           user_type NOT NULL DEFAULT 'student',
  -- Student fields
  college_year        college_year,
  institution_name    TEXT,
  major_degree        TEXT,
  -- Professional fields
  years_of_experience NUMERIC(4,1),
  current_role        TEXT,
  target_role         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── topics ────────────────────────────────────────────────────────────────────
CREATE TABLE topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_name  TEXT NOT NULL CHECK (char_length(topic_name) BETWEEN 1 AND 100),
  difficulty  experience_level NOT NULL DEFAULT 'intermediate',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX topics_user_id_idx ON topics(user_id);
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own topics"
  ON topics FOR ALL USING (auth.uid() = user_id);

-- ── questions (seeded curated bank) ──────────────────────────────────────────
CREATE TABLE questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain            TEXT NOT NULL,
  topic             TEXT NOT NULL,
  difficulty        experience_level NOT NULL DEFAULT 'intermediate',
  question_text     TEXT NOT NULL,
  expected_concepts TEXT[] NOT NULL DEFAULT '{}',
  evaluation_hints  TEXT NOT NULL DEFAULT '',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX questions_topic_difficulty_idx ON questions(topic, difficulty, is_active);
-- Questions are readable by all authenticated users
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read questions"
  ON questions FOR SELECT TO authenticated USING (is_active = TRUE);

-- ── practice_sessions ─────────────────────────────────────────────────────────
CREATE TABLE practice_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id         UUID REFERENCES topics(id),
  question_id      UUID REFERENCES questions(id),
  game_type        game_type NOT NULL,
  question         TEXT NOT NULL,
  status           session_status NOT NULL DEFAULT 'ready',
  duration_seconds INTEGER CHECK (duration_seconds > 0 AND duration_seconds <= 180),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX sessions_user_id_idx ON practice_sessions(user_id, created_at DESC);
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON practice_sessions FOR ALL USING (auth.uid() = user_id);

-- ── evaluations ───────────────────────────────────────────────────────────────
CREATE TABLE evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL UNIQUE REFERENCES practice_sessions(id) ON DELETE CASCADE,
  transcript      TEXT NOT NULL,
  score_breakdown JSONB NOT NULL,  -- DimensionScore per dimension
  overall_score   NUMERIC(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  feedback        JSONB NOT NULL,  -- strengths, gaps, misconceptions, improved_answer
  confidence      eval_confidence NOT NULL DEFAULT 'medium',
  needs_retry     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX evaluations_session_id_idx ON evaluations(session_id);
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own evaluations"
  ON evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions ps
      WHERE ps.id = evaluations.session_id
        AND ps.user_id = auth.uid()
    )
  );

-- ── user_progress ─────────────────────────────────────────────────────────────
CREATE TABLE user_progress (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp            INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  completed_sessions  INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  current_streak      INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  last_practice_date  DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress"
  ON user_progress FOR SELECT USING (auth.uid() = user_id);

-- ── Helper: update updated_at on profile changes ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── XP award function (idempotent via evaluations.session_id UNIQUE) ─────────
-- Called after evaluation insert. Awards XP only once per session.
CREATE OR REPLACE FUNCTION award_xp_on_evaluation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_xp      INTEGER := 50;  -- base XP
  v_score   NUMERIC;
BEGIN
  -- Only award for valid, non-retry evaluations
  IF NEW.needs_retry THEN
    RETURN NEW;
  END IF;

  SELECT ps.user_id, NEW.overall_score
    INTO v_user_id, v_score
    FROM practice_sessions ps
   WHERE ps.id = NEW.session_id;

  -- Minimum score gate (10/100)
  IF v_score < 10 THEN
    RETURN NEW;
  END IF;

  INSERT INTO user_progress (user_id, total_xp, completed_sessions, last_practice_date, updated_at)
    VALUES (v_user_id, v_xp, 1, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp           = user_progress.total_xp + v_xp,
    completed_sessions = user_progress.completed_sessions + 1,
    current_streak     = CASE
                           WHEN user_progress.last_practice_date = CURRENT_DATE - 1
                           THEN user_progress.current_streak + 1
                           ELSE 1
                         END,
    last_practice_date = CURRENT_DATE,
    updated_at         = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER evaluations_award_xp
  AFTER INSERT ON evaluations
  FOR EACH ROW EXECUTE FUNCTION award_xp_on_evaluation();
