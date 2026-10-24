"""Audience assignment: who a course / training program is assigned to.

Assignments are *materialized* into the existing access mechanism
(``UserGroup`` + ``UserGroupResource``) — nothing else in the platform needs to
know about them:

- usergroup → that group is linked to the resource;
- cohort → the cohort's roster group is linked;
- entity → the entity's "all members" system group is linked;
- position / user → collected into one locked system group per resource
  (``managed_key = "audience:<type>:<uuid>"``) which is linked.

A training program links the groups to the program *and* to each of its
courses. ``mode = available`` grants nothing: it lets that entity's coordinator
assign the resource to their own groups, positions or members.

``sync_resource_audience`` is idempotent and is re-run whenever assignments,
entity members, positions or group memberships change.
"""
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import delete, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.cohorts import Cohort
from src.db.academic.links import TrainingProgramCourse
from src.db.academic.training_programs import TrainingProgram
from src.db.administration.audience import (
    AudienceAssignment,
    AudienceAssignmentCreate,
    AudienceAssignmentRead,
    AudienceMode,
    AudienceOption,
    AudienceResourceType,
    AudienceSyncResult,
    AudienceType,
    AvailableResourceRead,
    LegacyGroupLink,
    ResourceAudienceRead,
)
from src.db.administration.entities import Entity, EntityMember, Position
from src.db.administration.lookups import ConfigStatus
from src.db.courses.courses import Course
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup, UserGroupType
from src.db.users import User
from src.services.administration.authz import (
    AnyUser,
    authorize_admin,
    has_admin_permission,
    require_user_id,
)
from src.services.administration.common import bad_request, conflict, get_by_uuid_or_404, now
from src.services.administration.entities import get_entity_by_uuid, require_entity_access

WHAT = "assign learning"
PERSON_TYPES = (AudienceType.POSITION.value, AudienceType.USER.value)
Key = Tuple[str, str]

# ---------------------------------------------------------------------------
# Listeners (Phase 5 notifications register "course_assigned" here)
# ---------------------------------------------------------------------------

AudienceListener = Callable[[AsyncSession, int, str, str, List[int]], Awaitable[None]]
_LISTENERS: List[AudienceListener] = []


def register_audience_listener(listener: AudienceListener) -> None:
    """Called with (db, org_id, resource_type, resource_uuid, user_ids) for newly covered users."""
    if listener not in _LISTENERS:
        _LISTENERS.append(listener)


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------


@dataclass
class ResourceInfo:
    resource_type: str
    uuid: str
    org_id: int
    name: str
    published: bool
    # Resource uuids that get the group links (a program + its courses).
    targets: List[str] = field(default_factory=list)
    courses: List[Course] = field(default_factory=list)


async def _resource_info(
    db_session: AsyncSession, resource_type: str, resource_uuid: str, required: bool = True
) -> Optional[ResourceInfo]:
    if resource_type == AudienceResourceType.COURSE.value:
        course = (
            await db_session.execute(select(Course).where(Course.course_uuid == resource_uuid))
        ).scalars().first()
        if course is None:
            if required:
                raise HTTPException(status_code=404, detail="Course not found")
            return None
        return ResourceInfo(
            resource_type=resource_type,
            uuid=resource_uuid,
            org_id=course.org_id,
            name=course.name,
            published=bool(course.published),
            targets=[course.course_uuid],
            courses=[course],
        )
    if resource_type == AudienceResourceType.TRAINING_PROGRAM.value:
        tp = (
            await db_session.execute(
                select(TrainingProgram).where(TrainingProgram.trainingprogram_uuid == resource_uuid)
            )
        ).scalars().first()
        if tp is None:
            if required:
                raise HTTPException(status_code=404, detail="Training program not found")
            return None
        courses = list(
            (
                await db_session.execute(
                    select(Course)
                    .join(TrainingProgramCourse, TrainingProgramCourse.course_id == Course.id)  # type: ignore[arg-type]
                    .where(TrainingProgramCourse.training_program_id == tp.id)
                    .order_by(TrainingProgramCourse.order)
                )
            ).scalars().all()
        )
        return ResourceInfo(
            resource_type=resource_type,
            uuid=resource_uuid,
            org_id=tp.org_id,
            name=tp.name,
            published=bool(getattr(tp, "published", True)),
            targets=[tp.trainingprogram_uuid] + [c.course_uuid for c in courses],
            courses=courses,
        )
    raise bad_request("Unsupported resource type")


def _managed_key(resource_type: str, resource_uuid: str) -> str:
    return f"audience:{resource_type}:{resource_uuid}"


async def _assignments(
    db_session: AsyncSession, resource_type: str, resource_uuid: str, mode: Optional[str] = AudienceMode.ASSIGNED.value
) -> List[AudienceAssignment]:
    stmt = select(AudienceAssignment).where(
        AudienceAssignment.resource_type == resource_type,
        AudienceAssignment.resource_uuid == resource_uuid,
    )
    if mode:
        stmt = stmt.where(AudienceAssignment.mode == mode)
    return list((await db_session.execute(stmt.order_by(AudienceAssignment.id))).scalars().all())


