"""Postgraduate student records: cohort membership (program-level record).

A membership gives the student a system-generated student number and an
academic status. It mirrors into the cohort's UserGroup (program access) and
drives automatic registration in the cohort's required offerings.
"""
from typing import List, Optional
from uuid import uuid4

from fastapi import Request
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.cohorts import Cohort
from src.db.academic.offerings import (
    CohortMembership,
    CohortMembershipRead,
    CourseOffering,
    CourseOfferingRead,
    Enrollment,
    EnrollmentStatus,
    MembershipStatus,
)
from src.db.academic.programs import Program
from src.db.usergroup_user import UserGroupUser
from src.db.users import User, UserReadAuthor
from src.security.auth import resolve_acting_user_id
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic import offerings as offerings_svc
from src.services.academic.common import (
    Principal,
    conflict,
    get_by_uuid_or_404,
    get_user_by_uuid_or_400,
    now,
    require_academic_manager,
    require_academic_member,
)
from src.services.academic.validation import assert_status_transition, resolve_org_user
from pydantic import BaseModel

MEMBERSHIP_STATUS_TRANSITIONS = {
    MembershipStatus.ACTIVE: {
        MembershipStatus.DEFERRED, MembershipStatus.SUSPENDED, MembershipStatus.WITHDRAWN,
        MembershipStatus.COMPLETED,
    },
    MembershipStatus.DEFERRED: {MembershipStatus.ACTIVE, MembershipStatus.WITHDRAWN},
    MembershipStatus.SUSPENDED: {MembershipStatus.ACTIVE, MembershipStatus.WITHDRAWN},
    MembershipStatus.COMPLETED: {MembershipStatus.GRADUATED, MembershipStatus.ACTIVE},
    MembershipStatus.WITHDRAWN: set(),
    MembershipStatus.GRADUATED: set(),
}
# Leaving these states withdraws the student's current registrations.
INACTIVE_STATES = {MembershipStatus.DEFERRED, MembershipStatus.SUSPENDED, MembershipStatus.WITHDRAWN}


async def _cohort_and_program(db_session: AsyncSession, cohort_uuid: str) -> tuple[Cohort, Program]:
    cohort = await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, cohort_uuid, "Cohort")
    program = await db_session.get(Program, cohort.program_id)
    assert program is not None
    return cohort, program


async def _set_cohort_group_member(db_session: AsyncSession, cohort: Cohort, user_id: int, present: bool) -> None:
    if not cohort.usergroup_id:
        return
    row = (
        await db_session.execute(
            select(UserGroupUser).where(
                UserGroupUser.usergroup_id == cohort.usergroup_id, UserGroupUser.user_id == user_id
            )
        )
    ).scalars().first()
    if present and not row:
        db_session.add(
            UserGroupUser(
                usergroup_id=cohort.usergroup_id, user_id=user_id, org_id=cohort.org_id,
                creation_date=now(), update_date=now(),
            )
        )
    elif not present and row:
        await db_session.delete(row)


async def _next_student_number(db_session: AsyncSession, cohort: Cohort) -> str:
    prefix = cohort.code or f"C{cohort.id}"
    count = (
        await db_session.execute(
            select(func.count()).select_from(CohortMembership).where(CohortMembership.cohort_id == cohort.id)
        )
    ).scalar() or 0
    seq = int(count) + 1
    while True:
        candidate = f"{prefix}-{seq:03d}"
        taken = (
            await db_session.execute(
                select(CohortMembership).where(
                    CohortMembership.org_id == cohort.org_id, CohortMembership.student_number == candidate
                )
            )
        ).scalars().first()
        if not taken:
            return candidate
        seq += 1


async def membership_read(db_session: AsyncSession, membership: CohortMembership) -> CohortMembershipRead:
    user = await db_session.get(User, membership.user_id)
    cohort = await db_session.get(Cohort, membership.cohort_id)
    program = await db_session.get(Program, cohort.program_id) if cohort else None
    enrolled = (
        await db_session.execute(
            select(func.count()).select_from(Enrollment).where(
                Enrollment.membership_id == membership.id, Enrollment.status == EnrollmentStatus.REGISTERED
            )
        )
    ).scalar() or 0
    return CohortMembershipRead(
        membership_uuid=membership.membership_uuid,
        student_number=membership.student_number,
        status=membership.status,
        admitted_at=membership.admitted_at,
        status_changed_at=membership.status_changed_at,
        user=UserReadAuthor.model_validate(user),
        cohort_uuid=cohort.cohort_uuid if cohort else "",
        cohort_code=cohort.code if cohort else None,
        cohort_name=cohort.name if cohort else None,
        program_name=program.name if program else None,
        program_uuid=program.program_uuid if program else None,
        enrolled_offerings=int(enrolled),
    )


