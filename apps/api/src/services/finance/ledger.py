"""Finance ledger service — local P&L without Stripe."""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.finance.ledger import (
    CategoryBreakdown,
    DailyBreakdown,
    FinanceEntryStatus,
    FinanceEntryType,
    FinanceLedgerEntry,
    FinanceLedgerEntryCreate,
    FinanceLedgerEntryRead,
    FinanceLedgerEntryUpdate,
    FinanceLedgerSummaryRead,
)
from src.db.instructors.finance import InstructorWorkLog
from src.db.organizations import Organization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.finance.authz import authorize_finance_management


def _round_money(value: float) -> float:
    return round(value + 1e-9, 2)


def _validate_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="entry_date must be YYYY-MM-DD") from exc
    return value


async def _org_or_404(db_session: AsyncSession, org_id: int) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _to_read(row: FinanceLedgerEntry) -> FinanceLedgerEntryRead:
    return FinanceLedgerEntryRead(**row.model_dump())


async def create_entry(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    payload: FinanceLedgerEntryCreate,
) -> FinanceLedgerEntryRead:
    user_id = await authorize_finance_management(db_session, current_user, org_id, "create")
    await _org_or_404(db_session, org_id)

    if payload.amount is None or float(payload.amount) < 0:
        raise HTTPException(status_code=400, detail="amount must be >= 0")
    if not (payload.title or "").strip():
        raise HTTPException(status_code=400, detail="title is required")

    now = str(datetime.now())
    row = FinanceLedgerEntry(
        org_id=org_id,
        entry_uuid=f"fin_{uuid4()}",
        entry_type=payload.entry_type.value
        if isinstance(payload.entry_type, FinanceEntryType)
        else str(payload.entry_type),
        category=(payload.category or "other").strip().lower() or "other",
        title=payload.title.strip(),
        amount=_round_money(float(payload.amount)),
        currency=(payload.currency or "EGP").strip().upper() or "EGP",
        entry_date=_validate_date(payload.entry_date),
        description=payload.description,
        payment_method=payload.payment_method,
        status=payload.status.value
        if isinstance(payload.status, FinanceEntryStatus)
        else str(payload.status or FinanceEntryStatus.recorded.value),
        offer_uuid=payload.offer_uuid,
        course_uuid=payload.course_uuid,
        created_by=user_id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row)