async def _system_group(db_session: AsyncSession, resource_type: str, resource_uuid: str) -> Optional[UserGroup]:
    return (
        await db_session.execute(
            select(UserGroup).where(UserGroup.managed_key == _managed_key(resource_type, resource_uuid))
        )
    ).scalars().first()


async def _assignment_group_id(db_session: AsyncSession, a: AudienceAssignment) -> Optional[int]:
    """The UserGroup through which an assignment grants access."""
    if a.audience_type == AudienceType.USERGROUP.value:
        return a.audience_id if await db_session.get(UserGroup, a.audience_id) else None
    if a.audience_type == AudienceType.COHORT.value:
        cohort = await db_session.get(Cohort, a.audience_id)
        return cohort.usergroup_id if cohort else None
    if a.audience_type == AudienceType.ENTITY.value:
        entity = await db_session.get(Entity, a.audience_id)
        return entity.members_group_id if entity else None
    group = await _system_group(db_session, a.resource_type, a.resource_uuid)
    return group.id if group else None


async def _desired_groups(db_session: AsyncSession, resource_type: str, resource_uuid: str) -> Set[int]:
    ids: Set[int] = set()
    for a in await _assignments(db_session, resource_type, resource_uuid):
        gid = await _assignment_group_id(db_session, a)
        if gid:
            ids.add(gid)
    return ids


async def _desired_for_target(db_session: AsyncSession, target_uuid: str) -> Set[int]:
    """Groups that some assignment wants linked to this course / program uuid."""
    if target_uuid.startswith("trainingprogram_"):
        return await _desired_groups(db_session, AudienceResourceType.TRAINING_PROGRAM.value, target_uuid)
    desired = await _desired_groups(db_session, AudienceResourceType.COURSE.value, target_uuid)
    tp_uuid = (
        await db_session.execute(
            select(TrainingProgram.trainingprogram_uuid)
            .join(TrainingProgramCourse, TrainingProgramCourse.training_program_id == TrainingProgram.id)  # type: ignore[arg-type]
            .join(Course, Course.id == TrainingProgramCourse.course_id)  # type: ignore[arg-type]
            .where(Course.course_uuid == target_uuid)
        )
    ).scalars().first()
    if tp_uuid:
        desired |= await _desired_groups(db_session, AudienceResourceType.TRAINING_PROGRAM.value, tp_uuid)
    return desired


async def _group_members(db_session: AsyncSession, group_ids: Iterable[int]) -> Set[int]:
    ids = [g for g in group_ids if g]
    if not ids:
        return set()
    return set(
        (
            await db_session.execute(
                select(UserGroupUser.user_id)
                .join(UserGroup, UserGroup.id == UserGroupUser.usergroup_id)  # type: ignore[arg-type]
                .where(UserGroupUser.usergroup_id.in_(ids), UserGroup.status != "inactive")  # type: ignore[attr-defined]
            )
        ).scalars().all()
    )


async def _covered_by_links(db_session: AsyncSession, targets: Sequence[str]) -> Set[int]:
    """Everyone who currently gets access through a group linked to ``targets``."""
    if not targets:
        return set()
    return set(
        (
            await db_session.execute(
                select(UserGroupUser.user_id)
                .join(UserGroup, UserGroup.id == UserGroupUser.usergroup_id)  # type: ignore[arg-type]
                .join(UserGroupResource, UserGroupResource.usergroup_id == UserGroup.id)  # type: ignore[arg-type]
                .where(
                    UserGroupResource.resource_uuid.in_(list(targets)),  # type: ignore[union-attr]
                    UserGroup.status != "inactive",
                )
            )
        ).scalars().all()
    )


async def _person_members(db_session: AsyncSession, org_id: int, assignments: Sequence[AudienceAssignment]) -> Set[int]:
    users: Set[int] = set()
    for a in assignments:
        if a.audience_type == AudienceType.USER.value:
            member = (
                await db_session.execute(
                    select(UserOrganization.id).where(
                        UserOrganization.user_id == a.audience_id, UserOrganization.org_id == org_id
                    )
                )
            ).first()
            if member:
                users.add(a.audience_id)
        elif a.audience_type == AudienceType.POSITION.value:
            position = await db_session.get(Position, a.audience_id)
            if position is None or position.status != ConfigStatus.ACTIVE.value:
                continue
            stmt = (
                select(EntityMember.user_id)
                .join(Entity, Entity.id == EntityMember.entity_id)  # type: ignore[arg-type]
                .where(
                    EntityMember.position_id == a.audience_id,
                    EntityMember.status == ConfigStatus.ACTIVE.value,
                    Entity.status == ConfigStatus.ACTIVE.value,
                )
            )
            if a.entity_id:
                stmt = stmt.where(EntityMember.entity_id == a.entity_id)
            users |= set((await db_session.execute(stmt)).scalars().all())
    return users


async def drop_group(db_session: AsyncSession, group: UserGroup) -> None:
    """Delete a group with its links and memberships (no reliance on FK cascades)."""
    for model in (UserGroupResource, UserGroupUser):
        await db_session.execute(delete(model).where(model.usergroup_id == group.id))
    await db_session.delete(group)
    await db_session.flush()


