import os
import uuid

# Must run before `app` is imported: settings are read at import time.
os.environ["DATABASE_URL"] = "sqlite:///./.test.db"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["TALK_RATE_LIMIT_PER_MINUTE"] = "1000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import auth_limiter, talk_limiter  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
import app.models as _registered_models  # noqa: E402,F401  (registers tables on Base.metadata)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(engine)
    yield
    engine.dispose()
    if os.path.exists(".test.db"):
        os.remove(".test.db")


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
