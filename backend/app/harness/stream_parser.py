"""Parses the composer's NDJSON stream: one JSON object per line.

Allowed objects (anything else is dropped):
  {"type": "say",   "text": "..."}                       -> spoken + subtitles
  {"type": "state", "state": "<orb state>", "seconds": n} -> orb state (action, never spoken)
  {"type": "image", "query": "...", "seconds": n}         -> image (action, never spoken)
  {"type": "form", "form": "<orb form>", "seconds": n}     -> Orb body form (action)
  {"type": "entity", "kind": "<entity>", "count": n, "seconds": n} -> summoned entity (action)
  {"type": "sim", "id": "<sim>", "params": {...}, "seconds": n}    -> astronomy simulation (action)
  {"type": "suggest", "items": ["...", "..."]}             -> tappable follow-up questions (never spoken)

Only "say" produces Text. Stray prose outside JSON is discarded, so stage directions
such as "*waves*" can never reach TTS or subtitles.
"""

import json
from dataclasses import dataclass
from typing import Any

from app.harness.states import ENTITY_KINDS, MAX_ENTITY_COUNT, ORB_FORMS, ORB_STATES, SIM_IDS

DEFAULT_SECONDS = 2.0
MAX_LINE_CHARS = 1000
MAX_QUERY_CHARS = 80
MAX_SAY_CHARS = 250  # tiny-voca reads one utterance per call; keep sentences short
MAX_SUGGESTIONS = 3
MAX_SUGGEST_CHARS = 60


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


@dataclass(frozen=True)
class FormTag:
    form: str
    seconds: float


@dataclass(frozen=True)
class EntityTag:
    kind: str
    count: int
    seconds: float


@dataclass(frozen=True)
class SuggestTag:
    items: tuple[str, ...]


@dataclass(frozen=True)
class SimTag:
    sim_id: str
    params: tuple[tuple[str, str], ...]  # sorted (name, value) pairs, already whitelisted
    seconds: float


Item = Text | StateTag | ImageTag | FormTag | EntityTag | SimTag | SuggestTag


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

    if kind == "form":
        form = obj.get("form")
        return FormTag(form, seconds) if form in ORB_FORMS else None

    if kind == "entity":
        entity = obj.get("kind")
        if entity not in ENTITY_KINDS:
            return None
        return EntityTag(entity, _count(obj.get("count")), seconds)

    if kind == "sim":
        sim_id = obj.get("id")
        if sim_id not in SIM_IDS:
            return None
        return SimTag(sim_id, _sim_params(sim_id, obj.get("params")), seconds)

    if kind == "suggest":
        return _suggest(obj.get("items"))

    return None


def _suggest(raw: Any) -> SuggestTag | None:
    """Keep up to 3 short, non-empty questions. Anything else is dropped."""
    if not isinstance(raw, list):
        return None
    items = [i.strip()[:MAX_SUGGEST_CHARS] for i in raw if isinstance(i, str) and i.strip()]
    items = list(dict.fromkeys(items))[:MAX_SUGGESTIONS]
    return SuggestTag(tuple(items)) if items else None


def _count(value: Any) -> int:
    if isinstance(value, int) and not isinstance(value, bool):
        return max(1, min(MAX_ENTITY_COUNT, value))
    return 1


def _sim_params(sim_id: str, raw: Any) -> tuple[tuple[str, str], ...]:
    """Keep only params the sim declares, with values from its allowed list."""
    if not isinstance(raw, dict):
        return ()
    allowed = SIM_IDS[sim_id]
    kept = [
        (name, value)
        for name, value in raw.items()
        if name in allowed and value in allowed[name]
    ]
    return tuple(sorted(kept))


def _seconds(value: Any) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return DEFAULT_SECONDS
