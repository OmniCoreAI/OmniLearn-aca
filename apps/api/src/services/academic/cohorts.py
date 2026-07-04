from typing import List
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser
from src.db.usergroups import UserGroup
from src.db.usergroup_user import UserGroupUser
from src.db.usergroup_resources import UserGroupResource
from src.db.academic.programs import Program
from src.db.academic.cohorts import Cohort, CohortCreate, CohortRead, CohortUpdate
from src.db.academic.semesters import Semester
from src.db.academic.links import SemesterCourse
from src.db.courses.courses import Course
from src.security.auth import resolve_acting_user_id
from src.security.rbac import AccessAction, AccessContext, check_resource_access


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

    cohort = Cohort.model_validate(
        cohort_object,
        update={"org_id": program.org_id, "program_id": program.id},
    )
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

    return CohortRead.model_validate(cohort)


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
    return CohortRead.model_validate(cohort)


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
    return [CohortRead.model_validate(c) for c in cohorts]


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
    for key, value in update_data.items():
        setattr(cohort, key, value)
    cohort.update_date = str(datetime.now())

    db_session.add(cohort)
    await db_session.commit()
    await db_session.refresh(cohort)
    return CohortRead.model_validate(cohort)


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
    await db_session.delete(cohort)
    await db_session.commit()
    return "Cohort deleted"


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

    existing = (
        await db_session.execute(
            select(UserGroupUser).where(
                UserGroupUser.usergroup_id == cohort.usergroup_id,
                UserGroupUser.user_id == user_id,
            )
        )
    ).scalars().first()
    if existing:
        return "User already enrolled"

    db_session.add(
        UserGroupUser(
            usergroup_id=cohort.usergroup_id,
            user_id=user_id,
            org_id=cohort.org_id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db_session.commit()

    # Make sure the group is linked to all current cohort courses.
    await sync_cohort_course_access(db_session, cohort)
    return "User enrolled in cohort"
