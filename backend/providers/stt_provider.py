"""
stt_provider.py — Speech-to-text via Groq Whisper API.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from groq import Groq

from backend.config import AppConfig

logger = logging.getLogger(__name__)


@dataclass
class TranscriptResult:
    text: str
    language: str | None
    duration: float | None
    word_count: int

    @property
    def is_empty(self) -> bool:
        return len(self.text.strip()) == 0

    @property
    def is_too_short(self) -> bool:
        """Below 10 words — likely unusable for evaluation."""
        return self.word_count < 10


class STTProvider:
    def __init__(self, cfg: AppConfig) -> None:
        self._cfg = cfg
        self._client = Groq(api_key=cfg.settings.groq_api_key)
        self._stt_cfg = cfg.stt

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> TranscriptResult:
        """
        Transcribe audio bytes using Groq Whisper.

        Args:
            audio_bytes: Raw audio file bytes.
            filename: Original filename (used for MIME-type hinting).

        Returns:
            TranscriptResult with text and metadata.
        """
        logger.info("Transcribing audio via Groq Whisper (%s, %d bytes)", filename, len(audio_bytes))

        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename  # Groq uses this for MIME detection

        response = self._client.audio.transcriptions.create(
            file=audio_file,
            model=self._stt_cfg["model"],
            language=self._stt_cfg.get("language"),  # None = auto-detect
            response_format=self._stt_cfg.get("response_format", "verbose_json"),
        )

        text = response.text.strip()
        language = getattr(response, "language", None)
        duration = getattr(response, "duration", None)
        word_count = len(text.split()) if text else 0

        logger.info(
            "Transcription complete: %d words, language=%s, duration=%.1fs",
            word_count,
            language,
            duration or 0,
        )

        return TranscriptResult(
            text=text,
            language=language,
            duration=duration,
            word_count=word_count,
        )
