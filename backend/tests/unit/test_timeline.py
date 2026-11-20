from app.harness.stream_parser import ImageTag, StateTag, Text
from app.harness.timeline import TimelineBuilder
from app.harness.tools.image_search import ImageResult


def _run(items, images=None):
    builder = TimelineBuilder()
    out = []
    for item in items:
        out.extend(builder.apply(item, images or {}))
    out.append(builder.done())
    return out


def test_at_most_three_segments_and_offsets_are_contiguous():
    events = _run([StateTag("cute", 1), StateTag("laugh", 2), StateTag("idle", 1.5), StateTag("angry", 1)])
    segments = [e["data"] for e in events if e["event"] == "segment"]
    assert len(segments) == 3
    assert segments[0]["at_ms"] == 0
    assert segments[1]["at_ms"] == segments[0]["at_ms"] + segments[0]["duration_ms"]
    assert segments[2]["at_ms"] == segments[1]["at_ms"] + segments[1]["duration_ms"]
    assert events[-1]["data"]["total_ms"] == 1000 + 2000 + 1500


def test_durations_are_clamped():
    events = _run([StateTag("cute", 100), StateTag("idle", 0.01)])
    durations = [e["data"]["duration_ms"] for e in events if e["event"] == "segment"]
    assert durations == [8000, 500]


def test_images_only_when_fetched_and_at_most_five():
    fetched = {"cat": ImageResult("cat", "https://upload.wikimedia.org/a.jpg", "Cat")}
    items = [ImageTag("unknown", 2)] + [ImageTag("cat", 1)] * 7
    events = _run(items, fetched)
    images = [e for e in events if e["event"] == "image"]
    assert len(images) == 5
    assert all(e["data"]["url"] == "https://upload.wikimedia.org/a.jpg" for e in images)


def test_text_offsets_track_characters():
    events = _run([Text("abc"), Text("de")])
    texts = [e["data"] for e in events if e["event"] == "text"]
    assert [t["char_offset"] for t in texts] == [0, 3]


def test_thumbnail_host_is_allowed_by_default():
    from app.core.config import Settings

    assert "thumb.wikimedia.org" in Settings().image_domain_allowlist


def test_done_total_covers_last_image_end():
    fetched = {"cat": ImageResult("cat", "https://upload.wikimedia.org/a.jpg", "Cat")}
    events = _run([StateTag("talking", 2), ImageTag("cat", 4)], fetched)
    assert events[-1]["data"]["total_ms"] == 2000 + 4000
