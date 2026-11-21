from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
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
