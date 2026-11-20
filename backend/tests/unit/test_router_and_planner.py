from app.harness.planner import parse_plan
from app.harness.router import route_message


def test_visual_requests_take_plan_route():
    assert route_message("cho mình xem hình con mèo") == "plan"
    assert route_message("show me a picture of a red panda") == "plan"


def test_chit_chat_takes_fast_route():
    assert route_message("xin chào, hôm nay bạn thế nào?") == "fast"


def test_parse_plan_accepts_valid_json_inside_prose():
    raw = 'Kế hoạch: {"image_queries": ["red panda", "red panda", "  bamboo  "]}'
    assert parse_plan(raw) == ["red panda", "bamboo"]


def test_parse_plan_rejects_malformed_output():
    assert parse_plan("không phải json") == []
    assert parse_plan('{"image_queries": "not a list"}') == []
    assert parse_plan('{"image_queries": [1, 2]}') == []
