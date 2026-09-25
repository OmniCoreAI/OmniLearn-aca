"""Course offerings: one delivery of a catalog course in a term.

Access to an offering's content course is granted through the offering's own
roster UserGroup, so it can be granted and revoked per enrollment (a dropped
student loses access; unlinking/deleting an offering removes the grant).
"""
import logging
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.calendar import AcademicTerm
from src.db.academic.catalog import AcademicCourse, CoursePrerequisite
from src.db.academic.cohorts import Cohort
from src.db.academic.curricula import CurriculumItem, CurriculumRequirement
from src.db.academic.offerings import (
    CohortMembership,
    CourseOffering,
    CourseOfferingCreate,
    CourseOfferingRead,
    CourseOfferingUpdate,
    Enrollment,
    EnrollmentRead,
    EnrollmentStatus,
    MembershipStatus,
    OfferingSession,
    OfferingSessionCreate,
    OfferingSessionRead,
    OfferingSessionUpdate,
    OfferingStatus,
)
from src.db.academic.programs import Program
from src.db.courses.courses import Course
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import User, UserReadAuthor
from src.security.auth import resolve_acting_user_id
from src.security.rbac import AccessAction, check_resource_access
from src.services.academic.authors import ensure_coordinator_authorship, get_user_author
from src.services.academic.common import (
    Principal,
    bad_request,
    conflict,
    get_by_uuid_or_404,
    get_user_by_uuid_or_400,
    now,
    require_academic_manager,
    require_academic_member,
)
from src.services.academic.validation import assert_status_transition, resolve_org_user

logger = logging.getLogger(__name__)

OFFERING_STATUS_TRANSITIONS = {
    OfferingStatus.PLANNED: {OfferingStatus.OPEN, OfferingStatus.CANCELLED},
    OfferingStatus.OPEN: {OfferingStatus.IN_PROGRESS, OfferingStatus.CANCELLED, OfferingStatus.PLANNED},
    OfferingStatus.IN_PROGRESS: {OfferingStatus.COMPLETED, OfferingStatus.CANCELLED},
    OfferingStatus.COMPLETED: set(),
    OfferingStatus.CANCELLED: set(),
}
ENROLLMENT_STATUS_TRANSITIONS = {
    EnrollmentStatus.REGISTERED: {
        EnrollmentStatus.DROPPED, EnrollmentStatus.WITHDRAWN, EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED,
    },
    EnrollmentStatus.DROPPED: {EnrollmentStatus.REGISTERED},
    EnrollmentStatus.WITHDRAWN: {EnrollmentStatus.REGISTERED},
    EnrollmentStatus.COMPLETED: set(),
    EnrollmentStatus.FAILED: set(),
}
# Enrollment states that keep content access (completed students keep read access).
ACCESS_STATES = {EnrollmentStatus.REGISTERED, EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED}
ACTIVE_OFFERING_STATES = {OfferingStatus.PLANNED, OfferingStatus.OPEN, OfferingStatus.IN_PROGRESS}


# ---------------------------------------------------------------------------
# Access
# ---------------------------------------------------------------------------

async def _cohort_program(db_session: AsyncSession, cohort_id: Optional[int]) -> Optional[Program]:
    if not cohort_id:
        return None
    cohort = await db_session.get(Cohort, cohort_id)
    return await db_session.get(Program, cohort.program_id) if cohort else None


async def require_offering_manager(
    request: Request, db_session: AsyncSession, current_user: Principal, offering: CourseOffering
) -> None:
    """Cohort offerings are managed by whoever can manage the owning program;
    open (cohort-less) offerings by organization admins/maintainers."""
    program = await _cohort_program(db_session, offering.cohort_id)
    if program:
        await check_resource_access(request, db_session, current_user, program.program_uuid, AccessAction.UPDATE)
    else:
        await require_academic_manager(current_user, offering.org_id, db_session)


