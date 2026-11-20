from app.harness.prompts import build_system_prompt
from app.harness.states import ENTITY_KINDS, MAX_ENTITIES, MAX_FORMS, MAX_SIMS, ORB_FORMS, SIM_IDS
from app.harness.stream_parser import EntityTag, FormTag, SimTag, StreamParser
from app.harness.timeline import TimelineBuilder


def _parse(line: str):
    return StreamParser().feed(line + "\n")


def test_form_line_accepts_whitelisted_form_only():
    assert _parse('{"type": "form", "form": "moon", "seconds": 4}') == [FormTag("moon", 4.0)]
    assert _parse('{"type": "form", "form": "dragon", "seconds": 4}') == []


def test_entity_line_clamps_count_and_rejects_unknown_kind():
    assert _parse('{"type": "entity", "kind": "comet", "count": 99, "seconds": 5}') == [
        EntityTag("comet", 5, 5.0)
    ]
    assert _parse('{"type": "entity", "kind": "godzilla", "count": 1, "seconds": 5}') == []


def test_sim_keeps_only_declared_params_with_allowed_values():
    items = _parse(
        '{"type": "sim", "id": "moon_phases", "params": {"highlight": "full", "x": "1", "speed": "fast"}, "seconds": 8}'
    )
    assert items == [SimTag("moon_phases", (("highlight", "full"),), 8.0)]


def test_sim_rejects_unknown_id_and_bad_param_value():
    assert _parse('{"type": "sim", "id": "warp_drive", "params": {}, "seconds": 8}') == []
    items = _parse('{"type": "sim", "id": "moon_phases", "params": {"highlight": "half"}, "seconds": 8}')
    assert items == [SimTag("moon_phases", (), 8.0)]


def test_visuals_run_beside_speech_and_are_capped():
    builder = TimelineBuilder()
    events = []
    for item in [
        FormTag("sun", 3),
        FormTag("earth", 3),
        FormTag("moon", 3),  # over MAX_FORMS
        EntityTag("comet", 1, 4),
        EntityTag("rocket", 1, 4),
        EntityTag("astronaut", 1, 4),
        EntityTag("satellite", 1, 4),  # over MAX_ENTITIES
        SimTag("launch", (), 6),
        SimTag("tides", (), 6),  # over MAX_SIMS
    ]:
        events.extend(builder.apply(item, {}))
    names = [e["event"] for e in events]
    assert names.count("form") == MAX_FORMS
    assert names.count("entity") == MAX_ENTITIES
    assert names.count("sim") == MAX_SIMS
    # visuals never move the speech cursor, so they all start at 0
    assert all(e["data"]["at_ms"] == 0 for e in events)
    done = builder.done()["data"]["total_ms"]
    assert done == 6000  # the sim is the longest visual


def test_says_then_visual_starts_at_cursor():
    from app.harness.stream_parser import Text

    builder = TimelineBuilder()
    builder.apply(Text("Hi! "), {})
    events = builder.apply(FormTag("sun", 2), {})
    assert events[0]["data"]["at_ms"] == builder._cursor_ms
    assert events[0]["data"]["duration_ms"] == 2000


def test_prompt_lists_only_whitelisted_visuals():
    prompt = build_system_prompt({}, [])
    for form in ORB_FORMS:
        assert form in prompt
    for kind in ENTITY_KINDS:
        assert kind in prompt
    for sim_id in SIM_IDS:
        assert sim_id in prompt
    assert "STORY GUIDE" in prompt
    assert "Scene map" in prompt
    assert "Do not repeat a beat" in prompt


def test_first_reply_opens_the_story_before_any_bridge():
    prompt = build_system_prompt({}, [])
    assert "A new topic always starts with beat 1 and beat 2" in prompt


def test_prompt_has_a_full_story_example_with_opening_fact_picture_bridge():
    prompt = build_system_prompt({}, [])
    assert "ONE reply" in prompt
    assert '"form": "blackhole"' in prompt
    assert '"id": "blackhole_lens"' in prompt
    assert '"params": {}' in prompt  # braces survived .format


def test_entity_count_defaults_to_one():
    assert _parse('{"type": "entity", "kind": "comet", "seconds": 5}') == [EntityTag("comet", 1, 5.0)]
    assert _parse('{"type": "entity", "kind": "rocket", "seconds": 5}') == [EntityTag("rocket", 1, 5.0)]


def test_prompt_makes_orb_playful_and_announces_form_changes():
    prompt = build_system_prompt({}, [])
    assert "silly, bouncy, giggly friend" in prompt
    assert "FORM CHANGES" in prompt
    assert "Hey hey, look, look!" in prompt
    assert "Ta-da! I'm Orb again" in prompt
    assert "Never sarcastic, never mean, never scary" in prompt
