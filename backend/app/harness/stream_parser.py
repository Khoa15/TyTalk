"""Parses the composer's NDJSON stream: one JSON object per line.

Allowed objects (anything else is dropped):
  {"type": "say",   "text": "..."}                       -> spoken + subtitles
  {"type": "state", "state": "<orb state>", "seconds": n} -> orb state (action, never spoken)
  {"type": "image", "query": "...", "seconds": n}         -> image (action, never spoken)

Only "say" produces Text. Stray prose outside JSON is discarded, so stage directions
such as "*waves*" can never reach TTS or subtitles.
"""

import json
from dataclasses import dataclass
from typing import Any

from app.harness.states import ORB_STATES

DEFAULT_SECONDS = 2.0
MAX_LINE_CHARS = 1000
MAX_QUERY_CHARS = 80
MAX_SAY_CHARS = 250  # tiny-voca reads one utterance per call; keep sentences short


@dataclass(frozen=True)
class Text:
    text: str


@dataclass(frozen=True)
class StateTag:
    state: str
    seconds: float


@dataclass(frozen=True)
class ImageTag:
    query: str
    seconds: float


Item = Text | StateTag | ImageTag


class StreamParser:
    """Incremental NDJSON parser. Chunks may split lines anywhere."""

    def __init__(self) -> None:
        self._buf = ""

    def feed(self, chunk: str) -> list[Item]:
        self._buf += chunk
        out: list[Item] = []
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            item = _parse_line(line)
            if item is not None:
                out.append(item)
        if len(self._buf) > MAX_LINE_CHARS:
            self._buf = ""  # runaway line that never terminates: drop it
        return out

    def flush(self) -> list[Item]:
        line, self._buf = self._buf, ""
        item = _parse_line(line)
        return [item] if item is not None else []


def _parse_line(line: str) -> Item | None:
    stripped = line.strip()
    if not stripped or len(stripped) > MAX_LINE_CHARS:
        return None
    try:
        obj = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    return _to_item(obj)


def _to_item(obj: dict[str, Any]) -> Item | None:
    kind = obj.get("type")
    seconds = _seconds(obj.get("seconds"))

    if kind == "say":
        text = obj.get("text")
        if isinstance(text, str) and text.strip():
            return Text(text.strip()[:MAX_SAY_CHARS] + " ")
        return None

    if kind == "state":
        state = obj.get("state")
        return StateTag(state, seconds) if state in ORB_STATES else None

    if kind == "image":
        query = obj.get("query")
        if isinstance(query, str) and query.strip():
            return ImageTag(query.strip()[:MAX_QUERY_CHARS], seconds)
        return None

    return None


def _seconds(value: Any) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return DEFAULT_SECONDS