async def require_offering_staff(
    request: Request, db_session: AsyncSession, current_user: Principal, offering: CourseOffering
) -> None:
    """Managers plus the offering's own instructor / teaching assistant."""
    user_id = resolve_acting_user_id(current_user)
    if user_id and user_id in (offering.instructor_id, offering.teaching_assistant_id):
        return
    await require_offering_manager(request, db_session, current_user, offering)


# ---------------------------------------------------------------------------
# Roster group / content access
# ---------------------------------------------------------------------------

async def _ensure_roster_group(db_session: AsyncSession, offering: CourseOffering) -> UserGroup:
    if offering.usergroup_id:
        group = await db_session.get(UserGroup, offering.usergroup_id)
        if group:
            return group
    group = UserGroup(
        name=f"{offering.code} (Roster)",
        description=f"Enrollment roster for course offering {offering.code}",
        org_id=offering.org_id,
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(group)
    await db_session.flush()
    offering.usergroup_id = group.id
    db_session.add(offering)
    return group


async def _content_course_uuid(db_session: AsyncSession, offering: CourseOffering) -> Optional[str]:
    if not offering.content_course_id:
        return None
    course = await db_session.get(Course, offering.content_course_id)
    return course.course_uuid if course else None


async def _sync_content_access(db_session: AsyncSession, offering: CourseOffering) -> None:
    """Link the roster group to exactly the offering's current content course."""
    group = await _ensure_roster_group(db_session, offering)
    target = await _content_course_uuid(db_session, offering)
    rows = (
        await db_session.execute(select(UserGroupResource).where(UserGroupResource.usergroup_id == group.id))
    ).scalars().all()
    have = False
    for row in rows:
        if row.resource_uuid == target:
            have = True
        elif row.resource_uuid.startswith("course_"):
            await db_session.delete(row)
    if target and not have:
        db_session.add(
            UserGroupResource(
                usergroup_id=group.id,
                resource_uuid=target,
                org_id=offering.org_id,
                creation_date=now(),
                update_date=now(),
            )
        )


async def _sync_content_course(db_session: AsyncSession, offering: CourseOffering) -> None:
    """Keep the content course usable for this delivery (caller commits):

    - the instructor and TA become MAINTAINER authors, so they get the standard
      course editor, grading and contributor rights;
    - once the offering is open/in progress the course is published (it stays
      non-public), because UserGroup access only applies to published courses.
    """
    if not offering.content_course_id:
        return
    course = await db_session.get(Course, offering.content_course_id)
    if not course:
        return
    for user_id in (offering.instructor_id, offering.teaching_assistant_id):
        await ensure_coordinator_authorship(db_session, course.course_uuid, user_id)
    if offering.status in (OfferingStatus.OPEN, OfferingStatus.IN_PROGRESS) and not course.published:
        course.published = True
        db_session.add(course)


async def _set_roster_member(db_session: AsyncSession, offering: CourseOffering, user_id: int, present: bool) -> None:
    group = await _ensure_roster_group(db_session, offering)
    row = (
        await db_session.execute(
            select(UserGroupUser).where(UserGroupUser.usergroup_id == group.id, UserGroupUser.user_id == user_id)
        )
    ).scalars().first()
    if present and not row:
        db_session.add(
            UserGroupUser(
                usergroup_id=group.id, user_id=user_id, org_id=offering.org_id,
                creation_date=now(), update_date=now(),
            )
        )
    elif not present and row:
        await db_session.delete(row)


async def delete_offering_group(db_session: AsyncSession, offering: CourseOffering) -> None:
    """Remove the roster group (and with it every access grant it carried)."""
    if not offering.usergroup_id:
        return
    group = await db_session.get(UserGroup, offering.usergroup_id)
    if group:
        for model in (UserGroupResource, UserGroupUser):
            rows = (await db_session.execute(select(model).where(model.usergroup_id == group.id))).scalars().all()
            for row in rows:
                await db_session.delete(row)
        await db_session.delete(group)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

async def _enrolled_count(db_session: AsyncSession, offering_id: int) -> int:
    return int(
        (
            await db_session.execute(
                select(func.count()).select_from(Enrollment).where(
                    Enrollment.offering_id == offering_id, Enrollment.status == EnrollmentStatus.REGISTERED
                )
            )
        ).scalar()
        or 0
    )


async def to_read(db_session: AsyncSession, offering: CourseOffering) -> CourseOfferingRead:
    course = await db_session.get(AcademicCourse, offering.academic_course_id)
    term = await db_session.get(AcademicTerm, offering.term_id)
    cohort = await db_session.get(Cohort, offering.cohort_id) if offering.cohort_id else None
    item = await db_session.get(CurriculumItem, offering.curriculum_item_id) if offering.curriculum_item_id else None
    content = await db_session.get(Course, offering.content_course_id) if offering.content_course_id else None
    return CourseOfferingRead(
        **offering.model_dump(),
        academic_course_uuid=course.academic_course_uuid if course else "",
        course_code=course.code if course else "",
        course_name=course.name if course else "",
        credits=(course.credits or 0) if course else 0,
        term_uuid=term.term_uuid if term else "",
        term_code=term.code if term else "",
        cohort_uuid=cohort.cohort_uuid if cohort else None,
        cohort_code=cohort.code if cohort else None,
        cohort_name=cohort.name if cohort else None,
        requirement=getattr(item.requirement, "value", item.requirement) if item else None,
        instructor=await get_user_author(db_session, offering.instructor_id),
        teaching_assistant=await get_user_author(db_session, offering.teaching_assistant_id),
        content_course_uuid=content.course_uuid if content else None,
        content_course_name=content.name if content else None,
        enrolled_count=await _enrolled_count(db_session, offering.id),  # type: ignore[arg-type]
    )


async def list_offerings(
    org_id: int,
    current_user: Principal,
    db_session: AsyncSession,
    term_uuid: Optional[str] = None,
    cohort_uuid: Optional[str] = None,
    academic_course_uuid: Optional[str] = None,
) -> List[CourseOfferingRead]:
    await require_academic_member(current_user, org_id, db_session)
    statement = select(CourseOffering).where(CourseOffering.org_id == org_id)
    if term_uuid:
        term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
        statement = statement.where(CourseOffering.term_id == term.id)
    if cohort_uuid:
        cohort = await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, cohort_uuid, "Cohort")
        statement = statement.where(CourseOffering.cohort_id == cohort.id)
    if academic_course_uuid:
        course = await get_by_uuid_or_404(
            db_session, AcademicCourse, AcademicCourse.academic_course_uuid, academic_course_uuid, "Course"
        )
        statement = statement.where(CourseOffering.academic_course_id == course.id)
    rows = (await db_session.execute(statement.order_by(CourseOffering.code))).scalars().all()  # type: ignore
    return [await to_read(db_session, o) for o in rows]


