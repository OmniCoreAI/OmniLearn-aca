"""Course academic profile (1:1 course extension) + schedule sessions

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-07-04 18:30:00.000000

Adds a 1:1 academic/offering profile attached to the existing Course so the
attributes (credit hours, instructor, classroom, capacity, status, add-ons,
certificate flag) follow the course everywhere it is used (postgraduate
semesters AND training programs), without modifying the core ``course`` table.

    courseacademicprofile: 1:1 with course (unique course_id)
    courseschedulesession: schedule sessions belonging to a profile
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


course_offering_status_enum = postgresql.ENUM(
    'draft', 'open', 'in_progress', 'closed', 'archived',
    name='course_offering_status', create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    course_offering_status_enum.create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # courseacademicprofile
    # ------------------------------------------------------------------
    op.create_table(
        'courseacademicprofile',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('credit_hours', sa.Float(), nullable=True),
        sa.Column('classroom', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('status', course_offering_status_enum, nullable=True),
        sa.Column('issues_certificate', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('instructor_id', sa.Integer(), nullable=True),
        sa.Column('usergroup_id', sa.Integer(), nullable=True),
        sa.Column('add_ons', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('profile_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['course.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['instructor_id'], ['user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['usergroup_id'], ['usergroup.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', name='uq_courseacademicprofile_course'),
    )
    op.create_index('ix_courseacademicprofile_course_id', 'courseacademicprofile', ['course_id'], unique=False)
    op.create_index('ix_courseacademicprofile_org_id', 'courseacademicprofile', ['org_id'], unique=False)
    op.create_index('ix_courseacademicprofile_instructor_id', 'courseacademicprofile', ['instructor_id'], unique=False)
    op.create_index('ix_courseacademicprofile_profile_uuid', 'courseacademicprofile', ['profile_uuid'], unique=False)

    # ------------------------------------------------------------------
    # courseschedulesession
    # ------------------------------------------------------------------
    op.create_table(
        'courseschedulesession',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('start_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('end_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('location', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('session_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['profile_id'], ['courseacademicprofile.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_courseschedulesession_profile_id', 'courseschedulesession', ['profile_id'], unique=False)
    op.create_index('ix_courseschedulesession_session_uuid', 'courseschedulesession', ['session_uuid'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_courseschedulesession_session_uuid', table_name='courseschedulesession')
    op.drop_index('ix_courseschedulesession_profile_id', table_name='courseschedulesession')
    op.drop_table('courseschedulesession')

    op.drop_index('ix_courseacademicprofile_profile_uuid', table_name='courseacademicprofile')
    op.drop_index('ix_courseacademicprofile_instructor_id', table_name='courseacademicprofile')
    op.drop_index('ix_courseacademicprofile_org_id', table_name='courseacademicprofile')
    op.drop_index('ix_courseacademicprofile_course_id', table_name='courseacademicprofile')
    op.drop_table('courseacademicprofile')

    bind = op.get_bind()
    course_offering_status_enum.drop(bind, checkfirst=True)
