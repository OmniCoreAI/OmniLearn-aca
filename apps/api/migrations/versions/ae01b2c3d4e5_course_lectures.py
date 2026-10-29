"""Course lectures: chapters grouped under sessions with their own instructor

* ``courseacademicprofile.organize_by_lectures`` (bool, default false) — the
  course is organised as lectures instead of a flat list of chapters; set for
  every course already linked to a training program.
* ``courseschedulesession.description`` (text) — what the lecture covers.
* ``chapter.lecture_id`` → ``courseschedulesession.id`` (ON DELETE SET NULL) —
  the lecture a chapter belongs to.

Revision ID: ae01b2c3d4e5
Revises: adf2a3b4c5d6
Create Date: 2026-10-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ae01b2c3d4e5'
down_revision: Union[str, None] = 'adf2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector, table):
    return {col['name'] for col in inspector.get_columns(table)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if 'courseacademicprofile' in tables and 'organize_by_lectures' not in _columns(inspector, 'courseacademicprofile'):
        op.add_column(
            'courseacademicprofile',
            sa.Column('organize_by_lectures', sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        if 'trainingprogramcourse' in tables:
            op.execute(
                "UPDATE courseacademicprofile SET organize_by_lectures = true "
                "WHERE course_id IN (SELECT course_id FROM trainingprogramcourse)"
            )

    if 'courseschedulesession' in tables and 'description' not in _columns(inspector, 'courseschedulesession'):
        op.add_column('courseschedulesession', sa.Column('description', sa.Text(), nullable=True))

    if 'chapter' in tables and 'lecture_id' not in _columns(inspector, 'chapter'):
        op.add_column('chapter', sa.Column('lecture_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_chapter_lecture_id', 'chapter', 'courseschedulesession', ['lecture_id'], ['id'], ondelete='SET NULL'
        )
        op.create_index('ix_chapter_lecture_id', 'chapter', ['lecture_id'])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'lecture_id' in _columns(inspector, 'chapter'):
        op.drop_index('ix_chapter_lecture_id', table_name='chapter')
        op.drop_constraint('fk_chapter_lecture_id', 'chapter', type_='foreignkey')
        op.drop_column('chapter', 'lecture_id')
    if 'description' in _columns(inspector, 'courseschedulesession'):
        op.drop_column('courseschedulesession', 'description')
    if 'organize_by_lectures' in _columns(inspector, 'courseacademicprofile'):
        op.drop_column('courseacademicprofile', 'organize_by_lectures')
