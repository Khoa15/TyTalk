from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

def connect_args_for(url: str) -> dict:
    # Supabase's transaction pooler (port 6543) cannot reuse server-side prepared statements.
    return {"prepare_threshold": None} if url.startswith("postgresql") else {}


_url = get_settings().database_url
engine = create_engine(_url, pool_pre_ping=True, connect_args=connect_args_for(_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def check_database_connection() -> bool:
    """Run SELECT 1 once and print the result, so deploy logs show whether the DB is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001  (report any failure; startup should not crash here)
        print(f"Backend FAILED to connect to Database: {type(exc).__name__}: {exc}", flush=True)
        return False
    print("Backend Connected Successfully to Database", flush=True)
    return True


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
