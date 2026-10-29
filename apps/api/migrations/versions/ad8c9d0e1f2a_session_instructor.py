"""Course session instructor (guest lecturer / substitute)

Adds ``courseschedulesession.instructor_id`` when missing. Older databases may
already carry the column from the legacy scheduling tables.

Revision ID: ad8c9d0e1f2a
Revises: ad7b8c9d0e1f
Create Date: 2026-10-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad8c9d0e1f2a'
down_revision: Union[str, None] = 'ad7b8c9d0e1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(bind, table: str) -> set:
    return {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if 'courseschedulesession' not in set(sa.inspect(bind).get_table_names()):
        return
    if 'instructor_id' not in _columns(bind, 'courseschedulesession'):
        op.add_column(
            'courseschedulesession',
            sa.Column(
                'instructor_id', sa.Integer(),
                sa.ForeignKey('user.id', ondelete='SET NULL'), nullable=True,
            ),
        )
        op.create_index(
            'ix_courseschedulesession_instructor_id', 'courseschedulesession', ['instructor_id']
        )


def downgrade() -> None:
    # The column may predate this migration (legacy scheduling), so it is kept.
    pass
