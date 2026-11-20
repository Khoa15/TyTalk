import json
from collections.abc import AsyncIterator

import httpx

from app.harness.providers.base import ProviderError


class AnthropicProvider:
    """Native Anthropic Messages API (streaming). Use when LLM_PROVIDER=anthropic."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout_s: float, max_tokens: int) -> None:
        self._url = f"{base_url.rstrip('/')}/messages"
        self._headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        self._model = model
        self._timeout = timeout_s
        self._max_tokens = max_tokens

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        convo = [m for m in messages if m["role"] != "system"]
        body = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "system": system,
            "messages": convo,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream("POST", self._url, json=body, headers=self._headers) as resp:
                    if resp.status_code >= 400:
                        raise ProviderError(f"upstream status {resp.status_code}")
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        event = json.loads(line[5:].strip() or "{}")
                        if event.get("type") == "content_block_delta":
                            text = (event.get("delta") or {}).get("text")
                            if text:
                                yield text
        except httpx.HTTPError as exc:
            raise ProviderError(str(exc)) from exc
