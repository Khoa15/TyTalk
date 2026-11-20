from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import auth_limiter, limit_by_ip
from app.core.config import get_settings
from app.db.session import get_db
from app.core.errors import AppError
from app.schemas.auth import RefreshRequest, SignInRequest, SignUpRequest, TokenResponse
from app.services.auth_service import AuthService, TokenPair

router = APIRouter(prefix="/auth", tags=["auth"])

DbSession = Annotated[Session, Depends(get_db)]
IpLimit = Depends(limit_by_ip(auth_limiter))


def _to_response(pair: TokenPair) -> TokenResponse:
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
    )


@router.post("/signup", response_model=TokenResponse, status_code=201, dependencies=[IpLimit])
def signup(body: SignUpRequest, db: DbSession) -> TokenResponse:
    pair = AuthService(db).signup(body.email, body.password, body.display_name)
    return _to_response(pair)


@router.post("/signin", response_model=TokenResponse, dependencies=[IpLimit])
def signin(body: SignInRequest, db: DbSession) -> TokenResponse:
    return _to_response(AuthService(db).signin(body.email, body.password))


@router.post("/tester", response_model=TokenResponse, dependencies=[IpLimit])
def tester_login(db: DbSession) -> TokenResponse:
    settings = get_settings()
    if not settings.tester_login_enabled:
        raise AppError(404, "not_found", "Not found")
    return _to_response(AuthService(db).tester_login(settings.tester_email))


@router.post("/refresh", response_model=TokenResponse, dependencies=[IpLimit])
def refresh(body: RefreshRequest, db: DbSession) -> TokenResponse:
    return _to_response(AuthService(db).refresh(body.refresh_token))


@router.post("/signout", status_code=204, response_class=Response, dependencies=[IpLimit])
def signout(body: RefreshRequest, db: DbSession) -> Response:
    AuthService(db).signout(body.refresh_token)
    return Response(status_code=204)
