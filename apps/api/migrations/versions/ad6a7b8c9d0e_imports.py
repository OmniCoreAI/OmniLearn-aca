"""Bulk member import jobs (Excel / CSV)

Adds ``importjob`` and ``importrow``.

Revision ID: ad6a7b8c9d0e
Revises: ad5f6a7b8c9d
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad6a7b8c9d0e'
down_revision: Union[str, None] = 'ad5f6a7b8c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ['importjob', 'importrow']


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import imports  # noqa: F401  (registers the tables)

    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
