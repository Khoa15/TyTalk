from conftest import auth_header, signup

from app.api.deps import auth_limiter


def test_signup_then_me_returns_own_profile(client):
    tokens = signup(client, display_name="Ann")
    resp = client.get("/api/v1/me", headers=auth_header(tokens))
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == tokens["email"]
    assert body["display_name"] == "Ann"
    assert body["traits"] == {}


def test_me_requires_token(client):
    resp = client.get("/api/v1/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_users_cannot_read_each_other(client):
    alice = signup(client, display_name="Alice")
    bob = signup(client, display_name="Bob")

    alice_me = client.get("/api/v1/me", headers=auth_header(alice)).json()
    bob_me = client.get("/api/v1/me", headers=auth_header(bob)).json()

    assert alice_me["display_name"] == "Alice"
    assert bob_me["display_name"] == "Bob"
    assert alice_me["id"] != bob_me["id"]


def test_refresh_token_rotates_and_old_one_is_rejected(client):
    tokens = signup(client)
    first = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200
    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert replay.status_code == 401


def test_wrong_password_is_rejected_without_detail(client):
    tokens = signup(client)
    resp = client.post(
        "/api/v1/auth/signin",
        json={"email": tokens["email"], "password": "wrong-password-xyz"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["message"] == "Wrong email or password"


def test_signin_is_rate_limited_per_ip(client, monkeypatch):
    monkeypatch.setattr(auth_limiter, "_cap", 3.0)
    monkeypatch.setattr(auth_limiter, "_rate", 3 / 60)
    statuses = []
    for _ in range(4):
        resp = client.post(
            "/api/v1/auth/signin",
            json={"email": "nobody@example.com", "password": "whatever-pass"},
        )
        statuses.append(resp.status_code)
    assert statuses[:3] == [401, 401, 401]
    assert statuses[3] == 429
    assert resp.headers["Retry-After"]


def test_signout_revokes_refresh_token(client):
    tokens = signup(client)
    out = client.post("/api/v1/auth/signout", json={"refresh_token": tokens["refresh_token"]})
    assert out.status_code == 204
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert again.status_code == 401


def test_api_version_header_is_present(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.headers["X-API-Version"] == "1"


def test_tester_login_is_hidden_unless_enabled(client, monkeypatch):
    from app.api.v1 import auth as auth_module

    class Off:
        tester_login_enabled = False
        tester_email = "tester@tytalk.local"

    monkeypatch.setattr(auth_module, "get_settings", lambda: Off())
    assert client.post("/api/v1/auth/tester").status_code == 404


def test_tester_login_returns_a_working_session(client, monkeypatch):
    from app.api.v1 import auth as auth_module

    class On:
        tester_login_enabled = True
        tester_email = "tester-test@tytalk.local"

    monkeypatch.setattr(auth_module, "get_settings", lambda: On())
    resp = client.post("/api/v1/auth/tester")
    assert resp.status_code == 200
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    assert me.json()["email"] == "tester-test@tytalk.local"
