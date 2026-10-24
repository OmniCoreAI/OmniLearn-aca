"""Columns added to existing tables (create_all never alters them)."""

from unittest.mock import AsyncMock

from src.db.schema_patches import USER_PHONE_DDL, ensure_user_phone_columns


def test_user_phone_ddl_is_idempotent():
    assert len(USER_PHONE_DDL) == 3
    assert all("IF NOT EXISTS" in statement for statement in USER_PHONE_DDL)
    joined = " ".join(USER_PHONE_DDL)
    assert "phone_verified BOOLEAN NOT NULL DEFAULT false" in joined
    assert "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_phone" in joined


async def test_ensure_user_phone_columns_runs_every_statement():
    conn = AsyncMock()
    conn.dialect.name = "postgresql"
    await ensure_user_phone_columns(conn)
    assert conn.execute.await_count == 3


async def test_ensure_user_phone_columns_skips_other_databases():
    # The DDL is PostgreSQL's; SQLite (tests, local tools) builds the
    # columns from the models anyway.
    conn = AsyncMock()
    conn.dialect.name = "sqlite"
    await ensure_user_phone_columns(conn)
    conn.execute.assert_not_awaited()
