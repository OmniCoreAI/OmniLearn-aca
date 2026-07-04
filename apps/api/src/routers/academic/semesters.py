from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.db.academic.semesters import SemesterRead, SemesterUpdate
from src.db.academic.links import SemesterCourseRead, SemesterCourseUpdate
from src.security.auth import get_current_user
from src.services.academic.semesters import (
    get_semester,
    update_semester,
    delete_semester,
    link_course_to_semester,
    update_semester_course,
    unlink_course_from_semester,
    get_semester_courses,
)

router = APIRouter()


class LinkCourseRequest(BaseModel):
    course_uuid: str
    order: int = 0
    code: Optional[str] = None
    credit_hours: Optional[float] = None


@router.get("/{semester_uuid}", response_model=SemesterRead, summary="Get a semester")
async def api_get_semester(
    request: Request,
    semester_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> SemesterRead:
    return await get_semester(request, semester_uuid, current_user, db_session)


@router.put("/{semester_uuid}", response_model=SemesterRead, summary="Update a semester")
async def api_update_semester(
    request: Request,
    semester_uuid: str,
    semester_object: SemesterUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> SemesterRead:
    return await update_semester(
        request, semester_uuid, semester_object, current_user, db_session
    )


@router.delete("/{semester_uuid}", summary="Delete a semester")
async def api_delete_semester(
    request: Request,
    semester_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_semester(request, semester_uuid, current_user, db_session)


@router.get(
    "/{semester_uuid}/courses",
    response_model=List[SemesterCourseRead],
    summary="List courses linked to a semester",
)
async def api_list_semester_courses(
    request: Request,
    semester_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[SemesterCourseRead]:
    return await get_semester_courses(request, semester_uuid, current_user, db_session)


@router.post(
    "/{semester_uuid}/courses",
    summary="Link an existing course to a semester",
    description=(
        "Attach an existing course (created via the standard course workflow) to "
        "this semester, with optional academic metadata (code, credit hours, "
        "order). The course itself is unchanged; only the link is created."
    ),
)
async def api_link_semester_course(
    request: Request,
    semester_uuid: str,
    link_object: LinkCourseRequest,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await link_course_to_semester(
        request,
        semester_uuid,
        link_object.course_uuid,
        current_user,
        db_session,
        link_object.order,
        link_object.code,
        link_object.credit_hours,
    )


@router.put(
    "/{semester_uuid}/courses/{course_uuid}",
    summary="Update academic metadata of a semester's course link",
)
async def api_update_semester_course(
    request: Request,
    semester_uuid: str,
    course_uuid: str,
    link_object: SemesterCourseUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await update_semester_course(
        request, semester_uuid, course_uuid, link_object, current_user, db_session
    )


@router.delete(
    "/{semester_uuid}/courses/{course_uuid}",
    summary="Unlink a course from a semester",
)
async def api_unlink_semester_course(
    request: Request,
    semester_uuid: str,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await unlink_course_from_semester(
        request, semester_uuid, course_uuid, current_user, db_session
    )