async def get_offering_or_404(db_session: AsyncSession, offering_uuid: str) -> CourseOffering:
    return await get_by_uuid_or_404(db_session, CourseOffering, CourseOffering.offering_uuid, offering_uuid, "Offering")


async def get_offering(offering_uuid: str, current_user: Principal, db_session: AsyncSession) -> CourseOfferingRead:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_academic_member(current_user, offering.org_id, db_session)
    return await to_read(db_session, offering)


# ---------------------------------------------------------------------------
# Create / update / delete
# ---------------------------------------------------------------------------

def build_offering_code(course: AcademicCourse, term: AcademicTerm, cohort: Optional[Cohort], section: str) -> str:
    parts = [course.code, term.code]
    if cohort is not None and cohort.code:
        parts.append(cohort.code)
    parts.append(section)
    return "-".join(parts)


async def _clone_template_content(
    request: Request,
    db_session: AsyncSession,
    current_user: Principal,
    course: AcademicCourse,
    offering_code: str,
) -> Optional[int]:
    """Clone the catalog course's template LMS course for one offering (never per student)."""
    if not course.template_course_id:
        return None
    template = await db_session.get(Course, course.template_course_id)
    if not template:
        return None
    from src.services.courses.courses import clone_course

    try:
        cloned = await clone_course(request, template.course_uuid, current_user, db_session)
    except HTTPException:
        raise
    except Exception:  # file copy / storage failures must not block the offering
        logger.warning("Could not clone template course for offering %s", offering_code, exc_info=True)
        return None
    new_course = (
        await db_session.execute(select(Course).where(Course.course_uuid == cloned.course_uuid))
    ).scalars().first()
    if not new_course:
        return None
    new_course.name = f"{course.code} {course.name} — {offering_code}"
    db_session.add(new_course)
    await db_session.flush()
    return new_course.id


