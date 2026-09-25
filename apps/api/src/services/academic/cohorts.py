from typing import List, Optional
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser, User, UserReadAuthor
from src.db.usergroups import UserGroup
from src.db.usergroup_user import UserGroupUser
from src.db.usergroup_resources import UserGroupResource
from src.db.academic.programs import Program
from src.db.academic.cohorts import (
    Cohort,
    CohortCreate,
    CohortRead,
    CohortUpdate,
)
from src.db.academic.semesters import Semester
from src.db.academic.links import SemesterCourse
from src.db.academic.calendar import AcademicTerm, AcademicYear
from src.db.academic.curricula import Curriculum, CurriculumStatus
from src.db.academic.offerings import CohortMembership, CourseOffering, MembershipStatus
from src.db.courses.courses import Course
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import get_user_author
from src.services.academic.validation import (
    assert_status_transition,
    resolve_coordinator,
    resolve_org_user,
    validate_cohort_payload,
    COHORT_STATUS_TRANSITIONS,
)
from src.services.academic import students as students_svc
from src.services.academic.offerings import delete_offering_group


async def _get_cohort_or_404(db_session: AsyncSession, cohort_uuid: str) -> Cohort:
    statement = select(Cohort).where(Cohort.cohort_uuid == cohort_uuid)
    cohort = (await db_session.execute(statement)).scalars().first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    return cohort


async def _get_program_or_404(db_session: AsyncSession, program_uuid: str) -> Program:
    statement = select(Program).where(Program.program_uuid == program_uuid)
    program = (await db_session.execute(statement)).scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


async def _enrolled_count(db_session: AsyncSession, cohort: Cohort) -> int:
    """Active students (cohort memberships)."""
    statement = select(func.count()).select_from(CohortMembership).where(
        CohortMembership.cohort_id == cohort.id,
        CohortMembership.status == MembershipStatus.ACTIVE,
    )
    return int((await db_session.execute(statement)).scalar() or 0)


async def _to_read(db_session: AsyncSession, cohort: Cohort) -> CohortRead:
    coordinator = await get_user_author(db_session, cohort.coordinator_id)
    enrolled = await _enrolled_count(db_session, cohort)
    curriculum = await db_session.get(Curriculum, cohort.curriculum_id) if cohort.curriculum_id else None
    term = await db_session.get(AcademicTerm, cohort.intake_term_id) if cohort.intake_term_id else None
    offering_count = (
        await db_session.execute(
            select(func.count()).select_from(CourseOffering).where(CourseOffering.cohort_id == cohort.id)
        )
    ).scalar() or 0
    return CohortRead(
        **cohort.model_dump(),
        coordinator=coordinator,
        enrolled_count=enrolled,
        offering_count=int(offering_count),
        curriculum_uuid=curriculum.curriculum_uuid if curriculum else None,
        curriculum_version=curriculum.version if curriculum else None,
        intake_term_uuid=term.term_uuid if term else None,
        intake_term_code=term.code if term else None,
    )


async def _resolve_curriculum(
    db_session: AsyncSession, program: Program, curriculum_uuid: Optional[str]
) -> Optional[int]:
    """Explicit version, else the program's latest ACTIVE version (if any)."""
    if curriculum_uuid:
        curriculum = (
            await db_session.execute(select(Curriculum).where(Curriculum.curriculum_uuid == curriculum_uuid))
        ).scalars().first()
        if not curriculum or curriculum.program_id != program.id:
            raise HTTPException(status_code=400, detail="Curriculum does not belong to this program")
        if curriculum.status == CurriculumStatus.RETIRED:
            raise HTTPException(status_code=409, detail="A retired curriculum cannot be assigned")
        return curriculum.id
    active = (
        await db_session.execute(
            select(Curriculum)
            .where(Curriculum.program_id == program.id, Curriculum.status == CurriculumStatus.ACTIVE)
            .order_by(Curriculum.version.desc())  # type: ignore
        )
    ).scalars().first()
    return active.id if active else None


