from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1
from app.core.config import get_settings
from app.core.http_log import HttpBodyLogMiddleware
from app.core.errors import AppError
from app.models import User  # noqa: F401  (registers models for the app)

API_VERSION = "1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="TyTalk API",
        version="1.0.0",
        description="Human ↔ LLM Harness talk API. Stream protocol: see POST /api/v1/talk.",
    )

    if settings.http_body_log:
        app.add_middleware(HttpBodyLogMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
    )

    @app.middleware("http")
    async def add_api_version_header(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-API-Version"] = API_VERSION
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
            headers=exc.headers,
        )

    app.include_router(api_v1, prefix="/api/v1")
    return app


app = create_app()