async def _link(db_session: AsyncSession, group_id: int, target: str, org_id: int) -> None:
    exists = (
        await db_session.execute(
            select(UserGroupResource.id).where(
                UserGroupResource.usergroup_id == group_id, UserGroupResource.resource_uuid == target
            )
        )
    ).first()
    if not exists:
        db_session.add(
            UserGroupResource(
                usergroup_id=group_id,
                resource_uuid=target,
                org_id=org_id,
                creation_date=now(),
                update_date=now(),
            )
        )


async def _unlink_if_unwanted(db_session: AsyncSession, group_ids: Iterable[int], targets: Iterable[str]) -> None:
    for target in targets:
        wanted = await _desired_for_target(db_session, target)
        drop = [g for g in group_ids if g and g not in wanted]
        if drop:
            await db_session.execute(
                delete(UserGroupResource).where(
                    UserGroupResource.resource_uuid == target,
                    UserGroupResource.usergroup_id.in_(drop),  # type: ignore[attr-defined]
                )
            )


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------


async def sync_resource_audience(
    db_session: AsyncSession,
    resource_type: str,
    resource_uuid: str,
    *,
    dropped_group_ids: Iterable[int] = (),
    dropped_targets: Iterable[str] = (),
) -> AudienceSyncResult:
    """Make group links match the resource's assignments. Commits.

    ``dropped_group_ids``: groups a removed assignment used to link.
    ``dropped_targets``: course uuids that just left a training program.
    """
    info = await _resource_info(db_session, resource_type, resource_uuid, required=False)
    if info is None:
        return AudienceSyncResult()
    dropped: Set[int] = set(dropped_group_ids)
    before = await _covered_by_links(db_session, info.targets)
    assignments = await _assignments(db_session, resource_type, resource_uuid)

    # 1. The per-resource system group for position / user audiences.
    person = [a for a in assignments if a.audience_type in PERSON_TYPES]
    sys_group = await _system_group(db_session, resource_type, resource_uuid)
    if person:
        if sys_group is None:
            sys_group = UserGroup(
                name=f"Audience · {info.name}"[:250],
                description="Maintained automatically from audience assignments (positions and people).",
                org_id=info.org_id,
                group_type=UserGroupType.SYSTEM.value,
                status="active",
                managed_key=_managed_key(resource_type, resource_uuid),
                usergroup_uuid=f"usergroup_{uuid4()}",
                creation_date=now(),
                update_date=now(),
            )
            db_session.add(sys_group)
            await db_session.flush()
        wanted = await _person_members(db_session, info.org_id, person)
        current = set(
            (
                await db_session.execute(
                    select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == sys_group.id)
                )
            ).scalars().all()
        )
        if current - wanted:
            await db_session.execute(
                delete(UserGroupUser).where(
                    UserGroupUser.usergroup_id == sys_group.id,
                    UserGroupUser.user_id.in_(list(current - wanted)),  # type: ignore[attr-defined]
                )
            )
        for user_id in wanted - current:
            db_session.add(
                UserGroupUser(
                    usergroup_id=sys_group.id,
                    user_id=user_id,
                    org_id=info.org_id,
                    creation_date=now(),
                    update_date=now(),
                )
            )
        await db_session.flush()
    elif sys_group is not None:
        # No person audiences left: the group (and its links) go away.
        await drop_group(db_session, sys_group)

    # 2. Links for every assignment group.
    desired = await _desired_groups(db_session, resource_type, resource_uuid)
    for target in info.targets:
        for gid in desired:
            await _link(db_session, gid, target, info.org_id)
    await db_session.flush()

    # 3. Links nobody wants any more.
    if dropped - desired:
        await _unlink_if_unwanted(db_session, dropped - desired, info.targets)
    dropped_targets = list(dropped_targets)
    if dropped_targets:
        await _unlink_if_unwanted(db_session, desired | dropped, dropped_targets)
    await db_session.commit()

    # 4. Coverage, auto-enrollment and notifications.
    after = await _covered_by_links(db_session, info.targets)
    newly = after - before
    per_assignment: Dict[int, Set[int]] = {}
    for a in assignments:
        gid = await _assignment_group_id(db_session, a)
        per_assignment[a.id] = await _group_members(db_session, [gid] if gid else [])
    covered_total: Set[int] = set().union(*per_assignment.values()) if per_assignment else set()

    enroll_users: Set[int] = set()
    for a in assignments:
        if a.auto_enroll:
            enroll_users |= per_assignment.get(a.id, set())
    if enroll_users and info.courses:
        from src.services.admin.admin import enroll_users_in_course

        for course in info.courses:
            await enroll_users_in_course(db_session, info.org_id, course, sorted(enroll_users))

    notify_scope: Set[int] = set()
    for a in assignments:
        if a.notify:
            notify_scope |= per_assignment.get(a.id, set())
    notify_users = sorted(newly & notify_scope)
    if notify_users:
        for listener in list(_LISTENERS):
            try:
                await listener(db_session, info.org_id, resource_type, resource_uuid, notify_users)
            except Exception:  # pragma: no cover - listeners must never break access sync
                import logging

                logging.getLogger(__name__).exception("audience listener failed")

    return AudienceSyncResult(newly_covered_user_ids=sorted(newly), covered_users=len(covered_total))


