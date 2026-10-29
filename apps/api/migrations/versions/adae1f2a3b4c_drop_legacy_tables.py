"""Drop legacy tables with no model

``programinstructor`` and ``trainingprograminstructor`` (teaching staff now
comes from the instructor registry: course academic profile, offerings,
sessions) and ``room`` (replaced by Administration → Facilities).

A table is only dropped when it is empty; otherwise it is kept and a warning
is logged so its rows can be reviewed first. Foreign keys pointing at a dropped
table are removed with it.

Revision ID: adae1f2a3b4c
Revises: ad9d0e1f2a3b
Create Date: 2026-10-06

"""
import logging
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'adae1f2a3b4c'
down_revision: Union[str, None] = 'ad9d0e1f2a3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LEGACY_TABLES = ('programinstructor', 'trainingprograminstructor', 'room')

logger = logging.getLogger('alembic.runtime.migration')


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    for table in LEGACY_TABLES:
        if table not in existing:
            continue
        rows = bind.execute(sa.text(f'SELECT count(*) FROM "{table}"')).scalar() or 0
        if rows:
            logger.warning('Keeping legacy table %s: it still has %s row(s).', table, rows)
            continue
        for other in existing - {table}:
            for fk in inspector.get_foreign_keys(other):
                if fk.get('referred_table') == table and fk.get('name'):
                    op.drop_constraint(fk['name'], other, type_='foreignkey')
        op.drop_table(table)
        existing.discard(table)


def downgrade() -> None:
    # Legacy structures are not recreated.
    pass
