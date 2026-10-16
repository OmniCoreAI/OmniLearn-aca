"""Read-only academy reports. Each takes an inclusive date range
(``date_from`` / ``date_to`` as YYYY-MM-DD, default: the last 12 months) and
returns totals, the same totals for the previous period of equal length,
a monthly series and breakdown tables."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.security.modules import require_module
from src.services.reports.admissions import AdmissionsReport, admissions_report
from src.services.reports.financial import FinancialReport, financial_report
from src.services.reports.learning import LearningReport, learning_report
from src.services.reports.people import PeopleReport, people_report

router = APIRouter()

_range = {
    "date_from": Query(None, description="First day (YYYY-MM-DD). Default: 12 months before date_to."),
    "date_to": Query(None, description="Last day (YYYY-MM-DD). Default: today."),
}


@router.get(
    "/org/{org_id}/financial",
    dependencies=[Depends(require_module("finance"))],
    response_model=FinancialReport, summary="Financial report")
async def api_financial_report(
    org_id: int,
    date_from: Optional[str] = _range["date_from"],
    date_to: Optional[str] = _range["date_to"],
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FinancialReport:
    """Revenue, refunds, expenses, instructor costs and profit — same rules as the Finance P&L."""
    return await financial_report(db_session, current_user, org_id, date_from, date_to)


@router.get("/org/{org_id}/learning", response_model=LearningReport, summary="Learning & completion report")
async def api_learning_report(
    org_id: int,
    date_from: Optional[str] = _range["date_from"],
    date_to: Optional[str] = _range["date_to"],
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> LearningReport:
    return await learning_report(db_session, current_user, org_id, date_from, date_to)


@router.get(
    "/org/{org_id}/admissions",
    dependencies=[Depends(require_module("postgraduate"))],
    response_model=AdmissionsReport, summary="Admissions report")
async def api_admissions_report(
    org_id: int,
    date_from: Optional[str] = _range["date_from"],
    date_to: Optional[str] = _range["date_to"],
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AdmissionsReport:
    return await admissions_report(db_session, current_user, org_id, date_from, date_to)


@router.get("/org/{org_id}/people", response_model=PeopleReport, summary="Users & entities report")
async def api_people_report(
    org_id: int,
    date_from: Optional[str] = _range["date_from"],
    date_to: Optional[str] = _range["date_to"],
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PeopleReport:
    return await people_report(db_session, current_user, org_id, date_from, date_to)
