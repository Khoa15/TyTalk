from typing import TYPE_CHECKING, Any

from app.harness.guardrails.chain import GuardChain
from app.harness.prompts import build_system_prompt
from app.schemas.talk import RecentMessage

if TYPE_CHECKING:
    from app.harness.rag.retriever import Evidence

GROUNDING_RULES = (
    "GROUNDING: answer ONLY from the <evidence> passages below. They are excerpts from the science books. "
    "If the passages do not answer the question, say simply that Orb is not sure about that yet and invite a "
    "different science question. Never add facts that are not in the passages. Do not cite sources aloud."
)


def evidence_block(evidence: "list[Evidence]") -> str:
    passages = "\n\n".join(f"[{i + 1}] ({e.citation()})\n{e.text}" for i, e in enumerate(evidence))
    return f"{GROUNDING_RULES}\n\n<evidence>\n{passages}\n</evidence>"


def build_messages(
    traits: dict[str, Any],
    message: str,
    recent: list[RecentMessage],
    image_queries: list[str],
    input_guard: GuardChain,
    evidence: "list[Evidence] | None" = None,
    hints: list[str] | None = None,
) -> list[dict[str, str]]:
    """Assemble the chat request. Recent user turns pass the input guard again."""
    messages = [{"role": "system", "content": build_system_prompt(traits, image_queries)}]
    if evidence:
        messages.append({"role": "system", "content": evidence_block(evidence)})
    if hints:
        messages.append({"role": "system", "content": "TURN HINTS (server instructions):\n- " + "\n- ".join(hints)})
    for turn in recent[-6:]:
        if turn.role == "user" and not input_guard.check(turn.text).ok:
            continue
        messages.append({"role": turn.role, "content": turn.text})
    messages.append({"role": "user", "content": message})
    return messages