async def sync_resources(db_session: AsyncSession, dropped: Dict[Key, Set[int]]) -> None:
    for (resource_type, resource_uuid), group_ids in dropped.items():
        await sync_resource_audience(db_session, resource_type, resource_uuid, dropped_group_ids=group_ids)


async def _delete_assignments(db_session: AsyncSession, rows: Sequence[AudienceAssignment]) -> Dict[Key, Set[int]]:
    """Delete assignments (no commit); returns the groups each resource may drop."""
    dropped: Dict[Key, Set[int]] = {}
    for a in rows:
        key = (a.resource_type, a.resource_uuid)
        gid = None if a.audience_type in PERSON_TYPES else await _assignment_group_id(db_session, a)
        dropped.setdefault(key, set())
        if gid:
            dropped[key].add(gid)
        await db_session.delete(a)
    await db_session.flush()
    return dropped


async def resync_affected(
    db_session: AsyncSession,
    org_id: int,
    *,
    entity_ids: Sequence[int] = (),
    user_ids: Sequence[int] = (),
    group_ids: Sequence[int] = (),
    position_ids: Sequence[int] = (),
    all_person_audiences: bool = False,
) -> None:
    """Re-sync every resource whose audience may have changed."""
    conds = []
    if entity_ids:
        conds.append(
            (AudienceAssignment.audience_type == AudienceType.ENTITY.value)
            & AudienceAssignment.audience_id.in_(list(entity_ids))  # type: ignore[attr-defined]
        )
        conds.append(
            (AudienceAssignment.audience_type == AudienceType.POSITION.value)
            & or_(
                AudienceAssignment.entity_id.is_(None),  # type: ignore[union-attr]
                AudienceAssignment.entity_id.in_(list(entity_ids)),  # type: ignore[union-attr]
            )
        )
        conds.append(AudienceAssignment.entity_id.in_(list(entity_ids)))  # type: ignore[union-attr]
    if user_ids:
        conds.append(
            (AudienceAssignment.audience_type == AudienceType.USER.value)
            & AudienceAssignment.audience_id.in_(list(user_ids))  # type: ignore[attr-defined]
        )
    if group_ids:
        conds.append(
            (AudienceAssignment.audience_type == AudienceType.USERGROUP.value)
            & AudienceAssignment.audience_id.in_(list(group_ids))  # type: ignore[attr-defined]
        )
    if position_ids:
        conds.append(
            (AudienceAssignment.audience_type == AudienceType.POSITION.value)
            & AudienceAssignment.audience_id.in_(list(position_ids))  # type: ignore[attr-defined]
        )
    if all_person_audiences:
        conds.append(AudienceAssignment.audience_type.in_(PERSON_TYPES))  # type: ignore[attr-defined]
    if not conds:
        return
    keys = (
        await db_session.execute(
            select(AudienceAssignment.resource_type, AudienceAssignment.resource_uuid)
            .where(
                AudienceAssignment.org_id == org_id,
                AudienceAssignment.mode == AudienceMode.ASSIGNED.value,
                or_(*conds),
            )
            .distinct()
        )
    ).all()
    for resource_type, resource_uuid in keys:
        await sync_resource_audience(db_session, resource_type, resource_uuid)


# ---------------------------------------------------------------------------
# Cleanup hooks for deleted audiences / resources
# ---------------------------------------------------------------------------


async def forget_usergroup(db_session: AsyncSession, group: UserGroup) -> None:
    """Drop assignments targeting a group that is about to be deleted (no commit)."""
    rows = (
        await db_session.execute(
            select(AudienceAssignment).where(
                AudienceAssignment.audience_type == AudienceType.USERGROUP.value,
                AudienceAssignment.audience_id == group.id,
            )
        )
    ).scalars().all()
    for a in rows:
        await db_session.delete(a)
    await db_session.flush()
    for model in (UserGroupResource, UserGroupUser):
        await db_session.execute(delete(model).where(model.usergroup_id == group.id))


async def forget_cohort(db_session: AsyncSession, cohort: Cohort) -> None:
    rows = (
        await db_session.execute(
            select(AudienceAssignment).where(
                AudienceAssignment.audience_type == AudienceType.COHORT.value,
                AudienceAssignment.audience_id == cohort.id,
            )
        )
    ).scalars().all()
    for a in rows:
        await db_session.delete(a)
    await db_session.flush()


async def forget_position(db_session: AsyncSession, position: Position) -> Dict[Key, Set[int]]:
    rows = (
        await db_session.execute(
            select(AudienceAssignment).where(
                AudienceAssignment.audience_type == AudienceType.POSITION.value,
                AudienceAssignment.audience_id == position.id,
            )
        )
    ).scalars().all()
    return await _delete_assignments(db_session, rows)


