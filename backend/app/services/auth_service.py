from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.clock import utc_now
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.repositories.token_repo import TokenRepository
from app.repositories.user_repo import UserRepository

# Verified against when the email is unknown, so response time does not reveal which emails exist.
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._tokens = TokenRepository(db)

    def signup(self, email: str, password: str, display_name: str) -> TokenPair:
        email = email.lower()
        if self._users.get_by_email(email):
            raise AppError(409, "email_taken", "Email is already in use")
        user = self._users.create(email, hash_password(password), display_name)
        pair = self._issue(user.id)
        self._db.commit()
        return pair

    def signin(self, email: str, password: str) -> TokenPair:
        user = self._users.get_by_email(email.lower())
        stored_hash = user.password_hash if user else _DUMMY_HASH
        password_ok = verify_password(stored_hash, password)
        if user is None or not password_ok:
            raise AppError(401, "invalid_credentials", "Wrong email or password")
        pair = self._issue(user.id)
        self._db.commit()
        return pair

    def refresh(self, raw_refresh_token: str) -> TokenPair:
        """Rotate: the presented refresh token is revoked and a new pair is issued."""
        row = self._tokens.get_active(hash_refresh_token(raw_refresh_token))
        if row is None:
            raise AppError(401, "invalid_refresh_token", "Session has expired")
        self._tokens.revoke(row)
        pair = self._issue(row.user_id)
        self._db.commit()
        return pair

    def tester_login(self, email: str) -> TokenPair:
        """Dev-only: sign in as the shared tester account. The password is random and never disclosed."""
        user = self._users.get_by_email(email)
        if user is None:
            user = self._users.create(email, hash_password(new_refresh_token()), "Tester")
        pair = self._issue(user.id)
        self._db.commit()
        return pair

    def signout(self, raw_refresh_token: str) -> None:
        row = self._tokens.get_active(hash_refresh_token(raw_refresh_token))
        if row is not None:
            self._tokens.revoke(row)
            self._db.commit()

    def _issue(self, user_id: int) -> TokenPair:
        settings = get_settings()
        raw = new_refresh_token()
        self._tokens.add(
            user_id,
            hash_refresh_token(raw),
            utc_now() + timedelta(days=settings.refresh_token_days),
        )
        return TokenPair(
            access_token=create_access_token(user_id),
            refresh_token=raw,
            expires_in=settings.access_token_minutes * 60,
        )
