from typing import List

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.instructors.instructors import (
    InstructorCategoryCreate,
    InstructorCategoryRead,
    InstructorCategoryUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.instructors.categories import (
    create_category,
    delete_category,
    get_category,
    list_categories,
    update_category,
)

router = APIRouter()


@router.post("/", response_model=InstructorCategoryRead, summary="Create an instructor category")
async def api_create_category(
    payload: InstructorCategoryCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorCategoryRead:
    return await create_category(db_session, current_user, org_id, payload)


@router.get(
    "/org/{org_id}",
    response_model=List[InstructorCategoryRead],
    summary="List instructor categories for an organization",
)
async def api_list_categories(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorCategoryRead]:
    return await list_categories(db_session, current_user, org_id)


@router.get(
    "/{category_uuid}", response_model=InstructorCategoryRead, summary="Get an instructor category"
)
async def api_get_category(
    category_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorCategoryRead:
    return await get_category(db_session, current_user, category_uuid)


@router.put(
    "/{category_uuid}",
    response_model=InstructorCategoryRead,
    summary="Update an instructor category (and its per-language rates)",
)
async def api_update_category(
    category_uuid: str,
    payload: InstructorCategoryUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorCategoryRead:
    return await update_category(db_session, current_user, category_uuid, payload)


@router.delete("/{category_uuid}", summary="Delete an instructor category")
async def api_delete_category(
    category_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_category(db_session, current_user, category_uuid)
