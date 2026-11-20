import hashlib
import secrets
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.clock import utc_now
from app.core.config import get_settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = utc_now()
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int:
    """Return the user id from a valid access token. Raises jwt.PyJWTError otherwise."""
    settings = get_settings()
    data = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if data.get("type") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return int(data["sub"])


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    """Refresh tokens are stored hashed, so a database leak does not leak sessions."""
    return hashlib.sha256(raw.encode()).hexdigest()
