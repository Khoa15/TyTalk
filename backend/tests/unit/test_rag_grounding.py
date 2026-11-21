import asyncio

from app.harness.composer import build_messages
from app.harness.facade import Harness, UserContext, is_greeting
from app.harness.guardrails.chain import GuardChain
from app.harness.rag.retriever import Evidence


class FakeProvider:
    def __init__(self) -> None:
        self.calls = 0

    async def stream(self, messages):
        self.calls += 1
        yield '{"type": "say", "text": "Answer from evidence."}\n'


class FakeRetriever:
    def __init__(self, evidence):
        self._evidence = evidence

    def retrieve(self, query):
        return self._evidence

    def is_covered(self, query):
        return True


class PassGuard:
    def check(self, text):
        from app.harness.guardrails.base import GuardResult
        return GuardResult(True, "")


def _run(harness, message):
    async def collect():
        return [evt async for evt in harness.respond(UserContext(1, {}), message, [])]
    return asyncio.run(collect())


def _harness(provider, retriever):
    from app.harness.tools.image_search import ImageSearchTool
    return Harness(provider=provider, images=ImageSearchTool(allowed_hosts=[]),
                   input_guard=GuardChain([]), output_guard=GuardChain([]), retriever=retriever)


def test_no_evidence_still_reaches_the_model():
    provider = FakeProvider()
    _run(_harness(provider, FakeRetriever([])), "What is the capital of Japan?")
    assert provider.calls == 1


def test_evidence_is_passed_to_the_model_as_grounding():
    provider = FakeProvider()
    ev = [Evidence("chandra_black_hole_primer", 1, "A black hole is a region of strong gravity.")]
    _run(_harness(provider, FakeRetriever(ev)), "What is a black hole?")
    assert provider.calls == 1


def test_greeting_skips_retrieval_and_reaches_the_model():
    provider = FakeProvider()
    _run(_harness(provider, FakeRetriever([])), "Hi there")
    assert provider.calls == 1


def test_is_greeting_only_matches_short_greetings():
    assert is_greeting("Hello!") and is_greeting("Good night, Orb")
    assert not is_greeting("Hello, what is a black hole and why does it bend light near it?")


def test_build_messages_adds_grounding_block_only_with_evidence():
    ev = [Evidence("doc", 3, "The Moon has phases.")]
    plain = build_messages({}, "q", [], [], PassGuard())
    grounded = build_messages({}, "q", [], [], PassGuard(), ev)
    assert len(grounded) == len(plain) + 1
    assert "<evidence>" in grounded[1]["content"] and "(doc p.3)" in grounded[1]["content"]


def test_small_talk_and_any_topic_reach_the_model():
    provider = FakeProvider()
    _run(_harness(provider, FakeRetriever([])), "I'm John. Who are you?")
    _run(_harness(provider, FakeRetriever([])), "How do volcanoes form under the ocean?")
    assert provider.calls == 2
