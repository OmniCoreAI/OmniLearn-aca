"""Locations and facilities (rooms), attachable to courses, offerings and sessions

Adds ``location`` and ``facility`` and a nullable ``facility_id`` (ON DELETE
SET NULL) on course academic profiles, course schedule sessions, course
offerings, offering sessions and training programs. The legacy free-text
``classroom`` / ``location`` columns are kept as a fallback.

Revision ID: ad2c3d4e5f6a
Revises: ad1b2c3d4e5f
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad2c3d4e5f6a'
down_revision: Union[str, None] = 'ad1b2c3d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ['location', 'facility']
# Sidebar items added by the Administration & Configuration layer so far. A
# saved portal-visibility override for the Academy Admin role predates them,
# so grant them explicitly (the defaults already include them).
ADMIN_NAV_ITEMS = ['administration', 'instructors', 'facilities']
FACILITY_FK_TABLES = [
    'courseacademicprofile',
    'courseschedulesession',
    'courseoffering',
    'offeringsession',
    'trainingprogram',
]


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import facilities  # noqa: F401  (registers the tables)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)

    for table in FACILITY_FK_TABLES:
        if table not in existing:
            continue
        if 'facility_id' in {c['name'] for c in inspector.get_columns(table)}:
            continue
        op.add_column(table, sa.Column('facility_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            f'fk_{table}_facility_id', table, 'facility', ['facility_id'], ['id'], ondelete='SET NULL'
        )
        op.create_index(f'ix_{table}_facility_id', table, ['facility_id'])

    from src.security.rbac.nav_items import grant_saved_nav_items

    grant_saved_nav_items(bind, 'role_global_admin', ADMIN_NAV_ITEMS)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    for table in FACILITY_FK_TABLES:
        if table not in existing or 'facility_id' not in {c['name'] for c in inspector.get_columns(table)}:
            continue
        index_names = {i['name'] for i in inspector.get_indexes(table)}
        if f'ix_{table}_facility_id' in index_names:
            op.drop_index(f'ix_{table}_facility_id', table_name=table)
        for fk in inspector.get_foreign_keys(table):
            if fk.get('constrained_columns') == ['facility_id'] and fk.get('name'):
                op.drop_constraint(fk['name'], table, type_='foreignkey')
        op.drop_column(table, 'facility_id')
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
