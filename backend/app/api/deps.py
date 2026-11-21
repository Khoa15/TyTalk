import math
from functools import lru_cache
from pathlib import Path
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.core.security import decode_access_token
from app.db.session import get_db
from app.harness.facade import Harness
from app.harness.guardrails.input_guards import build_input_chain
from app.harness.guardrails.output_guards import build_output_chain
from app.harness.prompts import CANARY
from app.harness.providers.factory import build_provider
from app.harness.rag.retriever import default_retriever
from app.harness.providers.logged import LoggedProvider
from app.harness.tools.image_search import ImageSearchTool
from app.harness.tts.tiny_voca import TinyVocaSynth
from app.models.user import User
from app.repositories.user_repo import UserRepository

_bearer = HTTPBearer(auto_error=False)

_settings = get_settings()
auth_limiter = RateLimiter(_settings.auth_rate_limit_per_minute, per_seconds=60)
talk_limiter = RateLimiter(_settings.talk_rate_limit_per_minute, per_seconds=60)


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if creds is None:
        raise AppError(401, "unauthorized", "Missing access token")
    try:
        user_id = decode_access_token(creds.credentials)
    except jwt.PyJWTError as exc:
        raise AppError(401, "unauthorized", "Invalid access token") from exc
    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        raise AppError(401, "unauthorized", "User does not exist")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def _enforce(limiter: RateLimiter, key: str) -> None:
    retry_after = limiter.hit(key)
    if retry_after > 0:
        raise AppError(
            429,
            "rate_limited",
            "You are acting too fast, please try again later",
            headers={"Retry-After": str(math.ceil(retry_after))},
        )


def limit_by_ip(limiter: RateLimiter):
    def dependency(request: Request) -> None:
        host = request.client.host if request.client else "unknown"
        _enforce(limiter, f"ip:{host}")

    return dependency


def limit_by_user(limiter: RateLimiter):  # kept for per-account limits
    def dependency(user: CurrentUser) -> None:
        _enforce(limiter, f"user:{user.id}")

    return dependency


@lru_cache
def get_harness() -> Harness:
    settings = get_settings()
    provider = build_provider(settings)
    if settings.http_body_log:
        provider = LoggedProvider(provider)
    tts = None
    model_file = Path(settings.tts_model_dir) / "onnx" / "model.onnx"
    if settings.tts_enabled and model_file.exists():
        tts = TinyVocaSynth(settings.tts_model_dir)
    retriever = default_retriever() if settings.rag_enabled else None
    return Harness(
        provider=provider,
        images=ImageSearchTool(allowed_hosts=settings.image_domain_allowlist),
        input_guard=build_input_chain(),
        output_guard=build_output_chain(CANARY),
        tts=tts,
        retriever=retriever,
    )
