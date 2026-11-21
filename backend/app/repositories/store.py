"""Persistence boundary. SupabaseStore talks to Supabase; tests inject an in-memory store."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True)
class UserRecord:
    id: int
    email: str
    password_hash: str
    display_name: str


@dataclass(frozen=True)
class RefreshRecord:
    id: int
    user_id: int


@dataclass(frozen=True)
class PersonaRecord:
    user_id: int
    traits: dict[str, Any]
    version: int


class Store(Protocol):
    def get_user_by_id(self, user_id: int) -> UserRecord | None: ...
    def get_user_by_email(self, email: str) -> UserRecord | None: ...
    def insert_user(self, email: str, password_hash: str, display_name: str) -> UserRecord: ...
    def insert_refresh_token(self, user_id: int, token_hash: str, expires_at: datetime) -> None: ...
    def get_active_refresh_token(self, token_hash: str, now: datetime) -> RefreshRecord | None: ...
    def revoke_refresh_token(self, token_id: int, at: datetime) -> None: ...
    def get_persona(self, user_id: int) -> PersonaRecord | None: ...
    def upsert_persona(self, user_id: int, traits: dict[str, Any], version: int, at: datetime) -> None: ...


def _user(row: dict) -> UserRecord:
    return UserRecord(
        id=int(row["id"]),
        email=row["email"],
        password_hash=row["password_hash"],
        display_name=row["display_name"],
    )


class SupabaseStore:
    def __init__(self, client: Any) -> None:
        self._db = client

    def get_user_by_id(self, user_id: int) -> UserRecord | None:
        rows = self._db.table("users").select("*").eq("id", user_id).limit(1).execute().data
        return _user(rows[0]) if rows else None

    def get_user_by_email(self, email: str) -> UserRecord | None:
        rows = self._db.table("users").select("*").eq("email", email).limit(1).execute().data
        return _user(rows[0]) if rows else None

    def insert_user(self, email: str, password_hash: str, display_name: str) -> UserRecord:
        row = (
            self._db.table("users")
            .insert({"email": email, "password_hash": password_hash, "display_name": display_name})
            .execute()
            .data[0]
        )
        return _user(row)

    def insert_refresh_token(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        self._db.table("refresh_tokens").insert(
            {"user_id": user_id, "token_hash": token_hash, "expires_at": expires_at.isoformat()}
        ).execute()

    def get_active_refresh_token(self, token_hash: str, now: datetime) -> RefreshRecord | None:
        rows = (
            self._db.table("refresh_tokens")
            .select("id,user_id")
            .eq("token_hash", token_hash)
            .is_("revoked_at", "null")
            .gt("expires_at", now.isoformat())
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        return RefreshRecord(id=int(rows[0]["id"]), user_id=int(rows[0]["user_id"]))

    def revoke_refresh_token(self, token_id: int, at: datetime) -> None:
        self._db.table("refresh_tokens").update({"revoked_at": at.isoformat()}).eq("id", token_id).execute()

    def get_persona(self, user_id: int) -> PersonaRecord | None:
        rows = self._db.table("user_personas").select("*").eq("user_id", user_id).limit(1).execute().data
        if not rows:
            return None
        return PersonaRecord(user_id=int(rows[0]["user_id"]), traits=dict(rows[0]["traits"] or {}), version=int(rows[0]["version"]))

    def upsert_persona(self, user_id: int, traits: dict[str, Any], version: int, at: datetime) -> None:
        self._db.table("user_personas").upsert(
            {"user_id": user_id, "traits": traits, "version": version, "updated_at": at.isoformat()},
            on_conflict="user_id",
        ).execute()


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        from app.db.supabase_client import get_supabase

        _store = SupabaseStore(get_supabase())
    return _store


def set_store(store: Store | None) -> None:
    global _store
    _store = store