async def _resolve_content_course(db_session: AsyncSession, org_id: int, course_uuid: Optional[str]) -> Optional[int]:
    if not course_uuid:
        return None
    course = await get_by_uuid_or_404(db_session, Course, Course.course_uuid, course_uuid, "Content course")
    if course.org_id != org_id:
        raise bad_request("Content course belongs to another organization")
    return course.id


async def create_offering_record(
    request: Request,
    db_session: AsyncSession,
    current_user: Principal,
    course: AcademicCourse,
    term: AcademicTerm,
    cohort: Optional[Cohort],
    *,
    section: str = "A",
    curriculum_item_id: Optional[int] = None,
    content_course_id: Optional[int] = None,
    clone_template: bool = True,
    extra: Optional[dict] = None,
) -> CourseOffering:
    section = (section or "A").strip().upper()[:8] or "A"
    code = build_offering_code(course, term, cohort, section)
    existing = (
        await db_session.execute(
            select(CourseOffering).where(
                CourseOffering.academic_course_id == course.id,
                CourseOffering.term_id == term.id,
                CourseOffering.cohort_id == (cohort.id if cohort else None),
                CourseOffering.section == section,
            )
        )
    ).scalars().first()
    if existing:
        raise conflict(f"Offering {code} already exists")
    if content_course_id is None and clone_template:
        content_course_id = await _clone_template_content(request, db_session, current_user, course, code)

    offering = CourseOffering(
        section=section,
        code=code,
        org_id=course.org_id,
        academic_course_id=course.id,
        term_id=term.id,
        cohort_id=cohort.id if cohort else None,
        curriculum_item_id=curriculum_item_id,
        content_course_id=content_course_id,
        offering_uuid=f"offering_{uuid4()}",
        creation_date=now(),
        update_date=now(),
        **(extra or {}),
    )
    db_session.add(offering)
    await db_session.flush()
    await _sync_content_access(db_session, offering)
    await _sync_content_course(db_session, offering)
    return offering


async def create_offering(
    request: Request, org_id: int, data: CourseOfferingCreate, current_user: Principal, db_session: AsyncSession
) -> CourseOfferingRead:
    course = await get_by_uuid_or_404(
        db_session, AcademicCourse, AcademicCourse.academic_course_uuid, data.academic_course_uuid, "Course"
    )
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, data.term_uuid, "Term")
    cohort = (
        await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, data.cohort_uuid, "Cohort")
        if data.cohort_uuid
        else None
    )
    for obj in (course, term, cohort):
        if obj is not None and obj.org_id != org_id:
            raise bad_request("All offering references must belong to the same organization")

    probe = CourseOffering(org_id=org_id, academic_course_id=course.id, term_id=term.id, cohort_id=cohort.id if cohort else None)
    await require_offering_manager(request, db_session, current_user, probe)

    if data.capacity is not None and data.capacity < 0:
        raise bad_request("Capacity cannot be negative")
    instructor_id = await resolve_org_user(db_session, org_id, data.instructor_uuid, label="Instructor")
    ta_id = await resolve_org_user(db_session, org_id, data.teaching_assistant_uuid, label="Teaching assistant")
    content_course_id = await _resolve_content_course(db_session, org_id, data.content_course_uuid)

    curriculum_item_id = None
    if cohort and cohort.curriculum_id:
        item = (
            await db_session.execute(
                select(CurriculumItem).where(
                    CurriculumItem.curriculum_id == cohort.curriculum_id,
                    CurriculumItem.academic_course_id == course.id,
                )
            )
        ).scalars().first()
        curriculum_item_id = item.id if item else None

    offering = await create_offering_record(
        request, db_session, current_user, course, term, cohort,
        section=data.section,
        curriculum_item_id=curriculum_item_id,
        content_course_id=content_course_id,
        clone_template=data.clone_template,
        extra={
            "classroom": data.classroom,
            "capacity": data.capacity,
            "status": data.status,
            "instructor_id": instructor_id,
            "teaching_assistant_id": ta_id,
        },
    )
    await db_session.commit()
    await db_session.refresh(offering)
    return await to_read(db_session, offering)


