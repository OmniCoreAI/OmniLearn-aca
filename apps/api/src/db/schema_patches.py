"""
Columns added to tables that already exist. The app builds its schema with
SQLModel's create_all at startup (core/events/database.py), which creates
missing tables but never adds columns to existing ones, and deployments
aren't necessarily Alembic-managed (or get stamped without running
migrations). These statements are idempotent, so running them at startup and
in the matching migration is safe either way.
"""

from sqlalchemy import text

# Migration h1a2b3c4d5e6 (SMS sign-in).
USER_PHONE_DDL = [
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone VARCHAR',
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false',
    'CREATE UNIQUE INDEX IF NOT EXISTS ix_user_phone ON "user" (phone)',
]


async def ensure_user_phone_columns(conn) -> None:
    """Adds user.phone / phone_verified (+ unique index) if missing. PostgreSQL
    only: other databases (SQLite in tests) get the columns from the models."""
    if conn.dialect.name != "postgresql":
        return
    for statement in USER_PHONE_DDL:
        await conn.execute(text(statement))
