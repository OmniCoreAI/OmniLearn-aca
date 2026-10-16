"""Floor plans on locations

Adds a nullable JSONB ``floor_plan`` column to ``location`` holding the drawn
layout of a building (floors, rooms, corridors, doors). Bookable rooms in it
point at facilities by uuid.

Revision ID: ade1f2a3b4c5
Revises: add0e1f2a3b4
Create Date: 2026-10-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'ade1f2a3b4c5'
down_revision: Union[str, None] = 'add0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'location' not in inspector.get_table_names():
        return
    if 'floor_plan' in {col['name'] for col in inspector.get_columns('location')}:
        return
    op.add_column('location', sa.Column('floor_plan', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'floor_plan' in {col['name'] for col in inspector.get_columns('location')}:
        op.drop_column('location', 'floor_plan')
