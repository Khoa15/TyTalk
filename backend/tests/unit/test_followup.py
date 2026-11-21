from app.harness.followup import contextual_query, is_followup, last_promise, turn_hints
from app.harness.stream_parser import StreamParser, SuggestTag
from app.schemas.talk import RecentMessage

HISTORY = [
    RecentMessage(role="user", text="Tell me about black holes"),
    RecentMessage(role="assistant", text="A black hole pulls in light. Next, we will see how its gravity bends stars."),
]


def test_bare_followup_is_anchored_to_last_topic():
    assert is_followup("ok")
    assert contextual_query("ok", HISTORY) == "Tell me about black holes ok"


def test_real_question_is_not_rewritten():
    assert contextual_query("How hot is the Sun?", HISTORY) == "How hot is the Sun?"


def test_promise_is_extracted_and_delivered_as_hint():
    assert last_promise(HISTORY) == "Next, we will see how its gravity bends stars."
    hints = turn_hints("ok", HISTORY)
    assert any("Deliver exactly what was promised" in h for h in hints)


def test_confused_child_gets_simpler_explanation_hint():
    hints = turn_hints("why?", HISTORY)
    assert any("simpler" in h for h in hints)


def test_suggest_line_is_parsed_and_capped():
    items = StreamParser().feed(
        '{"type": "suggest", "items": ["Why is the Moon bright?", "", "What is a star?", "Is Mars cold?", "Extra?"]}\n'
    )
    assert items == [SuggestTag(("Why is the Moon bright?", "What is a star?", "Is Mars cold?"))]
