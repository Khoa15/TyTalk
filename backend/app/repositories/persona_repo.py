from sqlalchemy.orm import Session

from app.models.persona import UserPersona


class PersonaRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_traits(self, user_id: int) -> dict:
        row = self._db.get(UserPersona, user_id)
        return dict(row.traits) if row else {}

    def save_traits(self, user_id: int, traits: dict) -> None:
        row = self._db.get(UserPersona, user_id)
        if row is None:
            self._db.add(UserPersona(user_id=user_id, traits=traits, version=1))
        else:
            row.traits = traits
            row.version += 1
        self._db.flush()
