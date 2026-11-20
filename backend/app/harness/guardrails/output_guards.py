from app.harness.guardrails.chain import GuardChain, GuardResult
from app.harness.guardrails.input_guards import SECRET_RE


class CanaryGuard:
    """LLM07: blocks output that leaks the hidden system-prompt canary."""

    def __init__(self, canary: str) -> None:
        self._canary = canary

    def check(self, text: str) -> GuardResult:
        if self._canary in text:
            return GuardResult(ok=False, reason="system_prompt_leak")
        return GuardResult(ok=True)


class SecretOutputGuard:
    """LLM02/LLM06: blocks credentials the model might echo back."""

    def check(self, text: str) -> GuardResult:
        if SECRET_RE.search(text):
            return GuardResult(ok=False, reason="secret_in_output")
        return GuardResult(ok=True)


def build_output_chain(canary: str) -> GuardChain:
    return GuardChain([CanaryGuard(canary), SecretOutputGuard()])
