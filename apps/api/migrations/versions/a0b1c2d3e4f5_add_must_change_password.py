"""Add must_change_password to user table

Supports admin-provisioned accounts: an admin creates a user with a
server-generated temporary password and the user is forced to change it on
first login. The flag is cleared when the user updates their password.

Revision ID: a0b1c2d3e4f5
Revises: f9a0b1c2d3e4
Create Date: 2026-07-04 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401
import sqlmodel  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user',
        sa.Column(
            'must_change_password',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Drop the server_default so future inserts rely on the app-level default,
    # keeping behavior consistent with the SQLModel definition.
    op.alter_column('user', 'must_change_password', server_default=None)


def downgrade() -> None:
    op.drop_column('user', 'must_change_password')
