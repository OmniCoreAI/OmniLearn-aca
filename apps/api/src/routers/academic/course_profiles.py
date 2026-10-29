from typing import List, Optional
from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.db.academic.course_profiles import (
    CourseAcademicProfileRead,
    CourseAcademicProfileUpsert,
    CourseScheduleSessionCreate,
    CourseScheduleSessionRead,
    CourseScheduleSessionUpdate,
    MyLectureRead,
)
from src.security.auth import get_current_user
from src.services.academic.course_profiles import (
    get_course_academic_profile,
    upsert_course_academic_profile,
    list_sessions,
    create_session,
    update_session,
    delete_session,
    list_my_lectures,
)

router = APIRouter()


@router.get(
    "/lectures/mine",
    response_model=List[MyLectureRead],
    summary="Lectures I teach",
    description=(
        "Lectures (sessions of courses organised by lectures) taught by the signed-in user — "
        "their own, or those without an instructor in courses they teach. Dated lectures first."
    ),
)
async def api_my_lectures(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[MyLectureRead]:
    return await list_my_lectures(db_session, current_user, org_id)


@router.get(
    "/{course_uuid}/academic-profile",
    response_model=Optional[CourseAcademicProfileRead],
    summary="Get a course's academic profile",
    description=(
        "Returns the academic/offering attributes attached to the course "
        "(credit hours, instructor, classroom, capacity, status, add-ons, "
        "certificate flag, schedule sessions). Applies wherever the course is "
        "used — in postgraduate semesters and training programs. Null if none."
    ),
)
async def api_get_course_profile(
    request: Request,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> Optional[CourseAcademicProfileRead]:
    return await get_course_academic_profile(request, course_uuid, current_user, db_session)


@router.put(
    "/{course_uuid}/academic-profile",
    response_model=CourseAcademicProfileRead,
    summary="Create or update a course's academic profile",
)
async def api_upsert_course_profile(
    request: Request,
    course_uuid: str,
    payload: CourseAcademicProfileUpsert,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseAcademicProfileRead:
    return await upsert_course_academic_profile(
        request, course_uuid, payload, current_user, db_session
    )


@router.get(
    "/{course_uuid}/academic-profile/sessions",
    response_model=List[CourseScheduleSessionRead],
    summary="List a course's schedule sessions",
)
async def api_list_sessions(
    request: Request,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseScheduleSessionRead]:
    return await list_sessions(request, course_uuid, current_user, db_session)


@router.post(
    "/{course_uuid}/academic-profile/sessions",
    response_model=CourseScheduleSessionRead,
    summary="Add a schedule session to a course",
)
async def api_create_session(
    request: Request,
    course_uuid: str,
    payload: CourseScheduleSessionCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseScheduleSessionRead:
    return await create_session(request, course_uuid, payload, current_user, db_session)


@router.put(
    "/{course_uuid}/academic-profile/sessions/{session_uuid}",
    response_model=CourseScheduleSessionRead,
    summary="Update a course schedule session",
)
async def api_update_session(
    request: Request,
    course_uuid: str,
    session_uuid: str,
    payload: CourseScheduleSessionUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseScheduleSessionRead:
    return await update_session(
        request, course_uuid, session_uuid, payload, current_user, db_session
    )


@router.delete(
    "/{course_uuid}/academic-profile/sessions/{session_uuid}",
    summary="Delete a course schedule session",
)
async def api_delete_session(
    request: Request,
    course_uuid: str,
    session_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_session(request, course_uuid, session_uuid, current_user, db_session)
