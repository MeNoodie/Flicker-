/**
 * lib/api.ts
 * Typed fetch wrappers for the Python FastAPI backend.
 * All calls include the Supabase JWT for authentication.
 */
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  EvaluateRequest,
  EvaluateResponse,
  Profile,
  QuestionListResponse,
  SessionListResponse,
  TranscribeResponse,
  UpsertProfileRequest,
  UserProgress,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token: string }
): Promise<T> {
  const { token, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(rest.headers ?? {}),
    },
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(token: string): Promise<Profile> {
  return apiFetch<Profile>("/api/profile", { method: "GET", token });
}

export async function upsertProfile(
  token: string,
  body: UpsertProfileRequest
): Promise<Profile> {
  return apiFetch<Profile>("/api/profile", {
    method: "PUT",
    token,
    body: JSON.stringify(body),
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(
  token: string,
  body: CreateSessionRequest
): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>("/api/sessions", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function listSessions(
  token: string,
  limit = 20,
  offset = 0
): Promise<SessionListResponse> {
  return apiFetch<SessionListResponse>(
    `/api/sessions?limit=${limit}&offset=${offset}`,
    { method: "GET", token }
  );
}

// ── Questions ─────────────────────────────────────────────────────────────────

export async function getQuestions(
  token: string,
  count = 10,
  forceRefresh = false
): Promise<QuestionListResponse> {
  return apiFetch<QuestionListResponse>(
    `/api/questions?count=${count}&force_refresh=${forceRefresh}`,
    { method: "GET", token }
  );
}

// ── Transcribe & Typed Answer ─────────────────────────────────────────────────

export async function transcribeAudio(
  token: string,
  sessionId: string,
  audioBlob: Blob,
  filename = "audio.webm"
): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("audio", audioBlob, filename);

  const res = await fetch(`${BASE_URL}/api/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail?.detail ?? `Transcription error ${res.status}`);
  }

  return res.json() as Promise<TranscribeResponse>;
}

export async function submitTypedAnswer(
  token: string,
  sessionId: string,
  transcript: string,
  durationSeconds = 60
): Promise<{ status: string; session_id: string; transcript: string }> {
  return apiFetch<{ status: string; session_id: string; transcript: string }>(
    `/api/sessions/${sessionId}/typed-answer`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ transcript, duration_seconds: durationSeconds }),
    }
  );
}

// ── Evaluate ──────────────────────────────────────────────────────────────────

export async function evaluateSession(
  token: string,
  body: EvaluateRequest
): Promise<EvaluateResponse> {
  return apiFetch<EvaluateResponse>("/api/evaluate", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function getProgress(token: string): Promise<UserProgress> {
  return apiFetch<UserProgress>("/api/progress", { method: "GET", token });
}
