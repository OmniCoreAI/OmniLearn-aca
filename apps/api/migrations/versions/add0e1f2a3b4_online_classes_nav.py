"""Online classes in the dashboard sidebar

Academy admins and instructors see the new "online-classes" item by default;
this also adds it to a visibility override a super-admin saved before the
item existed, so those roles are not left without it.

Revision ID: add0e1f2a3b4
Revises: adc1d2e3f4a5
Create Date: 2026-10-16

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'add0e1f2a3b4'
down_revision: Union[str, None] = 'adc1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from src.security.rbac.nav_items import grant_saved_nav_items

    bind = op.get_bind()
    grant_saved_nav_items(bind, 'role_global_admin', ['online-classes'])
    grant_saved_nav_items(bind, 'role_global_instructor', ['online-classes'])


def downgrade() -> None:
    pass
