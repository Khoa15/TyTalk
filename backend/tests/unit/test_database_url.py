from app.core.config import normalize_database_url


def test_vercel_postgres_url_is_normalized_and_drops_supa_param():
    url = "postgres://postgres.abc:pw@pooler.example.com:6543/postgres?sslmode=require&supa=base-pooler.x"
    assert normalize_database_url(url) == (
        "postgresql+psycopg://postgres.abc:pw@pooler.example.com:6543/postgres?sslmode=require"
    )


def test_sqlalchemy_form_is_kept():
    url = "postgresql+psycopg://u:p@host:5432/db?sslmode=require"
    assert normalize_database_url(url) == url


def test_sqlite_url_is_untouched():
    assert normalize_database_url("sqlite:///./.test.db") == "sqlite:///./.test.db"
