"""
llm_provider.py — Gemma (Google AI Studio) primary + Ollama fallback.
Automatic failover using tenacity retry logic.
"""
from __future__ import annotations

import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_core.outputs import ChatResult
from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_fixed,
)

from backend.config import AppConfig

logger = logging.getLogger(__name__)

# Errors that should trigger fallback to Ollama
_FALLBACK_ERRORS = (
    ConnectionError,
    TimeoutError,
    OSError,
)


def _build_primary(cfg: AppConfig) -> BaseChatModel:
    """Build Google AI (Gemma) primary LLM."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=cfg.settings.gemma_model,
        google_api_key=cfg.settings.gemma_api_key,
        temperature=cfg.llm["primary"]["temperature"],
        max_tokens=cfg.llm["primary"]["max_tokens"],
    )


def _build_fallback(cfg: AppConfig) -> BaseChatModel:
    """Build Ollama (local Gemma) fallback LLM."""
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=cfg.settings.ollama_model,
        base_url=cfg.settings.ollama_base_url,
        temperature=cfg.llm["fallback"]["temperature"],
        num_predict=cfg.llm["fallback"]["max_tokens"],
    )


class FallbackLLM(BaseChatModel):
    """
    LangChain-compatible LLM that tries the primary (Gemma via Google AI)
    and automatically falls back to Ollama on connection/rate-limit errors.
    """

    cfg: Any  # AppConfig — stored as Any to avoid pydantic serialisation issues

    class Config:
        arbitrary_types_allowed = True

    @property
    def _llm_type(self) -> str:
        return "speakquest-fallback-llm"

    def _generate(self, messages: list[BaseMessage], **kwargs: Any) -> ChatResult:
        # If no Google AI key configured, use local Ollama directly
        if not self.cfg.settings.gemma_api_key or self.cfg.settings.gemma_api_key in ("dummy-key", "your-google-ai-api-key"):
            logger.info("No valid GEMMA_API_KEY found, using local Ollama model: %s", self.cfg.settings.ollama_model)
            fallback = _build_fallback(self.cfg)
            return fallback._generate(messages, **kwargs)

        primary = _build_primary(self.cfg)

        @retry(
            stop=stop_after_attempt(self.cfg.llm["retry"]["max_attempts"]),
            retry=retry_if_exception_type(_FALLBACK_ERRORS),
            wait=wait_fixed(1),
        )
        def _call_primary() -> ChatResult:
            return primary._generate(messages, **kwargs)

        try:
            logger.info("Calling primary LLM: %s", self.cfg.settings.gemma_model)
            return _call_primary()
        except (RetryError, Exception) as e:
            logger.warning(
                "Primary LLM failed (%s), switching to Ollama fallback: %s",
                type(e).__name__,
                str(e)[:120],
            )
            fallback = _build_fallback(self.cfg)
            logger.info("Calling fallback LLM: %s", self.cfg.settings.ollama_model)
            return fallback._generate(messages, **kwargs)

    async def _agenerate(self, messages: list[BaseMessage], **kwargs: Any) -> ChatResult:
        """Async version — runs sync version in threadpool (sufficient for MVP)."""
        import asyncio

        return await asyncio.get_event_loop().run_in_executor(
            None, lambda: self._generate(messages, **kwargs)
        )


def get_llm(cfg: AppConfig) -> FallbackLLM:
    """Return the configured LLM with automatic fallback."""
    return FallbackLLM(cfg=cfg)
