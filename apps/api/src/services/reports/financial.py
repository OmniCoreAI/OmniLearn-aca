"""Financial report: revenue, instructor costs and the profit & loss statement.

Totals follow the same rules as the Finance page's P&L
(``src/services/finance/reporting.profit_loss``) so the two always agree:
cancelled ledger entries are ignored, refunds count once approved/recorded
(dated by their decision), and instructor cost is the sum of work logs.
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.finance.ledger import FinanceEntryStatus, FinanceEntryType, FinanceLedgerEntry
from src.db.finance.reporting import FinanceRefund, FinanceRefundStatus
from src.db.instructors.finance import InstructorWorkLog
from src.db.instructors.instructors import Instructor
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.services.finance.authz import authorize_finance_management
from src.services.reports.common import Range, ReportRange, money, month_of, org_or_404, pct, resolve_range, to_day


class FinancialTotals(BaseModel):
    gross_revenue: float = 0
    refunds: float = 0
    net_revenue: float = 0
    operating_expenses: float = 0
    instructor_cost: float = 0
    total_costs: float = 0
    net_profit: float = 0
    margin_pct: float = 0
    instructor_hours: float = 0
    revenue_entries: int = 0
    expense_entries: int = 0


class FinancialMonth(BaseModel):
    month: str
    revenue: float = 0
    refunds: float = 0
    expenses: float = 0
    instructor_cost: float = 0
    net: float = 0


class AmountRow(BaseModel):
    key: str
    label: str
    total: float
    count: int
    share_pct: float = 0


class RevenueEntry(BaseModel):
    entry_uuid: str
    title: str
    category: str
    amount: float
    entry_date: str
    payment_method: Optional[str] = None
    course_name: Optional[str] = None


class InstructorCostRow(BaseModel):
    instructor_uuid: Optional[str] = None
    name: str
    hours: float
    sessions: int
    amount: float
    avg_rate: float
    courses: list[str]
    share_pct: float


class CourseCostRow(BaseModel):
    course_uuid: Optional[str] = None
    course_name: str
    hours: float
    amount: float
    instructors: int


class FinancialReport(BaseModel):
    range: ReportRange
    currency: str
    totals: FinancialTotals
    previous: FinancialTotals
    monthly: list[FinancialMonth]
    revenue_by_category: list[AmountRow]
    revenue_by_payment_method: list[AmountRow]
    revenue_by_course: list[AmountRow]
    expenses_by_category: list[AmountRow]
    top_revenue: list[RevenueEntry]
    instructors: list[InstructorCostRow]
    instructor_cost_by_course: list[CourseCostRow]


def _rows(groups: dict[str, list[float]], labels: dict[str, str], whole: float) -> list[AmountRow]:
    rows = [
        AmountRow(key=k, label=labels.get(k, k), total=money(sum(v)), count=len(v), share_pct=pct(sum(v), whole))
        for k, v in groups.items()
    ]
    return sorted(rows, key=lambda r: r.total, reverse=True)


def _totals(entries, refunds, worklogs, rng: Range) -> FinancialTotals:
    t = FinancialTotals()
    for e in entries:
        if not rng.contains(to_day(e.entry_date)):
            continue
        if e.entry_type == FinanceEntryType.revenue.value:
            t.gross_revenue += float(e.amount or 0)
            t.revenue_entries += 1
        else:
            t.operating_expenses += float(e.amount or 0)
            t.expense_entries += 1
    for r in refunds:
        if rng.contains(to_day(r.decided_at or r.creation_date)):
            t.refunds += float(r.amount or 0)
    for w in worklogs:
        if rng.contains(to_day(w.work_date)):
            t.instructor_cost += float(w.amount or 0)
            t.instructor_hours += float(w.hours or 0)
    t.gross_revenue = money(t.gross_revenue)
    t.refunds = money(t.refunds)
    t.net_revenue = money(t.gross_revenue - t.refunds)
    t.operating_expenses = money(t.operating_expenses)
    t.instructor_cost = money(t.instructor_cost)
    t.instructor_hours = money(t.instructor_hours)
    t.total_costs = money(t.operating_expenses + t.instructor_cost)
    t.net_profit = money(t.net_revenue - t.total_costs)
    t.margin_pct = pct(t.net_profit, t.net_revenue) if t.net_revenue > 0 else 0.0
    return t


async def financial_report(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> FinancialReport:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await org_or_404(db_session, org_id)
    rng = resolve_range(date_from, date_to)
    span = Range(rng.prev.start, rng.end)  # current + previous period in one read
    lo, hi = span.start.isoformat(), span.end.isoformat()

    entries = (
        await db_session.execute(
            select(FinanceLedgerEntry).where(
                FinanceLedgerEntry.org_id == org_id,
                FinanceLedgerEntry.status != FinanceEntryStatus.cancelled.value,
                FinanceLedgerEntry.entry_date >= lo,
                FinanceLedgerEntry.entry_date <= hi,
            )
        )
    ).scalars().all()
    refunds = (
        await db_session.execute(
            select(FinanceRefund).where(
                FinanceRefund.org_id == org_id,
                FinanceRefund.status.in_([FinanceRefundStatus.approved.value, FinanceRefundStatus.recorded.value]),  # type: ignore[union-attr]
            )
        )
    ).scalars().all()
    worklogs = (
        await db_session.execute(
            select(InstructorWorkLog).where(
                InstructorWorkLog.org_id == org_id,
                InstructorWorkLog.work_date >= lo,
                InstructorWorkLog.work_date <= hi + "~",
            )
        )
    ).scalars().all()

    currency = next((e.currency for e in entries if e.currency), None) or next((w.currency for w in worklogs if w.currency), None) or "EGP"
    totals = _totals(entries, refunds, worklogs, rng)
    previous = _totals(entries, refunds, worklogs, rng.prev)

    # ---- monthly series
    monthly = {m: FinancialMonth(month=m) for m in rng.months()}
    for e in entries:
        d = to_day(e.entry_date)
        row = monthly.get(month_of(d) or "") if rng.contains(d) else None
        if row:
            if e.entry_type == FinanceEntryType.revenue.value:
                row.revenue += float(e.amount or 0)
            else:
                row.expenses += float(e.amount or 0)
    for r in refunds:
        d = to_day(r.decided_at or r.creation_date)
        row = monthly.get(month_of(d) or "") if rng.contains(d) else None
        if row:
            row.refunds += float(r.amount or 0)
    for w in worklogs:
        d = to_day(w.work_date)
        row = monthly.get(month_of(d) or "") if rng.contains(d) else None
        if row:
            row.instructor_cost += float(w.amount or 0)
    for row in monthly.values():
        row.revenue, row.refunds, row.expenses, row.instructor_cost = (
            money(row.revenue), money(row.refunds), money(row.expenses), money(row.instructor_cost)
        )
        row.net = money(row.revenue - row.refunds - row.expenses - row.instructor_cost)

    # ---- revenue and expense breakdowns (current period)
    current = [e for e in entries if rng.contains(to_day(e.entry_date))]
    revenue = [e for e in current if e.entry_type == FinanceEntryType.revenue.value]
    expenses = [e for e in current if e.entry_type != FinanceEntryType.revenue.value]

    course_uuids = {e.course_uuid for e in revenue if e.course_uuid} | {w.course_uuid for w in worklogs if w.course_uuid}
    course_names: dict[str, str] = {}
    if course_uuids:
        for c in (await db_session.execute(select(Course).where(Course.course_uuid.in_(course_uuids)))).scalars().all():  # type: ignore[union-attr]
            course_names[c.course_uuid] = c.name

    by_cat: dict[str, list[float]] = {}
    by_method: dict[str, list[float]] = {}
    by_course: dict[str, list[float]] = {}
    for e in revenue:
        by_cat.setdefault(e.category or "other", []).append(float(e.amount or 0))
        by_method.setdefault(e.payment_method or "unspecified", []).append(float(e.amount or 0))
        by_course.setdefault(e.course_uuid or "unassigned", []).append(float(e.amount or 0))
    exp_cat: dict[str, list[float]] = {}
    for e in expenses:
        exp_cat.setdefault(e.category or "other", []).append(float(e.amount or 0))

    top_revenue = [
        RevenueEntry(
            entry_uuid=e.entry_uuid, title=e.title, category=e.category or "other", amount=money(e.amount),
            entry_date=e.entry_date, payment_method=e.payment_method,
            course_name=course_names.get(e.course_uuid or ""),
        )
        for e in sorted(revenue, key=lambda e: float(e.amount or 0), reverse=True)[:10]
    ]

    # ---- instructor costs (current period)
    current_logs = [w for w in worklogs if rng.contains(to_day(w.work_date))]
    instructor_ids = {w.instructor_id for w in current_logs if w.instructor_id}
    names: dict[int, tuple[Optional[str], str]] = {}
    if instructor_ids:
        rows = (
            await db_session.execute(
                select(Instructor, User).join(User, User.id == Instructor.user_id).where(Instructor.id.in_(instructor_ids))  # type: ignore[union-attr]
            )
        ).all()
        for inst, user in rows:
            full = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
            names[inst.id] = (inst.instructor_uuid, full)

    per_inst: dict[Optional[int], dict] = {}
    per_course: dict[str, dict] = {}
    for w in current_logs:
        bucket = per_inst.setdefault(w.instructor_id, {"hours": 0.0, "amount": 0.0, "sessions": 0, "courses": set()})
        bucket["hours"] += float(w.hours or 0)
        bucket["amount"] += float(w.amount or 0)
        bucket["sessions"] += 1
        if w.course_uuid:
            bucket["courses"].add(course_names.get(w.course_uuid, w.course_uuid))
        ckey = w.course_uuid or "unassigned"
        cb = per_course.setdefault(ckey, {"hours": 0.0, "amount": 0.0, "instructors": set()})
        cb["hours"] += float(w.hours or 0)
        cb["amount"] += float(w.amount or 0)
        cb["instructors"].add(w.instructor_id)

    instructors = sorted(
        (
            InstructorCostRow(
                instructor_uuid=names.get(iid or -1, (None, ""))[0],
                name=names.get(iid or -1, (None, ""))[1] or "—",
                hours=money(b["hours"]),
                sessions=b["sessions"],
                amount=money(b["amount"]),
                avg_rate=money(b["amount"] / b["hours"]) if b["hours"] else 0.0,
                courses=sorted(b["courses"]),
                share_pct=pct(b["amount"], totals.instructor_cost),
            )
            for iid, b in per_inst.items()
        ),
        key=lambda r: r.amount,
        reverse=True,
    )
    cost_by_course = sorted(
        (
            CourseCostRow(
                course_uuid=None if k == "unassigned" else k,
                course_name=course_names.get(k, "—" if k == "unassigned" else k),
                hours=money(b["hours"]),
                amount=money(b["amount"]),
                instructors=len([i for i in b["instructors"] if i]),
            )
            for k, b in per_course.items()
        ),
        key=lambda r: r.amount,
        reverse=True,
    )

    course_labels = {k: course_names.get(k, "—") for k in by_course}
    return FinancialReport(
        range=rng.to_read(),
        currency=currency,
        totals=totals,
        previous=previous,
        monthly=list(monthly.values()),
        revenue_by_category=_rows(by_cat, {}, totals.gross_revenue),
        revenue_by_payment_method=_rows(by_method, {}, totals.gross_revenue),
        revenue_by_course=_rows(by_course, course_labels, totals.gross_revenue),
        expenses_by_category=_rows(exp_cat, {}, totals.operating_expenses),
        top_revenue=top_revenue,
        instructors=instructors,
        instructor_cost_by_course=cost_by_course,
    )
