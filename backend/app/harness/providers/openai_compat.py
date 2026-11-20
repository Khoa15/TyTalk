import json
from collections.abc import AsyncIterator

import httpx

from app.harness.providers.base import ProviderError


class OpenAICompatProvider:
    """Covers every OpenAI-compatible endpoint: OpenRouter, OpenAI, DeepSeek, Qwen, Gemini-compat."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout_s: float, max_tokens: int) -> None:
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        self._model = model
        self._timeout = timeout_s
        self._max_tokens = max_tokens

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        body = {
            "model": self._model,
            "messages": messages,
            "stream": True,
            "max_tokens": self._max_tokens,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream("POST", self._url, json=body, headers=self._headers) as resp:
                    if resp.status_code >= 400:
                        raise ProviderError(f"upstream status {resp.status_code}")
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            break
                        delta = _delta_text(payload)
                        if delta:
                            yield delta
        except httpx.HTTPError as exc:
            raise ProviderError(str(exc)) from exc


def _delta_text(payload: str) -> str | None:
    try:
        chunk = json.loads(payload)
    except json.JSONDecodeError:
        return None
    choices = chunk.get("choices") or [{}]
    return (choices[0].get("delta") or {}).get("content")
