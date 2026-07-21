from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.finance.ledger import (
    FinanceLedgerEntryCreate,
    FinanceLedgerEntryRead,
    FinanceLedgerEntryUpdate,
    FinanceLedgerSummaryRead,
)
from src.db.finance.reporting import (
    CourseProfitRead,
    FinanceCourseConfigRead,
    FinanceCourseConfigUpsert,
    FinanceRefundCreate,
    FinanceRefundDecision,
    FinanceRefundRead,
    PayrollReportRead,
    ProfitLossRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.finance.ledger import (
    create_entry,
    delete_entry,
    ledger_summary,
    list_entries,
    update_entry,
)
from src.services.finance.reporting import (
    close_payroll_month,
    create_refund,
    decide_refund,
    get_course_profit,
    list_course_profits,
    list_refunds,
    payroll_report,
    profit_loss,
    upsert_course_config,
)

router = APIRouter()


@router.post(
    "/org/{org_id}/entries",
    response_model=FinanceLedgerEntryRead,
    summary="Create a local finance ledger entry (revenue or expense)",
)
async def api_create_entry(
    org_id: int,
    payload: FinanceLedgerEntryCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinanceLedgerEntryRead:
    return await create_entry(db_session, current_user, org_id, payload)


@router.get(
    "/org/{org_id}/entries",
    response_model=List[FinanceLedgerEntryRead],
    summary="List finance ledger entries",
)
async def api_list_entries(
    org_id: int,
    entry_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[FinanceLedgerEntryRead]:
    return await list_entries(
        db_session,
        current_user,
        org_id,
        entry_type=entry_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )


@router.put(
    "/entries/{entry_uuid}",
    response_model=FinanceLedgerEntryRead,
    summary="Update a finance ledger entry",
)
async def api_update_entry(
    entry_uuid: str,
    payload: FinanceLedgerEntryUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinanceLedgerEntryRead:
    return await update_entry(db_session, current_user, entry_uuid, payload)


@router.delete("/entries/{entry_uuid}", summary="Delete a finance ledger entry")
async def api_delete_entry(
    entry_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await delete_entry(db_session, current_user, entry_uuid)


@router.get(
    "/org/{org_id}/summary",
    response_model=FinanceLedgerSummaryRead,
    summary="Finance summary with instructor cost and estimated profit",
)
async def api_ledger_summary(
    org_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    include_instructor_cost: bool = Query(True),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinanceLedgerSummaryRead:
    return await ledger_summary(
        db_session,
        current_user,
        org_id,
        date_from=date_from,
        date_to=date_to,
        include_instructor_cost=include_instructor_cost,
    )


@router.get(
    "/org/{org_id}/profit-loss",
    response_model=ProfitLossRead,
    summary="Profit & Loss statement for a period",
)
async def api_profit_loss(
    org_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ProfitLossRead:
    return await profit_loss(db_session, current_user, org_id, date_from, date_to)


@router.get(
    "/org/{org_id}/courses",
    response_model=List[CourseProfitRead],
    summary="Course profitability list",
)
async def api_list_course_profits(
    org_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseProfitRead]:
    return await list_course_profits(db_session, current_user, org_id, date_from, date_to)


@router.get(
    "/org/{org_id}/courses/{course_uuid}/profit",
    response_model=CourseProfitRead,
    summary="Course cost build-up and net profit",
)
async def api_get_course_profit(
    org_id: int,
    course_uuid: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseProfitRead:
    return await get_course_profit(
        db_session, current_user, org_id, course_uuid, date_from, date_to
    )


@router.put(
    "/org/{org_id}/courses/config",
    response_model=FinanceCourseConfigRead,
    summary="Upsert per-course cost/revenue assumptions",
)
async def api_upsert_course_config(
    org_id: int,
    payload: FinanceCourseConfigUpsert,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinanceCourseConfigRead:
    return await upsert_course_config(db_session, current_user, org_id, payload)


@router.post(
    "/org/{org_id}/refunds",
    response_model=FinanceRefundRead,
    summary="Request a refund against a revenue ledger entry",
)
async def api_create_refund(
    org_id: int,
    payload: FinanceRefundCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinanceRefundRead:
    return await create_refund(db_session, current_user, org_id, payload)


@router.get(
    "/org/{org_id}/refunds",
    response_model=List[FinanceRefundRead],
    summary="List refund requests",
)
async def api_list_refunds(
    org_id: int,
    status: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[FinanceRefundRead]:
    return await list_refunds(db_session, current_user, org_id, status)


@router.put(
    "/refunds/{refund_uuid}/decision",
    response_model=FinanceRefundRead,
    summary="Approve, reject, or mark refund as recorded",
)
async def api_decide_refund(
    refund_uuid: str,
    payload: FinanceRefundDecision,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinanceRefundRead:
    return await decide_refund(db_session, current_user, refund_uuid, payload)


@router.get(
    "/org/{org_id}/payroll",
    response_model=PayrollReportRead,
    summary="Monthly instructor payroll (hours × rate from work logs)",
)
async def api_payroll_report(
    org_id: int,
    month: str = Query(..., description="YYYY-MM"),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PayrollReportRead:
    return await payroll_report(db_session, current_user, org_id, month)


@router.post(
    "/org/{org_id}/payroll/{month}/close",
    response_model=PayrollReportRead,
    summary="Close a payroll month",
)
async def api_close_payroll(
    org_id: int,
    month: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PayrollReportRead:
    return await close_payroll_month(db_session, current_user, org_id, month)
