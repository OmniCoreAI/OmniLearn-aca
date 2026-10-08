"""In-app notifications (inbox)

Creates the ``notification`` table when it does not exist yet.

Revision ID: ad9d0e1f2a3b
Revises: ad8c9d0e1f2a
Create Date: 2026-10-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad9d0e1f2a3b'
down_revision: Union[str, None] = 'ad8c9d0e1f2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db import notification_inbox  # noqa: F401  (registers the table)

    bind = op.get_bind()
    if 'notification' not in set(sa.inspect(bind).get_table_names()):
        SQLModel.metadata.tables['notification'].create(bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    if 'notification' in set(sa.inspect(bind).get_table_names()):
        op.drop_table('notification')
