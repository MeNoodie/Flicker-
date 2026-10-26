"""
config.py — Load model.yaml and environment variables into typed settings.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# ─── Raw YAML loader ─────────────────────────────────────────────────────────

def _load_model_yaml() -> dict[str, Any]:
    root = Path(__file__).parent.parent  # project root
    yaml_path = root / "model.yaml"
    with yaml_path.open() as f:
        return yaml.safe_load(f)


# ─── Pydantic settings (from .env) ───────────────────────────────────────────

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str = Field("https://dummy.supabase.co", alias="NEXT_PUBLIC_SUPABASE_URL")
    supabase_anon_key: str = Field("dummy-anon-key", alias="NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field("dummy-service-role-key", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = Field("dummy-jwt-secret", alias="SUPABASE_JWT_SECRET")

    # LLM — primary
    gemma_api_key: str = Field("", alias="GEMMA_API_KEY")
    gemma_model: str = Field("gemma-3-12b-it", alias="GEMMA_MODEL")

    # LLM — fallback
    ollama_base_url: str = Field("http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field("gemma-local:latest", alias="OLLAMA_MODEL")

    # STT
    groq_api_key: str = Field("", alias="GROQ_API_KEY")

    # Backend
    backend_port: int = Field(8000, alias="BACKEND_PORT")
    backend_cors_origins: str = Field("http://localhost:3000", alias="BACKEND_CORS_ORIGINS")

    # Rate limits
    rate_limit_transcribe: int = Field(10, alias="RATE_LIMIT_TRANSCRIBE_PER_MINUTE")
    rate_limit_evaluate: int = Field(5, alias="RATE_LIMIT_EVALUATE_PER_MINUTE")
    rate_limit_sessions: int = Field(20, alias="RATE_LIMIT_SESSIONS_PER_MINUTE")

    # Upload limits
    max_audio_upload_bytes: int = Field(26_214_400, alias="MAX_AUDIO_UPLOAD_BYTES")

    # LangSmith (optional)
    langchain_tracing_v2: bool = Field(False, alias="LANGCHAIN_TRACING_V2")
    langchain_api_key: str | None = Field(None, alias="LANGCHAIN_API_KEY")
    langchain_project: str = Field("speakquest-dev", alias="LANGCHAIN_PROJECT")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",")]


# ─── Combined config object ───────────────────────────────────────────────────

class AppConfig:
    def __init__(self, settings: Settings, yaml_cfg: dict[str, Any]) -> None:
        self.settings = settings
        self.yaml = yaml_cfg

    @property
    def llm(self) -> dict[str, Any]:
        return self.yaml["llm"]

    @property
    def stt(self) -> dict[str, Any]:
        return self.yaml["stt"]

    @property
    def evaluation(self) -> dict[str, Any]:
        return self.yaml["evaluation"]

    @property
    def recording(self) -> dict[str, Any]:
        return self.yaml["recording"]


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    settings = Settings()
    yaml_cfg = _load_model_yaml()
    return AppConfig(settings, yaml_cfg)