async def forget_entity(db_session: AsyncSession, entity: Entity) -> Dict[Key, Set[int]]:
    """Drop assignments owned by / targeting an entity about to be deleted (no commit)."""
    rows = (
        await db_session.execute(
            select(AudienceAssignment).where(
                or_(
                    AudienceAssignment.entity_id == entity.id,
                    (AudienceAssignment.audience_type == AudienceType.ENTITY.value)
                    & (AudienceAssignment.audience_id == entity.id),
                )
            )
        )
    ).scalars().all()
    dropped = await _delete_assignments(db_session, rows)
    # Shared-position audiences lose this entity's members too.
    person_keys = (
        await db_session.execute(
            select(AudienceAssignment.resource_type, AudienceAssignment.resource_uuid)
            .where(
                AudienceAssignment.org_id == entity.org_id,
                AudienceAssignment.audience_type == AudienceType.POSITION.value,
            )
            .distinct()
        )
    ).all()
    for key in person_keys:
        dropped.setdefault((key[0], key[1]), set())
    return dropped


async def forget_resource(db_session: AsyncSession, resource_type: str, resource_uuid: str) -> None:
    """Remove a resource's assignments and the links they made (commits).

    Call before deleting a training program (its course links would otherwise
    keep restricting the courses).
    """
    info = await _resource_info(db_session, resource_type, resource_uuid, required=False)
    rows = await _assignments(db_session, resource_type, resource_uuid, mode=None)
    groups = await _desired_groups(db_session, resource_type, resource_uuid)
    sys_group = await _system_group(db_session, resource_type, resource_uuid)
    for a in rows:
        await db_session.delete(a)
    await db_session.flush()
    if sys_group is not None:
        await drop_group(db_session, sys_group)
    if info is not None and groups:
        await _unlink_if_unwanted(db_session, groups, info.targets)
    await db_session.commit()


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def _audience_label(db_session: AsyncSession, a: AudienceAssignment) -> Tuple[Optional[str], Optional[str]]:
    t = a.audience_type
    if t == AudienceType.USER.value:
        user = await db_session.get(User, a.audience_id)
        if not user:
            return None, None
        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
        return user.user_uuid, name
    if t == AudienceType.USERGROUP.value:
        group = await db_session.get(UserGroup, a.audience_id)
        return (group.usergroup_uuid, group.name) if group else (None, None)
    if t == AudienceType.ENTITY.value:
        entity = await db_session.get(Entity, a.audience_id)
        return (entity.entity_uuid, entity.name) if entity else (None, None)
    if t == AudienceType.POSITION.value:
        position = await db_session.get(Position, a.audience_id)
        return (position.position_uuid, position.name) if position else (None, None)
    if t == AudienceType.COHORT.value:
        cohort = await db_session.get(Cohort, a.audience_id)
        return (cohort.cohort_uuid, cohort.name) if cohort else (None, None)
    return None, None


async def _assignment_read(
    db_session: AsyncSession, a: AudienceAssignment, resource_name: Optional[str] = None
) -> AudienceAssignmentRead:
    audience_uuid, audience_name = await _audience_label(db_session, a)
    entity = await db_session.get(Entity, a.entity_id) if a.entity_id else None
    if a.mode == AudienceMode.ASSIGNED.value:
        if a.audience_type in PERSON_TYPES:
            member_count = len(await _person_members(db_session, a.org_id, [a]))
        else:
            gid = await _assignment_group_id(db_session, a)
            member_count = len(await _group_members(db_session, [gid] if gid else []))
    else:
        member_count = 0
    return AudienceAssignmentRead(
        assignment_uuid=a.assignment_uuid,
        resource_type=a.resource_type,
        resource_uuid=a.resource_uuid,
        resource_name=resource_name,
        audience_type=a.audience_type,
        audience_uuid=audience_uuid,
        audience_name=audience_name,
        entity_uuid=entity.entity_uuid if entity else None,
        entity_name=entity.name if entity else None,
        mode=a.mode,
        auto_enroll=a.auto_enroll,
        due_date=a.due_date,
        notify=a.notify,
        member_count=member_count,
        creation_date=a.creation_date,
    )


async def get_resource_audience(
    db_session: AsyncSession, current_user: AnyUser, resource_type: str, resource_uuid: str
) -> ResourceAudienceRead:
    info = await _resource_info(db_session, resource_type, resource_uuid)
    await authorize_admin(db_session, current_user, info.org_id, "entities", "read", WHAT)
    rows = await _assignments(db_session, resource_type, resource_uuid, mode=None)
    assignment_groups: Set[int] = set()
    for a in rows:
        if a.mode == AudienceMode.ASSIGNED.value:
            gid = await _assignment_group_id(db_session, a)
            if gid:
                assignment_groups.add(gid)
    linked = (
        await db_session.execute(
            select(UserGroup)
            .join(UserGroupResource, UserGroupResource.usergroup_id == UserGroup.id)  # type: ignore[arg-type]
            .where(UserGroupResource.resource_uuid == resource_uuid)
            .order_by(UserGroup.name)
        )
    ).scalars().all()
    other = [
        LegacyGroupLink(usergroup_uuid=g.usergroup_uuid, name=g.name, group_type=g.group_type)
        for g in linked
        if g.id not in assignment_groups
    ]
    return ResourceAudienceRead(
        resource_type=resource_type,
        resource_uuid=resource_uuid,
        resource_name=info.name,
        published=info.published,
        assignments=[await _assignment_read(db_session, a, info.name) for a in rows],
        other_groups=other,
        covered_users=len(await _group_members(db_session, assignment_groups)),
    )


