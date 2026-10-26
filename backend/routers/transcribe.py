"""
transcribe.py — POST /api/transcribe
Accepts audio upload, validates it, calls Groq Whisper, stores transcript.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from backend.config import AppConfig, get_config
from backend.middleware.auth import get_current_user_id
from backend.providers.stt_provider import STTProvider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["transcribe"])

SUPPORTED_MIME = {
    "audio/webm", "audio/mp4", "audio/wav", "audio/mpeg",
    "audio/x-m4a", "audio/ogg", "video/webm",
}


class TranscribeResponse(BaseModel):
    session_id: str
    transcript: str
    language: str | None
    word_count: int
    needs_retry: bool


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> TranscribeResponse:
    """
    Validate and transcribe an audio recording.
    Ownership check, size/MIME validation, then Groq Whisper call.
    """
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)

    # ── Ownership check ───────────────────────────────────────────────────────
    session_row = (
        db.table("practice_sessions")
        .select("id, user_id, status")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not session_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    sess_status = session_row.data["status"]
    if sess_status not in ("submitting", "ready"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transcribe session with status '{sess_status}'",
        )

    # ── File validation ───────────────────────────────────────────────────────
    audio_bytes = await audio.read()
    max_bytes = cfg.settings.max_audio_upload_bytes

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio file")

    if len(audio_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio exceeds {max_bytes // 1_048_576} MB limit",
        )

    content_type = audio.content_type or ""
    if content_type not in SUPPORTED_MIME and not audio.filename.rsplit(".", 1)[-1] in cfg.stt["supported_formats"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio format: {content_type}",
        )

    # ── Update session status ─────────────────────────────────────────────────
    db.table("practice_sessions").update({"status": "transcribing"}).eq("id", session_id).execute()

    # ── Transcribe ────────────────────────────────────────────────────────────
    try:
        stt = STTProvider(cfg)
        result = stt.transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    except Exception as e:
        logger.error("STT failed for session %s: %s", session_id, str(e))
        db.table("practice_sessions").update({"status": "failed"}).eq("id", session_id).execute()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Transcription service error")

    # ── Store transcript (for evaluation step) ────────────────────────────────
    db.table("evaluations").upsert({
        "session_id": session_id,
        "transcript": result.text,
        "score_breakdown": {},
        "overall_score": 0,
        "feedback": {},
        "confidence": "low",
        "needs_retry": result.is_too_short or result.is_empty,
    }, on_conflict="session_id").execute()

    # Move to next state
    db.table("practice_sessions").update({"status": "evaluating"}).eq("id", session_id).execute()

    return TranscribeResponse(
        session_id=session_id,
        transcript=result.text,
        language=result.language,
        word_count=result.word_count,
        needs_retry=result.is_empty or result.is_too_short,
    )
