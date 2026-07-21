"""Add local finance ledger table (no Stripe dependency)

Revision ID: f4a5b6c7d8e9
Revises: c2d3e4f5a6b7
Create Date: 2026-07-21 14:45:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "financeledgerentry",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("entry_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entry_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("category", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entry_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("payment_method", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("offer_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("course_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("creation_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("update_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_financeledgerentry_org_id", "financeledgerentry", ["org_id"])
    op.create_index("ix_financeledgerentry_entry_uuid", "financeledgerentry", ["entry_uuid"])
    op.create_index("ix_financeledgerentry_entry_type", "financeledgerentry", ["entry_type"])
    op.create_index("ix_financeledgerentry_category", "financeledgerentry", ["category"])
    op.create_index("ix_financeledgerentry_entry_date", "financeledgerentry", ["entry_date"])
    op.create_index("ix_financeledgerentry_status", "financeledgerentry", ["status"])


def downgrade() -> None:
    op.drop_index("ix_financeledgerentry_status", table_name="financeledgerentry")
    op.drop_index("ix_financeledgerentry_entry_date", table_name="financeledgerentry")
    op.drop_index("ix_financeledgerentry_category", table_name="financeledgerentry")
    op.drop_index("ix_financeledgerentry_entry_type", table_name="financeledgerentry")
    op.drop_index("ix_financeledgerentry_entry_uuid", table_name="financeledgerentry")
    op.drop_index("ix_financeledgerentry_org_id", table_name="financeledgerentry")
    op.drop_table("financeledgerentry")
