from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Read from environment variables or .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"
    # Dev-only: log full request/response bodies (see app/core/http_log.py).
    http_body_log: bool = False
    # PostgreSQL via psycopg 3. Supabase: postgresql+psycopg://... (see backend/.env.example).
    database_url: str = "postgresql+psycopg://tytalk:tytalk@postgres:5432/tytalk"

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

    # RAG: grounded answers from the local PDF corpus (see app/harness/rag).
    rag_enabled: bool = True
    rag_sources_dir: str = "data/rag/sources"
    rag_index_dir: str = "data/rag/index"
    # Local English embedding model (fastembed, ONNX, CPU, 384 dims). The project is English-only.
    # Must match the index it was built with: change it, then re-run ingest.
    rag_embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    # Optional cross-encoder reranker. Empty disables it. Off by default until the eval favours it.
    rag_rerank_model: str = ""
    rag_chunk_chars: int = 1400
    rag_chunk_overlap_chars: int = 200
    rag_candidates: int = 20  # top-k per retriever before fusion
    rag_top_k: int = 4  # chunks handed to the LLM
    # Minimum top-1 cosine similarity for the corpus to count as evidence. Below it: refuse.
    rag_min_score: float = 0.35


@lru_cache
def get_settings() -> Settings:
    return Settings()