async def _resolve_intake_term(
    db_session: AsyncSession, org_id: int, term_uuid: Optional[str]
) -> Optional[AcademicTerm]:
    if not term_uuid:
        return None
    term = (
        await db_session.execute(select(AcademicTerm).where(AcademicTerm.term_uuid == term_uuid))
    ).scalars().first()
    if not term or term.org_id != org_id:
        raise HTTPException(status_code=400, detail="Intake term not found")
    return term


async def _generate_cohort_code(
    db_session: AsyncSession, program: Program, cohort: Cohort, term: Optional[AcademicTerm]
) -> Optional[str]:
    """``<PROGRAM_CODE>-<YEAR>`` (e.g. MSC-AI-2026); suffixed if a second intake shares the year."""
    if not program.code:
        return None
    year = None
    if term and term.code and term.code[-4:].isdigit():
        year = term.code[-4:]
    elif cohort.start_date and cohort.start_date[:4].isdigit():
        year = cohort.start_date[:4]
    elif cohort.academic_year and cohort.academic_year[:4].isdigit():
        year = cohort.academic_year[:4]
    if not year:
        return None
    base = f"{program.code}-{year}"
    candidate, n = base, 1
    while (
        await db_session.execute(
            select(Cohort).where(Cohort.org_id == program.org_id, Cohort.code == candidate)
        )
    ).scalars().first():
        n += 1
        candidate = f"{base}-{n}"
    return candidate


