from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Read from environment variables or .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"
    # Dev-only: log full request/response bodies (see app/core/http_log.py).
    http_body_log: bool = False
    database_url: str = "mysql+pymysql://tytalk:tytalk@mysql:3306/tytalk"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    cors_origins: list[str] = ["http://localhost:5173"]

    # Any OpenAI-compatible endpoint (OpenRouter, DeepSeek, Qwen, Gemini-compat, OpenAI...)
    # or "anthropic". Switching model/provider is configuration only.
    llm_provider: str = "openrouter"
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-4o-mini"
    llm_timeout_s: float = 30.0
    llm_max_tokens: int = 800

    auth_rate_limit_per_minute: int = 5
    # Talk is limited per client IP: 10 requests per minute.
    talk_rate_limit_per_minute: int = 10
    # Dev only: exposes POST /auth/tester, a passwordless login for the shared tester account.
    tester_login_enabled: bool = False
    tester_email: str = "tester@tytalk.local"

    # Wikimedia returns thumbnails on thumb.wikimedia.org, originals on upload.wikimedia.org.
    # Local TTS (tiny-voca, ONNX, CPU). Missing model files disable TTS; text still streams.
    tts_enabled: bool = True
    tts_model_dir: str = "/app/models/tiny-voca"

    image_domain_allowlist: list[str] = ["upload.wikimedia.org", "thumb.wikimedia.org"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
