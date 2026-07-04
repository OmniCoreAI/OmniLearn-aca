from typing import List
from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.db.academic.programs import ProgramCreate, ProgramRead, ProgramUpdate
from src.db.academic.cohorts import CohortCreate, CohortRead
from src.security.auth import get_current_user
from src.services.academic.programs import (
    create_program,
    get_program,
    get_programs_by_org,
    update_program,
    delete_program,
)
from src.services.academic.cohorts import create_cohort, get_cohorts_by_program

router = APIRouter()


@router.post("/", response_model=ProgramRead, summary="Create a program")
async def api_create_program(
    request: Request,
    program_object: ProgramCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ProgramRead:
    return await create_program(
        request, org_id, program_object, current_user, db_session
    )


@router.get(
    "/org/{org_id}/page/{page}/limit/{limit}",
    response_model=List[ProgramRead],
    summary="List programs for an organization",
)
async def api_list_programs(
    request: Request,
    org_id: int,
    page: int,
    limit: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[ProgramRead]:
    return await get_programs_by_org(
        request, org_id, current_user, db_session, page, limit
    )


@router.get("/{program_uuid}", response_model=ProgramRead, summary="Get a program")
async def api_get_program(
    request: Request,
    program_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ProgramRead:
    return await get_program(request, program_uuid, current_user, db_session)


@router.put("/{program_uuid}", response_model=ProgramRead, summary="Update a program")
async def api_update_program(
    request: Request,
    program_uuid: str,
    program_object: ProgramUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ProgramRead:
    return await update_program(
        request, program_uuid, program_object, current_user, db_session
    )


@router.delete("/{program_uuid}", summary="Delete a program")
async def api_delete_program(
    request: Request,
    program_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_program(request, program_uuid, current_user, db_session)


@router.get(
    "/{program_uuid}/cohorts",
    response_model=List[CohortRead],
    summary="List cohorts of a program",
)
async def api_list_program_cohorts(
    request: Request,
    program_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CohortRead]:
    return await get_cohorts_by_program(request, program_uuid, current_user, db_session)


@router.post(
    "/{program_uuid}/cohorts",
    response_model=CohortRead,
    summary="Create a cohort under a program",
)
async def api_create_program_cohort(
    request: Request,
    program_uuid: str,
    cohort_object: CohortCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CohortRead:
    return await create_cohort(
        request, program_uuid, cohort_object, current_user, db_session
    )
