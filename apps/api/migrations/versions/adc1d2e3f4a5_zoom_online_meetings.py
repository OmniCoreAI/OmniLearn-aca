"""Zoom online meetings

Adds the organization's Zoom connection (encrypted OAuth tokens) and online
meetings attached to existing lectures — course class sessions and offering
sessions — plus their attendance segments and recording files. No existing
table changes.

Revision ID: adc1d2e3f4a5
Revises: adb0c1d2e3f4
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'adc1d2e3f4a5'
down_revision: Union[str, None] = 'adb0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ('zoomconnection', 'onlinemeeting', 'onlinemeetingattendance', 'onlinemeetingrecording')


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.academic import course_profiles, offerings  # noqa: F401  (FK targets)
    from src.db.integrations import zoom  # noqa: F401  (registers the tables)

    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)


def downgrade() -> None:
    for name in reversed(TABLES):
        op.drop_table(name)