async def list_entity_learning(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str
) -> List[AvailableResourceRead]:
    """Resources made available to (or assigned within) an entity."""
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity)
    rows = (
        await db_session.execute(
            select(AudienceAssignment)
            .where(
                or_(
                    AudienceAssignment.entity_id == entity.id,
                    (AudienceAssignment.audience_type == AudienceType.ENTITY.value)
                    & (AudienceAssignment.audience_id == entity.id),
                )
            )
            .order_by(AudienceAssignment.id)
        )
    ).scalars().all()
    grouped: Dict[Key, List[AudienceAssignment]] = {}
    for a in rows:
        grouped.setdefault((a.resource_type, a.resource_uuid), []).append(a)
    result: List[AvailableResourceRead] = []
    for (resource_type, resource_uuid), items in grouped.items():
        info = await _resource_info(db_session, resource_type, resource_uuid, required=False)
        if info is None:
            continue
        available = next((a for a in items if a.mode == AudienceMode.AVAILABLE.value), None)
        result.append(
            AvailableResourceRead(
                resource_type=resource_type,
                resource_uuid=resource_uuid,
                resource_name=info.name,
                published=info.published,
                available_since=(available or items[0]).creation_date,
                assignments=[
                    await _assignment_read(db_session, a, info.name)
                    for a in items
                    if a.mode == AudienceMode.ASSIGNED.value
                ],
            )
        )
    result.sort(key=lambda r: (r.resource_name or "").lower())
    return result


# ---------------------------------------------------------------------------
# Create / delete
# ---------------------------------------------------------------------------


async def _is_available_to(db_session: AsyncSession, resource_type: str, resource_uuid: str, entity: Entity) -> bool:
    return (
        await db_session.execute(
            select(AudienceAssignment.id).where(
                AudienceAssignment.resource_type == resource_type,
                AudienceAssignment.resource_uuid == resource_uuid,
                AudienceAssignment.audience_type == AudienceType.ENTITY.value,
                AudienceAssignment.audience_id == entity.id,
                AudienceAssignment.mode == AudienceMode.AVAILABLE.value,
            )
        )
    ).first() is not None


async def _resolve_audience(
    db_session: AsyncSession,
    org_id: int,
    audience_type: str,
    audience_uuid: str,
    scope_entity: Optional[Entity],
    coordinator: bool,
) -> Tuple[int, Optional[int]]:
    """Return ``(audience_id, entity_id)`` after checking it belongs to the org/entity."""
    def _foreign() -> HTTPException:
        return HTTPException(status_code=403, detail="This audience is outside your entity")

    if audience_type == AudienceType.USER.value:
        user = await get_by_uuid_or_404(db_session, User, User.user_uuid, audience_uuid, "User")
        member = (
            await db_session.execute(
                select(UserOrganization.id).where(
                    UserOrganization.user_id == user.id, UserOrganization.org_id == org_id
                )
            )
        ).first()
        if not member:
            raise bad_request("User is not a member of this organization")
        if coordinator:
            in_entity = (
                await db_session.execute(
                    select(EntityMember.id).where(
                        EntityMember.entity_id == scope_entity.id,  # type: ignore[union-attr]
                        EntityMember.user_id == user.id,
                        EntityMember.status == ConfigStatus.ACTIVE.value,
                    )
                )
            ).first()
            if not in_entity:
                raise _foreign()
        return user.id, scope_entity.id if (coordinator and scope_entity) else None
    if audience_type == AudienceType.USERGROUP.value:
        group = await get_by_uuid_or_404(db_session, UserGroup, UserGroup.usergroup_uuid, audience_uuid, "Group")
        if group.org_id != org_id:
            raise bad_request("Group belongs to a different organization")
        if group.group_type == UserGroupType.SYSTEM.value or group.managed_key:
            raise bad_request("Assign the entity (or position) instead of a system group")
        if coordinator and group.entity_id != scope_entity.id:  # type: ignore[union-attr]
            raise _foreign()
        return group.id, scope_entity.id if (coordinator and scope_entity) else None
    if audience_type == AudienceType.ENTITY.value:
        entity = await get_entity_by_uuid(db_session, audience_uuid)
        if entity.org_id != org_id:
            raise bad_request("Entity belongs to a different organization")
        if coordinator and entity.id != scope_entity.id:  # type: ignore[union-attr]
            raise _foreign()
        return entity.id, entity.id
    if audience_type == AudienceType.POSITION.value:
        position = await get_by_uuid_or_404(db_session, Position, Position.position_uuid, audience_uuid, "Position")
        if position.org_id != org_id:
            raise bad_request("Position belongs to a different organization")
        if scope_entity is not None and position.entity_id and position.entity_id != scope_entity.id:
            raise bad_request("Position does not belong to this entity")
        if scope_entity is None and position.entity_id:
            return position.id, position.entity_id
        return position.id, scope_entity.id if scope_entity else None
    if audience_type == AudienceType.COHORT.value:
        if coordinator:
            raise _foreign()
        cohort = await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, audience_uuid, "Cohort")
        if cohort.org_id != org_id:
            raise bad_request("Cohort belongs to a different organization")
        if not cohort.usergroup_id:
            raise bad_request("This cohort has no roster group")
        return cohort.id, None
    raise bad_request("Unsupported audience type")


