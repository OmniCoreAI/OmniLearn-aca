from typing import List
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser
from src.db.courses.courses import Course
from src.db.academic.cohorts import Cohort
from src.db.academic.semesters import (
    Semester,
    SemesterCreate,
    SemesterRead,
    SemesterUpdate,
)
from src.db.academic.links import (
    SemesterCourse,
    SemesterCourseRead,
    SemesterCourseUpdate,
)
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import get_resource_authors
from src.services.academic.cohorts import sync_cohort_course_access


async def _get_semester_or_404(db_session: AsyncSession, semester_uuid: str) -> Semester:
    statement = select(Semester).where(Semester.semester_uuid == semester_uuid)
    semester = (await db_session.execute(statement)).scalars().first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester


async def _get_cohort_or_404(db_session: AsyncSession, cohort_uuid: str) -> Cohort:
    statement = select(Cohort).where(Cohort.cohort_uuid == cohort_uuid)
    cohort = (await db_session.execute(statement)).scalars().first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    return cohort


async def create_semester(
    request: Request,
    cohort_uuid: str,
    semester_object: SemesterCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> SemesterRead:
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request, db_session, current_user, cohort.cohort_uuid, AccessAction.UPDATE
    )

    semester = Semester.model_validate(
        semester_object,
        update={
            "org_id": cohort.org_id,
            "cohort_id": cohort.id,
            "program_id": cohort.program_id,
        },
    )
    semester.semester_uuid = f"semester_{uuid4()}"
    semester.creation_date = str(datetime.now())
    semester.update_date = str(datetime.now())

    db_session.add(semester)
    await db_session.commit()
    await db_session.refresh(semester)
    return SemesterRead.model_validate(semester)


async def get_semester(
    request: Request,
    semester_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> SemesterRead:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        semester.semester_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )
    return SemesterRead.model_validate(semester)


async def get_semesters_by_cohort(
    request: Request,
    cohort_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[SemesterRead]:
    cohort = await _get_cohort_or_404(db_session, cohort_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        cohort.cohort_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    statement = (
        select(Semester)
        .where(Semester.cohort_id == cohort.id)
        .order_by(Semester.order.asc())  # type: ignore
    )
    semesters = (await db_session.execute(statement)).scalars().all()
    return [SemesterRead.model_validate(s) for s in semesters]


async def update_semester(
    request: Request,
    semester_uuid: str,
    semester_object: SemesterUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> SemesterRead:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request, db_session, current_user, semester.semester_uuid, AccessAction.UPDATE
    )

    update_data = semester_object.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(semester, key, value)
    semester.update_date = str(datetime.now())

    db_session.add(semester)
    await db_session.commit()
    await db_session.refresh(semester)
    return SemesterRead.model_validate(semester)


async def delete_semester(
    request: Request,
    semester_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request, db_session, current_user, semester.semester_uuid, AccessAction.DELETE
    )
    await db_session.delete(semester)
    await db_session.commit()
    return "Semester deleted"


# ----------------------------------------------------------------------------
# Semester <-> Course linking (reuses the existing Course implementation).
# The academic metadata (code, credit hours, order) lives on the link row so
# the core Course table stays untouched.
# ----------------------------------------------------------------------------


async def link_course_to_semester(
    request: Request,
    semester_uuid: str,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    order: int = 0,
    code: str | None = None,
    credit_hours: float | None = None,
) -> str:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request, db_session, current_user, semester.semester_uuid, AccessAction.UPDATE
    )

    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.org_id != semester.org_id:
        raise HTTPException(
            status_code=400, detail="Course belongs to a different organization"
        )

    # Enforce 1:N — a course can belong to at most one semester.
    existing = (
        await db_session.execute(
            select(SemesterCourse).where(SemesterCourse.course_id == course.id)
        )
    ).scalars().first()
    if existing:
        if existing.semester_id == semester.id:
            return "Course already linked to this semester"
        raise HTTPException(
            status_code=409, detail="Course is already linked to another semester"
        )

    db_session.add(
        SemesterCourse(
            semester_id=semester.id,
            course_id=course.id,
            org_id=semester.org_id,
            order=order,
            code=code,
            credit_hours=credit_hours,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db_session.commit()

    # Propagate access to the owning cohort's enrollment group.
    await _sync_cohort_for_semester(db_session, semester)
    return "Course linked to semester"


async def update_semester_course(
    request: Request,
    semester_uuid: str,
    course_uuid: str,
    link_object: SemesterCourseUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request, db_session, current_user, semester.semester_uuid, AccessAction.UPDATE
    )

    link = await _get_link_or_404(db_session, semester.id, course_uuid)

    update_data = link_object.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(link, key, value)
    link.update_date = str(datetime.now())

    db_session.add(link)
    await db_session.commit()
    return "Semester course updated"


async def unlink_course_from_semester(
    request: Request,
    semester_uuid: str,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request, db_session, current_user, semester.semester_uuid, AccessAction.UPDATE
    )

    link = await _get_link_or_404(db_session, semester.id, course_uuid)
    await db_session.delete(link)
    await db_session.commit()
    return "Course unlinked from semester"


async def get_semester_courses(
    request: Request,
    semester_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[SemesterCourseRead]:
    semester = await _get_semester_or_404(db_session, semester_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        semester.semester_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    statement = (
        select(Course, SemesterCourse)
        .join(SemesterCourse, SemesterCourse.course_id == Course.id)  # type: ignore
        .where(SemesterCourse.semester_id == semester.id)
        .order_by(SemesterCourse.order.asc())  # type: ignore
    )
    rows = (await db_session.execute(statement)).all()

    result: List[SemesterCourseRead] = []
    for course, link in rows:
        authors = await get_resource_authors(db_session, course.course_uuid)
        result.append(
            SemesterCourseRead(
                **course.model_dump(),
                authors=authors,
                academic_order=link.order,
                code=link.code,
                credit_hours=link.credit_hours,
            )
        )
    return result


async def _get_link_or_404(
    db_session: AsyncSession, semester_id: int, course_uuid: str
) -> SemesterCourse:
    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    link = (
        await db_session.execute(
            select(SemesterCourse).where(
                SemesterCourse.semester_id == semester_id,
                SemesterCourse.course_id == course.id,
            )
        )
    ).scalars().first()
    if not link:
        raise HTTPException(status_code=404, detail="Course is not linked to this semester")
    return link


async def _sync_cohort_for_semester(db_session: AsyncSession, semester: Semester) -> None:
    """Re-sync the cohort enrollment group after a course is linked to a semester."""
    cohort = (
        await db_session.execute(select(Cohort).where(Cohort.id == semester.cohort_id))
    ).scalars().first()
    if cohort:
        await sync_cohort_course_access(db_session, cohort)
