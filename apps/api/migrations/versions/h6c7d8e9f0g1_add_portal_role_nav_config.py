"""Add portal_role_nav_config table

Adds a table that stores per-system-role overrides for which dashboard
sidebar sections (Instructor / Trainee / Academy Admin / Organization
Coordinator "portals") are visible. Absence of a row for a role_uuid means
"use the hardcoded default" (see src/security/rbac/nav_items.py) — the
table starts empty, so this migration changes no runtime behavior on its
own.

Revision ID: h6c7d8e9f0g1
Revises: g5b6c7d8e9f0
Create Date: 2026-09-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'h6c7d8e9f0g1'
down_revision: Union[str, None] = 'g5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'portal_role_nav_config' in inspector.get_table_names():
        return

    op.create_table(
        'portal_role_nav_config',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('role_uuid', sa.String(), nullable=False),
        sa.Column('visible_items', sa.JSON(), nullable=False),
        sa.Column('updated_by_user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
    )
    op.create_index(
        'ix_portal_role_nav_config_role_uuid',
        'portal_role_nav_config',
        ['role_uuid'],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'portal_role_nav_config' not in inspector.get_table_names():
        return

    op.drop_index('ix_portal_role_nav_config_role_uuid', table_name='portal_role_nav_config')
    op.drop_table('portal_role_nav_config')
