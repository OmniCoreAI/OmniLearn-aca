"""Reports section in the dashboard sidebar

Academy admins see the new "reports" item by default; this also adds it to a
visibility override a super-admin saved before the item existed.

Revision ID: adaf2a3b4c5d
Revises: adae1f2a3b4c
Create Date: 2026-10-07

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'adaf2a3b4c5d'
down_revision: Union[str, None] = 'adae1f2a3b4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from src.security.rbac.nav_items import grant_saved_nav_items

    grant_saved_nav_items(op.get_bind(), 'role_global_admin', ['reports'])


def downgrade() -> None:
    pass
