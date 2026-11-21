from datetime import datetime

from app.core.clock import utc_now
from app.repositories.store import RefreshRecord, get_store


class TokenRepository:
    def add(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        get_store().insert_refresh_token(user_id, token_hash, expires_at)

    def get_active(self, token_hash: str) -> RefreshRecord | None:
        return get_store().get_active_refresh_token(token_hash, utc_now())

    def revoke(self, token: RefreshRecord) -> None:
        get_store().revoke_refresh_token(token.id, utc_now())
