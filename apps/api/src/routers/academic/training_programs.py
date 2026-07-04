from typing import List
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.db.courses.courses import CourseRead
from src.db.academic.training_programs import (
    TrainingProgramCreate,
    TrainingProgramRead,
    TrainingProgramUpdate,
)
from src.security.auth import get_current_user
from src.services.academic.training_programs import (
    create_training_program,
    get_training_program,
    get_training_programs_by_org,
    update_training_program,
    delete_training_program,
    link_course_to_training_program,
    unlink_course_from_training_program,
    get_training_program_courses,
)

router = APIRouter()


class LinkCourseRequest(BaseModel):
    course_uuid: str
    order: int = 0


@router.post("/", response_model=TrainingProgramRead, summary="Create a training program")
async def api_create_training_program(
    request: Request,
    tp_object: TrainingProgramCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> TrainingProgramRead:
    return await create_training_program(
        request, org_id, tp_object, current_user, db_session
    )


@router.get(
    "/org/{org_id}/page/{page}/limit/{limit}",
    response_model=List[TrainingProgramRead],
    summary="List training programs for an organization",
)
async def api_list_training_programs(
    request: Request,
    org_id: int,
    page: int,
    limit: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[TrainingProgramRead]:
    return await get_training_programs_by_org(
        request, org_id, current_user, db_session, page, limit
    )


@router.get(
    "/{tp_uuid}", response_model=TrainingProgramRead, summary="Get a training program"
)
async def api_get_training_program(
    request: Request,
    tp_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> TrainingProgramRead:
    return await get_training_program(request, tp_uuid, current_user, db_session)


@router.put(
    "/{tp_uuid}", response_model=TrainingProgramRead, summary="Update a training program"
)
async def api_update_training_program(
    request: Request,
    tp_uuid: str,
    tp_object: TrainingProgramUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> TrainingProgramRead:
    return await update_training_program(
        request, tp_uuid, tp_object, current_user, db_session
    )


@router.delete("/{tp_uuid}", summary="Delete a training program")
async def api_delete_training_program(
    request: Request,
    tp_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_training_program(request, tp_uuid, current_user, db_session)


@router.get(
    "/{tp_uuid}/courses",
    response_model=List[CourseRead],
    summary="List courses linked to a training program",
)
async def api_list_training_program_courses(
    request: Request,
    tp_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseRead]:
    return await get_training_program_courses(request, tp_uuid, current_user, db_session)


@router.post(
    "/{tp_uuid}/courses",
    summary="Link an existing course to a training program",
)
async def api_link_training_program_course(
    request: Request,
    tp_uuid: str,
    link_object: LinkCourseRequest,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await link_course_to_training_program(
        request,
        tp_uuid,
        link_object.course_uuid,
        current_user,
        db_session,
        link_object.order,
    )


@router.delete(
    "/{tp_uuid}/courses/{course_uuid}",
    summary="Unlink a course from a training program",
)
async def api_unlink_training_program_course(
    request: Request,
    tp_uuid: str,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await unlink_course_from_training_program(
        request, tp_uuid, course_uuid, current_user, db_session
    )