async def create_cohort(
    request: Request,
    program_uuid: str,
    cohort_object: CohortCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CohortRead:
    program = await _get_program_or_404(db_session, program_uuid)

    # Adding a cohort is a mutation on the parent program (RBAC delegates up).
    await check_resource_access(
        request, db_session, current_user, program.program_uuid, AccessAction.UPDATE
    )

    validate_cohort_payload(cohort_object.model_dump())
    coordinator_id = await resolve_coordinator(
        db_session, program.org_id, cohort_object.coordinator_uuid
    )

    curriculum_id = await _resolve_curriculum(db_session, program, cohort_object.curriculum_uuid)
    intake_term = await _resolve_intake_term(db_session, program.org_id, cohort_object.intake_term_uuid)

    cohort = Cohort.model_validate(
        cohort_object.model_dump(exclude={"curriculum_uuid", "intake_term_uuid", "coordinator_uuid"}),
        update={"org_id": program.org_id, "program_id": program.id},
    )
    cohort.coordinator_id = coordinator_id
    cohort.curriculum_id = curriculum_id
    if intake_term:
        cohort.intake_term_id = intake_term.id
        if not cohort.start_date:
            cohort.start_date = intake_term.start_date
        if not cohort.academic_year:
            year = await db_session.get(AcademicYear, intake_term.academic_year_id)
            cohort.academic_year = year.code if year else None
    cohort.code = await _generate_cohort_code(db_session, program, cohort, intake_term)
    cohort.cohort_uuid = f"cohort_{uuid4()}"
    cohort.creation_date = str(datetime.now())
    cohort.update_date = str(datetime.now())

    # Auto-create the enrollment UserGroup for this cohort (reuses UserGroup).
    usergroup = UserGroup(
        name=f"{cohort.name} (Cohort)",
        description=f"Enrollment group for cohort {cohort.name}",
        org_id=program.org_id,
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    try:
        db_session.add(usergroup)
        await db_session.flush()
        await db_session.refresh(usergroup)
        cohort.usergroup_id = usergroup.id
        db_session.add(cohort)
        await db_session.commit()
        await db_session.refresh(cohort)
    except Exception:
        await db_session.rollback()
        raise

    return await _to_read(db_session, cohort)


async def get_cohort(
    request: Request,
    cohort_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CohortRead:
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        cohort.cohort_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )
    return await _to_read(db_session, cohort)


async def get_cohorts_by_program(
    request: Request,
    program_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[CohortRead]:
    program = await _get_program_or_404(db_session, program_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        program.program_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    statement = (
        select(Cohort)
        .where(Cohort.program_id == program.id)
        .order_by(Cohort.creation_date.desc())  # type: ignore
    )
    cohorts = (await db_session.execute(statement)).scalars().all()
    return [await _to_read(db_session, c) for c in cohorts]


async def update_cohort(
    request: Request,
    cohort_uuid: str,
    cohort_object: CohortUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CohortRead:
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request, db_session, current_user, cohort.cohort_uuid, AccessAction.UPDATE
    )

    update_data = cohort_object.model_dump(exclude_unset=True)
    merged = {**cohort.model_dump(), **update_data}
    validate_cohort_payload(merged)

    if "status" in update_data and update_data["status"] is not None:
        assert_status_transition(
            cohort.status, update_data["status"], COHORT_STATUS_TRANSITIONS
        )

    if "coordinator_uuid" in update_data:
        coordinator_uuid = update_data.pop("coordinator_uuid")
        cohort.coordinator_id = await resolve_coordinator(
            db_session, cohort.org_id, coordinator_uuid
        )
    if "curriculum_uuid" in update_data:
        curriculum_uuid = update_data.pop("curriculum_uuid")
        program = await db_session.get(Program, cohort.program_id)
        new_id = await _resolve_curriculum(db_session, program, curriculum_uuid) if curriculum_uuid else None  # type: ignore[arg-type]
        if new_id != cohort.curriculum_id:
            has_offerings = (
                await db_session.execute(
                    select(func.count()).select_from(CourseOffering).where(CourseOffering.cohort_id == cohort.id)
                )
            ).scalar() or 0
            if has_offerings:
                raise HTTPException(
                    status_code=409,
                    detail="The cohort already has offerings; its curriculum version can no longer change",
                )
            cohort.curriculum_id = new_id
    if "intake_term_uuid" in update_data:
        term = await _resolve_intake_term(db_session, cohort.org_id, update_data.pop("intake_term_uuid"))
        cohort.intake_term_id = term.id if term else None

    for key, value in update_data.items():
        setattr(cohort, key, value)
    cohort.update_date = str(datetime.now())

    db_session.add(cohort)
    await db_session.commit()
    await db_session.refresh(cohort)
    return await _to_read(db_session, cohort)


async def delete_cohort(
    request: Request,
    cohort_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request, db_session, current_user, cohort.cohort_uuid, AccessAction.DELETE
    )
    await delete_cohort_dependents(db_session, cohort)
    await db_session.delete(cohort)
    await db_session.commit()
    return "Cohort deleted"


async def delete_cohort_dependents(db_session: AsyncSession, cohort: Cohort) -> None:
    """Remove the access groups a cohort owns (its own + its offerings' rosters),
    which would otherwise be orphaned by the FK's SET NULL."""
    offerings = (
        await db_session.execute(select(CourseOffering).where(CourseOffering.cohort_id == cohort.id))
    ).scalars().all()
    for offering in offerings:
        await delete_offering_group(db_session, offering)
    if cohort.usergroup_id:
        group = await db_session.get(UserGroup, cohort.usergroup_id)
        if group:
            for model in (UserGroupResource, UserGroupUser):
                rows = (
                    await db_session.execute(select(model).where(model.usergroup_id == group.id))
                ).scalars().all()
                for row in rows:
                    await db_session.delete(row)
            await db_session.delete(group)
            cohort.usergroup_id = None


async def _course_uuids_for_cohort(db_session: AsyncSession, cohort: Cohort) -> List[str]:
    """All course UUIDs linked (via the cohort's semesters) to a cohort."""
    statement = (
        select(Course.course_uuid)
        .join(SemesterCourse, SemesterCourse.course_id == Course.id)  # type: ignore
        .join(Semester, Semester.id == SemesterCourse.semester_id)  # type: ignore
        .where(Semester.cohort_id == cohort.id)
    )
    return list((await db_session.execute(statement)).scalars().all())


async def sync_cohort_course_access(db_session: AsyncSession, cohort: Cohort) -> None:
    """Ensure the cohort's UserGroup is linked to every course in the cohort.

    Idempotent: only inserts missing UserGroupResource rows. This is the
    access-propagation step so enrolled cohort members reach the linked courses.
    """
    if not cohort.usergroup_id:
        return

    course_uuids = await _course_uuids_for_cohort(db_session, cohort)
    if not course_uuids:
        return

    existing_stmt = select(UserGroupResource.resource_uuid).where(
        UserGroupResource.usergroup_id == cohort.usergroup_id
    )
    existing = set((await db_session.execute(existing_stmt)).scalars().all())

    for course_uuid in course_uuids:
        if course_uuid in existing:
            continue
        db_session.add(
            UserGroupResource(
                usergroup_id=cohort.usergroup_id,
                resource_uuid=course_uuid,
                org_id=cohort.org_id,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
    await db_session.commit()


async def enroll_user_in_cohort(
    request: Request,
    cohort_uuid: str,
    user_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    """Add a user to the cohort's enrollment UserGroup (managing = update on cohort)."""
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request, db_session, current_user, cohort.cohort_uuid, AccessAction.UPDATE
    )

    if not cohort.usergroup_id:
        raise HTTPException(status_code=409, detail="Cohort has no enrollment group")

    user = await db_session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    await resolve_org_user(db_session, cohort.org_id, user.user_uuid, label="Student")

    already = (
        await db_session.execute(
            select(CohortMembership).where(
                CohortMembership.cohort_id == cohort.id, CohortMembership.user_id == user_id
            )
        )
    ).scalars().first()
    if already:
        return "User already enrolled"

    # Creates the student record (student number), joins the cohort group,
    # enforces capacity and registers the student in required offerings.
    await students_svc.admit_user(db_session, cohort, user_id)
    await db_session.commit()

    # Make sure the group is linked to all current cohort courses.
    await sync_cohort_course_access(db_session, cohort)
    return "User enrolled in cohort"


async def unenroll_user_from_cohort(
    request: Request,
    cohort_uuid: str,
    user_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    """Remove a user from the cohort's enrollment UserGroup."""
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request, db_session, current_user, cohort.cohort_uuid, AccessAction.UPDATE
    )

    if not cohort.usergroup_id:
        raise HTTPException(status_code=409, detail="Cohort has no enrollment group")

    membership = (
        await db_session.execute(
            select(CohortMembership).where(
                CohortMembership.cohort_id == cohort.id, CohortMembership.user_id == user_id
            )
        )
    ).scalars().first()
    if membership:
        await students_svc.remove_membership(db_session, cohort, membership)
        await db_session.commit()
        return "User unenrolled from cohort"

    # Legacy group-only member (pre student-records data).
    group_member = (
        await db_session.execute(
            select(UserGroupUser).where(
                UserGroupUser.usergroup_id == cohort.usergroup_id,
                UserGroupUser.user_id == user_id,
            )
        )
    ).scalars().first()
    if not group_member:
        raise HTTPException(status_code=404, detail="User is not enrolled in this cohort")
    await db_session.delete(group_member)
    await db_session.commit()
    return "User unenrolled from cohort"


async def get_cohort_members(
    request: Request,
    cohort_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[UserReadAuthor]:
    """List the users enrolled in a cohort (via its enrollment UserGroup)."""
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        cohort.cohort_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    if not cohort.usergroup_id:
        return []

    statement = (
        select(User)
        .join(UserGroupUser, UserGroupUser.user_id == User.id)  # type: ignore
        .where(UserGroupUser.usergroup_id == cohort.usergroup_id)
        .order_by(UserGroupUser.creation_date.asc())  # type: ignore
    )
    users = (await db_session.execute(statement)).scalars().all()
    return [UserReadAuthor.model_validate(u) for u in users]
