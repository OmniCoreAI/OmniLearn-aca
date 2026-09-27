"""Administration & Configuration foundation: lookups and admin settings

Adds ``configlookup`` (reusable, org-scoped categories: facility types,
equipment, add-on categories, entity types, location types, course categories)
and ``adminsetting`` (typed org-level settings such as currencies and taxes).

Revision ID: ad0a1b2c3d4e
Revises: l0g1h2i3j4k5
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


revision: str = 'ad0a1b2c3d4e'
down_revision: Union[str, None] = 'l0g1h2i3j4k5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = [
    'configlookup',
    'adminsetting',
]


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import lookups, settings  # noqa: F401  (registers the tables)

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
