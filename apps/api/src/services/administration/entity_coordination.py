"""Coordinator follow-up: members' learning progress and instructor invitations."""
from typing import Dict, List, Optional, Set
from uuid import uuid4

from sqlmodel import func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.audience import AudienceAssignment, AudienceType
from src.db.administration.entities import (
    CourseProgressRead,
    Entity,
    EntityCourseStats,
    EntityInstructorInvite,
    EntityInstructorRead,
    EntityMember,
    EntityNewUser,
    EntityProgressRead,
    MemberProgressRead,
    Position,
)
from src.db.administration.lookups import ConfigStatus
from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.courses import Course
from src.db.instructors.instructors import Instructor, InstructorStatus
from src.db.trail_runs import StatusEnum, TrailRun
from src.db.trail_steps import TrailStep
from src.db.usergroup_user import UserGroupUser
from src.db.users import User, UserReadAuthor
from src.security.rbac.constants import TRAINEE_ROLE_ID
from src.services.administration.authz import AnyUser
from src.services.administration.common import conflict, now
from src.services.administration.entities import (
    _entity_group_or_404,
    _find_or_create_user,
    get_entity_by_uuid,
    require_entity_access,
)


async def _entity_course_ids(db_session: AsyncSession, entity: Entity) -> Set[int]:
    """Courses the academy made available to / assigned within the entity."""
    from src.services.administration.audience import _resource_info

    keys = (
        await db_session.execute(
            select(AudienceAssignment.resource_type, AudienceAssignment.resource_uuid)
            .where(
                or_(
                    AudienceAssignment.entity_id == entity.id,
                    (AudienceAssignment.audience_type == AudienceType.ENTITY.value)
                    & (AudienceAssignment.audience_id == entity.id),
                )
            )
            .distinct()
        )
    ).all()
    ids: Set[int] = set()
    for resource_type, resource_uuid in keys:
        info = await _resource_info(db_session, resource_type, resource_uuid, required=False)
        if info:
            ids |= {c.id for c in info.courses if c.id}
    return ids


async def get_entity_progress(
    db_session: AsyncSession,
    current_user: AnyUser,
    entity_uuid: str,
    group_uuid: Optional[str] = None,
) -> EntityProgressRead:
    """Enrollment / progress / certificates for each active member.

    Coordinators see only the learning connected to their entity; academy
    staff see every course the members take.
    """
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    access = await require_entity_access(db_session, current_user, entity)
    stmt = (
        select(EntityMember, User)
        .join(User, User.id == EntityMember.user_id)  # type: ignore[arg-type]
        .where(EntityMember.entity_id == entity.id, EntityMember.status == ConfigStatus.ACTIVE.value)
    )
    if group_uuid:
        group = await _entity_group_or_404(db_session, entity, group_uuid)
        stmt = stmt.where(
            EntityMember.user_id.in_(select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == group.id))  # type: ignore[attr-defined]
        )
    members = (await db_session.execute(stmt.order_by(User.first_name, User.last_name))).all()
    user_ids = [u.id for _, u in members]
    if not user_ids:
        return EntityProgressRead()

    runs_stmt = select(TrailRun).where(TrailRun.user_id.in_(user_ids), TrailRun.org_id == entity.org_id)  # type: ignore[attr-defined]
    if not access.is_academy:
        scope = await _entity_course_ids(db_session, entity)
        if not scope:
            runs_stmt = runs_stmt.where(TrailRun.course_id == -1)
        else:
            runs_stmt = runs_stmt.where(TrailRun.course_id.in_(scope))  # type: ignore[attr-defined]
    runs = (await db_session.execute(runs_stmt)).scalars().all()
    course_ids = {r.course_id for r in runs}
    courses = {
        c.id: c
        for c in (await db_session.execute(select(Course).where(Course.id.in_(course_ids or {-1})))).scalars().all()  # type: ignore[union-attr]
    }
    totals = dict(
        (
            await db_session.execute(
                select(ChapterActivity.course_id, func.count(ChapterActivity.id))
                .where(ChapterActivity.course_id.in_(course_ids or {-1}))  # type: ignore[attr-defined]
                .group_by(ChapterActivity.course_id)
            )
        ).all()
    )
    done: Dict[tuple, int] = {
        (u, c): n
        for u, c, n in (
            await db_session.execute(
                select(TrailStep.user_id, TrailStep.course_id, func.count(TrailStep.id))
                .where(
                    TrailStep.user_id.in_(user_ids),  # type: ignore[attr-defined]
                    TrailStep.course_id.in_(course_ids or {-1}),  # type: ignore[attr-defined]
                    TrailStep.complete == True,  # noqa: E712
                )
                .group_by(TrailStep.user_id, TrailStep.course_id)
            )
        ).all()
    }
    last_step: Dict[int, str] = {
        u: d
        for u, d in (
            await db_session.execute(
                select(TrailStep.user_id, func.max(TrailStep.update_date))
                .where(TrailStep.user_id.in_(user_ids), TrailStep.course_id.in_(course_ids or {-1}))  # type: ignore[attr-defined]
                .group_by(TrailStep.user_id)
            )
        ).all()
        if d
    }
    certs = dict(
        (
            await db_session.execute(
                select(CertificateUser.user_id, func.count(CertificateUser.id))
                .join(Certifications, Certifications.id == CertificateUser.certification_id)  # type: ignore[arg-type]
                .where(CertificateUser.user_id.in_(user_ids), Certifications.course_id.in_(course_ids or {-1}))  # type: ignore[attr-defined]
                .group_by(CertificateUser.user_id)
            )
        ).all()
    )
    positions = {
        p.id: p.name
        for p in (
            await db_session.execute(
                select(Position).where(Position.id.in_({m.position_id for m, _ in members if m.position_id} or {-1}))  # type: ignore[union-attr]
            )
        ).scalars().all()
    }

    runs_by_user: Dict[int, List[TrailRun]] = {}
    for r in runs:
        runs_by_user.setdefault(r.user_id, []).append(r)
    course_stats: Dict[int, Dict[str, float]] = {}
    items: List[MemberProgressRead] = []
    for member, user in members:
        course_items: List[CourseProgressRead] = []
        for r in runs_by_user.get(user.id, []):
            course = courses.get(r.course_id)
            if course is None:
                continue
            total = totals.get(r.course_id, 0)
            status = r.status.value if hasattr(r.status, "value") else str(r.status)
            pct = 100.0 if status == StatusEnum.STATUS_COMPLETED.value else (
                round(done.get((user.id, r.course_id), 0) / total * 100, 1) if total else 0.0
            )
            course_items.append(
                CourseProgressRead(course_uuid=course.course_uuid, course_name=course.name, status=status, completion_percentage=min(pct, 100.0), enrolled_at=r.creation_date)
            )
            stats = course_stats.setdefault(r.course_id, {"enrolled": 0, "completed": 0, "sum": 0.0})
            stats["enrolled"] += 1
            stats["sum"] += min(pct, 100.0)
            if status == StatusEnum.STATUS_COMPLETED.value or pct >= 100:
                stats["completed"] += 1
        completed = sum(1 for c in course_items if c.completion_percentage >= 100 or c.status == StatusEnum.STATUS_COMPLETED.value)
        items.append(
            MemberProgressRead(
                member_uuid=member.member_uuid,
                user=UserReadAuthor.model_validate(user, from_attributes=True),
                email=user.email,
                position_name=positions.get(member.position_id) if member.position_id else None,
                employee_id=member.employee_id,
                enrolled=len(course_items),
                completed=completed,
                in_progress=len(course_items) - completed,
                average_progress=round(sum(c.completion_percentage for c in course_items) / len(course_items), 1) if course_items else 0,
                certificates=int(certs.get(user.id, 0)),
                last_activity=last_step.get(user.id) or max((r.update_date for r in runs_by_user.get(user.id, []) if r.update_date), default=None),
                courses=course_items,
            )
        )
    enrolled_total = sum(m.enrolled for m in items)
    return EntityProgressRead(
        members=items,
        courses=sorted(
            [
                EntityCourseStats(
                    course_uuid=courses[cid].course_uuid,
                    course_name=courses[cid].name,
                    enrolled=int(s["enrolled"]),
                    completed=int(s["completed"]),
                    average_progress=round(s["sum"] / s["enrolled"], 1) if s["enrolled"] else 0,
                )
                for cid, s in course_stats.items()
                if cid in courses
            ],
            key=lambda c: c.course_name.lower(),
        ),
        total_members=len(items),
        active_learners=sum(1 for m in items if m.enrolled),
        completion_rate=round(sum(m.completed for m in items) / enrolled_total * 100, 1) if enrolled_total else 0,
    )


