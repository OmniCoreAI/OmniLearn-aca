"""Instructor Finance service.

Computes ``amount = hours × rate`` where the rate is resolved from the
instructor's category for the chosen delivery language (category rate wins,
per-language rate preferred, instructor rate as final fallback). Work logs
persist a snapshot of the rate/amount so financial history is stable.
"""
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.instructors.finance import (
    InstructorFinanceSummaryRead,
    InstructorWorkLog,
    InstructorWorkLogCreate,
    InstructorWorkLogRead,
    InstructorWorkLogUpdate,
    OrgFinanceSummaryRead,
    RateComputationRead,
)
from src.db.instructors.instructors import Instructor
from src.db.organizations import Organization
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.services.instructors.authz import authorize_instructor_management
from src.services.instructors.validation import resolve_effective_rate, validate_worklog_payload


def _round_money(value: float) -> float:
    return round(value + 1e-9, 2)


async def _get_instructor_or_404(db_session: AsyncSession, instructor_uuid: str) -> Instructor:
    instructor = (
        await db_session.execute(
            select(Instructor).where(Instructor.instructor_uuid == instructor_uuid)
        )
    ).scalars().first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor


async def _instructor_display(
    db_session: AsyncSession, instructor_id: Optional[int]
) -> Tuple[Optional[str], Optional[str]]:
    """Return (instructor_uuid, display_name) for a worklog row, or (None, None)."""
    if instructor_id is None:
        return None, None
    instructor = (
        await db_session.execute(select(Instructor).where(Instructor.id == instructor_id))
    ).scalars().first()
    if not instructor:
        return None, None
    user = (
        await db_session.execute(select(User).where(User.id == instructor.user_id))
    ).scalars().first()
    name = None
    if user:
        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
    return instructor.instructor_uuid, name


async def _worklog_to_read(
    db_session: AsyncSession, log: InstructorWorkLog
) -> InstructorWorkLogRead:
    instructor_uuid, instructor_name = await _instructor_display(db_session, log.instructor_id)
    return InstructorWorkLogRead(
        **log.model_dump(),
        instructor_uuid=instructor_uuid,
        instructor_name=instructor_name,
    )


async def compute_rate(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    instructor_uuid: str,
    hours: float,
    language: Optional[str],
) -> RateComputationRead:
    """Preview a Hours × Rate computation without persisting anything."""
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "read")
    validate_worklog_payload({"hours": hours})

    rate, source, currency = await resolve_effective_rate(db_session, instructor, language)
    return RateComputationRead(
        instructor_uuid=instructor_uuid,
        language=language,
        hours=hours,
        rate_applied=rate,
        amount=_round_money(hours * rate),
        currency=currency,
        rate_source=source,
    )


async def create_worklog(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    payload: InstructorWorkLogCreate,
) -> InstructorWorkLogRead:
    await authorize_instructor_management(db_session, current_user, org_id, "create")

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    validate_worklog_payload(payload.model_dump())

    instructor = await _get_instructor_or_404(db_session, payload.instructor_uuid)
    if instructor.org_id != org_id:
        raise HTTPException(status_code=400, detail="Instructor belongs to a different organization")

    rate, _source, currency = await resolve_effective_rate(db_session, instructor, payload.language)
    amount = _round_money(payload.hours * rate)

    log = InstructorWorkLog(
        org_id=org_id,
        instructor_id=instructor.id,
        hours=payload.hours,
        language=payload.language,
        rate_applied=rate,
        amount=amount,
        currency=currency,
        work_date=payload.work_date,
        description=payload.description,
        course_uuid=payload.course_uuid,
        worklog_uuid=f"worklog_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    return await _worklog_to_read(db_session, log)


async def _get_worklog_or_404(db_session: AsyncSession, worklog_uuid: str) -> InstructorWorkLog:
    log = (
        await db_session.execute(
            select(InstructorWorkLog).where(InstructorWorkLog.worklog_uuid == worklog_uuid)
        )
    ).scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Work log not found")
    return log


async def list_worklogs(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    instructor_uuid: Optional[str] = None,
) -> List[InstructorWorkLogRead]:
    await authorize_instructor_management(db_session, current_user, org_id, "read")

    statement = select(InstructorWorkLog).where(InstructorWorkLog.org_id == org_id)
    if instructor_uuid:
        instructor = await _get_instructor_or_404(db_session, instructor_uuid)
        statement = statement.where(InstructorWorkLog.instructor_id == instructor.id)
    statement = statement.order_by(InstructorWorkLog.creation_date.desc())  # type: ignore

    logs = (await db_session.execute(statement)).scalars().all()
    return [await _worklog_to_read(db_session, log) for log in logs]


async def update_worklog(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    worklog_uuid: str,
    payload: InstructorWorkLogUpdate,
) -> InstructorWorkLogRead:
    log = await _get_worklog_or_404(db_session, worklog_uuid)
    await authorize_instructor_management(db_session, current_user, log.org_id, "update")

    data = payload.model_dump(exclude_unset=True)
    validate_worklog_payload({**log.model_dump(), **data})

    for key, value in data.items():
        setattr(log, key, value)

    # Re-resolve the rate/amount whenever hours or language changed and the
    # instructor still exists; otherwise recompute the amount off the snapshot.
    if ("hours" in data or "language" in data):
        instructor = None
        if log.instructor_id is not None:
            instructor = (
                await db_session.execute(
                    select(Instructor).where(Instructor.id == log.instructor_id)
                )
            ).scalars().first()
        if instructor is not None:
            rate, _source, currency = await resolve_effective_rate(
                db_session, instructor, log.language
            )
            log.rate_applied = rate
            log.currency = currency
        log.amount = _round_money(log.hours * log.rate_applied)

    log.update_date = str(datetime.now())
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    return await _worklog_to_read(db_session, log)


async def delete_worklog(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    worklog_uuid: str,
) -> str:
    log = await _get_worklog_or_404(db_session, worklog_uuid)
    await authorize_instructor_management(db_session, current_user, log.org_id, "delete")
    await db_session.delete(log)
    await db_session.commit()
    return "Work log deleted"


async def org_finance_summary(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
) -> OrgFinanceSummaryRead:
    """Aggregate total hours/amount for the org and per instructor."""
    await authorize_instructor_management(db_session, current_user, org_id, "read")

    logs = (
        await db_session.execute(
            select(InstructorWorkLog).where(InstructorWorkLog.org_id == org_id)
        )
    ).scalars().all()

    per_instructor: dict[Optional[int], InstructorFinanceSummaryRead] = {}
    total_hours = 0.0
    total_amount = 0.0
    for log in logs:
        total_hours += log.hours
        total_amount += log.amount
        bucket = per_instructor.get(log.instructor_id)
        if bucket is None:
            uuid_, name = await _instructor_display(db_session, log.instructor_id)
            bucket = InstructorFinanceSummaryRead(
                instructor_id=log.instructor_id,
                instructor_uuid=uuid_,
                instructor_name=name,
                currency=log.currency,
            )
            per_instructor[log.instructor_id] = bucket
        bucket.total_hours += log.hours
        bucket.total_amount = _round_money(bucket.total_amount + log.amount)
        bucket.entry_count += 1

    return OrgFinanceSummaryRead(
        org_id=org_id,
        total_hours=_round_money(total_hours),
        total_amount=_round_money(total_amount),
        entry_count=len(logs),
        per_instructor=list(per_instructor.values()),
    )
