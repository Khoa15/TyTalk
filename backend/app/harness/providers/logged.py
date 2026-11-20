"""Decorator: logs every LLM request and full response (dev only, HTTP_BODY_LOG=true).

Wraps any LLMProvider, so composer, planner and persona calls are all logged.
The prompt includes the user's message and learned traits: this is a debugging aid.
"""

import json
from collections.abc import AsyncIterator

from app.harness.providers.base import LLMProvider


class LoggedProvider:
    def __init__(self, inner: LLMProvider) -> None:
        self._inner = inner

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        print("LLM_REQUEST " + json.dumps({"messages": messages}, ensure_ascii=False), flush=True)
        parts: list[str] = []
        error: str | None = None
        try:
            async for delta in self._inner.stream(messages):
                parts.append(delta)
                yield delta
        except Exception as exc:
            error = type(exc).__name__
            raise
        finally:
            record = {"response": "".join(parts), "error": error}
            print("LLM_RESPONSE " + json.dumps(record, ensure_ascii=False), flush=True)
