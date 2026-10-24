"""Entities, positions, members, audience assignment; role 2 → Entity Coordinator

- New tables ``entity``, ``entityposition``, ``entitymember`` and
  ``audienceassignment``.
- ``usergroup`` gains ``entity_id``, ``group_type`` (general | department |
  cohort | system), ``status`` and ``managed_key``; cohort / offering roster
  groups are backfilled as ``cohort``.
- ``instructor`` gains ``entity_id``.
- Role 2 (``role_global_maintainer``) becomes the **Entity Coordinator**: its
  rights are reset to Trainee rights + dashboard access (entity-scoped power
  comes from ``entitymember.is_coordinator``), and its saved sidebar override is
  reset to Home + My entity. Academy staff who held role 2 for academy-wide
  administration must be moved to role 1 (Academy Admin).

Revision ID: ad4e5f6a7b8c
Revises: ad3d4e5f6a7b
Create Date: 2026-09-27

"""
import json
import logging
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad4e5f6a7b8c'
down_revision: Union[str, None] = 'ad3d4e5f6a7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ['entity', 'entityposition', 'entitymember', 'audienceassignment']
COORDINATOR_NAV = ['home', 'my-entity']

logger = logging.getLogger("alembic.runtime.migration")


def _columns(bind, table: str) -> set:
    return {c['name'] for c in sa.inspect(bind).get_columns(table)}


def _reset_role_2(bind, existing: set) -> None:
    if 'role' not in existing:
        return
    trainee = bind.execute(sa.text("SELECT rights FROM role WHERE id = 4")).first()
    rights = trainee[0] if trainee else None
    if isinstance(rights, str):
        rights = json.loads(rights or "{}")
    if isinstance(rights, dict):
        rights = dict(rights)
        rights['dashboard'] = {'action_access': True}
        bind.execute(
            sa.text("UPDATE role SET rights = :rights WHERE id = 2"),
            {"rights": json.dumps(rights)},
        )
    bind.execute(
        sa.text(
            "UPDATE role SET name = 'Entity Coordinator', description = :description, "
            "update_date = :now WHERE id = 2"
        ),
        {
            "description": (
                "Manages their own entity (الجهة): adds and imports members, organizes them into "
                "groups, assigns the training the academy made available, and follows members' "
                "progress. Has no academy-wide administration rights."
            ),
            "now": str(datetime.now()),
        },
    )
    if 'userorganization' in existing:
        holders = bind.execute(sa.text("SELECT count(*) FROM userorganization WHERE role_id = 2")).scalar()
        if holders:
            logger.warning(
                "%s membership(s) hold role 2, which is now the entity-scoped Entity Coordinator. "
                "Move academy staff to role 1 (Academy Admin) and assign real coordinators to "
                "their entity under Administration → Entities.",
                holders,
            )


def upgrade() -> None:
    from sqlmodel import SQLModel
    from src.db.administration import audience, entities  # noqa: F401  (registers the tables)
    from src.security.rbac.nav_items import grant_saved_nav_items

    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for name in NEW_TABLES:
        if name not in existing:
            SQLModel.metadata.tables[name].create(bind, checkfirst=True)
    # use_alter FK (entity ↔ usergroup cycle) is not emitted by Table.create.
    fks = {fk['name'] for fk in sa.inspect(bind).get_foreign_keys('entity')}
    if 'fk_entity_members_group_id' not in fks:
        op.create_foreign_key(
            'fk_entity_members_group_id', 'entity', 'usergroup', ['members_group_id'], ['id'], ondelete='SET NULL'
        )

    if 'usergroup' in existing:
        cols = _columns(bind, 'usergroup')
        if 'entity_id' not in cols:
            op.add_column(
                'usergroup',
                sa.Column('entity_id', sa.Integer(), sa.ForeignKey('entity.id', ondelete='SET NULL'), nullable=True),
            )
            op.create_index('ix_usergroup_entity_id', 'usergroup', ['entity_id'])
        if 'group_type' not in cols:
            op.add_column(
                'usergroup',
                sa.Column('group_type', sa.String(length=16), nullable=False, server_default='general'),
            )
        if 'status' not in cols:
            op.add_column(
                'usergroup',
                sa.Column('status', sa.String(length=16), nullable=False, server_default='active'),
            )
        if 'managed_key' not in cols:
            op.add_column('usergroup', sa.Column('managed_key', sa.String(), nullable=True))
            op.create_index('ix_usergroup_managed_key', 'usergroup', ['managed_key'])
        for owner in ('cohort', 'courseoffering'):
            if owner in existing and 'usergroup_id' in _columns(bind, owner):
                bind.execute(
                    sa.text(
                        f"UPDATE usergroup SET group_type = 'cohort' WHERE group_type = 'general' "
                        f"AND id IN (SELECT usergroup_id FROM {owner} WHERE usergroup_id IS NOT NULL)"
                    )
                )

    if 'instructor' in existing and 'entity_id' not in _columns(bind, 'instructor'):
        op.add_column(
            'instructor',
            sa.Column('entity_id', sa.Integer(), sa.ForeignKey('entity.id', ondelete='SET NULL'), nullable=True),
        )
        op.create_index('ix_instructor_entity_id', 'instructor', ['entity_id'])

    _reset_role_2(bind, existing)

    if 'portal_role_nav_config' in existing:
        bind.execute(
            sa.text("UPDATE portal_role_nav_config SET visible_items = :items WHERE role_uuid = 'role_global_maintainer'"),
            {"items": json.dumps(COORDINATOR_NAV)},
        )
    grant_saved_nav_items(bind, 'role_global_admin', ['entities'])


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    if 'instructor' in existing and 'entity_id' in _columns(bind, 'instructor'):
        op.drop_index('ix_instructor_entity_id', table_name='instructor')
        op.drop_column('instructor', 'entity_id')
    if 'usergroup' in existing:
        cols = _columns(bind, 'usergroup')
        # Automatically maintained groups have no meaning without the new tables.
        if 'managed_key' in cols:
            bind.execute(sa.text("DELETE FROM usergroup WHERE managed_key IS NOT NULL"))
            op.drop_index('ix_usergroup_managed_key', table_name='usergroup')
            op.drop_column('usergroup', 'managed_key')
        if 'entity_id' in cols:
            op.drop_index('ix_usergroup_entity_id', table_name='usergroup')
            op.drop_column('usergroup', 'entity_id')
        for col in ('status', 'group_type'):
            if col in cols:
                op.drop_column('usergroup', col)
    if 'entity' in existing:
        fks = {fk['name'] for fk in sa.inspect(bind).get_foreign_keys('entity')}
        if 'fk_entity_members_group_id' in fks:
            op.drop_constraint('fk_entity_members_group_id', 'entity', type_='foreignkey')
    for name in reversed(NEW_TABLES):
        if name in existing:
            op.drop_table(name)
    if 'role' in existing:
        # Rights are not restored; re-run the role seed if needed.
        bind.execute(sa.text("UPDATE role SET name = 'Organization Coordinator' WHERE id = 2"))
