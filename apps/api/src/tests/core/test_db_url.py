"""Tests for Postgres URL normalization used by asyncpg engines."""

from src.core.db_url import prepare_asyncpg_connection, to_asyncpg_url


def test_to_asyncpg_url_rewrites_common_prefixes():
    assert (
        to_asyncpg_url("postgresql://u:p@host/db")
        == "postgresql+asyncpg://u:p@host/db"
    )
    assert (
        to_asyncpg_url("postgresql+psycopg2://u:p@host/db")
        == "postgresql+asyncpg://u:p@host/db"
    )
    assert (
        to_asyncpg_url("postgres://u:p@host/db")
        == "postgresql+asyncpg://u:p@host/db"
    )
    assert (
        to_asyncpg_url("postgresql+asyncpg://u:p@host/db")
        == "postgresql+asyncpg://u:p@host/db"
    )


def test_sslmode_require_mapped_to_ssl_connect_arg():
    """DigitalOcean-style URLs use sslmode=require; asyncpg rejects that kwarg."""
    url, connect_args = prepare_asyncpg_connection(
        "postgresql://u:p@db.example.com:25060/mydb?sslmode=require"
    )

    assert url.startswith("postgresql+asyncpg://")
    assert "sslmode" not in url
    assert connect_args["ssl"] == "require"


def test_sslmode_disable_maps_to_false():
    url, connect_args = prepare_asyncpg_connection(
        "postgresql://u:p@host/db?sslmode=disable"
    )
    assert "sslmode" not in url
    assert connect_args["ssl"] is False


def test_channel_binding_stripped():
    url, connect_args = prepare_asyncpg_connection(
        "postgresql://u:p@host/db?sslmode=require&channel_binding=require"
    )
    assert "channel_binding" not in url
    assert "sslmode" not in url
    assert connect_args["ssl"] == "require"


def test_existing_ssl_connect_arg_not_overridden():
    url, connect_args = prepare_asyncpg_connection(
        "postgresql://u:p@host/db?sslmode=require",
        base_connect_args={"ssl": True, "statement_cache_size": 0},
    )
    assert connect_args["ssl"] is True
    assert connect_args["statement_cache_size"] == 0
    assert "sslmode" not in url


def test_base_connect_args_preserved():
    _, connect_args = prepare_asyncpg_connection(
        "postgresql://u:p@host/db",
        base_connect_args={"statement_cache_size": 0},
    )
    assert connect_args == {"statement_cache_size": 0}
