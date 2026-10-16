"""Facility reservations with a no-double-booking exclusion constraint

Adds ``facilityreservation``: one row per schedule session that occupies a room
plus halls booked directly (events, exams, meetings). Existing sessions are
mirrored into it (overlaps that already exist are kept, flagged
``conflict_override``), then a GiST exclusion constraint (``btree_gist``)
rejects overlapping approved bookings of the same room.

The API runs the same backfill/constraint step at startup, so databases built
by ``create_all`` get it too.

Revision ID: adb0c1d2e3f4
Revises: adae1f2a3b4c
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'adb0c1d2e3f4'
down_revision: Union[str, None] = 'adae1f2a3b4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.academic import course_profiles, offerings  # noqa: F401  (FK targets)
    from src.db.administration import facilities  # noqa: F401  (registers the table)
    from src.services.administration.reservations import backfill_reservations, ensure_no_overlap_constraint

    bind = op.get_bind()
    if 'facilityreservation' not in set(sa.inspect(bind).get_table_names()):
        SQLModel.metadata.tables['facilityreservation'].create(bind, checkfirst=True)
    backfill_reservations(bind)
    ensure_no_overlap_constraint(bind)


def downgrade() -> None:
    # The exclusion constraint and indexes go with the table.
    op.drop_table('facilityreservation')
