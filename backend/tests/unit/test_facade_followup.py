import asyncio

from app.harness.facade import Harness, UserContext
from app.harness.guardrails.chain import GuardChain
from app.harness.guardrails.input_guards import InjectionGuard
from app.harness.rag.retriever import Evidence
from app.harness.tools.image_search import ImageSearchTool
from app.schemas.talk import RecentMessage

BLACK_HOLE_HISTORY = [
    RecentMessage(role="user", text="Tell me about black holes"),
    RecentMessage(role="assistant", text="A black hole pulls in light. Next, we will see how gravity bends light."),
]
EVIDENCE = [Evidence("chandra_black_hole_primer", 1, "A black hole is a region of strong gravity.")]


class RecordingProvider:
    def __init__(self, lines: str = '{"type": "say", "text": "Answer."}\n') -> None:
        self.lines = lines
        self.calls: list[list[dict[str, str]]] = []

    async def stream(self, messages):
        self.calls.append(messages)
        yield self.lines


class RecordingRetriever:
    def __init__(self, evidence=None, covered=None) -> None:
        self.queries: list[str] = []
        self._evidence = EVIDENCE if evidence is None else evidence
        self._covered = covered  # None means every item is covered

    def retrieve(self, query):
        self.queries.append(query)
        return self._evidence


def _harness(provider, retriever=None, input_guard=None):
    return Harness(
        provider=provider,
        images=ImageSearchTool(allowed_hosts=[]),
        input_guard=input_guard or GuardChain([]),
        output_guard=GuardChain([]),
        retriever=retriever,
    )


def _run(harness, message, recent):
    async def collect():
        return [evt async for evt in harness.respond(UserContext(1, {}), message, recent)]

    return asyncio.run(collect())



def test_followup_is_retrieved_with_its_topic():
    retriever = RecordingRetriever()
    _run(_harness(RecordingProvider(), retriever), "ok", BLACK_HOLE_HISTORY)
    assert retriever.queries == ["Tell me about black holes ok"]



def test_promise_reaches_the_model_as_a_turn_hint():
    provider = RecordingProvider()
    _run(_harness(provider, RecordingRetriever()), "ok", BLACK_HOLE_HISTORY)
    system_texts = [m["content"] for m in provider.calls[0] if m["role"] == "system"]
    assert any(t.startswith("TURN HINTS") for t in system_texts)

