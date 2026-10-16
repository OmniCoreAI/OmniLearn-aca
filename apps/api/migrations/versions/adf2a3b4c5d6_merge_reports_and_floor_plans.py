"""Merge the reports-nav and floor-plan branches

Two revisions were added in parallel on top of different parents
(``adaf2a3b4c5d`` reports nav; ``ade1f2a3b4c5`` location floor plans, after the
Zoom and online-classes revisions). Neither depends on the other, so this
revision only joins them into a single head.

Revision ID: adf2a3b4c5d6
Revises: adaf2a3b4c5d, ade1f2a3b4c5
Create Date: 2026-10-16

"""
from typing import Sequence, Union


revision: str = 'adf2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = ('adaf2a3b4c5d', 'ade1f2a3b4c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
