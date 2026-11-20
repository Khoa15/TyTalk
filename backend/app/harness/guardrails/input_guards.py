import re

from app.harness.guardrails.chain import GuardChain, GuardResult

# LLM01: direct prompt injection and jailbreak phrasing (English + Vietnamese).
_INJECTION_RE = re.compile(
    r"(ignore (all |the |any )?(previous|above|prior) .{0,30}(instructions?|prompts?)"
    r"|disregard .{0,30}(instructions?|prompts?)"
    r"|(enable|enter|activate|switch to|you are( now)? in) .{0,10}developer mode"
    r"|\bjailbreak\b|you are now (a|an|in) |act as (dan|an? unfiltered)"
    r"|\b(reveal|print|repeat|dump|output|show|tell me) (me )?(your|the) (system )?(prompt|instructions?)"
    r"|bỏ qua (mọi|tất cả|các|toàn bộ) .{0,25}(chỉ dẫn|hướng dẫn|lệnh)"
    r"|tiết lộ .{0,20}(prompt|hướng dẫn hệ thống))",
    re.IGNORECASE,
)

# LLM06: credentials that must never be sent to a third-party model.
SECRET_RE = re.compile(
    r"(sk-[A-Za-z0-9_\-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----)"
)


class InjectionGuard:
    def check(self, text: str) -> GuardResult:
        if _INJECTION_RE.search(text):
            return GuardResult(ok=False, reason="prompt_injection")
        return GuardResult(ok=True)


class SecretGuard:
    def check(self, text: str) -> GuardResult:
        if SECRET_RE.search(text):
            return GuardResult(ok=False, reason="secret_in_input")
        return GuardResult(ok=True)


def build_input_chain() -> GuardChain:
    return GuardChain([InjectionGuard(), SecretGuard()])
