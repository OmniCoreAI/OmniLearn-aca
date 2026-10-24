"""Student record status reason and history

Adds ``cohortmembership.status_reason`` (why the current status was set;
required for deferral, suspension and withdrawal) and
``cohortmembership.status_history`` (every status change with actor, reason
and the registrations a deferral/suspension withdrew, so they can be restored
when the student returns).

Revision ID: l0g1h2i3j4k5
Revises: k9f0g1h2i3j4
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'l0g1h2i3j4k5'
down_revision: Union[str, None] = 'k9f0g1h2i3j4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {c['name'] for c in inspector.get_columns('cohortmembership')}
    if 'status_reason' not in columns:
        op.add_column('cohortmembership', sa.Column('status_reason', sa.String(), nullable=True))
    if 'status_history' not in columns:
        op.add_column('cohortmembership', sa.Column('status_history', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {c['name'] for c in inspector.get_columns('cohortmembership')}
    for name in ('status_history', 'status_reason'):
        if name in columns:
            op.drop_column('cohortmembership', name)
