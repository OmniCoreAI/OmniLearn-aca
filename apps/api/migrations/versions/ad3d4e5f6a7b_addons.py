"""Add-ons catalog, attachments and participant selections

Adds ``addon``, ``addonattachment`` and ``addonselection`` and moves every
course's legacy ``courseacademicprofile.add_ons`` JSON entry into the catalog
(reused by case-insensitive name within the org) plus a course attachment that
keeps the old price as an override. The JSON column is left untouched
(deprecated; no longer written).

Revision ID: ad3d4e5f6a7b
Revises: ad2c3d4e5f6a
Create Date: 2026-09-27

"""
import re
from datetime import datetime
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = 'ad3d4e5f6a7b'
down_revision: Union[str, None] = 'ad2c3d4e5f6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ['addon', 'addonattachment', 'addonselection']


def _code(name: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "-", name.upper()).strip("-")[:40].strip("-") or "ADDON"


def _migrate_legacy_course_addons(bind) -> None:
    rows = bind.execute(
        sa.text(
            "SELECT p.org_id, c.course_uuid, p.add_ons FROM courseacademicprofile p "
            "JOIN course c ON c.id = p.course_id WHERE p.add_ons IS NOT NULL"
        )
    ).fetchall()
    stamp = str(datetime.now())
    for org_id, course_uuid, add_ons in rows:
        for entry in add_ons or []:
            name = (entry.get("name") or "").strip() if isinstance(entry, dict) else ""
            if not name:
                continue
            price = entry.get("price")
            addon = bind.execute(
                sa.text("SELECT id, price FROM addon WHERE org_id = :org AND lower(name) = lower(:name) LIMIT 1"),
                {"org": org_id, "name": name},
            ).first()
            if addon is None:
                addon_id = bind.execute(
                    sa.text(
                        "INSERT INTO addon (org_id, name, code, price, tax_inclusive, unit, status, "
                        "addon_uuid, creation_date, update_date) VALUES (:org, :name, :code, :price, false, "
                        "'per_participant', 'active', :uuid, :now, :now) RETURNING id"
                    ),
                    {
                        "org": org_id,
                        "name": name,
                        "code": _code(name),
                        "price": float(price or 0),
                        "uuid": f"addon_{uuid4()}",
                        "now": stamp,
                    },
                ).scalar()
                catalog_price = float(price or 0)
            else:
                addon_id, catalog_price = addon[0], addon[1]
            override = None if price is None or float(price) == float(catalog_price) else float(price)
            bind.execute(
                sa.text(
                    "INSERT INTO addonattachment (org_id, addon_id, target_type, target_uuid, price_override, "
                    "is_required, is_selectable, max_quantity, sort_order, status, attachment_uuid, "
                    "creation_date, update_date) VALUES (:org, :addon, 'course', :course, :override, false, "
                    "true, 1, 0, 'active', :uuid, :now, :now) "
                    "ON CONFLICT ON CONSTRAINT uq_addonattachment_addon_target DO NOTHING"
                ),
                {
                    "org": org_id,
                    "addon": addon_id,
                    "course": course_uuid,
                    "override": override,
                    "uuid": f"addonattachment_{uuid4()}",
                    "now": stamp,
                },
            )


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import addons  # noqa: F401  (registers the tables)
    from src.security.rbac.nav_items import grant_saved_nav_items

    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)

    if 'courseacademicprofile' in existing:
        _migrate_legacy_course_addons(bind)

    grant_saved_nav_items(bind, 'role_global_admin', ['addons'])


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
