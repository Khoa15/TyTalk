from fastapi import APIRouter, Response

from app.api.deps import CurrentUser
from app.schemas.user import MeOut
from app.services.persona_service import PersonaService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MeOut)
def get_me(user: CurrentUser) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        traits=PersonaService().traits(user.id),
    )


@router.delete("/persona", status_code=204, response_class=Response)
def reset_persona(user: CurrentUser) -> Response:
    PersonaService().reset(user.id)
    return Response(status_code=204)
