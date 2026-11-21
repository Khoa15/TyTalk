"""Importing this package registers every model on Base.metadata (used by Alembic and tests)."""

from app.models.persona import UserPersona
from app.models.refresh_token import RefreshToken
from app.models.user import User

__all__ = ["User", "UserPersona", "RefreshToken"]
