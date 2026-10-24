"""Academic grading: grade scales, assessment components, scores, results

Adds grade scales, weighted assessment components per course offering and
per-enrollment component scores; extends ``courseoffering`` with the grade
submission/approval workflow, ``enrollment`` with the official result, and
``program`` with its grade scale.

Revision ID: j8e9f0g1h2i3
Revises: i7d8e9f0g1h2
Create Date: 2026-09-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


revision: str = 'j8e9f0g1h2i3'
down_revision: Union[str, None] = 'i7d8e9f0g1h2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ['gradescale', 'assessmentcomponent', 'componentscore']

OFFERING_COLUMNS = [
    ('grade_status', sa.String(), "'open'"),
    ('grade_note', sa.String(), None),
    ('grades_submitted_at', sa.String(), None),
    ('grades_submitted_by_id', sa.Integer(), None),
    ('grades_approved_at', sa.String(), None),
    ('grades_approved_by_id', sa.Integer(), None),
]
ENROLLMENT_COLUMNS = [
    ('final_score', sa.Float()),
    ('letter_grade', sa.String()),
    ('grade_points', sa.Float()),
    ('result_passed', sa.Boolean()),
    ('graded_at', sa.String()),
]


def _columns(inspector, table):
    return {c['name'] for c in inspector.get_columns(table)}


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.academic import grading  # noqa: F401  (registers the tables)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)

    cols = _columns(inspector, 'courseoffering')
    for name, type_, default in OFFERING_COLUMNS:
        if name not in cols:
            op.add_column(
                'courseoffering',
                sa.Column(name, type_, nullable=True, server_default=sa.text(default) if default else None),
            )
    for name in ('grades_submitted_by_id', 'grades_approved_by_id'):
        if name not in cols:
            op.create_foreign_key(
                f'fk_courseoffering_{name}_user', 'courseoffering', 'user', [name], ['id'], ondelete='SET NULL'
            )

    cols = _columns(inspector, 'enrollment')
    for name, type_ in ENROLLMENT_COLUMNS:
        if name not in cols:
            op.add_column('enrollment', sa.Column(name, type_, nullable=True))

    if 'grade_scale_id' not in _columns(inspector, 'program'):
        op.add_column('program', sa.Column('grade_scale_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'grade_scale_id' in _columns(inspector, 'program'):
        op.drop_column('program', 'grade_scale_id')

    cols = _columns(inspector, 'enrollment')
    for name, _ in ENROLLMENT_COLUMNS:
        if name in cols:
            op.drop_column('enrollment', name)

    cols = _columns(inspector, 'courseoffering')
    for name in ('grades_submitted_by_id', 'grades_approved_by_id'):
        if name in cols:
            op.drop_constraint(f'fk_courseoffering_{name}_user', 'courseoffering', type_='foreignkey')
    for name, _, _ in OFFERING_COLUMNS:
        if name in cols:
            op.drop_column('courseoffering', name)

    existing = set(inspector.get_table_names())
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
    op.execute('DROP TYPE IF EXISTS component_score_source')
    op.execute('DROP TYPE IF EXISTS assessment_component_type')