async def list_entries(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    entry_type: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[FinanceLedgerEntryRead]:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await _org_or_404(db_session, org_id)

    stmt = select(FinanceLedgerEntry).where(FinanceLedgerEntry.org_id == org_id)
    if entry_type:
        stmt = stmt.where(FinanceLedgerEntry.entry_type == entry_type)
    if status:
        stmt = stmt.where(FinanceLedgerEntry.status == status)
    if date_from:
        _validate_date(date_from)
        stmt = stmt.where(FinanceLedgerEntry.entry_date >= date_from)
    if date_to:
        _validate_date(date_to)
        stmt = stmt.where(FinanceLedgerEntry.entry_date <= date_to)

    stmt = stmt.order_by(FinanceLedgerEntry.entry_date.desc(), FinanceLedgerEntry.id.desc())
    rows = (await db_session.execute(stmt)).scalars().all()
    return [_to_read(r) for r in rows]


async def update_entry(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    entry_uuid: str,
    payload: FinanceLedgerEntryUpdate,
) -> FinanceLedgerEntryRead:
    row = (
        await db_session.execute(
            select(FinanceLedgerEntry).where(FinanceLedgerEntry.entry_uuid == entry_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Finance entry not found")

    await authorize_finance_management(db_session, current_user, row.org_id, "update")

    data = payload.model_dump(exclude_unset=True)
    if "entry_type" in data and data["entry_type"] is not None:
        data["entry_type"] = (
            data["entry_type"].value
            if isinstance(data["entry_type"], FinanceEntryType)
            else str(data["entry_type"])
        )
    if "status" in data and data["status"] is not None:
        data["status"] = (
            data["status"].value
            if isinstance(data["status"], FinanceEntryStatus)
            else str(data["status"])
        )
    if "entry_date" in data and data["entry_date"]:
        data["entry_date"] = _validate_date(data["entry_date"])
    if "amount" in data and data["amount"] is not None:
        if float(data["amount"]) < 0:
            raise HTTPException(status_code=400, detail="amount must be >= 0")
        data["amount"] = _round_money(float(data["amount"]))
    if "currency" in data and data["currency"]:
        data["currency"] = str(data["currency"]).strip().upper()
    if "category" in data and data["category"]:
        data["category"] = str(data["category"]).strip().lower()
    if "title" in data and data["title"] is not None:
        data["title"] = str(data["title"]).strip()

    for key, value in data.items():
        setattr(row, key, value)
    row.update_date = str(datetime.now())

    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row)


async def delete_entry(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    entry_uuid: str,
) -> str:
    row = (
        await db_session.execute(
            select(FinanceLedgerEntry).where(FinanceLedgerEntry.entry_uuid == entry_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Finance entry not found")

    await authorize_finance_management(db_session, current_user, row.org_id, "delete")
    await db_session.delete(row)
    await db_session.commit()
    return "Finance entry deleted"


async def ledger_summary(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    include_instructor_cost: bool = True,
) -> FinanceLedgerSummaryRead:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await _org_or_404(db_session, org_id)

    if date_from:
        _validate_date(date_from)
    if date_to:
        _validate_date(date_to)

    stmt = select(FinanceLedgerEntry).where(
        FinanceLedgerEntry.org_id == org_id,
        FinanceLedgerEntry.status != FinanceEntryStatus.cancelled.value,
    )
    if date_from:
        stmt = stmt.where(FinanceLedgerEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(FinanceLedgerEntry.entry_date <= date_to)

    rows = (await db_session.execute(stmt)).scalars().all()

    total_revenue = 0.0
    total_expenses = 0.0
    revenue_count = 0
    expense_count = 0
    currency = "EGP"
    cat_map: dict[tuple[str, str], CategoryBreakdown] = {}
    daily_map: dict[str, DailyBreakdown] = {}

    for row in rows:
        currency = row.currency or currency
        amount = float(row.amount or 0)
        key = (row.category or "other", row.entry_type)
        if key not in cat_map:
            cat_map[key] = CategoryBreakdown(
                category=key[0], entry_type=key[1], total=0.0, count=0
            )
        cat_map[key].total = _round_money(cat_map[key].total + amount)
        cat_map[key].count += 1

        day = row.entry_date or ""
        if day not in daily_map:
            daily_map[day] = DailyBreakdown(date=day)
        if row.entry_type == FinanceEntryType.revenue.value:
            total_revenue += amount
            revenue_count += 1
            daily_map[day].revenue = _round_money(daily_map[day].revenue + amount)
        else:
            total_expenses += amount
            expense_count += 1
            daily_map[day].expenses = _round_money(daily_map[day].expenses + amount)
        daily_map[day].net = _round_money(daily_map[day].revenue - daily_map[day].expenses)

    instructor_cost = 0.0
    if include_instructor_cost:
        wl_stmt = select(InstructorWorkLog).where(InstructorWorkLog.org_id == org_id)
        if date_from:
            wl_stmt = wl_stmt.where(InstructorWorkLog.work_date >= date_from)
        if date_to:
            wl_stmt = wl_stmt.where(InstructorWorkLog.work_date <= date_to)
        worklogs = (await db_session.execute(wl_stmt)).scalars().all()
        instructor_cost = _round_money(sum(float(w.amount or 0) for w in worklogs))

    total_revenue = _round_money(total_revenue)
    total_expenses = _round_money(total_expenses)
    estimated_profit = _round_money(total_revenue - total_expenses - instructor_cost)
    estimated_margin = (
        _round_money((estimated_profit / total_revenue) * 100) if total_revenue > 0 else 0.0
    )

    daily = sorted(daily_map.values(), key=lambda d: d.date)
    by_category = sorted(
        cat_map.values(), key=lambda c: (c.entry_type, -c.total, c.category)
    )

    return FinanceLedgerSummaryRead(
        org_id=org_id,
        currency=currency,
        range_from=date_from,
        range_to=date_to,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        instructor_cost=instructor_cost,
        estimated_profit=estimated_profit,
        estimated_margin=estimated_margin,
        entry_count=len(rows),
        revenue_count=revenue_count,
        expense_count=expense_count,
        by_category=by_category,
        daily=daily,
    )
