"""Postgraduate module fields (program + cohort metadata, coordinator, fees)

Revision ID: d5e6f7a8b9c0
Revises: f1a2b3c4d5e6
Create Date: 2026-07-04 17:30:00.000000

Adds the richer Postgraduate Studies metadata on top of the academic tables:

    program: status, capacity, is_paid, price, currency, in_plan, start/end
             dates, banner_image, coordinator_id (FK user, SET NULL)
    cohort:  academic_year, capacity, coordinator_id (FK user, SET NULL)

Program ``code`` also gets a per-organization partial unique index.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


program_status_enum = postgresql.ENUM(
    'draft', 'active', 'suspended', 'archived', name='program_status', create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    program_status_enum.create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # program
    # ------------------------------------------------------------------
    op.add_column('program', sa.Column('status', program_status_enum, nullable=True))
    op.add_column('program', sa.Column('capacity', sa.Integer(), nullable=True))
    op.add_column(
        'program',
        sa.Column('is_paid', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column('program', sa.Column('price', sa.Float(), nullable=True))
    op.add_column('program', sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column(
        'program',
        sa.Column('in_plan', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.add_column('program', sa.Column('start_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('program', sa.Column('end_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('program', sa.Column('banner_image', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('program', sa.Column('coordinator_id', sa.Integer(), nullable=True))
    op.create_index('ix_program_coordinator_id', 'program', ['coordinator_id'], unique=False)
    op.create_foreign_key(
        'fk_program_coordinator_user', 'program', 'user', ['coordinator_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'uq_program_org_code', 'program', ['org_id', 'code'], unique=True,
        postgresql_where=sa.text('code IS NOT NULL'),
    )

    # ------------------------------------------------------------------
    # cohort
    # ------------------------------------------------------------------
    op.add_column('cohort', sa.Column('academic_year', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('cohort', sa.Column('capacity', sa.Integer(), nullable=True))
    op.add_column('cohort', sa.Column('coordinator_id', sa.Integer(), nullable=True))
    op.create_index('ix_cohort_coordinator_id', 'cohort', ['coordinator_id'], unique=False)
    op.create_foreign_key(
        'fk_cohort_coordinator_user', 'cohort', 'user', ['coordinator_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_cohort_coordinator_user', 'cohort', type_='foreignkey')
    op.drop_index('ix_cohort_coordinator_id', table_name='cohort')
    op.drop_column('cohort', 'coordinator_id')
    op.drop_column('cohort', 'capacity')
    op.drop_column('cohort', 'academic_year')

    op.drop_index('uq_program_org_code', table_name='program')
    op.drop_constraint('fk_program_coordinator_user', 'program', type_='foreignkey')
    op.drop_index('ix_program_coordinator_id', table_name='program')
    op.drop_column('program', 'coordinator_id')
    op.drop_column('program', 'banner_image')
    op.drop_column('program', 'end_date')
    op.drop_column('program', 'start_date')
    op.drop_column('program', 'in_plan')
    op.drop_column('program', 'currency')
    op.drop_column('program', 'price')
    op.drop_column('program', 'is_paid')
    op.drop_column('program', 'capacity')
    op.drop_column('program', 'status')

    bind = op.get_bind()
    program_status_enum.drop(bind, checkfirst=True)
