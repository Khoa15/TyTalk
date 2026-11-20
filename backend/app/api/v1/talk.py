import json
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentUser, get_harness, limit_by_ip, talk_limiter
from app.db.session import get_db
from app.harness.facade import Harness, UserContext
from app.schemas.talk import TalkRequest
from app.services.persona_service import PersonaService, schedule_persona_learning

router = APIRouter(tags=["talk"])

DbSession = Annotated[Session, Depends(get_db)]
IpTalkLimit = Depends(limit_by_ip(talk_limiter))

SSE_DESCRIPTION = (
    "Server-Sent Events. Each frame is `event: <name>` + `data: <json>`.\n\n"
    "- route: {route: fast|plan}\n"
    "- plan: {steps: [str]}\n"
    "- segment: {index, state, at_ms, duration_ms}  (max 3)\n"
    "- text: {delta, char_offset}\n"
    "- image: {url, caption, char_offset, at_ms, duration_ms}  (max 5)\n"
    "- form: {form, at_ms, duration_ms}  (max 2; Orb body shape)\n"
    "- entity: {kind, count, at_ms, duration_ms}  (max 3; summoned object)\n"
    "- sim: {id, params, at_ms, duration_ms}  (max 1; astronomy simulation)\n"
    "- done: {total_ms}\n"
    "- error: {code}\n\n"
    "at_ms is relative to the start of the reply; the client plays it on one local clock."
)


def sse_encode(evt: dict[str, Any]) -> str:
    return f"event: {evt['event']}\ndata: {json.dumps(evt['data'], ensure_ascii=False)}\n\n"


@router.post(
    "/talk",
    dependencies=[IpTalkLimit],
    responses={200: {"content": {"text/event-stream": {}}, "description": SSE_DESCRIPTION}},
)
async def talk(
    body: TalkRequest,
    user: CurrentUser,
    db: DbSession,
    harness: Annotated[Harness, Depends(get_harness)],
) -> StreamingResponse:
    traits = await run_in_threadpool(PersonaService(db).traits, user.id)
    ctx = UserContext(user_id=user.id, traits=traits)

    async def events() -> AsyncIterator[str]:
        learning_started = False
        async for evt in harness.respond(ctx, body.message, body.recent):
            # Learn only from turns that were actually answered, not from refusals.
            if evt["event"] == "route" and not learning_started:
                learning_started = True
                schedule_persona_learning(user.id, body.message, harness.provider)
            yield sse_encode(evt)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
