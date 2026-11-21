"""In-memory Store for tests. Same semantics as SupabaseStore, no network."""

from dataclasses import replace
from datetime import datetime
from typing import Any

from app.repositories.store import PersonaRecord, RefreshRecord, UserRecord


class MemoryStore:
    def __init__(self) -> None:
        self.users: dict[int, UserRecord] = {}
        self.refresh: dict[int, dict[str, Any]] = {}
        self.personas: dict[int, PersonaRecord] = {}
        self._next = 1

    def _id(self) -> int:
        self._next += 1
        return self._next

    def get_user_by_id(self, user_id: int) -> UserRecord | None:
        return self.users.get(user_id)

    def get_user_by_email(self, email: str) -> UserRecord | None:
        return next((u for u in self.users.values() if u.email == email), None)

    def insert_user(self, email: str, password_hash: str, display_name: str) -> UserRecord:
        user = UserRecord(id=self._id(), email=email, password_hash=password_hash, display_name=display_name)
        self.users[user.id] = user
        return user

    def insert_refresh_token(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        rid = self._id()
        self.refresh[rid] = {"id": rid, "user_id": user_id, "token_hash": token_hash, "expires_at": expires_at, "revoked_at": None}

    def get_active_refresh_token(self, token_hash: str, now: datetime) -> RefreshRecord | None:
        for row in self.refresh.values():
            if row["token_hash"] == token_hash and row["revoked_at"] is None and row["expires_at"] > now:
                return RefreshRecord(id=row["id"], user_id=row["user_id"])
        return None

    def revoke_refresh_token(self, token_id: int, at: datetime) -> None:
        self.refresh[token_id]["revoked_at"] = at

    def get_persona(self, user_id: int) -> PersonaRecord | None:
        return self.personas.get(user_id)

    def upsert_persona(self, user_id: int, traits: dict[str, Any], version: int, at: datetime) -> None:
        self.personas[user_id] = PersonaRecord(user_id=user_id, traits=dict(traits), version=version)
