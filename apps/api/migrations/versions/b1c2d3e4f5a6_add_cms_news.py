"""Add cms_news table for organization news CMS

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-07-18 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401
import sqlmodel  # noqa: F401

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a0b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cms_news",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Integer(),
            sa.ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("news_uuid", sa.String(), nullable=False, server_default=""),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False, server_default=""),
        sa.Column("excerpt", sa.String(), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover_image", sa.String(), nullable=False, server_default=""),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("published_at", sa.String(), nullable=True),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("creation_date", sa.String(), nullable=False, server_default=""),
        sa.Column("update_date", sa.String(), nullable=False, server_default=""),
    )
    op.create_index("ix_cms_news_org_id", "cms_news", ["org_id"])
    op.create_index("ix_cms_news_news_uuid", "cms_news", ["news_uuid"])
    op.create_index("ix_cms_news_slug", "cms_news", ["slug"])
    op.create_index(
        "ix_cms_news_org_published_at",
        "cms_news",
        ["org_id", "published", "published_at"],
    )
    op.create_unique_constraint("uq_cms_news_org_slug", "cms_news", ["org_id", "slug"])


def downgrade() -> None:
    op.drop_constraint("uq_cms_news_org_slug", "cms_news", type_="unique")
    op.drop_index("ix_cms_news_org_published_at", table_name="cms_news")
    op.drop_index("ix_cms_news_slug", table_name="cms_news")
    op.drop_index("ix_cms_news_news_uuid", table_name="cms_news")
    op.drop_index("ix_cms_news_org_id", table_name="cms_news")
    op.drop_table("cms_news")
