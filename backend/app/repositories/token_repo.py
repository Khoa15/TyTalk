from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utc_now
from app.models.refresh_token import RefreshToken


class TokenRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        self._db.add(RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
        self._db.flush()

    def get_active(self, token_hash: str) -> RefreshToken | None:
        return self._db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > utc_now(),
            )
        )

    def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = utc_now()
        self._db.flush()
