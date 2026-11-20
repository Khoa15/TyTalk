from app.harness.stream_parser import ImageTag, StateTag, StreamParser, Text


def test_say_line_becomes_spoken_text():
    parser = StreamParser()
    items = parser.feed('{"type": "say", "text": "Hi there!"}\n')
    assert items == [Text("Hi there! ")]


def test_state_and_image_lines_are_actions_not_text():
    parser = StreamParser()
    items = parser.feed(
        '{"type": "state", "state": "cute", "seconds": 1.5}\n'
        '{"type": "image", "query": "red panda", "seconds": 3}\n'
    )
    assert items == [StateTag("cute", 1.5), ImageTag("red panda", 3.0)]


def test_stage_directions_outside_json_are_never_spoken():
    """Regression: '*waves*' must not reach TTS or subtitles."""
    parser = StreamParser()
    items = parser.feed('*waves* Hi!\n{"type": "say", "text": "Hi!"}\n')
    assert items == [Text("Hi! ")]


def test_line_split_across_chunks_is_reassembled():
    parser = StreamParser()
    assert parser.feed('{"type": "sa') == []
    assert parser.feed('y", "text": "ok"}\n') == [Text("ok ")]


def test_unknown_state_and_bad_json_are_dropped():
    parser = StreamParser()
    items = parser.feed(
        '{"type": "state", "state": "wave"}\n'
        "not json\n"
        '{"type": "unknown"}\n'
    )
    assert items == []


def test_seconds_default_when_missing():
    parser = StreamParser()
    assert parser.feed('{"type": "state", "state": "laugh"}\n') == [StateTag("laugh", 2.0)]


def test_last_line_without_newline_is_parsed_on_flush():
    parser = StreamParser()
    assert parser.feed('{"type": "say", "text": "bye"}') == []
    assert parser.flush() == [Text("bye ")]


def test_empty_say_is_ignored():
    parser = StreamParser()
    assert parser.feed('{"type": "say", "text": "   "}\n') == []
