"""
main.py — FastAPI application entry point for SpeakQuest AI backend.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_config
from backend.routers import evaluate, profile, progress, questions, sessions, transcribe

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    cfg = get_config()

    app = FastAPI(
        title="SpeakQuest AI",
        description="Gamified speaking practice backend — evaluation powered by LangGraph + Gemma",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(questions.router)
    app.include_router(sessions.router)
    app.include_router(transcribe.router)
    app.include_router(evaluate.router)
    app.include_router(profile.router)
    app.include_router(progress.router)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "speakquest-backend"}

    logger.info("SpeakQuest backend starting — LLM: %s | Fallback: %s | STT: %s",
                cfg.settings.gemma_model, cfg.settings.ollama_model, cfg.stt["model"])

    return app


app = create_app()
