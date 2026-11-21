from alembic import context
from sqlalchemy import create_engine

import app.models  # noqa: F401  (registers all tables on Base.metadata)
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import connect_args_for

target_metadata = Base.metadata


def run_migrations_online() -> None:
    url = get_settings().database_url
    engine = create_engine(url, connect_args=connect_args_for(url))
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
