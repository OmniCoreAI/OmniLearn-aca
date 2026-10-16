"""Entities (الجهات): entity records, positions, members, coordinators and groups.

Academy staff manage every entity through the ``entities`` rights bucket. An
**Entity Coordinator** (platform role 2 + ``EntityMember.is_coordinator``)
manages only their own entity, and only the capabilities the academy switched
on for it (``Entity.coordinator_permissions``) — see ``require_entity_access``.

Every entity owns a locked system user group with all of its active members
(``Entity.members_group_id``), so assigning a course "to the entity" reuses the
existing UserGroup → resource access mechanism.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional, Sequence
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlmodel import and_, delete, func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.entities import (
    CoordinatorAssign,
    CoordinatorPermissions,
    Entity,
    EntityCreate,
    EntityGroupCreate,
    EntityGroupRead,
    EntityGroupRef,
    EntityGroupUpdate,
    EntityMember,
    EntityMemberCreate,
    EntityMemberPage,
    EntityMemberRead,
    EntityMemberUpdate,
    EntityNewUser,
    EntityOption,
    EntityRead,
    EntityUpdate,
    Position,
    PositionCreate,
    PositionRead,
    PositionUpdate,
)
from src.db.administration.lookups import ConfigLookup, ConfigLookupOption, ConfigStatus, LookupKind
from src.db.organizations import Organization
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup, UserGroupType
from src.db.users import User, UserReadAuthor
from src.security.rbac.constants import (
    ACADEMY_ADMIN_ROLE_IDS,
    ENTITY_COORDINATOR_ROLE_ID,
    TRAINEE_ROLE_ID,
)
from src.security.superadmin import is_user_superadmin
from src.services.administration.authz import (
    Action,
    AnyUser,
    authorize_admin,
    get_membership,
    has_admin_permission,
    require_org_member,
    require_user_id,
)
from src.services.administration.common import (
    bad_request,
    conflict,
    get_by_uuid_or_404,
    get_org_or_404,
    make_code,
    now,
)
from src.services.administration.lookups import register_lookup_usage, resolve_lookup_id
from src.services.administration.overview import register_overview_counter
from src.services.utils.upload_content import upload_file

WHAT = "manage entities"
ENTITY_GROUP_TYPES = (UserGroupType.GENERAL.value, UserGroupType.DEPARTMENT.value)

register_lookup_usage(
    LookupKind.ENTITY_TYPE,
    lambda lookup_id: select(func.count(Entity.id)).where(Entity.entity_type_id == lookup_id),
)
register_overview_counter(
    "entities", lambda org_id: select(func.count(Entity.id)).where(Entity.org_id == org_id)
)
register_overview_counter(
    "positions", lambda org_id: select(func.count(Position.id)).where(Position.org_id == org_id)
)


# ---------------------------------------------------------------------------
# Access
# ---------------------------------------------------------------------------


@dataclass
class EntityAccess:
    user_id: int
    # Academy staff (superadmin, academy admin, or ``entities`` bucket).
    is_academy: bool
    # Set when the caller acts as the entity's coordinator.
    coordinator: Optional[EntityMember] = None


def coordinator_permissions(entity: Entity) -> CoordinatorPermissions:
    try:
        return CoordinatorPermissions(**(entity.coordinator_permissions or {}))
    except Exception:
        return CoordinatorPermissions()


async def _active_coordinator_row(
    db_session: AsyncSession, entity_id: int, user_id: int
) -> Optional[EntityMember]:
    return (
        await db_session.execute(
            select(EntityMember).where(
                EntityMember.entity_id == entity_id,
                EntityMember.user_id == user_id,
                EntityMember.is_coordinator == True,  # noqa: E712
                EntityMember.status == ConfigStatus.ACTIVE.value,
            )
        )
    ).scalars().first()


async def require_entity_access(
    db_session: AsyncSession,
    current_user: AnyUser,
    entity: Entity,
    capability: Optional[str] = None,
    action: Action = "read",
) -> EntityAccess:
    """Academy staff always pass; a coordinator passes for their own entity only.

    ``capability`` names a ``CoordinatorPermissions`` switch the coordinator
    needs for this operation (``None`` = read-only access to their entity).
    """
    user_id = require_user_id(current_user, WHAT)
    if await has_admin_permission(db_session, user_id, entity.org_id, "entities", action):
        return EntityAccess(user_id=user_id, is_academy=True)
    membership = await get_membership(db_session, user_id, entity.org_id)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this organization")
    if membership.role_id != ENTITY_COORDINATOR_ROLE_ID:
        raise HTTPException(status_code=403, detail=f"You don't have permission to {WHAT}")
    coordinator = await _active_coordinator_row(db_session, entity.id, user_id)
    if coordinator is None:
        raise HTTPException(status_code=403, detail="You are not a coordinator of this entity")
    if entity.status != ConfigStatus.ACTIVE.value:
        raise HTTPException(status_code=403, detail="This entity is inactive")
    if capability and not getattr(coordinator_permissions(entity), capability, False):
        raise HTTPException(
            status_code=403, detail="The academy has not enabled this for your entity"
        )
    return EntityAccess(user_id=user_id, is_academy=False, coordinator=coordinator)


async def get_entity_by_uuid(db_session: AsyncSession, entity_uuid: str) -> Entity:
    return await get_by_uuid_or_404(db_session, Entity, Entity.entity_uuid, entity_uuid, "Entity")


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def _author(user: User) -> UserReadAuthor:
    return UserReadAuthor.model_validate(user, from_attributes=True)


async def _lookup_option(db_session: AsyncSession, lookup_id: Optional[int]) -> Optional[ConfigLookupOption]:
    if not lookup_id:
        return None
    lookup = await db_session.get(ConfigLookup, lookup_id)
    if not lookup:
        return None
    return ConfigLookupOption(
        id=lookup.id,
        lookup_uuid=lookup.lookup_uuid,
        kind=lookup.kind,
        name=lookup.name,
        code=lookup.code,
        color=lookup.color,
    )


async def _entity_read(
    db_session: AsyncSession, entity: Entity, viewer_is_coordinator: bool = False
) -> EntityRead:
    parent = await db_session.get(Entity, entity.parent_id) if entity.parent_id else None
    members_group = (
        await db_session.get(UserGroup, entity.members_group_id) if entity.members_group_id else None
    )
    member_count = (
        await db_session.execute(
            select(func.count(EntityMember.id)).where(
                EntityMember.entity_id == entity.id,
                EntityMember.status == ConfigStatus.ACTIVE.value,
            )
        )
    ).scalar() or 0
    group_count = (
        await db_session.execute(
            select(func.count(UserGroup.id)).where(
                UserGroup.entity_id == entity.id,
                UserGroup.group_type != UserGroupType.SYSTEM.value,
            )
        )
    ).scalar() or 0
    from src.db.administration.audience import AudienceAssignment, AudienceType

    learning_count = (
        await db_session.execute(
            select(func.count(func.distinct(AudienceAssignment.resource_uuid))).where(
                AudienceAssignment.org_id == entity.org_id,
                or_(
                    AudienceAssignment.entity_id == entity.id,
                    and_(
                        AudienceAssignment.audience_type == AudienceType.ENTITY.value,
                        AudienceAssignment.audience_id == entity.id,
                    ),
                ),
            )
        )
    ).scalar() or 0
    coordinators = (
        await db_session.execute(
            select(User)
            .join(EntityMember, EntityMember.user_id == User.id)  # type: ignore[arg-type]
            .where(EntityMember.entity_id == entity.id, EntityMember.is_coordinator == True)  # noqa: E712
            .order_by(User.first_name)
        )
    ).scalars().all()
    data = entity.model_dump(exclude={"coordinator_permissions"})
    return EntityRead(
        **data,
        entity_type=await _lookup_option(db_session, entity.entity_type_id),
        parent_uuid=parent.entity_uuid if parent else None,
        parent_name=parent.name if parent else None,
        coordinator_permissions=coordinator_permissions(entity),
        members_group_uuid=members_group.usergroup_uuid if members_group else None,
        member_count=int(member_count),
        group_count=int(group_count),
        learning_count=int(learning_count),
        coordinators=[_author(u) for u in coordinators],
        viewer_is_coordinator=viewer_is_coordinator,
    )


async def _resolve_parent_id(
    db_session: AsyncSession, org_id: int, parent_uuid: Optional[str], self_id: Optional[int] = None
) -> Optional[int]:
    if not parent_uuid:
        return None
    parent = await get_entity_by_uuid(db_session, parent_uuid)
    if parent.org_id != org_id:
        raise bad_request("Parent entity belongs to a different organization")
    if self_id is not None:
        # Walk up to reject cycles.
        cursor: Optional[Entity] = parent
        while cursor is not None:
            if cursor.id == self_id:
                raise bad_request("An entity cannot be its own parent")
            cursor = await db_session.get(Entity, cursor.parent_id) if cursor.parent_id else None
    return parent.id


async def _ensure_unique_code(db_session: AsyncSession, org_id: int, code: str, self_id: Optional[int] = None) -> None:
    stmt = select(Entity.id).where(Entity.org_id == org_id, Entity.code == code)
    if self_id is not None:
        stmt = stmt.where(Entity.id != self_id)
    if (await db_session.execute(stmt)).first():
        raise conflict(f"Another entity already uses the code '{code}'")


# ---------------------------------------------------------------------------
# Entities (academy)
# ---------------------------------------------------------------------------


async def list_entities(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    q: Optional[str] = None,
    status: Optional[str] = None,
    entity_type_uuid: Optional[str] = None,
) -> List[EntityRead]:
    await authorize_admin(db_session, current_user, org_id, "entities", "read", WHAT)
    stmt = select(Entity).where(Entity.org_id == org_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Entity.name.ilike(like), Entity.name_ar.ilike(like), Entity.code.ilike(like)))  # type: ignore[union-attr]
    if status:
        stmt = stmt.where(Entity.status == status)
    if entity_type_uuid:
        type_id = await resolve_lookup_id(db_session, org_id, LookupKind.ENTITY_TYPE, entity_type_uuid)
        stmt = stmt.where(Entity.entity_type_id == type_id)
    rows = (await db_session.execute(stmt.order_by(Entity.name))).scalars().all()
    return [await _entity_read(db_session, e) for e in rows]


async def entity_options(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[EntityOption]:
    await require_org_member(db_session, current_user, org_id)
    rows = (
        await db_session.execute(
            select(Entity)
            .where(Entity.org_id == org_id, Entity.status == ConfigStatus.ACTIVE.value)
            .order_by(Entity.name)
        )
    ).scalars().all()
    return [EntityOption(entity_uuid=e.entity_uuid, name=e.name, code=e.code) for e in rows]


async def list_my_entities(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[EntityRead]:
    """Entities the caller coordinates (drives the "My entity" portal)."""
    user_id = await require_org_member(db_session, current_user, org_id)
    membership = await get_membership(db_session, user_id, org_id)
    if not membership or membership.role_id != ENTITY_COORDINATOR_ROLE_ID:
        return []
    rows = (
        await db_session.execute(
            select(Entity)
            .join(EntityMember, EntityMember.entity_id == Entity.id)  # type: ignore[arg-type]
            .where(
                Entity.org_id == org_id,
                Entity.status == ConfigStatus.ACTIVE.value,
                EntityMember.user_id == user_id,
                EntityMember.is_coordinator == True,  # noqa: E712
                EntityMember.status == ConfigStatus.ACTIVE.value,
            )
            .order_by(Entity.name)
        )
    ).scalars().all()
    return [await _entity_read(db_session, e, viewer_is_coordinator=True) for e in rows]


async def get_entity(db_session: AsyncSession, current_user: AnyUser, entity_uuid: str) -> EntityRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    access = await require_entity_access(db_session, current_user, entity)
    return await _entity_read(db_session, entity, viewer_is_coordinator=not access.is_academy)


async def _create_members_group(db_session: AsyncSession, entity: Entity) -> UserGroup:
    group = UserGroup(
        name=f"{entity.name} — all members",
        description="Maintained automatically: every active member of this entity.",
        org_id=entity.org_id,
        entity_id=entity.id,
        group_type=UserGroupType.SYSTEM.value,
        status="active",
        managed_key=f"entity:{entity.entity_uuid}",
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(group)
    await db_session.flush()
    return group


async def create_entity(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: EntityCreate
) -> EntityRead:
    await authorize_admin(db_session, current_user, org_id, "entities", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    code = make_code(payload.code, name)
    await _ensure_unique_code(db_session, org_id, code)
    data = payload.model_dump(
        exclude={"entity_type_uuid", "parent_uuid", "coordinator_permissions", "code", "name"}
    )
    entity = Entity(
        **data,
        name=name,
        code=code,
        org_id=org_id,
        entity_type_id=await resolve_lookup_id(db_session, org_id, LookupKind.ENTITY_TYPE, payload.entity_type_uuid),
        parent_id=await _resolve_parent_id(db_session, org_id, payload.parent_uuid),
        coordinator_permissions=(payload.coordinator_permissions or CoordinatorPermissions()).model_dump(),
        entity_uuid=f"entity_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(entity)
    await db_session.flush()
    group = await _create_members_group(db_session, entity)
    entity.members_group_id = group.id
    db_session.add(entity)
    await db_session.commit()
    await db_session.refresh(entity)
    return await _entity_read(db_session, entity)


async def update_entity(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, payload: EntityUpdate
) -> EntityRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await authorize_admin(db_session, current_user, entity.org_id, "entities", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    if "entity_type_uuid" in data:
        entity.entity_type_id = await resolve_lookup_id(
            db_session, entity.org_id, LookupKind.ENTITY_TYPE, data.pop("entity_type_uuid")
        )
    if "parent_uuid" in data:
        entity.parent_id = await _resolve_parent_id(db_session, entity.org_id, data.pop("parent_uuid"), entity.id)
    if "coordinator_permissions" in data:
        perms = data.pop("coordinator_permissions")
        entity.coordinator_permissions = CoordinatorPermissions(**(perms or {})).model_dump()
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise bad_request("Name is required")
    if "code" in data:
        data["code"] = make_code(data["code"], data.get("name") or entity.name)
        await _ensure_unique_code(db_session, entity.org_id, data["code"], entity.id)
    for key, value in data.items():
        setattr(entity, key, value)
    entity.update_date = now()
    if "name" in data and entity.members_group_id:
        group = await db_session.get(UserGroup, entity.members_group_id)
        if group:
            group.name = f"{entity.name} — all members"
            db_session.add(group)
    db_session.add(entity)
    await db_session.commit()
    await db_session.refresh(entity)
    return await _entity_read(db_session, entity)


async def upload_entity_logo(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, logo: UploadFile
) -> EntityRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await authorize_admin(db_session, current_user, entity.org_id, "entities", "update", WHAT)
    org = await db_session.get(Organization, entity.org_id)
    entity.logo = await upload_file(
        file=logo,
        directory=f"entities/{entity.entity_uuid}/logo",
        type_of_dir="orgs",
        uuid=org.org_uuid if org else "",
        allowed_types=["image"],
        filename_prefix="entity",
    )
    entity.update_date = now()
    db_session.add(entity)
    await db_session.commit()
    await db_session.refresh(entity)
    return await _entity_read(db_session, entity)


async def delete_entity(db_session: AsyncSession, current_user: AnyUser, entity_uuid: str) -> str:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await authorize_admin(db_session, current_user, entity.org_id, "entities", "delete", WHAT)
    from src.services.administration.audience import drop_group, forget_entity, sync_resources

    coordinator_ids = (
        await db_session.execute(
            select(EntityMember.user_id).where(
                EntityMember.entity_id == entity.id, EntityMember.is_coordinator == True  # noqa: E712
            )
        )
    ).scalars().all()
    # Audience links owned by the entity's groups disappear with the groups.
    dropped = await forget_entity(db_session, entity)
    groups = (
        await db_session.execute(select(UserGroup).where(UserGroup.entity_id == entity.id))
    ).scalars().all()
    for group in groups:
        if group.group_type == UserGroupType.SYSTEM.value:
            await drop_group(db_session, group)
        else:
            # Keep hand-made groups (and their course access); detach them.
            group.entity_id = None
            db_session.add(group)
    org_id = entity.org_id
    await db_session.execute(delete(EntityMember).where(EntityMember.entity_id == entity.id))
    await db_session.execute(delete(Position).where(Position.entity_id == entity.id))
    await db_session.delete(entity)
    await db_session.flush()
    for user_id in coordinator_ids:
        await _maybe_demote_coordinator(db_session, org_id, user_id)
    await db_session.commit()
    await sync_resources(db_session, dropped)
    return "Entity deleted"


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------


async def _position_read(db_session: AsyncSession, position: Position) -> PositionRead:
    entity = await db_session.get(Entity, position.entity_id) if position.entity_id else None
    member_count = (
        await db_session.execute(
            select(func.count(EntityMember.id)).where(
                EntityMember.position_id == position.id,
                EntityMember.status == ConfigStatus.ACTIVE.value,
            )
        )
    ).scalar() or 0
    return PositionRead(
        id=position.id,
        position_uuid=position.position_uuid,
        name=position.name,
        code=position.code,
        description=position.description,
        status=position.status,
        entity_uuid=entity.entity_uuid if entity else None,
        entity_name=entity.name if entity else None,
        member_count=int(member_count),
    )


async def list_positions(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    entity_uuid: Optional[str] = None,
    include_shared: bool = True,
) -> List[PositionRead]:
    stmt = select(Position).where(Position.org_id == org_id)
    if entity_uuid:
        entity = await get_entity_by_uuid(db_session, entity_uuid)
        if entity.org_id != org_id:
            raise bad_request("Entity belongs to a different organization")
        await require_entity_access(db_session, current_user, entity)
        cond = Position.entity_id == entity.id
        stmt = stmt.where(or_(cond, Position.entity_id.is_(None)) if include_shared else cond)  # type: ignore[union-attr]
    else:
        await authorize_admin(db_session, current_user, org_id, "entities", "read", WHAT)
    rows = (await db_session.execute(stmt.order_by(Position.name))).scalars().all()
    return [await _position_read(db_session, p) for p in rows]


async def create_position(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: PositionCreate
) -> PositionRead:
    await authorize_admin(db_session, current_user, org_id, "entities", "create", WHAT)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    entity_id = None
    if payload.entity_uuid:
        entity = await get_entity_by_uuid(db_session, payload.entity_uuid)
        if entity.org_id != org_id:
            raise bad_request("Entity belongs to a different organization")
        entity_id = entity.id
    position = Position(
        org_id=org_id,
        entity_id=entity_id,
        name=name,
        code=make_code(payload.code, name),
        description=payload.description,
        status=payload.status,
        position_uuid=f"position_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(position)
    await db_session.commit()
    await db_session.refresh(position)
    return await _position_read(db_session, position)


async def update_position(
    db_session: AsyncSession, current_user: AnyUser, position_uuid: str, payload: PositionUpdate
) -> PositionRead:
    position = await get_by_uuid_or_404(db_session, Position, Position.position_uuid, position_uuid, "Position")
    await authorize_admin(db_session, current_user, position.org_id, "entities", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise bad_request("Name is required")
    if "code" in data:
        data["code"] = make_code(data["code"], data.get("name") or position.name)
    status_changed = "status" in data and data["status"] != position.status
    for key, value in data.items():
        setattr(position, key, value)
    position.update_date = now()
    db_session.add(position)
    await db_session.commit()
    if status_changed:
        from src.services.administration.audience import resync_affected

        await resync_affected(db_session, position.org_id, position_ids=[position.id])
    await db_session.refresh(position)
    return await _position_read(db_session, position)


async def delete_position(db_session: AsyncSession, current_user: AnyUser, position_uuid: str) -> str:
    position = await get_by_uuid_or_404(db_session, Position, Position.position_uuid, position_uuid, "Position")
    await authorize_admin(db_session, current_user, position.org_id, "entities", "delete", WHAT)
    from src.services.administration.audience import forget_position, sync_resources

    dropped = await forget_position(db_session, position)
    await db_session.delete(position)
    await db_session.commit()
    await sync_resources(db_session, dropped)
    return "Position deleted"


async def _resolve_position_id(
    db_session: AsyncSession, entity: Entity, position_uuid: Optional[str]
) -> Optional[int]:
    if not position_uuid:
        return None
    position = await get_by_uuid_or_404(db_session, Position, Position.position_uuid, position_uuid, "Position")
    if position.org_id != entity.org_id or (position.entity_id and position.entity_id != entity.id):
        raise bad_request("Position does not belong to this entity")
    return position.id


# ---------------------------------------------------------------------------
# Membership helpers (also used by the Excel import)
# ---------------------------------------------------------------------------


async def _group_ids_of_entity(db_session: AsyncSession, entity: Entity) -> List[int]:
    return list(
        (await db_session.execute(select(UserGroup.id).where(UserGroup.entity_id == entity.id))).scalars().all()
    )


async def _add_to_group(db_session: AsyncSession, group_id: int, org_id: int, user_id: int) -> bool:
    exists = (
        await db_session.execute(
            select(UserGroupUser.id).where(
                UserGroupUser.usergroup_id == group_id, UserGroupUser.user_id == user_id
            )
        )
    ).first()
    if exists:
        return False
    db_session.add(
        UserGroupUser(
            usergroup_id=group_id,
            user_id=user_id,
            org_id=org_id,
            creation_date=now(),
            update_date=now(),
        )
    )
    return True


async def _remove_from_groups(db_session: AsyncSession, group_ids: Sequence[int], user_id: int) -> None:
    if group_ids:
        await db_session.execute(
            delete(UserGroupUser).where(
                UserGroupUser.usergroup_id.in_(list(group_ids)),  # type: ignore[attr-defined]
                UserGroupUser.user_id == user_id,
            )
        )


async def _ensure_members_group(db_session: AsyncSession, entity: Entity) -> int:
    if entity.members_group_id and await db_session.get(UserGroup, entity.members_group_id):
        return entity.members_group_id
    group = await _create_members_group(db_session, entity)
    entity.members_group_id = group.id
    db_session.add(entity)
    return group.id  # type: ignore[return-value]


async def _entity_group_or_404(db_session: AsyncSession, entity: Entity, usergroup_uuid: str) -> UserGroup:
    group = await get_by_uuid_or_404(db_session, UserGroup, UserGroup.usergroup_uuid, usergroup_uuid, "Group")
    if group.entity_id != entity.id:
        raise HTTPException(status_code=404, detail="Group not found in this entity")
    return group


async def _find_or_create_user(
    db_session: AsyncSession,
    org_id: int,
    new_user: EntityNewUser,
    role_id: int,
) -> tuple[User, Optional[str]]:
    """Reuse an org member with this email, or create a new account.

    Returns ``(user, temporary_password)`` — the password only for new accounts.
    """
    email = (new_user.email or "").strip().lower()
    if "@" not in email or not (new_user.first_name or "").strip():
        raise bad_request("First name and a valid email are required")
    existing = (await db_session.execute(select(User).where(func.lower(User.email) == email))).scalars().first()
    if existing is not None:
        if not await get_membership(db_session, existing.id, org_id):
            # SECURITY: same generic message as signup to avoid enumeration.
            raise bad_request("Email or username is already in use")
        return existing, None
    from src.services.orgs.users import provision_org_user

    phone = (new_user.phone or "").strip()
    user, temporary_password = await provision_org_user(
        db_session,
        org_id,
        email=email,
        first_name=new_user.first_name.strip(),
        last_name=(new_user.last_name or "").strip(),
        role_id=role_id,
        extra_metadata={"phone": phone} if phone else None,
        signup_method="entity_member",
    )
    return user, temporary_password


async def upsert_member(
    db_session: AsyncSession,
    entity: Entity,
    user: User,
    *,
    position_id: Optional[int] = None,
    employee_id: Optional[str] = None,
    group_ids: Iterable[int] = (),
    is_coordinator: Optional[bool] = None,
) -> tuple[EntityMember, bool]:
    """Create or update a membership and keep group rows in sync (no commit).

    Returns ``(member, created)``.
    """
    employee_id = (employee_id or "").strip() or None
    if employee_id:
        clash = (
            await db_session.execute(
                select(EntityMember.id).where(
                    EntityMember.entity_id == entity.id,
                    EntityMember.employee_id == employee_id,
                    EntityMember.user_id != user.id,
                )
            )
        ).first()
        if clash:
            raise conflict(f"Employee ID '{employee_id}' is already used in this entity")
    member = (
        await db_session.execute(
            select(EntityMember).where(EntityMember.entity_id == entity.id, EntityMember.user_id == user.id)
        )
    ).scalars().first()
    created = member is None
    if member is None:
        member = EntityMember(
            org_id=entity.org_id,
            entity_id=entity.id,
            user_id=user.id,
            member_uuid=f"entitymember_{uuid4()}",
            creation_date=now(),
        )
    if position_id is not None:
        member.position_id = position_id
    if employee_id is not None:
        member.employee_id = employee_id
    if is_coordinator is not None:
        member.is_coordinator = is_coordinator
    member.status = ConfigStatus.ACTIVE
    member.update_date = now()
    db_session.add(member)
    members_group_id = await _ensure_members_group(db_session, entity)
    if member.is_coordinator:
        # Coordinators manage the entity's learning; they aren't learners in
        # it, so entity-wide assignments must not enroll them.
        await _remove_from_groups(db_session, [members_group_id], user.id)
    else:
        await _add_to_group(db_session, members_group_id, entity.org_id, user.id)
    for group_id in group_ids:
        await _add_to_group(db_session, group_id, entity.org_id, user.id)
    await db_session.flush()
    return member, created


async def _member_read(
    db_session: AsyncSession,
    member: EntityMember,
    user: Optional[User] = None,
    temporary_password: Optional[str] = None,
) -> EntityMemberRead:
    user = user or await db_session.get(User, member.user_id)
    position = await db_session.get(Position, member.position_id) if member.position_id else None
    groups = (
        await db_session.execute(
            select(UserGroup)
            .join(UserGroupUser, UserGroupUser.usergroup_id == UserGroup.id)  # type: ignore[arg-type]
            .where(
                UserGroupUser.user_id == member.user_id,
                UserGroup.entity_id == member.entity_id,
                UserGroup.group_type != UserGroupType.SYSTEM.value,
            )
            .order_by(UserGroup.name)
        )
    ).scalars().all()
    return EntityMemberRead(
        member_uuid=member.member_uuid,
        user=_author(user),
        email=user.email if user else None,
        position_uuid=position.position_uuid if position else None,
        position_name=position.name if position else None,
        employee_id=member.employee_id,
        is_coordinator=member.is_coordinator,
        status=member.status,
        groups=[EntityGroupRef(usergroup_uuid=g.usergroup_uuid, name=g.name) for g in groups],
        creation_date=member.creation_date,
        temporary_password=temporary_password,
    )


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


async def list_members(
    db_session: AsyncSession,
    current_user: AnyUser,
    entity_uuid: str,
    q: Optional[str] = None,
    status: Optional[str] = None,
    position_uuid: Optional[str] = None,
    group_uuid: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> EntityMemberPage:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity)
    page = max(1, page)
    limit = max(1, min(limit, 200))
    stmt = (
        select(EntityMember, User)
        .join(User, User.id == EntityMember.user_id)  # type: ignore[arg-type]
        .where(EntityMember.entity_id == entity.id)
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.first_name.ilike(like),  # type: ignore[union-attr]
                User.last_name.ilike(like),  # type: ignore[union-attr]
                User.email.ilike(like),  # type: ignore[union-attr]
                User.username.ilike(like),  # type: ignore[union-attr]
                EntityMember.employee_id.ilike(like),  # type: ignore[union-attr]
            )
        )
    if status:
        stmt = stmt.where(EntityMember.status == status)
    if position_uuid:
        position_id = await _resolve_position_id(db_session, entity, position_uuid)
        stmt = stmt.where(EntityMember.position_id == position_id)
    if group_uuid:
        group = await _entity_group_or_404(db_session, entity, group_uuid)
        stmt = stmt.where(
            EntityMember.user_id.in_(  # type: ignore[attr-defined]
                select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == group.id)
            )
        )
    total = (await db_session.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
    rows = (
        await db_session.execute(
            stmt.order_by(User.first_name, User.last_name).offset((page - 1) * limit).limit(limit)
        )
    ).all()
    items = [await _member_read(db_session, member, user) for member, user in rows]
    return EntityMemberPage(items=items, total=int(total), page=page, limit=limit)


async def add_member(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, payload: EntityMemberCreate
) -> EntityMemberRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    access = await require_entity_access(db_session, current_user, entity, "can_manage_members", "create")
    temporary_password = None
    if payload.user_uuid:
        # Picking any org user is an academy-staff tool; coordinators add by email.
        if not access.is_academy:
            raise HTTPException(status_code=403, detail="Add members by email")
        user = await get_by_uuid_or_404(db_session, User, User.user_uuid, payload.user_uuid, "User")
        if not await get_membership(db_session, user.id, entity.org_id):
            raise bad_request("User is not a member of this organization")
    elif payload.new_user is not None:
        user, temporary_password = await _find_or_create_user(
            db_session, entity.org_id, payload.new_user, TRAINEE_ROLE_ID
        )
    else:
        raise bad_request("Choose an existing user or enter a new user's details")
    group_ids = [
        (await _entity_group_or_404(db_session, entity, g)).id for g in payload.group_uuids
    ]
    for gid in group_ids:
        group = await db_session.get(UserGroup, gid)
        if group and group.group_type == UserGroupType.SYSTEM.value:
            raise bad_request("System groups are maintained automatically")
    member, _created = await upsert_member(
        db_session,
        entity,
        user,
        position_id=await _resolve_position_id(db_session, entity, payload.position_uuid),
        employee_id=payload.employee_id,
        group_ids=group_ids,
    )
    await db_session.commit()
    await db_session.refresh(member)
    from src.services.administration.audience import resync_affected

    await resync_affected(db_session, entity.org_id, entity_ids=[entity.id], user_ids=[user.id])
    return await _member_read(db_session, member, user, temporary_password)


async def _member_or_404(db_session: AsyncSession, entity: Entity, member_uuid: str) -> EntityMember:
    member = await get_by_uuid_or_404(
        db_session, EntityMember, EntityMember.member_uuid, member_uuid, "Member"
    )
    if member.entity_id != entity.id:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


async def update_member(
    db_session: AsyncSession,
    current_user: AnyUser,
    entity_uuid: str,
    member_uuid: str,
    payload: EntityMemberUpdate,
) -> EntityMemberRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    access = await require_entity_access(db_session, current_user, entity, "can_manage_members", "update")
    member = await _member_or_404(db_session, entity, member_uuid)
    data = payload.model_dump(exclude_unset=True)
    if "position_uuid" in data:
        member.position_id = await _resolve_position_id(db_session, entity, data["position_uuid"])
    if "employee_id" in data:
        employee_id = (data["employee_id"] or "").strip() or None
        if employee_id:
            clash = (
                await db_session.execute(
                    select(EntityMember.id).where(
                        EntityMember.entity_id == entity.id,
                        EntityMember.employee_id == employee_id,
                        EntityMember.id != member.id,
                    )
                )
            ).first()
            if clash:
                raise conflict(f"Employee ID '{employee_id}' is already used in this entity")
        member.employee_id = employee_id
    if data.get("status") is not None and data["status"] != member.status:
        if member.is_coordinator and not access.is_academy:
            raise HTTPException(status_code=403, detail="Only the academy can deactivate a coordinator")
        member.status = data["status"]
        if member.status == ConfigStatus.ACTIVE.value:
            if not member.is_coordinator:
                await _add_to_group(
                    db_session, await _ensure_members_group(db_session, entity), entity.org_id, member.user_id
                )
        else:
            # Inactive members lose every entity-granted access.
            await _remove_from_groups(db_session, await _group_ids_of_entity(db_session, entity), member.user_id)
    member.update_date = now()
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(member)
    from src.services.administration.audience import resync_affected

    await resync_affected(db_session, entity.org_id, entity_ids=[entity.id], user_ids=[member.user_id])
    return await _member_read(db_session, member)


async def remove_member(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, member_uuid: str
) -> str:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    access = await require_entity_access(db_session, current_user, entity, "can_manage_members", "delete")
    member = await _member_or_404(db_session, entity, member_uuid)
    if member.is_coordinator and not access.is_academy:
        raise HTTPException(status_code=403, detail="Only the academy can remove a coordinator")
    user_id = member.user_id
    await _remove_from_groups(db_session, await _group_ids_of_entity(db_session, entity), user_id)
    was_coordinator = member.is_coordinator
    await db_session.delete(member)
    await db_session.flush()
    if was_coordinator:
        await _maybe_demote_coordinator(db_session, entity.org_id, user_id)
    await db_session.commit()
    from src.services.administration.audience import resync_affected

    await resync_affected(db_session, entity.org_id, entity_ids=[entity.id], user_ids=[user_id])
    return "Member removed"


# ---------------------------------------------------------------------------
# Coordinators (academy only)
# ---------------------------------------------------------------------------


async def _promote_to_coordinator(db_session: AsyncSession, org_id: int, user_id: int) -> None:
    if await is_user_superadmin(user_id, db_session):
        return
    membership = await get_membership(db_session, user_id, org_id)
    if membership is None:
        raise bad_request("User is not a member of this organization")
    if membership.role_id in ACADEMY_ADMIN_ROLE_IDS or membership.role_id == ENTITY_COORDINATOR_ROLE_ID:
        return
    if membership.role_id != TRAINEE_ROLE_ID:
        raise conflict(
            "This user already has another staff role. Change it to Trainee first, "
            "or choose a different coordinator."
        )
    membership.role_id = ENTITY_COORDINATOR_ROLE_ID
    membership.update_date = str(datetime.now())
    db_session.add(membership)


async def _maybe_demote_coordinator(db_session: AsyncSession, org_id: int, user_id: int) -> None:
    """Return a coordinator who no longer coordinates any entity to Trainee."""
    still = (
        await db_session.execute(
            select(EntityMember.id)
            .join(Entity, Entity.id == EntityMember.entity_id)  # type: ignore[arg-type]
            .where(
                EntityMember.user_id == user_id,
                EntityMember.is_coordinator == True,  # noqa: E712
                Entity.org_id == org_id,
            )
        )
    ).first()
    if still:
        return
    membership = await get_membership(db_session, user_id, org_id)
    if membership and membership.role_id == ENTITY_COORDINATOR_ROLE_ID:
        membership.role_id = TRAINEE_ROLE_ID
        membership.update_date = str(datetime.now())
        db_session.add(membership)


async def assign_coordinator(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, payload: CoordinatorAssign
) -> EntityMemberRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await authorize_admin(db_session, current_user, entity.org_id, "entities", "update", WHAT)
    temporary_password = None
    if payload.user_uuid:
        user = await get_by_uuid_or_404(db_session, User, User.user_uuid, payload.user_uuid, "User")
    elif payload.new_user is not None:
        user, temporary_password = await _find_or_create_user(
            db_session, entity.org_id, payload.new_user, ENTITY_COORDINATOR_ROLE_ID
        )
    else:
        raise bad_request("Choose an existing user or enter a new user's details")
    already = (
        await db_session.execute(
            select(EntityMember.is_coordinator).where(EntityMember.entity_id == entity.id, EntityMember.user_id == user.id)
        )
    ).scalars().first()
    await _promote_to_coordinator(db_session, entity.org_id, user.id)
    member, _ = await upsert_member(db_session, entity, user, is_coordinator=True)
    await db_session.commit()
    await db_session.refresh(member)
    from src.services.administration.audience import resync_affected

    await resync_affected(db_session, entity.org_id, entity_ids=[entity.id], user_ids=[user.id])
    if not already:
        from src.services.notifications.assignments import staff_assigned

        await staff_assigned(
            db_session, entity.org_id, [user.id], "entity_coordinator", entity.name, "/dash/my-entity",
            actor_id=getattr(current_user, "id", None), resource=("entity", entity.entity_uuid),
        )
        await db_session.refresh(member)
    return await _member_read(db_session, member, user, temporary_password)


async def remove_coordinator(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, member_uuid: str
) -> EntityMemberRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await authorize_admin(db_session, current_user, entity.org_id, "entities", "update", WHAT)
    if member_uuid.startswith("user_"):
        # Coordinators are listed by user on the entity read.
        member = (
            await db_session.execute(
                select(EntityMember)
                .join(User, User.id == EntityMember.user_id)  # type: ignore[arg-type]
                .where(EntityMember.entity_id == entity.id, User.user_uuid == member_uuid)
            )
        ).scalars().first()
        if member is None:
            raise HTTPException(status_code=404, detail="Member not found")
    else:
        member = await _member_or_404(db_session, entity, member_uuid)
    member.is_coordinator = False
    member.update_date = now()
    db_session.add(member)
    if member.status == ConfigStatus.ACTIVE.value:
        # Back to a regular member: entity-wide learning applies again.
        await _add_to_group(db_session, await _ensure_members_group(db_session, entity), entity.org_id, member.user_id)
    await db_session.flush()
    await _maybe_demote_coordinator(db_session, entity.org_id, member.user_id)
    await db_session.commit()
    await db_session.refresh(member)
    from src.services.administration.audience import resync_affected

    await resync_affected(db_session, entity.org_id, entity_ids=[entity.id], user_ids=[member.user_id])
    return await _member_read(db_session, member)


# ---------------------------------------------------------------------------
# Groups inside an entity
# ---------------------------------------------------------------------------


async def _group_read(db_session: AsyncSession, group: UserGroup) -> EntityGroupRead:
    count = (
        await db_session.execute(
            select(func.count(UserGroupUser.id)).where(UserGroupUser.usergroup_id == group.id)
        )
    ).scalar() or 0
    return EntityGroupRead(
        usergroup_uuid=group.usergroup_uuid,
        id=group.id,
        name=group.name,
        description=group.description or "",
        group_type=group.group_type,
        status=group.status,
        member_count=int(count),
        managed=group.group_type == UserGroupType.SYSTEM.value or bool(group.managed_key),
    )


def _clean_group_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if value not in ENTITY_GROUP_TYPES:
        raise bad_request("Group type must be 'general' or 'department'")
    return value


async def list_entity_groups(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str
) -> List[EntityGroupRead]:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity)
    rows = (
        await db_session.execute(
            select(UserGroup)
            .where(UserGroup.entity_id == entity.id)
            .order_by(UserGroup.group_type.desc(), UserGroup.name)  # type: ignore[union-attr]
        )
    ).scalars().all()
    return [await _group_read(db_session, g) for g in rows]


async def create_entity_group(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, payload: EntityGroupCreate
) -> EntityGroupRead:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity, "can_manage_groups", "create")
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    group = UserGroup(
        name=name,
        description=payload.description or "",
        org_id=entity.org_id,
        entity_id=entity.id,
        group_type=_clean_group_type(payload.group_type) or UserGroupType.GENERAL.value,
        status="active",
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    return await _group_read(db_session, group)


async def _editable_entity_group(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, usergroup_uuid: str, action: Action
) -> tuple[Entity, UserGroup]:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity, "can_manage_groups", action)
    group = await _entity_group_or_404(db_session, entity, usergroup_uuid)
    if group.group_type == UserGroupType.SYSTEM.value or group.managed_key:
        raise conflict("This group is maintained automatically and cannot be changed by hand")
    return entity, group


async def update_entity_group(
    db_session: AsyncSession,
    current_user: AnyUser,
    entity_uuid: str,
    usergroup_uuid: str,
    payload: EntityGroupUpdate,
) -> EntityGroupRead:
    _entity, group = await _editable_entity_group(db_session, current_user, entity_uuid, usergroup_uuid, "update")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise bad_request("Name is required")
        group.name = name
    if "description" in data:
        group.description = data["description"] or ""
    if "group_type" in data:
        group.group_type = _clean_group_type(data["group_type"]) or group.group_type
    if data.get("status") is not None:
        status = data["status"].value if hasattr(data["status"], "value") else data["status"]
        group.status = status
    group.update_date = now()
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    return await _group_read(db_session, group)


async def delete_entity_group(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, usergroup_uuid: str
) -> str:
    entity, group = await _editable_entity_group(db_session, current_user, entity_uuid, usergroup_uuid, "delete")
    from src.services.administration.audience import forget_usergroup

    await forget_usergroup(db_session, group)
    await db_session.delete(group)
    await db_session.commit()
    return "Group deleted"


async def set_entity_group_members(
    db_session: AsyncSession,
    current_user: AnyUser,
    entity_uuid: str,
    usergroup_uuid: str,
    member_uuids: List[str],
) -> EntityGroupRead:
    """Replace a group's members with the given entity members."""
    entity, group = await _editable_entity_group(db_session, current_user, entity_uuid, usergroup_uuid, "update")
    wanted: set[int] = set()
    if member_uuids:
        rows = (
            await db_session.execute(
                select(EntityMember).where(
                    EntityMember.entity_id == entity.id,
                    EntityMember.member_uuid.in_(member_uuids),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
        if len(rows) != len(set(member_uuids)):
            raise bad_request("Some members do not belong to this entity")
        wanted = {m.user_id for m in rows if m.status == ConfigStatus.ACTIVE.value}
    current = set(
        (
            await db_session.execute(
                select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == group.id)
            )
        ).scalars().all()
    )
    removed = current - wanted
    if removed:
        await db_session.execute(
            delete(UserGroupUser).where(
                UserGroupUser.usergroup_id == group.id,
                UserGroupUser.user_id.in_(list(removed)),  # type: ignore[attr-defined]
            )
        )
    added = wanted - current
    for user_id in added:
        await _add_to_group(db_session, group.id, entity.org_id, user_id)
    group.update_date = now()
    db_session.add(group)
    await db_session.commit()
    if added:
        from src.services.administration.audience import resync_affected

        await resync_affected(db_session, entity.org_id, group_ids=[group.id])
    await db_session.refresh(group)
    return await _group_read(db_session, group)

