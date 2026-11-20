from typing import Any

from app.harness.guardrails.chain import GuardChain
from app.harness.prompts import build_system_prompt
from app.schemas.talk import RecentMessage


def build_messages(
    traits: dict[str, Any],
    message: str,
    recent: list[RecentMessage],
    image_queries: list[str],
    input_guard: GuardChain,
) -> list[dict[str, str]]:
    """Assemble the chat request. Recent user turns pass the input guard again."""
    messages = [{"role": "system", "content": build_system_prompt(traits, image_queries)}]
    for turn in recent[-6:]:
        if turn.role == "user" and not input_guard.check(turn.text).ok:
            continue
        messages.append({"role": turn.role, "content": turn.text})
    messages.append({"role": "user", "content": message})
    return messages