async def update_offering(
    request: Request, offering_uuid: str, data: CourseOfferingUpdate, current_user: Principal, db_session: AsyncSession
) -> CourseOfferingRead:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_manager(request, db_session, current_user, offering)
    update = data.model_dump(exclude_unset=True)
    if update.get("capacity") is not None and update["capacity"] < 0:
        raise bad_request("Capacity cannot be negative")
    if update.get("status") is not None:
        assert_status_transition(offering.status, update["status"], OFFERING_STATUS_TRANSITIONS)
    if "instructor_uuid" in update:
        offering.instructor_id = await resolve_org_user(
            db_session, offering.org_id, update.pop("instructor_uuid"), label="Instructor"
        )
    if "teaching_assistant_uuid" in update:
        offering.teaching_assistant_id = await resolve_org_user(
            db_session, offering.org_id, update.pop("teaching_assistant_uuid"), label="Teaching assistant"
        )
    content_changed = False
    if "content_course_uuid" in update:
        offering.content_course_id = await _resolve_content_course(
            db_session, offering.org_id, update.pop("content_course_uuid")
        )
        content_changed = True
    if "section" in update and update["section"] and update["section"].upper() != offering.section:
        course = await db_session.get(AcademicCourse, offering.academic_course_id)
        term = await db_session.get(AcademicTerm, offering.term_id)
        cohort = await db_session.get(Cohort, offering.cohort_id) if offering.cohort_id else None
        update["section"] = update["section"].strip().upper()[:8]
        offering.code = build_offering_code(course, term, cohort, update["section"])  # type: ignore[arg-type]
    for key, value in update.items():
        setattr(offering, key, value)
    offering.update_date = now()
    db_session.add(offering)
    if content_changed:
        await _sync_content_access(db_session, offering)
    await _sync_content_course(db_session, offering)
    await db_session.commit()
    await db_session.refresh(offering)
    return await to_read(db_session, offering)


