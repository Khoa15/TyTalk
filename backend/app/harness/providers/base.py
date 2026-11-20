from collections.abc import AsyncIterator
from typing import Protocol


class ProviderError(Exception):
    """Upstream LLM failed or returned an error status."""


class LLMProvider(Protocol):
    """Strategy: any chat model that can stream text deltas for a message list."""

    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...


async def collect(provider: LLMProvider, messages: list[dict[str, str]]) -> str:
    """Non-streaming helper used by the planner and persona extraction."""
    parts: list[str] = []
    async for delta in provider.stream(messages):
        parts.append(delta)
    return "".join(parts)
