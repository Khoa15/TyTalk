"""Dev-only HTTP body logger. Enabled with HTTP_BODY_LOG=true; never on by default.

Logs full request and response bodies as one JSON line per request to stdout.
Secret fields (passwords, tokens, Authorization header) are redacted.
Chat text is NOT redacted: this is a debugging aid, do not enable it in production.
"""

import json
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REDACT_KEYS = {"password", "access_token", "refresh_token", "authorization"}
# Health probes are noise for debugging; they are not logged.
SKIP_PATHS = {"/api/v1/health"}


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: ("***" if k.lower() in REDACT_KEYS else _redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


def _render(raw: bytes) -> Any:
    if not raw:
        return None
    text = raw.decode("utf-8", errors="replace")
    try:
        return _redact(json.loads(text))
    except json.JSONDecodeError:
        return text  # SSE streams and non-JSON bodies are logged verbatim


class HttpBodyLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"] in SKIP_PATHS:
            await self._app(scope, receive, send)
            return

        request_chunks: list[bytes] = []
        response_chunks: list[bytes] = []
        status: dict[str, int] = {}

        async def recv() -> Message:
            message = await receive()
            if message["type"] == "http.request":
                request_chunks.append(message.get("body", b""))
            return message

        async def snd(message: Message) -> None:
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            elif message["type"] == "http.response.body":
                response_chunks.append(message.get("body", b""))
            await send(message)

        try:
            await self._app(scope, recv, snd)
        finally:
            headers = {k.decode(): v.decode() for k, v in scope.get("headers", [])}
            record = {
                "method": scope["method"],
                "path": scope["path"],
                "query": scope.get("query_string", b"").decode(),
                "status": status.get("code"),
                "request_headers": _redact({"authorization": headers.get("authorization")}),
                "request_body": _render(b"".join(request_chunks)),
                "response_body": _render(b"".join(response_chunks)),
            }
            print("HTTP " + json.dumps(record, ensure_ascii=False), flush=True)