async def create_assignment(
    db_session: AsyncSession, current_user: AnyUser, payload: AudienceAssignmentCreate
) -> AudienceAssignmentRead:
    resource_type = payload.resource_type.value
    audience_type = payload.audience_type.value
    mode = payload.mode.value
    info = await _resource_info(db_session, resource_type, payload.resource_uuid)
    user_id = require_user_id(current_user, WHAT)
    is_academy = await has_admin_permission(db_session, user_id, info.org_id, "entities", "create")

    scope_entity: Optional[Entity] = None
    if payload.entity_uuid:
        scope_entity = await get_entity_by_uuid(db_session, payload.entity_uuid)
        if scope_entity.org_id != info.org_id:
            raise bad_request("Entity belongs to a different organization")

    if not is_academy:
        if scope_entity is None:
            raise HTTPException(status_code=403, detail=f"You don't have permission to {WHAT}")
        await require_entity_access(db_session, current_user, scope_entity, "can_assign_training", "create")
        if mode != AudienceMode.ASSIGNED.value:
            raise HTTPException(status_code=403, detail="Only the academy can make learning available")
        if not await _is_available_to(db_session, resource_type, payload.resource_uuid, scope_entity):
            raise HTTPException(
                status_code=403, detail="The academy has not made this available to your entity"
            )
    elif mode == AudienceMode.AVAILABLE.value and audience_type != AudienceType.ENTITY.value:
        raise bad_request("Learning can only be made available to an entity")

    audience_id, entity_id = await _resolve_audience(
        db_session, info.org_id, audience_type, payload.audience_uuid, scope_entity, coordinator=not is_academy
    )
    duplicate = (
        await db_session.execute(
            select(AudienceAssignment.id).where(
                AudienceAssignment.resource_type == resource_type,
                AudienceAssignment.resource_uuid == payload.resource_uuid,
                AudienceAssignment.audience_type == audience_type,
                AudienceAssignment.audience_id == audience_id,
                AudienceAssignment.mode == mode,
                (AudienceAssignment.entity_id == entity_id) if entity_id else AudienceAssignment.entity_id.is_(None),  # type: ignore[union-attr]
            )
        )
    ).first()
    if duplicate:
        raise conflict("This audience is already assigned")

    assignment = AudienceAssignment(
        org_id=info.org_id,
        resource_type=resource_type,
        resource_uuid=payload.resource_uuid,
        audience_type=audience_type,
        audience_id=audience_id,
        entity_id=entity_id,
        mode=mode,
        auto_enroll=payload.auto_enroll if mode == AudienceMode.ASSIGNED.value else False,
        due_date=(payload.due_date or None),
        notify=payload.notify,
        created_by_user_id=user_id,
        assignment_uuid=f"audience_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(assignment)
    await db_session.commit()
    await db_session.refresh(assignment)
    if mode == AudienceMode.ASSIGNED.value:
        await sync_resource_audience(db_session, resource_type, payload.resource_uuid)
        await db_session.refresh(assignment)
    return await _assignment_read(db_session, assignment, info.name)


async def delete_assignment(db_session: AsyncSession, current_user: AnyUser, assignment_uuid: str) -> str:
    assignment = await get_by_uuid_or_404(
        db_session, AudienceAssignment, AudienceAssignment.assignment_uuid, assignment_uuid, "Assignment"
    )
    user_id = require_user_id(current_user, WHAT)
    is_academy = await has_admin_permission(db_session, user_id, assignment.org_id, "entities", "delete")
    if not is_academy:
        entity = await db_session.get(Entity, assignment.entity_id) if assignment.entity_id else None
        if entity is None or assignment.mode != AudienceMode.ASSIGNED.value:
            raise HTTPException(status_code=403, detail=f"You don't have permission to {WHAT}")
        await require_entity_access(db_session, current_user, entity, "can_assign_training", "delete")

    rows = [assignment]
    if assignment.mode == AudienceMode.AVAILABLE.value:
        # Withdrawing availability also withdraws what the coordinator assigned.
        candidates = (
            await db_session.execute(
                select(AudienceAssignment).where(
                    AudienceAssignment.resource_type == assignment.resource_type,
                    AudienceAssignment.resource_uuid == assignment.resource_uuid,
                    AudienceAssignment.entity_id == assignment.entity_id,
                    AudienceAssignment.mode == AudienceMode.ASSIGNED.value,
                )
            )
        ).scalars().all()
        for c in candidates:
            creator = c.created_by_user_id
            if creator is None or not await has_admin_permission(
                db_session, creator, c.org_id, "entities", "create"
            ):
                rows.append(c)
    dropped = await _delete_assignments(db_session, rows)
    await db_session.commit()
    await sync_resources(db_session, dropped)
    return "Assignment removed"


async def resync_resource(
    db_session: AsyncSession, current_user: AnyUser, resource_type: str, resource_uuid: str
) -> AudienceSyncResult:
    info = await _resource_info(db_session, resource_type, resource_uuid)
    await authorize_admin(db_session, current_user, info.org_id, "entities", "update", WHAT)
    return await sync_resource_audience(db_session, resource_type, resource_uuid)


# ---------------------------------------------------------------------------
# Picker
# ---------------------------------------------------------------------------


async def audience_options(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    q: Optional[str] = None,
    entity_uuid: Optional[str] = None,
    limit: int = 30,
) -> List[AudienceOption]:
    """Search audiences. Coordinators (``entity_uuid``) only see their entity."""
    limit = max(1, min(limit, 100))
    like = f"%{q.strip()}%" if q and q.strip() else None
    scope: Optional[Entity] = None
    if entity_uuid:
        scope = await get_entity_by_uuid(db_session, entity_uuid)
        if scope.org_id != org_id:
            raise bad_request("Entity belongs to a different organization")
        await require_entity_access(db_session, current_user, scope)
    else:
        await authorize_admin(db_session, current_user, org_id, "entities", "read", WHAT)

    options: List[AudienceOption] = []

    ent_stmt = select(Entity).where(Entity.org_id == org_id, Entity.status == ConfigStatus.ACTIVE.value)
    if scope:
        ent_stmt = ent_stmt.where(Entity.id == scope.id)
    if like:
        ent_stmt = ent_stmt.where(or_(Entity.name.ilike(like), Entity.code.ilike(like), Entity.name_ar.ilike(like)))  # type: ignore[union-attr]
    for e in (await db_session.execute(ent_stmt.order_by(Entity.name).limit(limit))).scalars().all():
        options.append(AudienceOption(audience_type="entity", audience_uuid=e.entity_uuid, name=e.name, detail=e.code, entity_uuid=e.entity_uuid))

    grp_stmt = select(UserGroup).where(
        UserGroup.org_id == org_id,
        UserGroup.group_type.in_([UserGroupType.GENERAL.value, UserGroupType.DEPARTMENT.value]),  # type: ignore[attr-defined]
        UserGroup.managed_key.is_(None),  # type: ignore[union-attr]
        UserGroup.status != "inactive",
    )
    if scope:
        grp_stmt = grp_stmt.where(UserGroup.entity_id == scope.id)
    if like:
        grp_stmt = grp_stmt.where(UserGroup.name.ilike(like))  # type: ignore[attr-defined]
    groups = (await db_session.execute(grp_stmt.order_by(UserGroup.name).limit(limit))).scalars().all()
    entity_names: Dict[int, Entity] = {}
    for g in groups:
        if g.entity_id and g.entity_id not in entity_names:
            ent = await db_session.get(Entity, g.entity_id)
            if ent:
                entity_names[g.entity_id] = ent
        ent = entity_names.get(g.entity_id) if g.entity_id else None
        options.append(
            AudienceOption(
                audience_type="usergroup",
                audience_uuid=g.usergroup_uuid,
                name=g.name,
                detail=ent.name if ent else g.group_type,
                entity_uuid=ent.entity_uuid if ent else None,
            )
        )

    pos_stmt = select(Position).where(Position.org_id == org_id, Position.status == ConfigStatus.ACTIVE.value)
    if scope:
        pos_stmt = pos_stmt.where(or_(Position.entity_id == scope.id, Position.entity_id.is_(None)))  # type: ignore[union-attr]
    if like:
        pos_stmt = pos_stmt.where(Position.name.ilike(like))  # type: ignore[attr-defined]
    for p in (await db_session.execute(pos_stmt.order_by(Position.name).limit(limit))).scalars().all():
        ent = await db_session.get(Entity, p.entity_id) if p.entity_id else None
        options.append(
            AudienceOption(
                audience_type="position",
                audience_uuid=p.position_uuid,
                name=p.name,
                detail=ent.name if ent else None,
                entity_uuid=ent.entity_uuid if ent else None,
            )
        )

    if scope is None:
        coh_stmt = select(Cohort).where(Cohort.org_id == org_id, Cohort.usergroup_id.is_not(None))  # type: ignore[union-attr]
        if like:
            coh_stmt = coh_stmt.where(or_(Cohort.name.ilike(like), Cohort.code.ilike(like)))  # type: ignore[union-attr]
        for c in (await db_session.execute(coh_stmt.order_by(Cohort.name).limit(limit))).scalars().all():
            options.append(AudienceOption(audience_type="cohort", audience_uuid=c.cohort_uuid, name=c.name, detail=c.code))

    if like:
        user_stmt = (
            select(User)
            .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore[arg-type]
            .where(
                UserOrganization.org_id == org_id,
                or_(
                    User.first_name.ilike(like),  # type: ignore[union-attr]
                    User.last_name.ilike(like),  # type: ignore[union-attr]
                    User.email.ilike(like),  # type: ignore[union-attr]
                    User.username.ilike(like),  # type: ignore[union-attr]
                ),
            )
        )
        if scope:
            user_stmt = user_stmt.join(EntityMember, EntityMember.user_id == User.id).where(  # type: ignore[arg-type]
                EntityMember.entity_id == scope.id, EntityMember.status == ConfigStatus.ACTIVE.value
            )
        for u in (await db_session.execute(user_stmt.order_by(User.first_name).limit(limit))).scalars().all():
            name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
            options.append(AudienceOption(audience_type="user", audience_uuid=u.user_uuid, name=name, detail=u.email))
    return options

