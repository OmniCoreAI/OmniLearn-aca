"""Academic admissions: requirements, entrance tests, applications

Adds program admission requirements and entrance tests, applications to a
cohort intake with private documents, entrance-test attempts, interviews and
an audit trail; adds ``cohort.admission_status`` (open / closed).

Revision ID: k9f0g1h2i3j4
Revises: j8e9f0g1h2i3
Create Date: 2026-09-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


revision: str = 'k9f0g1h2i3j4'
down_revision: Union[str, None] = 'j8e9f0g1h2i3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = [
    'admissionrequirement',
    'entrancetest',
    'admissionapplication',
    'applicationdocument',
    'entrancetestattempt',
    'admissioninterview',
    'applicationevent',
]
ENUMS = [
    'admission_requirement_type',
    'application_status',
    'admission_document_status',
    'entrance_attempt_status',
    'admission_interview_status',
    'interview_recommendation',
]


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.academic import admissions  # noqa: F401  (registers the tables)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)

    if 'admission_status' not in {c['name'] for c in inspector.get_columns('cohort')}:
        op.add_column(
            'cohort',
            sa.Column('admission_status', sa.String(), nullable=True, server_default=sa.text("'closed'")),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'admission_status' in {c['name'] for c in inspector.get_columns('cohort')}:
        op.drop_column('cohort', 'admission_status')
    existing = set(inspector.get_table_names())
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
    for enum_name in ENUMS:
        op.execute(f'DROP TYPE IF EXISTS {enum_name}')
