"""Add a normalised, unique phone number to users (SMS sign-in)

Revision ID: h1a2b3c4d5e6
Revises: g5b6c7d8e9f0
Create Date: 2026-10-22 12:00:00.000000

Phones typed at sign-up so far live as free text in
``user.extra_metadata->>'phone'``. They are copied into the new column in
E.164 form where valid (src/services/phone.py, Egypt assumed for numbers
without a country code); invalid ones are skipped, and when two accounts
typed the same number the older account (lowest id) keeps it. None count as
verified: ``phone_verified`` starts false for everyone.

Idempotent (src/db/schema_patches.py): deployments built by create_all may be
stamped past this revision, so the app also runs the same DDL at startup.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

from src.db.schema_patches import USER_PHONE_DDL
from src.services.phone import normalize_phone

revision: str = "h1a2b3c4d5e6"
down_revision: Union[str, None] = "g5b6c7d8e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for statement in USER_PHONE_DDL:
        op.execute(statement)

    conn = op.get_bind()
    # Only accounts without a phone yet, so running this again changes nothing.
    rows = conn.execute(
        sa.text(
            "SELECT id, extra_metadata->>'phone' FROM \"user\" "
            "WHERE phone IS NULL AND extra_metadata->>'phone' IS NOT NULL ORDER BY id"
        )
    ).fetchall()
    taken: set[str] = {
        phone for (phone,) in conn.execute(sa.text('SELECT phone FROM "user" WHERE phone IS NOT NULL'))
    }
    for user_id, raw in rows:
        phone = normalize_phone(raw, "EG")
        if phone is None or phone in taken:
            continue
        taken.add(phone)
        conn.execute(
            sa.text('UPDATE "user" SET phone = :phone WHERE id = :id'),
            {"phone": phone, "id": user_id},
        )


def downgrade() -> None:
    op.drop_index("ix_user_phone", table_name="user")
    op.drop_column("user", "phone_verified")
    op.drop_column("user", "phone")