async def admit_user(db_session: AsyncSession, cohort: Cohort, user_id: int) -> CohortMembership:
    """Create (or return) the student's membership, join the cohort group and
    register them in current required offerings. Caller commits."""
    membership = (
        await db_session.execute(
            select(CohortMembership).where(
                CohortMembership.cohort_id == cohort.id, CohortMembership.user_id == user_id
            )
        )
    ).scalars().first()
    if membership:
        return membership
    if cohort.capacity is not None:
        active = (
            await db_session.execute(
                select(func.count()).select_from(CohortMembership).where(
                    CohortMembership.cohort_id == cohort.id,
                    CohortMembership.status == MembershipStatus.ACTIVE,
                )
            )
        ).scalar() or 0
        if active >= cohort.capacity:
            raise conflict("Cohort is at full capacity")
    membership = CohortMembership(
        cohort_id=cohort.id,
        user_id=user_id,
        org_id=cohort.org_id,
        student_number=await _next_student_number(db_session, cohort),
        status=MembershipStatus.ACTIVE,
        admitted_at=now(),
        status_changed_at=now(),
        membership_uuid=f"cmember_{uuid4()}",
    )
    db_session.add(membership)
    await db_session.flush()
    await _set_cohort_group_member(db_session, cohort, user_id, True)
    await offerings_svc.auto_enroll_member(db_session, cohort, membership)
    return membership


async def add_student(
    request: Request, cohort_uuid: str, user_uuid: str, current_user: Principal, db_session: AsyncSession
) -> CohortMembershipRead:
    cohort, program = await _cohort_and_program(db_session, cohort_uuid)
    await check_resource_access(request, db_session, current_user, program.program_uuid, AccessAction.UPDATE)
    user = await get_user_by_uuid_or_400(db_session, user_uuid)
    await resolve_org_user(db_session, cohort.org_id, user.user_uuid, label="Student")
    membership = await admit_user(db_session, cohort, user.id)  # type: ignore[arg-type]
    await db_session.commit()
    await db_session.refresh(membership)
    return await membership_read(db_session, membership)


async def list_cohort_students(
    request: Request, cohort_uuid: str, current_user: Principal, db_session: AsyncSession
) -> List[CohortMembershipRead]:
    cohort, program = await _cohort_and_program(db_session, cohort_uuid)
    await check_resource_access(
        request, db_session, current_user, program.program_uuid, AccessAction.READ, context=AccessContext.DASHBOARD
    )
    rows = (
        await db_session.execute(
            select(CohortMembership).where(CohortMembership.cohort_id == cohort.id)
            .order_by(CohortMembership.student_number)  # type: ignore
        )
    ).scalars().all()
    return [await membership_read(db_session, m) for m in rows]


async def _withdraw_registrations(db_session: AsyncSession, membership: CohortMembership) -> None:
    rows = (
        await db_session.execute(
            select(Enrollment).where(
                Enrollment.membership_id == membership.id, Enrollment.status == EnrollmentStatus.REGISTERED
            )
        )
    ).scalars().all()
    for enrollment in rows:
        offering = await db_session.get(CourseOffering, enrollment.offering_id)
        await offerings_svc.set_enrollment_status(db_session, offering, enrollment, EnrollmentStatus.WITHDRAWN)  # type: ignore[arg-type]


async def change_membership_status(
    db_session: AsyncSession, cohort: Cohort, membership: CohortMembership, status: MembershipStatus
) -> None:
    assert_status_transition(membership.status, status, MEMBERSHIP_STATUS_TRANSITIONS)
    previous = membership.status
    membership.status = status
    membership.status_changed_at = now()
    db_session.add(membership)
    if status in INACTIVE_STATES and previous not in INACTIVE_STATES:
        await _withdraw_registrations(db_session, membership)
    await _set_cohort_group_member(db_session, cohort, membership.user_id, status != MembershipStatus.WITHDRAWN)


async def update_student_status(
    request: Request,
    cohort_uuid: str,
    membership_uuid: str,
    status: MembershipStatus,
    current_user: Principal,
    db_session: AsyncSession,
) -> CohortMembershipRead:
    cohort, program = await _cohort_and_program(db_session, cohort_uuid)
    await check_resource_access(request, db_session, current_user, program.program_uuid, AccessAction.UPDATE)
    membership = await get_by_uuid_or_404(
        db_session, CohortMembership, CohortMembership.membership_uuid, membership_uuid, "Student"
    )
    if membership.cohort_id != cohort.id:
        raise conflict("Student does not belong to this cohort")
    await change_membership_status(db_session, cohort, membership, status)
    await db_session.commit()
    await db_session.refresh(membership)
    return await membership_read(db_session, membership)


