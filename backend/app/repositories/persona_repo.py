from typing import Any

from app.core.clock import utc_now
from app.repositories.store import get_store


class PersonaRepository:
    def get_traits(self, user_id: int) -> dict[str, Any]:
        row = get_store().get_persona(user_id)
        return dict(row.traits) if row else {}

    def save_traits(self, user_id: int, traits: dict[str, Any]) -> None:
        row = get_store().get_persona(user_id)
        version = row.version + 1 if row else 1
        get_store().upsert_persona(user_id, traits, version, utc_now())
