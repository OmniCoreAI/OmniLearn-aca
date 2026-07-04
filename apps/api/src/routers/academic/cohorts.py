from typing import List
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser, UserReadAuthor
from src.db.academic.cohorts import CohortRead, CohortUpdate
from src.db.academic.semesters import SemesterCreate, SemesterRead
from src.security.auth import get_current_user
from src.services.academic.cohorts import (
    get_cohort,
    update_cohort,
    delete_cohort,
    enroll_user_in_cohort,
    unenroll_user_from_cohort,
    get_cohort_members,
)
from src.services.academic.semesters import (
    create_semester,
    get_semesters_by_cohort,
)

router = APIRouter()


class EnrollRequest(BaseModel):
    user_id: int


@router.get("/{cohort_uuid}", response_model=CohortRead, summary="Get a cohort")
async def api_get_cohort(
    request: Request,
    cohort_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CohortRead:
    return await get_cohort(request, cohort_uuid, current_user, db_session)


@router.put("/{cohort_uuid}", response_model=CohortRead, summary="Update a cohort")
async def api_update_cohort(
    request: Request,
    cohort_uuid: str,
    cohort_object: CohortUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CohortRead:
    return await update_cohort(
        request, cohort_uuid, cohort_object, current_user, db_session
    )


@router.delete("/{cohort_uuid}", summary="Delete a cohort")
async def api_delete_cohort(
    request: Request,
    cohort_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_cohort(request, cohort_uuid, current_user, db_session)


@router.get(
    "/{cohort_uuid}/semesters",
    response_model=List[SemesterRead],
    summary="List semesters of a cohort",
)
async def api_list_cohort_semesters(
    request: Request,
    cohort_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[SemesterRead]:
    return await get_semesters_by_cohort(request, cohort_uuid, current_user, db_session)


@router.post(
    "/{cohort_uuid}/semesters",
    response_model=SemesterRead,
    summary="Create a semester under a cohort",
)
async def api_create_cohort_semester(
    request: Request,
    cohort_uuid: str,
    semester_object: SemesterCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> SemesterRead:
    return await create_semester(
        request, cohort_uuid, semester_object, current_user, db_session
    )


@router.post("/{cohort_uuid}/enroll", summary="Enroll a user in a cohort")
async def api_enroll_in_cohort(
    request: Request,
    cohort_uuid: str,
    enroll_object: EnrollRequest,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await enroll_user_in_cohort(
        request, cohort_uuid, enroll_object.user_id, current_user, db_session
    )


@router.delete("/{cohort_uuid}/enroll/{user_id}", summary="Unenroll a user from a cohort")
async def api_unenroll_from_cohort(
    request: Request,
    cohort_uuid: str,
    user_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await unenroll_user_from_cohort(
        request, cohort_uuid, user_id, current_user, db_session
    )


@router.get(
    "/{cohort_uuid}/members",
    response_model=List[UserReadAuthor],
    summary="List users enrolled in a cohort",
)
async def api_list_cohort_members(
    request: Request,
    cohort_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[UserReadAuthor]:
    return await get_cohort_members(request, cohort_uuid, current_user, db_session)
