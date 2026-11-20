import re
from typing import Literal

Route = Literal["fast", "plan"]

# Requests that need visuals go through plan-then-execute (fetch images first).
# Everything else takes the fast path: one streamed LLM call, no tools.
_VISUAL_HINTS = re.compile(
    r"(\bảnh\b|\bhình\b|\bphotos?\b|\bpictures?\b|\bimages?\b|\bpics?\b|\bshow me\b|\blet me see\b"
    r"|\bdraw\b|\bsketch\b|\bdisplay\b|\blook like\b|\bcho (tôi|mình|tớ) xem\b|\btrông (như|thế nào)\b)",
    re.IGNORECASE,
)


def route_message(text: str) -> Route:
    return "plan" if _VISUAL_HINTS.search(text) else "fast"
