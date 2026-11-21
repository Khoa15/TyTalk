from app.repositories.store import UserRecord, get_store


class UserRepository:
    def get_by_id(self, user_id: int) -> UserRecord | None:
        return get_store().get_user_by_id(user_id)

    def get_by_email(self, email: str) -> UserRecord | None:
        return get_store().get_user_by_email(email)

    def create(self, email: str, password_hash: str, display_name: str) -> UserRecord:
        return get_store().insert_user(email, password_hash, display_name)
