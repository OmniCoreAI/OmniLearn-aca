"""Training program metadata (code, coordinator, capacity, fees, in_plan)

Revision ID: e8f9a0b1c2d3
Revises: e7f8a9b0c1d2
Create Date: 2026-07-04 19:00:00.000000

Enriches the ``trainingprogram`` table with the same offering metadata the
Postgraduate ``program`` carries:

    code, capacity, is_paid, price, currency, in_plan, coordinator_id (FK user,
    SET NULL).

``code`` gets a per-organization partial unique index. The course-level
attributes (instructor, classroom, question bank, certificate, add-ons,
schedule) live on ``courseacademicprofile`` and are shared across academic and
training contexts, so nothing is duplicated here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trainingprogram', sa.Column('code', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('trainingprogram', sa.Column('capacity', sa.Integer(), nullable=True))
    op.add_column(
        'trainingprogram',
        sa.Column('is_paid', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column('trainingprogram', sa.Column('price', sa.Float(), nullable=True))
    op.add_column('trainingprogram', sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column(
        'trainingprogram',
        sa.Column('in_plan', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.add_column('trainingprogram', sa.Column('coordinator_id', sa.Integer(), nullable=True))
    op.create_index('ix_trainingprogram_coordinator_id', 'trainingprogram', ['coordinator_id'], unique=False)
    op.create_foreign_key(
        'fk_trainingprogram_coordinator_user', 'trainingprogram', 'user',
        ['coordinator_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index(
        'uq_trainingprogram_org_code', 'trainingprogram', ['org_id', 'code'], unique=True,
        postgresql_where=sa.text('code IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_trainingprogram_org_code', table_name='trainingprogram')
    op.drop_constraint('fk_trainingprogram_coordinator_user', 'trainingprogram', type_='foreignkey')
    op.drop_index('ix_trainingprogram_coordinator_id', table_name='trainingprogram')
    op.drop_column('trainingprogram', 'coordinator_id')
    op.drop_column('trainingprogram', 'in_plan')
    op.drop_column('trainingprogram', 'currency')
    op.drop_column('trainingprogram', 'price')
    op.drop_column('trainingprogram', 'is_paid')
    op.drop_column('trainingprogram', 'capacity')
    op.drop_column('trainingprogram', 'code')
