from typing import Any

from app.harness.states import (
    MAX_ENTITIES,
    MAX_FORMS,
    MAX_IMAGES,
    MAX_SECONDS,
    MAX_SEGMENTS,
    MAX_SIMS,
    MIN_SECONDS,
)
from app.harness.stream_parser import EntityTag, FormTag, ImageTag, Item, SimTag, StateTag, Text
from app.harness.tools.image_search import ImageResult


def event(name: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"event": name, "data": data}


def estimate_speech_ms(text: str) -> int:
    """Rough speaking time for text that has no audio (e.g. Vietnamese with tiny-voca)."""
    return max(300, len(text) * 60)


def _ms(seconds: float) -> int:
    return int(max(MIN_SECONDS, min(MAX_SECONDS, seconds)) * 1000)


class TimelineBuilder:
    """Turns parsed items into timed SSE events and enforces the hard limits.

    `at_ms` is a cursor on the server, relative to the start of the reply.
    The client plays everything from one local clock, so these offsets are the only timing info sent.
    """

    def __init__(self) -> None:
        self._cursor_ms = 0
        self._char_offset = 0
        self._segments = 0
        self._images = 0
        self._image_end_ms = 0
        self._forms = 0
        self._entities = 0
        self._sims = 0
        self._visual_end_ms = 0  # forms, entities and sims run beside the speech; they never move the cursor

    def say(self, text: str, duration_ms: int, wav_base64: str | None = None) -> list[dict[str, Any]]:
        """Speech advances the shared cursor by its duration (real audio, or an estimate when silent)."""
        events = [event("text", {"delta": text, "char_offset": self._char_offset})]
        if wav_base64:
            events.append(
                event(
                    "audio",
                    {
                        "at_ms": self._cursor_ms,
                        "duration_ms": duration_ms,
                        "char_offset": self._char_offset,
                        "wav_base64": wav_base64,
                    },
                )
            )
        self._char_offset += len(text)
        self._cursor_ms += duration_ms
        return events

    def apply(self, item: Item, images: dict[str, ImageResult]) -> list[dict[str, Any]]:
        if isinstance(item, Text):
            return self.say(item.text, estimate_speech_ms(item.text))

        if isinstance(item, StateTag):
            if self._segments >= MAX_SEGMENTS:
                return []
            duration = _ms(item.seconds)
            evt = event(
                "segment",
                {
                    "index": self._segments,
                    "state": item.state,
                    "at_ms": self._cursor_ms,
                    "duration_ms": duration,
                },
            )
            self._segments += 1
            self._cursor_ms += duration
            return [evt]

        if isinstance(item, ImageTag):
            return self._image(item, images)
        if isinstance(item, FormTag):
            return self._form(item)
        if isinstance(item, EntityTag):
            return self._entity(item)
        if isinstance(item, SimTag):
            return self._sim(item)
        return []

    def done(self) -> dict[str, Any]:
        # The reply lasts until the last segment OR the last image has finished.
        return event(
            "done",
            {"total_ms": max(self._cursor_ms, self._image_end_ms, self._visual_end_ms)},
        )

    def _start_visual(self, seconds: float) -> tuple[int, int]:
        duration = _ms(seconds)
        self._visual_end_ms = max(self._visual_end_ms, self._cursor_ms + duration)
        return self._cursor_ms, duration

    def _form(self, tag: FormTag) -> list[dict[str, Any]]:
        if self._forms >= MAX_FORMS:
            return []
        self._forms += 1
        at_ms, duration = self._start_visual(tag.seconds)
        return [event("form", {"form": tag.form, "at_ms": at_ms, "duration_ms": duration})]

    def _entity(self, tag: EntityTag) -> list[dict[str, Any]]:
        if self._entities >= MAX_ENTITIES:
            return []
        self._entities += 1
        at_ms, duration = self._start_visual(tag.seconds)
        return [
            event(
                "entity",
                {"kind": tag.kind, "count": tag.count, "at_ms": at_ms, "duration_ms": duration},
            )
        ]

    def _sim(self, tag: SimTag) -> list[dict[str, Any]]:
        if self._sims >= MAX_SIMS:
            return []
        self._sims += 1
        at_ms, duration = self._start_visual(tag.seconds)
        return [
            event(
                "sim",
                {
                    "id": tag.sim_id,
                    "params": dict(tag.params),
                    "at_ms": at_ms,
                    "duration_ms": duration,
                },
            )
        ]

    def _image(self, tag: ImageTag, images: dict[str, ImageResult]) -> list[dict[str, Any]]:
        # Only images the planner fetched are allowed; the LLM cannot request arbitrary URLs.
        result = images.get(tag.query)
        if result is None or self._images >= MAX_IMAGES:
            return []
        self._images += 1
        self._image_end_ms = max(self._image_end_ms, self._cursor_ms + _ms(tag.seconds))
        return [
            event(
                "image",
                {
                    "url": result.url,
                    "caption": result.caption,
                    "char_offset": self._char_offset,
                    "at_ms": self._cursor_ms,
                    "duration_ms": _ms(tag.seconds),
                },
            )
        ]
