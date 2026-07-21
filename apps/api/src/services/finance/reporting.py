"""Finance reporting service — P&L, course profit, payroll, refunds (no gateways)."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.links import SemesterCourse, TrainingProgramCourse
from src.db.academic.programs import Program
from src.db.academic.semesters import Semester
from src.db.academic.training_programs import TrainingProgram
from src.db.courses.courses import Course
from src.db.finance.ledger import FinanceEntryStatus, FinanceEntryType, FinanceLedgerEntry
from src.db.finance.reporting import (
    CategoryAmount,
    CourseProfitRead,
    FinanceCourseConfig,
    FinanceCourseConfigRead,
    FinanceCourseConfigUpsert,
    FinancePayrollPeriod,
    FinanceRefund,
    FinanceRefundCreate,
    FinanceRefundDecision,
    FinanceRefundRead,
    FinanceRefundStatus,
    PayrollInstructorLine,
    PayrollReportRead,
    ProfitLossLine,
    ProfitLossRead,
)
from src.db.instructors.finance import InstructorWorkLog
from src.db.instructors.instructors import Instructor
from src.db.organizations import Organization
from src.db.trail_runs import TrailRun
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.services.finance.authz import authorize_finance_management


def _round_money(value: float) -> float:
    return round(value + 1e-9, 2)


def _validate_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD") from exc
    return value


def _validate_month(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM") from exc
    return value


async def _org_or_404(db_session: AsyncSession, org_id: int) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _course_name(
    db_session: AsyncSession, org_id: int, course_uuid: str
) -> Optional[str]:
    course = (
        await db_session.execute(
            select(Course).where(
                Course.course_uuid == course_uuid, Course.org_id == org_id
            )
        )
    ).scalars().first()
    if course:
        return course.name
    # Demo / seed UUIDs used when Course table is empty
    demo = {
        "course_demo_governance": "Governance program (demo)",
        "course_demo_integrity": "Institutional integrity (demo)",
        "course_demo_investigation": "Administrative investigation (demo)",
    }
    return demo.get(course_uuid)


async def _course_program(
    db_session: AsyncSession, org_id: int, course_uuid: str
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    academic = (
        await db_session.execute(
            select(Program)
            .join(Semester, Semester.program_id == Program.id)
            .join(SemesterCourse, SemesterCourse.semester_id == Semester.id)
            .join(Course, Course.id == SemesterCourse.course_id)
            .where(Course.org_id == org_id, Course.course_uuid == course_uuid)
        )
    ).scalars().first()
    if academic:
        return academic.program_uuid, academic.name, "postgraduate"

    training = (
        await db_session.execute(
            select(TrainingProgram)
            .join(
                TrainingProgramCourse,
                TrainingProgramCourse.training_program_id == TrainingProgram.id,
            )
            .join(Course, Course.id == TrainingProgramCourse.course_id)
            .where(Course.org_id == org_id, Course.course_uuid == course_uuid)
        )
    ).scalars().first()
    if training:
        return training.trainingprogram_uuid, training.name, "training"
    return None, None, None


async def _enrollment_count(db_session: AsyncSession, org_id: int, course_uuid: str) -> int:
    course = (
        await db_session.execute(
            select(Course).where(Course.course_uuid == course_uuid, Course.org_id == org_id)
        )
    ).scalars().first()
    if not course or not course.id:
        return 0
    rows = (
        await db_session.execute(
            select(TrailRun).where(
                TrailRun.course_id == course.id,
                TrailRun.org_id == org_id,
            )
        )
    ).scalars().all()
    return len(rows)


# ---------------------------------------------------------------------------
# Profit & Loss
# ---------------------------------------------------------------------------


async def profit_loss(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> ProfitLossRead:
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
    entries = (await db_session.execute(stmt)).scalars().all()

    gross_revenue = 0.0
    operating_expenses = 0.0
    currency = "EGP"
    cat: dict[tuple[str, str], float] = {}

    for e in entries:
        currency = e.currency or currency
        amt = float(e.amount or 0)
        key = (e.entry_type, e.category or "other")
        cat[key] = cat.get(key, 0.0) + amt
        if e.entry_type == FinanceEntryType.revenue.value:
            gross_revenue += amt
        else:
            operating_expenses += amt

    # Refunds recorded as approved/recorded in period
    refund_stmt = select(FinanceRefund).where(
        FinanceRefund.org_id == org_id,
        FinanceRefund.status.in_(
            [FinanceRefundStatus.approved.value, FinanceRefundStatus.recorded.value]
        ),
    )
    refunds_rows = (await db_session.execute(refund_stmt)).scalars().all()
    refunds = 0.0
    for r in refunds_rows:
        # Approximate period filter via creation_date / decided_at date prefix
        stamp = (r.decided_at or r.creation_date or "")[:10]
        if date_from and stamp and stamp < date_from:
            continue
        if date_to and stamp and stamp > date_to:
            continue
        refunds += float(r.amount or 0)
        currency = r.currency or currency

    wl_stmt = select(InstructorWorkLog).where(InstructorWorkLog.org_id == org_id)
    if date_from:
        wl_stmt = wl_stmt.where(InstructorWorkLog.work_date >= date_from)
    if date_to:
        wl_stmt = wl_stmt.where(InstructorWorkLog.work_date <= date_to)
    worklogs = (await db_session.execute(wl_stmt)).scalars().all()
    instructor_cost = _round_money(sum(float(w.amount or 0) for w in worklogs))

    gross_revenue = _round_money(gross_revenue)
    refunds = _round_money(refunds)
    net_revenue = _round_money(gross_revenue - refunds)
    operating_expenses = _round_money(operating_expenses)
    total_costs = _round_money(operating_expenses + instructor_cost)
    net_profit = _round_money(net_revenue - total_costs)
    margin = _round_money((net_profit / net_revenue) * 100) if net_revenue > 0 else 0.0

    lines = [
        ProfitLossLine(label="Gross revenue", amount=gross_revenue, kind="revenue"),
        ProfitLossLine(label="Refunds", amount=refunds, kind="expense"),
        ProfitLossLine(label="Net revenue", amount=net_revenue, kind="total"),
        ProfitLossLine(label="Operating expenses", amount=operating_expenses, kind="expense"),
        ProfitLossLine(label="Instructor cost", amount=instructor_cost, kind="cost"),
        ProfitLossLine(label="Total costs", amount=total_costs, kind="total"),
        ProfitLossLine(label="Net profit", amount=net_profit, kind="total"),
        ProfitLossLine(label="Margin %", amount=margin, kind="margin"),
    ]

    by_category = [
        CategoryAmount(entry_type=k[0], category=k[1], total=_round_money(v))
        for k, v in sorted(cat.items(), key=lambda x: (x[0][0], -x[1]))
    ]

    return ProfitLossRead(
        org_id=org_id,
        currency=currency,
        range_from=date_from,
        range_to=date_to,
        gross_revenue=gross_revenue,
        refunds=refunds,
        net_revenue=net_revenue,
        operating_expenses=operating_expenses,
        instructor_cost=instructor_cost,
        total_costs=total_costs,
        net_profit=net_profit,
        margin_pct=margin,
        lines=lines,
        by_category=by_category,
    )


# ---------------------------------------------------------------------------
# Course profitability
# ---------------------------------------------------------------------------


def _config_to_read(cfg: FinanceCourseConfig) -> FinanceCourseConfigRead:
    return FinanceCourseConfigRead(**cfg.model_dump())


async def upsert_course_config(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    payload: FinanceCourseConfigUpsert,
) -> FinanceCourseConfigRead:
    await authorize_finance_management(db_session, current_user, org_id, "update")
    await _org_or_404(db_session, org_id)

    course = (
        await db_session.execute(
            select(Course).where(
                Course.course_uuid == payload.course_uuid,
                Course.org_id == org_id,
            )
        )
    ).scalars().first()
    # Allow demo course UUIDs (no Course row) for local reporting / cost config
    if not course and not payload.course_uuid.startswith("course_demo_"):
        raise HTTPException(status_code=404, detail="Course not found in this organization")

    existing = (
        await db_session.execute(
            select(FinanceCourseConfig).where(
                FinanceCourseConfig.org_id == org_id,
                FinanceCourseConfig.course_uuid == payload.course_uuid,
            )
        )
    ).scalars().first()

    now = str(datetime.now())
    if existing:
        existing.currency = (payload.currency or "EGP").upper()
        existing.tuition_unit_amount = payload.tuition_unit_amount
        existing.certification_unit_cost = payload.certification_unit_cost or 0.0
        existing.addons_unit_cost = payload.addons_unit_cost or 0.0
        existing.other_fixed_cost = payload.other_fixed_cost or 0.0
        existing.attendees_override = payload.attendees_override
        existing.certified_attendees_override = payload.certified_attendees_override
        existing.update_date = now
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)
        return _config_to_read(existing)

    row = FinanceCourseConfig(
        org_id=org_id,
        course_uuid=payload.course_uuid,
        config_uuid=f"fcc_{uuid4()}",
        currency=(payload.currency or "EGP").upper(),
        tuition_unit_amount=payload.tuition_unit_amount,
        certification_unit_cost=payload.certification_unit_cost or 0.0,
        addons_unit_cost=payload.addons_unit_cost or 0.0,
        other_fixed_cost=payload.other_fixed_cost or 0.0,
        attendees_override=payload.attendees_override,
        certified_attendees_override=payload.certified_attendees_override,
        creation_date=now,
        update_date=now,
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _config_to_read(row)


async def _compute_course_profit(
    db_session: AsyncSession,
    org_id: int,
    course_uuid: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> CourseProfitRead:
    cfg = (
        await db_session.execute(
            select(FinanceCourseConfig).where(
                FinanceCourseConfig.org_id == org_id,
                FinanceCourseConfig.course_uuid == course_uuid,
            )
        )
    ).scalars().first()

    ledger_stmt = select(FinanceLedgerEntry).where(
        FinanceLedgerEntry.org_id == org_id,
        FinanceLedgerEntry.course_uuid == course_uuid,
        FinanceLedgerEntry.status != FinanceEntryStatus.cancelled.value,
    )
    if date_from:
        ledger_stmt = ledger_stmt.where(FinanceLedgerEntry.entry_date >= date_from)
    if date_to:
        ledger_stmt = ledger_stmt.where(FinanceLedgerEntry.entry_date <= date_to)
    entries = (await db_session.execute(ledger_stmt)).scalars().all()

    ledger_revenue = 0.0
    ledger_expenses = 0.0
    currency = (cfg.currency if cfg else None) or "EGP"
    for e in entries:
        currency = e.currency or currency
        amt = float(e.amount or 0)
        if e.entry_type == FinanceEntryType.revenue.value:
            ledger_revenue += amt
        else:
            ledger_expenses += amt

    # Refunds linked to revenue entries for this course
    entry_uuids = [e.entry_uuid for e in entries if e.entry_type == FinanceEntryType.revenue.value]
    refunds = 0.0
    if entry_uuids:
        refund_rows = (
            await db_session.execute(
                select(FinanceRefund).where(
                    FinanceRefund.org_id == org_id,
                    FinanceRefund.entry_uuid.in_(entry_uuids),
                    FinanceRefund.status.in_(
                        [
                            FinanceRefundStatus.approved.value,
                            FinanceRefundStatus.recorded.value,
                        ]
                    ),
                )
            )
        ).scalars().all()
        refunds = sum(float(r.amount or 0) for r in refund_rows)

    wl_stmt = select(InstructorWorkLog).where(
        InstructorWorkLog.org_id == org_id,
        InstructorWorkLog.course_uuid == course_uuid,
    )
    if date_from:
        wl_stmt = wl_stmt.where(InstructorWorkLog.work_date >= date_from)
    if date_to:
        wl_stmt = wl_stmt.where(InstructorWorkLog.work_date <= date_to)
    worklogs = (await db_session.execute(wl_stmt)).scalars().all()
    instructor_cost = _round_money(sum(float(w.amount or 0) for w in worklogs))
    instructor_hours = _round_money(sum(float(w.hours or 0) for w in worklogs))

    trail_attendees = await _enrollment_count(db_session, org_id, course_uuid)
    attendees = (
        cfg.attendees_override
        if cfg and cfg.attendees_override is not None
        else trail_attendees
    )
    certified = (
        cfg.certified_attendees_override
        if cfg and cfg.certified_attendees_override is not None
        else attendees
    )

    cert_unit = float(cfg.certification_unit_cost or 0) if cfg else 0.0
    addons_unit = float(cfg.addons_unit_cost or 0) if cfg else 0.0
    other_fixed = float(cfg.other_fixed_cost or 0) if cfg else 0.0

    # If no ledger revenue but tuition configured, estimate revenue
    if ledger_revenue <= 0 and cfg and cfg.tuition_unit_amount and attendees > 0:
        ledger_revenue = float(cfg.tuition_unit_amount) * attendees

    certification_cost = _round_money(cert_unit * certified)
    addons_cost = _round_money(addons_unit * attendees)
    other_fixed_cost = _round_money(other_fixed)

    ledger_revenue = _round_money(ledger_revenue)
    ledger_expenses = _round_money(ledger_expenses)
    refunds = _round_money(refunds)
    net_revenue = _round_money(ledger_revenue - refunds)
    total_cost = _round_money(
        instructor_cost + certification_cost + addons_cost + other_fixed_cost + ledger_expenses
    )
    net_profit = _round_money(net_revenue - total_cost)
    margin = _round_money((net_profit / net_revenue) * 100) if net_revenue > 0 else 0.0

    program_uuid, program_name, program_type = await _course_program(
        db_session, org_id, course_uuid
    )
    return CourseProfitRead(
        org_id=org_id,
        course_uuid=course_uuid,
        course_name=await _course_name(db_session, org_id, course_uuid),
        program_uuid=program_uuid,
        program_name=program_name,
        program_type=program_type,
        currency=currency,
        attendees=attendees,
        certified_attendees=certified,
        ledger_revenue=ledger_revenue,
        ledger_expenses=ledger_expenses,
        refunds=refunds,
        net_revenue=net_revenue,
        instructor_cost=instructor_cost,
        instructor_hours=instructor_hours,
        certification_cost=certification_cost,
        addons_cost=addons_cost,
        other_fixed_cost=other_fixed_cost,
        total_cost=total_cost,
        net_profit=net_profit,
        margin_pct=margin,
        revenue_per_attendee=_round_money(net_revenue / attendees) if attendees else 0.0,
        cost_per_attendee=_round_money(total_cost / attendees) if attendees else 0.0,
        config=_config_to_read(cfg) if cfg else None,
    )


async def get_course_profit(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    course_uuid: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> CourseProfitRead:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await _org_or_404(db_session, org_id)
    if date_from:
        _validate_date(date_from)
    if date_to:
        _validate_date(date_to)
    return await _compute_course_profit(db_session, org_id, course_uuid, date_from, date_to)


async def list_course_profits(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[CourseProfitRead]:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await _org_or_404(db_session, org_id)
    if date_from:
        _validate_date(date_from)
    if date_to:
        _validate_date(date_to)

    # Collect course uuids from ledger, worklogs, and configs
    uuids: set[str] = set()

    for row in (
        await db_session.execute(
            select(FinanceLedgerEntry.course_uuid).where(
                FinanceLedgerEntry.org_id == org_id,
                FinanceLedgerEntry.course_uuid.is_not(None),
            )
        )
    ).all():
        if row[0]:
            uuids.add(row[0])

    for row in (
        await db_session.execute(
            select(InstructorWorkLog.course_uuid).where(
                InstructorWorkLog.org_id == org_id,
                InstructorWorkLog.course_uuid.is_not(None),
            )
        )
    ).all():
        if row[0]:
            uuids.add(row[0])

    for row in (
        await db_session.execute(
            select(FinanceCourseConfig.course_uuid).where(FinanceCourseConfig.org_id == org_id)
        )
    ).all():
        if row[0]:
            uuids.add(row[0])

    results: List[CourseProfitRead] = []
    for cuuid in sorted(uuids):
        results.append(
            await _compute_course_profit(db_session, org_id, cuuid, date_from, date_to)
        )

    results.sort(key=lambda r: r.net_profit, reverse=True)
    return results


# ---------------------------------------------------------------------------
# Refunds
# ---------------------------------------------------------------------------


async def _refund_to_read(db_session: AsyncSession, row: FinanceRefund) -> FinanceRefundRead:
    entry = (
        await db_session.execute(
            select(FinanceLedgerEntry).where(FinanceLedgerEntry.entry_uuid == row.entry_uuid)
        )
    ).scalars().first()
    return FinanceRefundRead(
        **row.model_dump(),
        entry_title=entry.title if entry else None,
    )


async def create_refund(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    payload: FinanceRefundCreate,
) -> FinanceRefundRead:
    user_id = await authorize_finance_management(db_session, current_user, org_id, "create")
    await _org_or_404(db_session, org_id)

    entry = (
        await db_session.execute(
            select(FinanceLedgerEntry).where(
                FinanceLedgerEntry.entry_uuid == payload.entry_uuid,
                FinanceLedgerEntry.org_id == org_id,
            )
        )
    ).scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    if entry.entry_type != FinanceEntryType.revenue.value:
        raise HTTPException(status_code=422, detail="Refunds can only target revenue entries")
    if entry.status == FinanceEntryStatus.cancelled.value:
        raise HTTPException(status_code=409, detail="Cannot refund a cancelled entry")

    existing = (
        await db_session.execute(
            select(FinanceRefund).where(
                FinanceRefund.entry_uuid == payload.entry_uuid,
                FinanceRefund.status.in_(
                    [
                        FinanceRefundStatus.pending.value,
                        FinanceRefundStatus.approved.value,
                        FinanceRefundStatus.recorded.value,
                    ]
                ),
            )
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="A refund already exists for this entry")

    amount = payload.amount if payload.amount is not None else float(entry.amount)
    if amount <= 0 or amount > float(entry.amount) + 1e-9:
        raise HTTPException(status_code=422, detail="Refund amount must be > 0 and ≤ entry amount")
    if not (payload.reason or "").strip():
        raise HTTPException(status_code=422, detail="reason is required")

    now = str(datetime.now())
    row = FinanceRefund(
        org_id=org_id,
        refund_uuid=f"ref_{uuid4()}",
        entry_uuid=payload.entry_uuid,
        amount=_round_money(amount),
        currency=(payload.currency or entry.currency or "EGP").upper(),
        reason=payload.reason.strip(),
        status=FinanceRefundStatus.pending.value,
        created_by=user_id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return await _refund_to_read(db_session, row)


async def list_refunds(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    status: Optional[str] = None,
) -> List[FinanceRefundRead]:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await _org_or_404(db_session, org_id)
    stmt = select(FinanceRefund).where(FinanceRefund.org_id == org_id)
    if status:
        stmt = stmt.where(FinanceRefund.status == status)
    stmt = stmt.order_by(FinanceRefund.id.desc())
    rows = (await db_session.execute(stmt)).scalars().all()
    return [await _refund_to_read(db_session, r) for r in rows]


async def decide_refund(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    refund_uuid: str,
    payload: FinanceRefundDecision,
) -> FinanceRefundRead:
    row = (
        await db_session.execute(
            select(FinanceRefund).where(FinanceRefund.refund_uuid == refund_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Refund not found")

    user_id = await authorize_finance_management(db_session, current_user, row.org_id, "update")

    status = (
        payload.status.value
        if isinstance(payload.status, FinanceRefundStatus)
        else str(payload.status)
    )
    if status not in {
        FinanceRefundStatus.approved.value,
        FinanceRefundStatus.rejected.value,
        FinanceRefundStatus.recorded.value,
    }:
        raise HTTPException(status_code=422, detail="Invalid decision status")

    if row.status == FinanceRefundStatus.recorded.value and status != FinanceRefundStatus.recorded.value:
        raise HTTPException(status_code=409, detail="Refund already recorded")

    now = str(datetime.now())
    row.status = status
    row.decided_by = user_id
    row.decided_at = now
    row.decision_note = payload.decision_note
    row.update_date = now
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return await _refund_to_read(db_session, row)


# ---------------------------------------------------------------------------
# Payroll
# ---------------------------------------------------------------------------


async def payroll_report(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    month: str,
) -> PayrollReportRead:
    await authorize_finance_management(db_session, current_user, org_id, "read")
    await _org_or_404(db_session, org_id)
    month = _validate_month(month)

    date_from = f"{month}-01"
    # next month rough upper bound via string compare on YYYY-MM-DD
    y, m = int(month[:4]), int(month[5:7])
    if m == 12:
        date_to = f"{y + 1}-01-01"
    else:
        date_to = f"{y}-{m + 1:02d}-01"

    worklogs = (
        await db_session.execute(
            select(InstructorWorkLog).where(
                InstructorWorkLog.org_id == org_id,
                InstructorWorkLog.work_date >= date_from,
                InstructorWorkLog.work_date < date_to,
            )
        )
    ).scalars().all()

    by_inst: dict[Optional[int], PayrollInstructorLine] = {}
    currency = "EGP"
    for w in worklogs:
        key = w.instructor_id
        if key not in by_inst:
            name = None
            iuuid = None
            if w.instructor_id:
                inst = (
                    await db_session.execute(
                        select(Instructor).where(Instructor.id == w.instructor_id)
                    )
                ).scalars().first()
                if inst:
                    iuuid = inst.instructor_uuid
                    user = (
                        await db_session.execute(select(User).where(User.id == inst.user_id))
                    ).scalars().first()
                    if user:
                        name = (
                            f"{user.first_name or ''} {user.last_name or ''}".strip()
                            or user.username
                        )
            by_inst[key] = PayrollInstructorLine(
                instructor_id=w.instructor_id,
                instructor_uuid=iuuid,
                instructor_name=name,
                hours=0.0,
                amount=0.0,
                currency=w.currency,
                courses=[],
            )
        line = by_inst[key]
        line.hours = _round_money(line.hours + float(w.hours or 0))
        line.amount = _round_money(line.amount + float(w.amount or 0))
        line.currency = w.currency or line.currency
        currency = w.currency or currency
        if w.course_uuid and w.course_uuid not in line.courses:
            line.courses.append(w.course_uuid)

    instructors = sorted(by_inst.values(), key=lambda x: x.amount, reverse=True)
    total_hours = _round_money(sum(i.hours for i in instructors))
    total_pay = _round_money(sum(i.amount for i in instructors))

    period = (
        await db_session.execute(
            select(FinancePayrollPeriod).where(
                FinancePayrollPeriod.org_id == org_id,
                FinancePayrollPeriod.month == month,
            )
        )
    ).scalars().first()

    return PayrollReportRead(
        org_id=org_id,
        month=month,
        currency=currency,
        total_hours=total_hours,
        total_pay=total_pay,
        instructors=instructors,
        closed=bool(period and period.status == "closed"),
    )


async def close_payroll_month(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    month: str,
) -> PayrollReportRead:
    user_id = await authorize_finance_management(db_session, current_user, org_id, "update")
    report = await payroll_report(db_session, current_user, org_id, month)

    period = (
        await db_session.execute(
            select(FinancePayrollPeriod).where(
                FinancePayrollPeriod.org_id == org_id,
                FinancePayrollPeriod.month == month,
            )
        )
    ).scalars().first()

    now = str(datetime.now())
    if period:
        if period.status == "closed":
            raise HTTPException(status_code=409, detail="Payroll month already closed")
        period.status = "closed"
        period.total_hours = report.total_hours
        period.total_pay = report.total_pay
        period.currency = report.currency
        period.closed_by = user_id
        period.closed_at = now
        period.update_date = now
        db_session.add(period)
    else:
        period = FinancePayrollPeriod(
            org_id=org_id,
            month=month,
            status="closed",
            total_hours=report.total_hours,
            total_pay=report.total_pay,
            currency=report.currency,
            closed_by=user_id,
            closed_at=now,
            creation_date=now,
            update_date=now,
        )
        db_session.add(period)

    await db_session.commit()
    report.closed = True
    return report
