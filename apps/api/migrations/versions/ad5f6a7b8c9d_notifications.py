"""Communication: notification templates, overrides and delivery log

Adds ``notificationtemplate``, ``notificationtemplateoverride`` and
``notificationlog`` and shows the Communication page to academy admins whose
sidebar visibility was saved before it existed.

Revision ID: ad5f6a7b8c9d
Revises: ad4e5f6a7b8c
Create Date: 2026-09-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad5f6a7b8c9d'
down_revision: Union[str, None] = 'ad4e5f6a7b8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ['notificationtemplate', 'notificationtemplateoverride', 'notificationlog']


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import notifications  # noqa: F401  (registers the tables)
    from src.security.rbac.nav_items import grant_saved_nav_items

    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)

    grant_saved_nav_items(bind, 'role_global_admin', ['communication'])


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
