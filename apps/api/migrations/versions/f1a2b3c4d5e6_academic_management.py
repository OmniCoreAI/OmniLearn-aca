"""Academic Management layer (programs, cohorts, semesters, training programs)

Revision ID: f1a2b3c4d5e6
Revises: b2c3d4e5f8a9
Create Date: 2026-07-04 12:00:00.000000

Introduces the Academic Management tables that sit ABOVE the existing course
implementation:

    program -> cohort -> semester -> semestercourse -> course
    trainingprogram -> trainingprogramcourse -> course

The existing ``course`` table is left untouched; linkage is done via the
``semestercourse`` and ``trainingprogramcourse`` join tables, which also carry
the academic metadata (code, credit hours, ordering).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'b2c3d4e5f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


program_level_enum = postgresql.ENUM(
    'phd', 'masters', 'diploma', name='program_level', create_type=False
)
cohort_status_enum = postgresql.ENUM(
    'upcoming', 'active', 'completed', 'archived', name='cohort_status', create_type=False
)
training_type_enum = postgresql.ENUM(
    'training_course', 'workshop', 'event', 'bootcamp', 'conference', 'seminar',
    'certification_program', name='training_type', create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()

    # Create PG enums explicitly so they exist before column creation.
    program_level_enum.create(bind, checkfirst=True)
    cohort_status_enum.create(bind, checkfirst=True)
    training_type_enum.create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # program
    # ------------------------------------------------------------------
    op.create_table(
        'program',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('about', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('code', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('program_level', program_level_enum, nullable=True),
        sa.Column('thumbnail_image', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('public', sa.Boolean(), nullable=False),
        sa.Column('published', sa.Boolean(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('program_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_program_org_id', 'program', ['org_id'], unique=False)
    op.create_index('ix_program_program_uuid', 'program', ['program_uuid'], unique=False)
    op.create_index(
        'ix_program_org_public_published', 'program', ['org_id', 'public', 'published'], unique=False
    )

    # ------------------------------------------------------------------
    # cohort
    # ------------------------------------------------------------------
    op.create_table(
        'cohort',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('start_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('end_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', cohort_status_enum, nullable=True),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('program_id', sa.Integer(), nullable=True),
        sa.Column('usergroup_id', sa.Integer(), nullable=True),
        sa.Column('cohort_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['program.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usergroup_id'], ['usergroup.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cohort_org_id', 'cohort', ['org_id'], unique=False)
    op.create_index('ix_cohort_program_id', 'cohort', ['program_id'], unique=False)
    op.create_index('ix_cohort_cohort_uuid', 'cohort', ['cohort_uuid'], unique=False)
    op.create_index('ix_cohort_program', 'cohort', ['program_id'], unique=False)

    # ------------------------------------------------------------------
    # semester
    # ------------------------------------------------------------------
    op.create_table(
        'semester',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('start_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('end_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('cohort_id', sa.Integer(), nullable=True),
        sa.Column('program_id', sa.Integer(), nullable=True),
        sa.Column('semester_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cohort_id'], ['cohort.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['program.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_semester_org_id', 'semester', ['org_id'], unique=False)
    op.create_index('ix_semester_cohort_id', 'semester', ['cohort_id'], unique=False)
    op.create_index('ix_semester_program_id', 'semester', ['program_id'], unique=False)
    op.create_index('ix_semester_semester_uuid', 'semester', ['semester_uuid'], unique=False)
    op.create_index('ix_semester_cohort', 'semester', ['cohort_id'], unique=False)

    # ------------------------------------------------------------------
    # trainingprogram
    # ------------------------------------------------------------------
    op.create_table(
        'trainingprogram',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('about', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('training_type', training_type_enum, nullable=True),
        sa.Column('location', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('start_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('end_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('thumbnail_image', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('public', sa.Boolean(), nullable=False),
        sa.Column('published', sa.Boolean(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('trainingprogram_uuid', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_trainingprogram_org_id', 'trainingprogram', ['org_id'], unique=False)
    op.create_index(
        'ix_trainingprogram_trainingprogram_uuid', 'trainingprogram', ['trainingprogram_uuid'],
        unique=False,
    )
    op.create_index(
        'ix_trainingprogram_org_public_published', 'trainingprogram',
        ['org_id', 'public', 'published'], unique=False,
    )

    # ------------------------------------------------------------------
    # semestercourse (join) — carries the academic metadata on the link
    # ------------------------------------------------------------------
    op.create_table(
        'semestercourse',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('code', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('credit_hours', sa.Float(), nullable=True),
        sa.Column('semester_id', sa.Integer(), nullable=True),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['semester_id'], ['semester.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['course.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', name='uq_semestercourse_course'),
    )
    op.create_index('ix_semestercourse_semester_id', 'semestercourse', ['semester_id'], unique=False)
    op.create_index('ix_semestercourse_course_id', 'semestercourse', ['course_id'], unique=False)

    # ------------------------------------------------------------------
    # trainingprogramcourse (join)
    # ------------------------------------------------------------------
    op.create_table(
        'trainingprogramcourse',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('training_program_id', sa.Integer(), nullable=True),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('creation_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('update_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['training_program_id'], ['trainingprogram.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['course.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organization.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', name='uq_trainingprogramcourse_course'),
    )
    op.create_index(
        'ix_trainingprogramcourse_training_program_id', 'trainingprogramcourse',
        ['training_program_id'], unique=False,
    )
    op.create_index(
        'ix_trainingprogramcourse_course_id', 'trainingprogramcourse', ['course_id'], unique=False
    )


def downgrade() -> None:
    op.drop_table('trainingprogramcourse')
    op.drop_table('semestercourse')
    op.drop_index('ix_trainingprogram_org_public_published', table_name='trainingprogram')
    op.drop_index('ix_trainingprogram_trainingprogram_uuid', table_name='trainingprogram')
    op.drop_index('ix_trainingprogram_org_id', table_name='trainingprogram')
    op.drop_table('trainingprogram')
    op.drop_table('semester')
    op.drop_table('cohort')
    op.drop_index('ix_program_org_public_published', table_name='program')
    op.drop_index('ix_program_program_uuid', table_name='program')
    op.drop_index('ix_program_org_id', table_name='program')
    op.drop_table('program')

    bind = op.get_bind()
    training_type_enum.drop(bind, checkfirst=True)
    cohort_status_enum.drop(bind, checkfirst=True)
    program_level_enum.drop(bind, checkfirst=True)
