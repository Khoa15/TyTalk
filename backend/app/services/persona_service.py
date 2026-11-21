import asyncio
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.harness.persona_updater import extract_traits
from app.harness.providers.base import LLMProvider
from app.repositories.persona_repo import PersonaRepository

MAX_LIST_ITEMS = 10
_STR_KEYS = ("preferred_name", "tone", "humor", "language")
_LIST_KEYS = ("interests",)


def sanitize_traits(raw: dict[str, Any]) -> dict[str, Any]:
    """Keep only whitelisted keys with bounded size. Extracted data is untrusted."""
    out: dict[str, Any] = {}
    for key in _STR_KEYS:
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            out[key] = value.strip()[:40]
    for key in _LIST_KEYS:
        value = raw.get(key)
        if isinstance(value, list):
            items = [str(v).strip()[:30] for v in value if str(v).strip()]
            if items:
                out[key] = list(dict.fromkeys(items))[:MAX_LIST_ITEMS]
    return out


def merge_traits(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    merged = {**old, **new}
    if "interests" in old or "interests" in new:
        combined = [*new.get("interests", []), *old.get("interests", [])]
        merged["interests"] = list(dict.fromkeys(combined))[:MAX_LIST_ITEMS]
    return merged


class PersonaService:
    def __init__(self) -> None:
        self._repo = PersonaRepository()

    def traits(self, user_id: int) -> dict[str, Any]:
        return self._repo.get_traits(user_id)

    def learn(self, user_id: int, extracted: dict[str, Any]) -> None:
        merged = merge_traits(self._repo.get_traits(user_id), sanitize_traits(extracted))
        self._repo.save_traits(user_id, merged)

    def reset(self, user_id: int) -> None:
        self._repo.save_traits(user_id, {})


_background_tasks: set[asyncio.Task[None]] = set()


def schedule_persona_learning(user_id: int, message: str, provider: LLMProvider) -> None:
    """Fire-and-forget: runs after the reply starts streaming.

    Only the user's message is sent for extraction and only derived traits are saved.
    """

    async def _run() -> None:
        extracted = await extract_traits(provider, message)
        if not extracted:
            return

        await run_in_threadpool(PersonaService().learn, user_id, extracted)

    task = asyncio.create_task(_run())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