# ---------------------------------------------------------------------------
# Instructor invitations (can_add_instructors)
# ---------------------------------------------------------------------------


def _instructor_read(instructor: Instructor, user: User) -> EntityInstructorRead:
    status = instructor.status.value if hasattr(instructor.status, "value") else str(instructor.status)
    return EntityInstructorRead(
        instructor_uuid=instructor.instructor_uuid,
        user=UserReadAuthor.model_validate(user, from_attributes=True),
        email=user.email,
        status=status,
        specializations=list(instructor.specializations or []),
        creation_date=instructor.creation_date,
    )


async def list_entity_instructors(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str
) -> List[EntityInstructorRead]:
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity, "can_add_instructors")
    rows = (
        await db_session.execute(
            select(Instructor, User)
            .join(User, User.id == Instructor.user_id)  # type: ignore[arg-type]
            .where(Instructor.entity_id == entity.id)
            .order_by(Instructor.id.desc())  # type: ignore[union-attr]
        )
    ).all()
    return [_instructor_read(i, u) for i, u in rows]


async def invite_instructor(
    db_session: AsyncSession, current_user: AnyUser, entity_uuid: str, payload: EntityInstructorInvite
) -> EntityInstructorRead:
    """Propose an instructor; the academy approves and sets category / rate."""
    entity = await get_entity_by_uuid(db_session, entity_uuid)
    await require_entity_access(db_session, current_user, entity, "can_add_instructors", "create")
    user, _temp = await _find_or_create_user(
        db_session,
        entity.org_id,
        EntityNewUser(first_name=payload.first_name, last_name=payload.last_name, email=payload.email, phone=payload.phone),
        TRAINEE_ROLE_ID,
    )
    already = (
        await db_session.execute(
            select(Instructor.id).where(Instructor.org_id == entity.org_id, Instructor.user_id == user.id)
        )
    ).first()
    if already:
        raise conflict("This person is already an instructor (or already invited)")
    instructor = Instructor(
        org_id=entity.org_id,
        user_id=user.id,  # type: ignore[arg-type]
        entity_id=entity.id,
        status=InstructorStatus.PENDING_APPROVAL,
        bio=payload.bio,
        specializations=[s.strip() for s in payload.specializations if s.strip()][:20] or None,
        contact_info={"phone": payload.phone} if payload.phone else None,
        instructor_uuid=f"instructor_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(instructor)
    await db_session.commit()
    await db_session.refresh(instructor)
    if _temp:
        from src.services.notifications.events import password_setup

        await password_setup(db_session, entity.org_id, user.id)  # type: ignore[arg-type]
    return _instructor_read(instructor, user)
