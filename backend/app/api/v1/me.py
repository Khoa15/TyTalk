from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.user import MeOut
from app.services.persona_service import PersonaService

router = APIRouter(prefix="/me", tags=["me"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=MeOut)
def get_me(user: CurrentUser, db: DbSession) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        traits=PersonaService(db).traits(user.id),
    )


@router.delete("/persona", status_code=204, response_class=Response)
def reset_persona(user: CurrentUser, db: DbSession) -> Response:
    PersonaService(db).reset(user.id)
    return Response(status_code=204)
