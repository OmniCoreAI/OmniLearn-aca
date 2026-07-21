"""Postgres URL helpers for SQLAlchemy + asyncpg."""

from __future__ import annotations

from sqlalchemy.engine.url import make_url

# libpq query params that asyncpg.connect() does not accept as kwargs.
# Leaving them in the URL makes SQLAlchemy forward them and crash startup, e.g.:
#   TypeError: connect() got an unexpected keyword argument 'sslmode'
_ASYNCPG_UNSUPPORTED_QUERY_KEYS = (
    "sslmode",
    "channel_binding",
    "gssencmode",
)

_SSL_MODE_TRUE = frozenset({"allow", "prefer", "require", "verify-ca", "verify-full"})


def to_asyncpg_url(url: str) -> str:
    """Rewrite sync / psycopg2 Postgres URLs to the asyncpg SQLAlchemy dialect."""
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def prepare_asyncpg_connection(
    url: str,
    *,
    base_connect_args: dict | None = None,
) -> tuple[str, dict]:
    """
    Normalize a Postgres URL for create_async_engine(+asyncpg).

    - Rewrites driver prefixes to postgresql+asyncpg://
    - Maps libpq ``sslmode`` to asyncpg's ``ssl`` connect arg
    - Strips other libpq-only query params that would break asyncpg.connect()
    """
    async_url = to_asyncpg_url(url)
    connect_args = dict(base_connect_args or {})

    if not async_url.startswith("postgresql+asyncpg://"):
        return async_url, connect_args

    sa_url = make_url(async_url)
    sslmode = sa_url.query.get("sslmode")

    sa_url = sa_url.difference_update_query(_ASYNCPG_UNSUPPORTED_QUERY_KEYS)

    if (
        sslmode is not None
        and "ssl" not in connect_args
        and "ssl" not in sa_url.query
    ):
        mode = str(sslmode).lower()
        if mode == "disable":
            connect_args["ssl"] = False
        elif mode in _SSL_MODE_TRUE:
            # asyncpg accepts these mode strings directly (0.27+)
            connect_args["ssl"] = mode
        else:
            connect_args["ssl"] = True

    return sa_url.render_as_string(hide_password=False), connect_args
