"""Instructor Management + Finance tables

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-07-04 21:20:00.000000

Adds the Instructor Management layer:

    instructorcategory                 - category + base hourly rate + currency
    instructorcategorylanguagerate     - per-delivery-language rate table
    instructor                         - 1:1 extension of a user (dept, langs,
                                         contact, status, fallback rate)
    instructorworklog                  - finance: logged hours + snapshot of
                                         rate/amount (Hours x Rate)

The dev/docker environment builds these via SQLModel.metadata.create_all; this
migration keeps the alembic history in sync for managed deploys.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    instructor_status = postgresql.ENUM(
        'active', 'inactive', 'on_leave', name='instructor_status'
    )
    instructor_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'instructorcategory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('hourly_rate', sa.Float(), nullable=True),
        sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('category_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_instructorcategory_org_id', 'instructorcategory', ['org_id'])
    op.create_index('ix_instructorcategory_category_uuid', 'instructorcategory', ['category_uuid'])

    op.create_table(
        'instructorcategorylanguagerate',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('language', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('hourly_rate', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['instructorcategory.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category_id', 'language', name='uq_instructorcatlangrate_cat_lang'),
    )
    op.create_index(
        'ix_instructorcategorylanguagerate_category_id',
        'instructorcategorylanguagerate', ['category_id'],
    )
    op.create_index(
        'ix_instructorcategorylanguagerate_org_id',
        'instructorcategorylanguagerate', ['org_id'],
    )

    op.create_table(
        'instructor',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('department', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('languages', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('contact_info', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('hourly_rate', sa.Float(), nullable=True),
        sa.Column('status', instructor_status, nullable=True),
        sa.Column('instructor_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['instructorcategory.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'user_id', name='uq_instructor_org_user'),
    )
    op.create_index('ix_instructor_org_id', 'instructor', ['org_id'])
    op.create_index('ix_instructor_user_id', 'instructor', ['user_id'])
    op.create_index('ix_instructor_category_id', 'instructor', ['category_id'])
    op.create_index('ix_instructor_instructor_uuid', 'instructor', ['instructor_uuid'])

    op.create_table(
        'instructorworklog',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('instructor_id', sa.Integer(), nullable=True),
        sa.Column('hours', sa.Float(), nullable=False),
        sa.Column('language', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('rate_applied', sa.Float(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('work_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('course_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('worklog_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['instructor_id'], ['instructor.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_instructorworklog_org_id', 'instructorworklog', ['org_id'])
    op.create_index('ix_instructorworklog_instructor_id', 'instructorworklog', ['instructor_id'])
    op.create_index('ix_instructorworklog_worklog_uuid', 'instructorworklog', ['worklog_uuid'])


def downgrade() -> None:
    op.drop_table('instructorworklog')
    op.drop_table('instructor')
    op.drop_table('instructorcategorylanguagerate')
    op.drop_table('instructorcategory')
    instructor_status = postgresql.ENUM(
        'active', 'inactive', 'on_leave', name='instructor_status'
    )
    instructor_status.drop(op.get_bind(), checkfirst=True)