async def remove_membership(db_session: AsyncSession, cohort: Cohort, membership: CohortMembership) -> None:
    """Undo an admission recorded by mistake. Refused once results exist."""
    results = (
        await db_session.execute(
            select(func.count()).select_from(Enrollment).where(
                Enrollment.membership_id == membership.id,
                Enrollment.status.in_([EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED]),  # type: ignore[attr-defined]
            )
        )
    ).scalar() or 0
    if results:
        raise conflict("The student has final results; withdraw them instead of removing")
    enrollments = (
        await db_session.execute(select(Enrollment).where(Enrollment.membership_id == membership.id))
    ).scalars().all()
    for enrollment in enrollments:
        offering = await db_session.get(CourseOffering, enrollment.offering_id)
        if offering:
            await offerings_svc._set_roster_member(db_session, offering, enrollment.user_id, False)
        await db_session.delete(enrollment)
    await _set_cohort_group_member(db_session, cohort, membership.user_id, False)
    await db_session.delete(membership)


async def remove_student(
    request: Request, cohort_uuid: str, membership_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    cohort, program = await _cohort_and_program(db_session, cohort_uuid)
    await check_resource_access(request, db_session, current_user, program.program_uuid, AccessAction.UPDATE)
    membership = await get_by_uuid_or_404(
        db_session, CohortMembership, CohortMembership.membership_uuid, membership_uuid, "Student"
    )
    if membership.cohort_id != cohort.id:
        raise conflict("Student does not belong to this cohort")
    await remove_membership(db_session, cohort, membership)
    await db_session.commit()
    return "Student removed from cohort"


async def list_org_students(
    org_id: int,
    current_user: Principal,
    db_session: AsyncSession,
    program_uuid: Optional[str] = None,
    status: Optional[MembershipStatus] = None,
    query: Optional[str] = None,
) -> List[CohortMembershipRead]:
    await require_academic_manager(current_user, org_id, db_session)
    statement = (
        select(CohortMembership)
        .join(Cohort, Cohort.id == CohortMembership.cohort_id)  # type: ignore
        .join(User, User.id == CohortMembership.user_id)  # type: ignore
        .where(CohortMembership.org_id == org_id)
    )
    if program_uuid:
        program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
        statement = statement.where(Cohort.program_id == program.id)
    if status:
        statement = statement.where(CohortMembership.status == status)
    if query:
        like = f"%{query.strip()}%"
        statement = statement.where(
            CohortMembership.student_number.ilike(like)  # type: ignore[attr-defined]
            | User.username.ilike(like)  # type: ignore[attr-defined]
            | User.first_name.ilike(like)  # type: ignore[attr-defined]
            | User.last_name.ilike(like)  # type: ignore[attr-defined]
            | User.email.ilike(like)  # type: ignore[attr-defined]
        )
    rows = (await db_session.execute(statement.order_by(CohortMembership.student_number))).scalars().all()  # type: ignore
    return [await membership_read(db_session, m) for m in rows]


class MyAcademicRecord(BaseModel):
    memberships: List[CohortMembershipRead]
    offerings: List[CourseOfferingRead]
    enrollment_status: dict[str, str]
    transcripts: list = []


async def get_my_record(org_id: int, current_user: Principal, db_session: AsyncSession) -> MyAcademicRecord:
    """The signed-in student's programs and course registrations."""
    await require_academic_member(current_user, org_id, db_session)
    user_id = resolve_acting_user_id(current_user)
    memberships = (
        await db_session.execute(
            select(CohortMembership).where(CohortMembership.org_id == org_id, CohortMembership.user_id == user_id)
        )
    ).scalars().all()
    enrollments = (
        await db_session.execute(
            select(Enrollment).where(Enrollment.org_id == org_id, Enrollment.user_id == user_id)
        )
    ).scalars().all()
    offerings: List[CourseOfferingRead] = []
    status_map: dict[str, str] = {}
    for enrollment in enrollments:
        offering = await db_session.get(CourseOffering, enrollment.offering_id)
        if offering:
            offerings.append(await offerings_svc.to_read(db_session, offering))
            status_map[offering.offering_uuid] = enrollment.status.value
    from src.services.academic.grading import build_transcript

    return MyAcademicRecord(
        memberships=[await membership_read(db_session, m) for m in memberships],
        offerings=offerings,
        enrollment_status=status_map,
        transcripts=[(await build_transcript(db_session, m)).model_dump() for m in memberships],
    )
