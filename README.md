# SpeakQuest AI

Gamified speaking-practice app — explain concepts aloud, get AI-powered feedback.

## Architecture

```
speakquest/
├── backend/         # Python FastAPI + LangChain + LangGraph
└── frontend/        # Next.js 14 + TypeScript + Tailwind + shadcn/ui
```

| Layer | Tech |
|---|---|
| Python env | `uv` (project: **Flicker**) |
| Agent framework | LangChain + LangGraph |
| Primary LLM | Gemma via Google AI Studio |
| Fallback LLM | Gemma local via Ollama |
| Speech-to-Text | Groq Whisper |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| Frontend | Next.js 14 App Router |

## Quick Start

### 1. Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (`pip install uv`)
- Node.js 20+
- [Ollama](https://ollama.com/) with `gemma3:12b` pulled (for fallback)

### 2. Environment Setup

```bash
cp .env.example .env
# Fill in your values in .env
```

Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_JWT_SECRET`
- `GEMMA_API_KEY` (from [aistudio.google.com](https://aistudio.google.com/app/apikey))
- `GROQ_API_KEY` (from [console.groq.com](https://console.groq.com/keys))

### 3. Database

Run [`backend/db/migrations/001_initial.sql`](backend/db/migrations/001_initial.sql) in your Supabase SQL editor.

Seed the question bank:
```bash
# (one-time setup, after DB is ready)
uv run python -c "
import json, os
from supabase import create_client
db = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
with open('data/questions_seed.json') as f:
    questions = json.load(f)
db.table('questions').upsert(questions, on_conflict='id').execute()
print('Seeded', len(questions), 'questions')
"
```

### 4. Start Backend

```bash
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

### 6. Ollama Fallback (optional but recommended)

```bash
ollama pull gemma3:12b
ollama serve
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `PUT` | `/api/profile` | Save profile + topics |
| `GET` | `/api/profile` | Get profile |
| `POST` | `/api/sessions` | Create practice session |
| `GET` | `/api/sessions` | List session history |
| `POST` | `/api/transcribe` | Upload audio → Groq Whisper |
| `POST` | `/api/evaluate` | Run LangGraph evaluation |
| `GET` | `/api/progress` | Get XP + streak |

## LLM Fallback

The system automatically falls back to local Ollama when the Google AI primary:
- Raises `ConnectionError`, `TimeoutError`, or `RateLimitError`
- Is unavailable

Configured in [`model.yaml`](model.yaml).

## Development

```bash
# Lint
uv run ruff check backend/

# Tests
uv run pytest

# Type check
uv run mypy backend/
```
