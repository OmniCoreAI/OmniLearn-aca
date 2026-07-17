from typing import List

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.instructors.instructors import (
    InstructorCreate,
    InstructorRead,
    InstructorUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.instructors.instructors import (
    create_instructor,
    delete_instructor,
    get_instructor,
    list_instructors,
    update_instructor,
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
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorRead]:
    return await list_instructors(db_session, current_user, org_id)


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