async def delete_offering(
    request: Request, offering_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_manager(request, db_session, current_user, offering)
    graded = (
        await db_session.execute(
            select(func.count()).select_from(Enrollment).where(
                Enrollment.offering_id == offering.id,
                Enrollment.status.in_([EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED]),  # type: ignore[attr-defined]
            )
        )
    ).scalar() or 0
    if graded:
        raise conflict("This offering has final results; cancel it instead of deleting")
    await delete_offering_group(db_session, offering)
    await db_session.delete(offering)
    await db_session.commit()
    return "Offering deleted"


# ---------------------------------------------------------------------------
# Sessions (schedule)
# ---------------------------------------------------------------------------

async def list_sessions(offering_uuid: str, current_user: Principal, db_session: AsyncSession) -> List[OfferingSessionRead]:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_academic_member(current_user, offering.org_id, db_session)
    rows = (
        await db_session.execute(
            select(OfferingSession).where(OfferingSession.offering_id == offering.id)
            .order_by(OfferingSession.start_datetime, OfferingSession.order)  # type: ignore
        )
    ).scalars().all()
    return [OfferingSessionRead.model_validate(r) for r in rows]


def _validate_session(data: dict) -> None:
    start, end = data.get("start_datetime"), data.get("end_datetime")
    if start and end and start > end:
        raise bad_request("Session start must be before its end")


async def create_session(
    request: Request, offering_uuid: str, data: OfferingSessionCreate, current_user: Principal, db_session: AsyncSession
) -> OfferingSessionRead:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_staff(request, db_session, current_user, offering)
    _validate_session(data.model_dump())
    session = OfferingSession.model_validate(data, update={"offering_id": offering.id, "org_id": offering.org_id})
    session.session_uuid = f"offeringsession_{uuid4()}"
    session.creation_date = session.update_date = now()
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return OfferingSessionRead.model_validate(session)


async def _get_session(db_session: AsyncSession, offering: CourseOffering, session_uuid: str) -> OfferingSession:
    session = await get_by_uuid_or_404(db_session, OfferingSession, OfferingSession.session_uuid, session_uuid, "Session")
    if session.offering_id != offering.id:
        raise bad_request("Session does not belong to this offering")
    return session


async def update_session(
    request: Request,
    offering_uuid: str,
    session_uuid: str,
    data: OfferingSessionUpdate,
    current_user: Principal,
    db_session: AsyncSession,
) -> OfferingSessionRead:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_staff(request, db_session, current_user, offering)
    session = await _get_session(db_session, offering, session_uuid)
    update = data.model_dump(exclude_unset=True)
    _validate_session({**session.model_dump(), **update})
    for key, value in update.items():
        setattr(session, key, value)
    session.update_date = now()
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return OfferingSessionRead.model_validate(session)


async def delete_session(
    request: Request, offering_uuid: str, session_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_staff(request, db_session, current_user, offering)
    session = await _get_session(db_session, offering, session_uuid)
    await db_session.delete(session)
    await db_session.commit()
    return "Session deleted"


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

async def missing_prerequisites(db_session: AsyncSession, course_id: int, user_id: int) -> List[str]:
    """Codes of prerequisite courses the student has not completed."""
    prereqs = (
        await db_session.execute(
            select(AcademicCourse)
            .join(CoursePrerequisite, CoursePrerequisite.prerequisite_id == AcademicCourse.id)  # type: ignore
            .where(CoursePrerequisite.academic_course_id == course_id)
        )
    ).scalars().all()
    missing = []
    for prereq in prereqs:
        done = (
            await db_session.execute(
                select(Enrollment)
                .join(CourseOffering, CourseOffering.id == Enrollment.offering_id)  # type: ignore
                .where(
                    CourseOffering.academic_course_id == prereq.id,
                    Enrollment.user_id == user_id,
                    Enrollment.status == EnrollmentStatus.COMPLETED,
                )
            )
        ).scalars().first()
        if not done:
            missing.append(prereq.code)
    return missing


async def enroll_user(
    db_session: AsyncSession,
    offering: CourseOffering,
    user_id: int,
    *,
    membership: Optional[CohortMembership] = None,
    check_prerequisites: bool = True,
    check_capacity: bool = True,
) -> Enrollment:
    """Register a user in an offering (idempotent; re-activates a dropped enrollment).
    Caller commits."""
    if offering.status not in ACTIVE_OFFERING_STATES:
        raise conflict("This offering is not open for registration")
    enrollment = (
        await db_session.execute(
            select(Enrollment).where(Enrollment.offering_id == offering.id, Enrollment.user_id == user_id)
        )
    ).scalars().first()
    if enrollment and enrollment.status in (EnrollmentStatus.REGISTERED, EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED):
        return enrollment
    if check_capacity and offering.capacity is not None:
        if await _enrolled_count(db_session, offering.id) >= offering.capacity:  # type: ignore[arg-type]
            raise conflict("This offering is at full capacity")
    if check_prerequisites:
        missing = await missing_prerequisites(db_session, offering.academic_course_id, user_id)
        if missing:
            raise conflict(f"Missing prerequisites: {', '.join(missing)}")
    if membership is None and offering.cohort_id:
        membership = (
            await db_session.execute(
                select(CohortMembership).where(
                    CohortMembership.cohort_id == offering.cohort_id, CohortMembership.user_id == user_id
                )
            )
        ).scalars().first()
    if enrollment is None:
        enrollment = Enrollment(
            offering_id=offering.id,
            user_id=user_id,
            org_id=offering.org_id,
            enrollment_uuid=f"enrollment_{uuid4()}",
            registered_at=now(),
        )
    enrollment.status = EnrollmentStatus.REGISTERED
    enrollment.membership_id = membership.id if membership else enrollment.membership_id
    enrollment.status_changed_at = now()
    db_session.add(enrollment)
    await _set_roster_member(db_session, offering, user_id, True)
    return enrollment


async def set_enrollment_status(
    db_session: AsyncSession, offering: CourseOffering, enrollment: Enrollment, status: EnrollmentStatus
) -> Enrollment:
    """Apply a status change and keep the roster group in sync. Caller commits."""
    assert_status_transition(enrollment.status, status, ENROLLMENT_STATUS_TRANSITIONS)
    enrollment.status = status
    enrollment.status_changed_at = now()
    db_session.add(enrollment)
    await _set_roster_member(db_session, offering, enrollment.user_id, status in ACCESS_STATES)
    return enrollment


async def _enrollment_read(db_session: AsyncSession, enrollment: Enrollment, offering: CourseOffering) -> EnrollmentRead:
    user = await db_session.get(User, enrollment.user_id)
    membership = await db_session.get(CohortMembership, enrollment.membership_id) if enrollment.membership_id else None
    return EnrollmentRead(
        enrollment_uuid=enrollment.enrollment_uuid,
        status=enrollment.status,
        registered_at=enrollment.registered_at,
        status_changed_at=enrollment.status_changed_at,
        user=UserReadAuthor.model_validate(user),
        student_number=membership.student_number if membership else None,
        offering_uuid=offering.offering_uuid,
        offering_code=offering.code,
    )


async def list_enrollments(
    request: Request, offering_uuid: str, current_user: Principal, db_session: AsyncSession
) -> List[EnrollmentRead]:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_staff(request, db_session, current_user, offering)
    rows = (
        await db_session.execute(
            select(Enrollment).where(Enrollment.offering_id == offering.id).order_by(Enrollment.registered_at)  # type: ignore
        )
    ).scalars().all()
    return [await _enrollment_read(db_session, e, offering) for e in rows]


async def create_enrollment(
    request: Request,
    offering_uuid: str,
    user_uuid: str,
    current_user: Principal,
    db_session: AsyncSession,
    override_prerequisites: bool = False,
) -> EnrollmentRead:
    offering = await get_offering_or_404(db_session, offering_uuid)
    await require_offering_manager(request, db_session, current_user, offering)
    user = await get_user_by_uuid_or_400(db_session, user_uuid)
    await resolve_org_user(db_session, offering.org_id, user.user_uuid, label="Student")
    if offering.cohort_id:
        membership = (
            await db_session.execute(
                select(CohortMembership).where(
                    CohortMembership.cohort_id == offering.cohort_id, CohortMembership.user_id == user.id
                )
            )
        ).scalars().first()
        if membership and membership.status != MembershipStatus.ACTIVE:
            raise conflict("The student's cohort membership is not active")
    enrollment = await enroll_user(
        db_session, offering, user.id, check_prerequisites=not override_prerequisites  # type: ignore[arg-type]
    )
    await db_session.commit()
    await db_session.refresh(enrollment)
    return await _enrollment_read(db_session, enrollment, offering)


async def update_enrollment(
    request: Request,
    offering_uuid: str,
    enrollment_uuid: str,
    status: EnrollmentStatus,
    current_user: Principal,
    db_session: AsyncSession,
) -> EnrollmentRead:
    offering = await get_offering_or_404(db_session, offering_uuid)
    # Instructors record completion/failure; drops and withdrawals are administrative.
    if status in (EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED):
        await require_offering_staff(request, db_session, current_user, offering)
    else:
        await require_offering_manager(request, db_session, current_user, offering)
    enrollment = await get_by_uuid_or_404(
        db_session, Enrollment, Enrollment.enrollment_uuid, enrollment_uuid, "Enrollment"
    )
    if enrollment.offering_id != offering.id:
        raise bad_request("Enrollment does not belong to this offering")
    if status == EnrollmentStatus.REGISTERED and offering.capacity is not None:
        if await _enrolled_count(db_session, offering.id) >= offering.capacity:  # type: ignore[arg-type]
            raise conflict("This offering is at full capacity")
    await set_enrollment_status(db_session, offering, enrollment, status)
    await db_session.commit()
    await db_session.refresh(enrollment)
    return await _enrollment_read(db_session, enrollment, offering)


# ---------------------------------------------------------------------------
# Curriculum-driven generation for a cohort
# ---------------------------------------------------------------------------

async def auto_enroll_member(db_session: AsyncSession, cohort: Cohort, membership: CohortMembership) -> int:
    """Register an active cohort member in the cohort's current required offerings."""
    offerings = (
        await db_session.execute(
            select(CourseOffering).where(
                CourseOffering.cohort_id == cohort.id,
                CourseOffering.status.in_(list(ACTIVE_OFFERING_STATES)),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    count = 0
    for offering in offerings:
        item = await db_session.get(CurriculumItem, offering.curriculum_item_id) if offering.curriculum_item_id else None
        if item is not None and item.requirement != CurriculumRequirement.REQUIRED:
            continue
        await enroll_user(
            db_session, offering, membership.user_id, membership=membership,
            check_prerequisites=False, check_capacity=False,
        )
        count += 1
    return count


async def generate_cohort_offerings(
    request: Request,
    cohort_uuid: str,
    term_uuid: str,
    year_no: int,
    term_no: int,
    current_user: Principal,
    db_session: AsyncSession,
) -> List[CourseOfferingRead]:
    """Create the offerings for one curriculum slot (year, term) of a cohort in
    a calendar term, then register the cohort's active students in the
    required ones. Existing offerings are kept (idempotent)."""
    cohort = await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, cohort_uuid, "Cohort")
    program = await db_session.get(Program, cohort.program_id)
    await check_resource_access(request, db_session, current_user, program.program_uuid, AccessAction.UPDATE)  # type: ignore[union-attr]
    if not cohort.curriculum_id:
        raise conflict("Assign a curriculum version to this cohort first")
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
    if term.org_id != cohort.org_id:
        raise bad_request("Term belongs to another organization")

    items = (
        await db_session.execute(
            select(CurriculumItem).where(
                CurriculumItem.curriculum_id == cohort.curriculum_id,
                CurriculumItem.year_no == year_no,
                CurriculumItem.term_no == term_no,
            ).order_by(CurriculumItem.order)  # type: ignore
        )
    ).scalars().all()
    if not items:
        raise conflict(f"The curriculum has no courses in year {year_no}, term {term_no}")

    result: List[CourseOffering] = []
    for item in items:
        course = await db_session.get(AcademicCourse, item.academic_course_id)
        existing = (
            await db_session.execute(
                select(CourseOffering).where(
                    CourseOffering.academic_course_id == item.academic_course_id,
                    CourseOffering.term_id == term.id,
                    CourseOffering.cohort_id == cohort.id,
                )
            )
        ).scalars().first()
        if existing:
            result.append(existing)
            continue
        offering = await create_offering_record(
            request, db_session, current_user, course, term, cohort,  # type: ignore[arg-type]
            curriculum_item_id=item.id,
        )
        result.append(offering)

    members = (
        await db_session.execute(
            select(CohortMembership).where(
                CohortMembership.cohort_id == cohort.id, CohortMembership.status == MembershipStatus.ACTIVE
            )
        )
    ).scalars().all()
    for membership in members:
        await auto_enroll_member(db_session, cohort, membership)
    await db_session.commit()
    return [await to_read(db_session, o) for o in result]
