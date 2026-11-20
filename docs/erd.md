# ERD — TyTalk (MySQL 8)

Conversations are **not** stored. Only identity, refresh sessions and learned personality traits are persisted.

```mermaid
erDiagram
    USERS ||--o| USER_PERSONAS : "has (1-1)"
    USERS ||--o{ REFRESH_TOKENS : "owns"

    USERS {
        int id PK
        varchar(255) email "UNIQUE"
        varchar(255) password_hash "argon2"
        varchar(100) display_name
        datetime created_at
    }

    USER_PERSONAS {
        int user_id PK, FK "users.id ON DELETE CASCADE"
        json traits "whitelisted keys only"
        int version
        datetime updated_at
    }

    REFRESH_TOKENS {
        int id PK
        int user_id FK "users.id ON DELETE CASCADE, indexed"
        varchar(64) token_hash "sha256, UNIQUE"
        datetime expires_at
        datetime revoked_at "NULL = active"
    }
```

## Isolation rules
- Every query on personas or tokens takes `user_id` from the verified JWT, never from the request body.
- `traits` is the only per-user LLM context. It is whitelisted and size-capped on write (`services/persona_service.py`).
- No table holds message content. Logs must not contain message text.

## Migrations
`backend/migrations/versions/0001_init.py`. Apply with `alembic upgrade head`.
