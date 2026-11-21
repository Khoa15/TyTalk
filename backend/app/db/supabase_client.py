from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Server-side client. The secret key bypasses Row Level Security, so it must never reach the frontend."""
    settings = get_settings()
    key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set")
    return create_client(settings.supabase_url, key)


def check_database_connection() -> bool:
    """Read one row so deploy logs show whether Supabase is reachable with the configured key."""
    settings = get_settings()
    if not settings.supabase_url:
        print("Backend: SUPABASE_URL not set, database disabled", flush=True)
        return False
    try:
        get_supabase().table("users").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001  (report any failure; startup should not crash here)
        print(f"Backend FAILED to connect to Database: {type(exc).__name__}: {exc}", flush=True)
        return False
    print("Backend Connected Successfully to Database", flush=True)
    return True
