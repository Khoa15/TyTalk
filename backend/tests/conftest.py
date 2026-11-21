import os
import uuid

# Must run before `app` is imported: settings are read at import time.
os.environ["SUPABASE_URL"] = ""  # no network in tests: the in-memory store is injected below
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["TALK_RATE_LIMIT_PER_MINUTE"] = "1000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import auth_limiter, talk_limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.repositories.store import set_store  # noqa: E402
from fake_store import MemoryStore  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_store():
    set_store(MemoryStore())
    yield
    set_store(None)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    auth_limiter.reset()
    talk_limiter.reset()
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def signup(client: TestClient, display_name: str = "Ann") -> dict:
    email = f"{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct-horse-battery", "display_name": display_name},
    )
    assert resp.status_code == 201, resp.text
    return {"email": email, **resp.json()}


def auth_header(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}
