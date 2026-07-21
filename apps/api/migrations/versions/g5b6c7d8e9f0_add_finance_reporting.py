"""Add finance reporting tables (refunds, course config, payroll periods)

Revision ID: g5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-07-21 15:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401

revision: str = "g5b6c7d8e9f0"
down_revision: Union[str, None] = "f4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "financerefund",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("refund_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("entry_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("reason", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.Column("decided_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("decision_note", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("creation_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("update_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_financerefund_org_id", "financerefund", ["org_id"])
    op.create_index("ix_financerefund_refund_uuid", "financerefund", ["refund_uuid"])
    op.create_index("ix_financerefund_entry_uuid", "financerefund", ["entry_uuid"])
    op.create_index("ix_financerefund_status", "financerefund", ["status"])

    op.create_table(
        "financecourseconfig",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("course_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("config_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("tuition_unit_amount", sa.Float(), nullable=True),
        sa.Column("certification_unit_cost", sa.Float(), nullable=True),
        sa.Column("addons_unit_cost", sa.Float(), nullable=True),
        sa.Column("other_fixed_cost", sa.Float(), nullable=True),
        sa.Column("attendees_override", sa.Integer(), nullable=True),
        sa.Column("certified_attendees_override", sa.Integer(), nullable=True),
        sa.Column("creation_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("update_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "course_uuid", name="uq_financecourseconfig_org_course"),
    )
    op.create_index("ix_financecourseconfig_org_id", "financecourseconfig", ["org_id"])
    op.create_index("ix_financecourseconfig_course_uuid", "financecourseconfig", ["course_uuid"])
    op.create_index("ix_financecourseconfig_config_uuid", "financecourseconfig", ["config_uuid"])

    op.create_table(
        "financepayrollperiod",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("month", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("total_hours", sa.Float(), nullable=False),
        sa.Column("total_pay", sa.Float(), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("closed_by", sa.Integer(), nullable=True),
        sa.Column("closed_at", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("creation_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("update_date", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["closed_by"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "month", name="uq_financepayrollperiod_org_month"),
    )
    op.create_index("ix_financepayrollperiod_org_id", "financepayrollperiod", ["org_id"])
    op.create_index("ix_financepayrollperiod_month", "financepayrollperiod", ["month"])


def downgrade() -> None:
    op.drop_index("ix_financepayrollperiod_month", table_name="financepayrollperiod")
    op.drop_index("ix_financepayrollperiod_org_id", table_name="financepayrollperiod")
    op.drop_table("financepayrollperiod")
    op.drop_index("ix_financecourseconfig_config_uuid", table_name="financecourseconfig")
    op.drop_index("ix_financecourseconfig_course_uuid", table_name="financecourseconfig")
    op.drop_index("ix_financecourseconfig_org_id", table_name="financecourseconfig")
    op.drop_table("financecourseconfig")
    op.drop_index("ix_financerefund_status", table_name="financerefund")
    op.drop_index("ix_financerefund_entry_uuid", table_name="financerefund")
    op.drop_index("ix_financerefund_refund_uuid", table_name="financerefund")
    op.drop_index("ix_financerefund_org_id", table_name="financerefund")
    op.drop_table("financerefund")
