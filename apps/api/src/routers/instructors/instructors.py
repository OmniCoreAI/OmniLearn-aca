from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.instructors.instructors import (
    InstructorApprove,
    InstructorCourseRead,
    InstructorCreate,
    InstructorOption,
    InstructorRead,
    InstructorUpdate,
    MyAssignmentsRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.instructors.instructors import (
    approve_instructor,
    assign_instructor_course,
    create_instructor,
    delete_instructor,
    get_instructor,
    list_instructor_assignments,
    list_instructor_courses,
    list_instructor_options,
    list_instructors,
    list_my_assignments,
    unassign_instructor_course,
    update_instructor,
    upload_instructor_image,
)

router = APIRouter()


@router.post("/", response_model=InstructorRead, summary="Create an instructor (extends a user)")
async def api_create_instructor(
    payload: InstructorCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorRead:
    return await create_instructor(db_session, current_user, org_id, payload)


@router.get(
    "/org/{org_id}",
    response_model=List[InstructorRead],
    summary="List instructors for an organization",
)
async def api_list_instructors(
    org_id: int,
    entity_uuid: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorRead]:
    return await list_instructors(db_session, current_user, org_id, entity_uuid)


@router.get(
    "/org/{org_id}/options",
    response_model=List[InstructorOption],
    summary="Active instructors for pickers (any org member; no rates)",
)
async def api_instructor_options(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorOption]:
    return await list_instructor_options(db_session, current_user, org_id)


@router.get(
    "/org/{org_id}/me/assignments",
    response_model=MyAssignmentsRead,
    summary="Courses and training programs the signed-in user is assigned to",
)
async def api_my_assignments(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> MyAssignmentsRead:
    return await list_my_assignments(db_session, current_user, org_id)


@router.get("/{instructor_uuid}", response_model=InstructorRead, summary="Get an instructor")
async def api_get_instructor(
    instructor_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorRead:
    return await get_instructor(db_session, current_user, instructor_uuid)


@router.put("/{instructor_uuid}", response_model=InstructorRead, summary="Update an instructor")
async def api_update_instructor(
    instructor_uuid: str,
    payload: InstructorUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorRead:
    return await update_instructor(db_session, current_user, instructor_uuid, payload)


@router.delete("/{instructor_uuid}", summary="Delete an instructor")
async def api_delete_instructor(
    instructor_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_instructor(db_session, current_user, instructor_uuid)


@router.post(
    "/{instructor_uuid}/approve",
    response_model=InstructorRead,
    summary="Approve a pending instructor (sets category/rate and the Instructor role)",
)
async def api_approve_instructor(
    instructor_uuid: str,
    payload: InstructorApprove,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorRead:
    return await approve_instructor(db_session, current_user, instructor_uuid, payload)


@router.put("/{instructor_uuid}/image", response_model=InstructorRead, summary="Upload an instructor photo")
async def api_upload_instructor_image(
    instructor_uuid: str,
    image: UploadFile,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorRead:
    return await upload_instructor_image(db_session, current_user, instructor_uuid, image)


@router.get(
    "/{instructor_uuid}/courses",
    response_model=List[InstructorCourseRead],
    summary="Courses the instructor teaches or co-authors",
)
async def api_instructor_courses(
    instructor_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorCourseRead]:
    return await list_instructor_courses(db_session, current_user, instructor_uuid)


@router.get(
    "/{instructor_uuid}/assignments",
    response_model=MyAssignmentsRead,
    summary="Everything the instructor teaches or runs: courses, offerings, programs, sessions",
)
async def api_instructor_assignments(
    instructor_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> MyAssignmentsRead:
    return await list_instructor_assignments(db_session, current_user, instructor_uuid)


@router.post(
    "/{instructor_uuid}/courses/{course_uuid}",
    response_model=List[InstructorCourseRead],
    summary="Assign the instructor to a course",
)
async def api_assign_instructor_course(
    instructor_uuid: str,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorCourseRead]:
    return await assign_instructor_course(db_session, current_user, instructor_uuid, course_uuid)


@router.delete(
    "/{instructor_uuid}/courses/{course_uuid}",
    response_model=List[InstructorCourseRead],
    summary="Remove the instructor from a course",
)
async def api_unassign_instructor_course(
    instructor_uuid: str,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorCourseRead]:
    return await unassign_instructor_course(db_session, current_user, instructor_uuid, course_uuid)
