from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class GuardResult:
    ok: bool
    reason: str = ""


class Guard(Protocol):
    def check(self, text: str) -> GuardResult: ...


class GuardChain:
    """Chain of Responsibility: the first guard that rejects stops the chain."""

    def __init__(self, guards: Sequence[Guard]) -> None:
        self._guards = tuple(guards)

    def check(self, text: str) -> GuardResult:
        for guard in self._guards:
            result = guard.check(text)
            if not result.ok:
                return result
        return GuardResult(ok=True)
