import base64
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.harness.composer import build_messages
from app.harness.followup import contextual_query, turn_hints
from app.harness.guardrails.chain import GuardChain
from app.harness.planner import PLANNER_PROMPT, parse_plan
from app.harness.providers.base import LLMProvider, ProviderError, collect
from app.harness.rag.retriever import CorpusRetriever, Evidence
from app.harness.router import route_message
from app.harness.stream_parser import Item, StateTag, StreamParser, Text
from app.harness.timeline import TimelineBuilder, estimate_speech_ms, event
from app.harness.tts.tiny_voca import TinyVocaSynth
from app.harness.tools.image_search import ImageResult, ImageSearchTool
from app.schemas.talk import RecentMessage

REFUSAL_TEXT = "I can't help with that one. Let's explore science instead. Try one of these!"
OUTPUT_WINDOW = 300  # chars re-scanned by the output guard on every step
_GREETING = re.compile(r"^\s*(hi+|hello|hey|yo|good (morning|afternoon|evening|night))\b", re.IGNORECASE)


def is_greeting(message: str) -> bool:
    """Plain greetings get a friendly reply without retrieval; every other turn needs evidence."""
    return bool(_GREETING.match(message)) and len(message.split()) <= 8


@dataclass(frozen=True)
class UserContext:
    """Immutable per-request context. Only the owner's traits are ever loaded into it."""

    user_id: int
    traits: dict[str, Any]


class Harness:
    """Facade: the single entry point for one talk turn.

    Pipeline: input guard -> route -> (plan: fetch images) -> stream LLM -> parse tags
    -> output guard -> timed events.
    """

    def __init__(
        self,
        provider: LLMProvider,
        images: ImageSearchTool,
        input_guard: GuardChain,
        output_guard: GuardChain,
        tts: TinyVocaSynth | None = None,
        retriever: CorpusRetriever | None = None,
    ) -> None:
        self.provider = provider
        self._tts = tts
        self._retriever = retriever
        self._images = images
        self._input_guard = input_guard
        self._output_guard = output_guard

    async def respond(
        self, ctx: UserContext, message: str, recent: list[RecentMessage]
    ) -> AsyncIterator[dict[str, Any]]:
        if not self._input_guard.check(message).ok:
            for evt in self._refusal(TimelineBuilder()):
                yield evt
            return

        route = route_message(message)
        yield event("route", {"route": route})

        # Orb is a companion for every topic except the sensitive ones the prompt blocks.
        # The corpus only enriches answers when a passage matches; no match is never a refusal.
        evidence: list[Evidence] = []
        if self._retriever is not None and not is_greeting(message):
            # Follow-ups ("ok", "why") are retrieved with the topic they refer to, not on their own.
            query = contextual_query(message, recent)
            evidence = await run_in_threadpool(self._retriever.retrieve, query)

        image_map: dict[str, ImageResult] = {}
        queries: list[str] = []
        if route == "plan":
            queries = await self._plan(message)
            image_map = await self._images.search_many(queries)
            yield event("plan", {"steps": [f"Find image: {q}" for q in queries]})

        messages = build_messages(
            ctx.traits,
            message,
            recent,
            list(image_map),
            self._input_guard,
            evidence or None,
            turn_hints(message, recent, self._input_guard),
        )
        builder = TimelineBuilder()
        spoken = ""
        try:
            async for item in self._tokens(messages):
                if isinstance(item, Text):
                    spoken += item.text
                    if not self._output_guard.check(spoken[-OUTPUT_WINDOW:]).ok:
                        for evt in self._refusal(builder):
                            yield evt
                        return
                    duration_ms, wav_b64 = await self._speak(item.text)
                    for evt in builder.say(item.text, duration_ms, wav_b64):
                        yield evt
                    continue
                for evt in builder.apply(item, image_map):
                    yield evt
        except ProviderError:
            yield event("error", {"code": "upstream_error"})
            return

        # A silent empty completion must not look like a successful reply.
        if not spoken.strip():
            yield event("error", {"code": "empty_reply"})
            return
        yield builder.done()

    async def _tokens(self, messages: list[dict[str, str]]) -> AsyncIterator[Item]:
        parser = StreamParser()
        async for delta in self.provider.stream(messages):
            for item in parser.feed(delta):
                yield item
        for item in parser.flush():
            yield item

    async def _plan(self, message: str) -> list[str]:
        try:
            raw = await collect(
                self.provider,
                [{"role": "system", "content": PLANNER_PROMPT}, {"role": "user", "content": message}],
            )
        except ProviderError:
            return []
        return parse_plan(raw)

    async def _speak(self, text: str) -> tuple[int, str | None]:
        """Returns (duration_ms, base64 WAV). Without audio the duration is estimated."""
        if self._tts is None:
            return estimate_speech_ms(text), None
        clip = await run_in_threadpool(self._tts.synthesize, text)
        if clip is None:
            return estimate_speech_ms(text), None
        duration_ms, wav = clip
        return duration_ms, base64.b64encode(wav).decode("ascii")

    @staticmethod
    def _refusal(builder: TimelineBuilder, text: str = REFUSAL_TEXT) -> list[dict[str, Any]]:
        events = builder.apply(StateTag("surprised", 2.0), {})
        events += builder.say(text, estimate_speech_ms(text))
        events.append(builder.done())
        return events
