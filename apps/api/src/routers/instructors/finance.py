from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.instructors.finance import (
    InstructorWorkLogCreate,
    InstructorWorkLogRead,
    InstructorWorkLogUpdate,
    OrgFinanceSummaryRead,
    RateComputationRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.instructors.finance import (
    compute_rate,
    create_worklog,
    delete_worklog,
    list_worklogs,
    org_finance_summary,
    update_worklog,
)

router = APIRouter()


class RateComputeRequest(BaseModel):
    instructor_uuid: str
    hours: float
    language: Optional[str] = None


@router.post(
    "/compute",
    response_model=RateComputationRead,
    summary="Preview Hours \u00d7 Rate for an instructor + delivery language",
)
async def api_compute_rate(
    body: RateComputeRequest,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> RateComputationRead:
    return await compute_rate(
        db_session, current_user, body.instructor_uuid, body.hours, body.language
    )


@router.post(
    "/worklogs",
    response_model=InstructorWorkLogRead,
    summary="Log instructor hours (computes and stores Hours \u00d7 Rate)",
)
async def api_create_worklog(
    payload: InstructorWorkLogCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorWorkLogRead:
    return await create_worklog(db_session, current_user, org_id, payload)


@router.get(
    "/org/{org_id}/worklogs",
    response_model=List[InstructorWorkLogRead],
    summary="List work logs for an organization (optionally by instructor)",
)
async def api_list_worklogs(
    org_id: int,
    instructor_uuid: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[InstructorWorkLogRead]:
    return await list_worklogs(db_session, current_user, org_id, instructor_uuid)


@router.put(
    "/worklogs/{worklog_uuid}",
    response_model=InstructorWorkLogRead,
    summary="Update a work log (recomputes the amount)",
)
async def api_update_worklog(
    worklog_uuid: str,
    payload: InstructorWorkLogUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> InstructorWorkLogRead:
    return await update_worklog(db_session, current_user, worklog_uuid, payload)


@router.delete("/worklogs/{worklog_uuid}", summary="Delete a work log")
async def api_delete_worklog(
    worklog_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_worklog(db_session, current_user, worklog_uuid)


@router.get(
    "/org/{org_id}/summary",
    response_model=OrgFinanceSummaryRead,
    summary="Finance summary (total + per-instructor Hours \u00d7 Rate) for an org",
)
async def api_org_finance_summary(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> OrgFinanceSummaryRead:
    return await org_finance_summary(db_session, current_user, org_id)
