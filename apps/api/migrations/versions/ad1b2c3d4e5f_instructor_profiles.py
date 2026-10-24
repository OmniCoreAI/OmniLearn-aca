"""Instructor profiles: bio, expertise, availability, photo, approval status

Adds profile columns to ``instructor`` (bio, specializations, availability,
profile_image), a ``status`` to ``instructorcategory`` and the
``pending_approval`` instructor status used for coordinator-invited instructors.

Revision ID: ad1b2c3d4e5f
Revises: ad0a1b2c3d4e
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'ad1b2c3d4e5f'
down_revision: Union[str, None] = 'ad0a1b2c3d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INSTRUCTOR_COLUMNS = [
    ('bio', sa.Text()),
    ('specializations', postgresql.JSONB(astext_type=sa.Text())),
    ('availability', postgresql.JSONB(astext_type=sa.Text())),
    ('profile_image', sa.String()),
]


def _columns(inspector, table: str) -> set:
    return {c['name'] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing = _columns(inspector, 'instructor')
    for name, type_ in INSTRUCTOR_COLUMNS:
        if name not in existing:
            op.add_column('instructor', sa.Column(name, type_, nullable=True))

    if 'status' not in _columns(inspector, 'instructorcategory'):
        op.add_column(
            'instructorcategory',
            sa.Column('status', sa.String(32), nullable=False, server_default=sa.text("'active'")),
        )
        op.create_index('ix_instructorcategory_status', 'instructorcategory', ['status'])

    # The enum was created with value labels by the original migration but with
    # member names by ``create_all``; add the new member in the same style.
    labels = {
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
                "WHERE t.typname = 'instructor_status'"
            )
        )
    }
    if labels:
        new_label = 'pending_approval' if 'active' in labels else 'PENDING_APPROVAL'
        with op.get_context().autocommit_block():
            op.execute(f"ALTER TYPE instructor_status ADD VALUE IF NOT EXISTS '{new_label}'")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    # Postgres cannot drop an enum value; demote pending instructors instead.
    op.execute(
        "UPDATE instructor SET status = NULL "
        "WHERE status::text IN ('PENDING_APPROVAL', 'pending_approval')"
    )
    if 'status' in _columns(inspector, 'instructorcategory'):
        op.drop_index('ix_instructorcategory_status', table_name='instructorcategory')
        op.drop_column('instructorcategory', 'status')
    existing = _columns(inspector, 'instructor')
    for name, _ in reversed(INSTRUCTOR_COLUMNS):
        if name in existing:
            op.drop_column('instructor', name)
