"""Admissions report: postgraduate applications by status, program and intake,
decision outcomes and speed, interviews and documents waiting for review.

An application belongs to the period it was submitted in (drafts, which have
no submission date, are counted separately).
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.admissions import (
    AdmissionApplication,
    AdmissionInterview,
    ApplicationDocument,
    ApplicationStatus,
    DocumentStatus,
)
from src.db.academic.cohorts import Cohort
from src.db.academic.programs import Program
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.reports.common import ReportRange, authorize_reports, month_of, org_or_404, pct, resolve_range, to_day

ACCEPTED = {ApplicationStatus.ACCEPTED.value, ApplicationStatus.ENROLLED.value}
DECIDED = ACCEPTED | {ApplicationStatus.REJECTED.value, ApplicationStatus.WAITLISTED.value}


class AdmissionsTotals(BaseModel):
    submitted: int = 0
    accepted: int = 0
    rejected: int = 0
    enrolled: int = 0
    pending: int = 0
    withdrawn: int = 0
    acceptance_rate: float = 0
    avg_days_to_decision: Optional[float] = None


class AdmissionsMonth(BaseModel):
    month: str
    submitted: int = 0
    decided: int = 0
    accepted: int = 0


class StatusRow(BaseModel):
    status: str
    count: int
    share_pct: float


class ProgramRow(BaseModel):
    key: str
    name: str
    submitted: int
    accepted: int
    rejected: int
    enrolled: int
    pending: int
    acceptance_rate: float


class InterviewSummary(BaseModel):
    scheduled: int = 0
    completed: int = 0
    no_show: int = 0
    cancelled: int = 0
    avg_score: Optional[float] = None


class AdmissionsReport(BaseModel):
    range: ReportRange
    totals: AdmissionsTotals
    previous: AdmissionsTotals
    drafts: int
    documents_pending: int
    monthly: list[AdmissionsMonth]
    by_status: list[StatusRow]
    by_program: list[ProgramRow]
    by_intake: list[ProgramRow]
    interviews: InterviewSummary


def _status(app: AdmissionApplication) -> str:
    return str(getattr(app.status, "value", app.status))


def _totals(apps: list[AdmissionApplication]) -> AdmissionsTotals:
    t = AdmissionsTotals(submitted=len(apps))
    days: list[float] = []
    for a in apps:
        s = _status(a)
        if s in ACCEPTED:
            t.accepted += 1
        if s == ApplicationStatus.ENROLLED.value:
            t.enrolled += 1
        if s == ApplicationStatus.REJECTED.value:
            t.rejected += 1
        if s == ApplicationStatus.WITHDRAWN.value:
            t.withdrawn += 1
        if s in (ApplicationStatus.SUBMITTED.value, ApplicationStatus.UNDER_REVIEW.value):
            t.pending += 1
        sub, dec = to_day(a.submitted_at), to_day(a.decided_at)
        if s in DECIDED and sub and dec and dec >= sub:
            days.append((dec - sub).days)
    decided = sum(1 for a in apps if _status(a) in DECIDED)
    t.acceptance_rate = pct(t.accepted, decided)
    t.avg_days_to_decision = round(sum(days) / len(days), 1) if days else None
    return t


def _group(apps: list[AdmissionApplication], key, names: dict) -> list[ProgramRow]:
    groups: dict = {}
    for a in apps:
        groups.setdefault(key(a), []).append(a)
    rows = []
    for k, items in groups.items():
        t = _totals(items)
        rows.append(
            ProgramRow(
                key=str(k), name=names.get(k, "—"), submitted=t.submitted, accepted=t.accepted,
                rejected=t.rejected, enrolled=t.enrolled, pending=t.pending, acceptance_rate=t.acceptance_rate,
            )
        )
    return sorted(rows, key=lambda r: r.submitted, reverse=True)


async def admissions_report(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> AdmissionsReport:
    await authorize_reports(db_session, current_user, org_id)
    await org_or_404(db_session, org_id)
    rng = resolve_range(date_from, date_to)

    apps = (await db_session.execute(select(AdmissionApplication).where(AdmissionApplication.org_id == org_id))).scalars().all()
    drafts = sum(1 for a in apps if _status(a) == ApplicationStatus.DRAFT.value)
    submitted = [a for a in apps if a.submitted_at]
    current = [a for a in submitted if rng.contains(to_day(a.submitted_at))]
    previous = [a for a in submitted if rng.prev.contains(to_day(a.submitted_at))]

    monthly = {m: AdmissionsMonth(month=m) for m in rng.months()}
    for a in submitted:
        sd = to_day(a.submitted_at)
        if rng.contains(sd):
            monthly[month_of(sd)].submitted += 1  # type: ignore[index]
        dd = to_day(a.decided_at)
        if _status(a) in DECIDED and rng.contains(dd):
            monthly[month_of(dd)].decided += 1  # type: ignore[index]
            if _status(a) in ACCEPTED:
                monthly[month_of(dd)].accepted += 1  # type: ignore[index]

    counts: dict[str, int] = {}
    for a in current:
        counts[_status(a)] = counts.get(_status(a), 0) + 1
    by_status = sorted(
        (StatusRow(status=s, count=n, share_pct=pct(n, len(current))) for s, n in counts.items()),
        key=lambda r: r.count,
        reverse=True,
    )

    program_ids = {a.program_id for a in current}
    cohort_ids = {a.cohort_id for a in current}
    programs = {
        p.id: p.name
        for p in (await db_session.execute(select(Program).where(Program.id.in_(program_ids)))).scalars().all()  # type: ignore[union-attr]
    } if program_ids else {}
    cohorts = {
        c.id: c.name
        for c in (await db_session.execute(select(Cohort).where(Cohort.id.in_(cohort_ids)))).scalars().all()  # type: ignore[union-attr]
    } if cohort_ids else {}

    interviews = (
        await db_session.execute(select(AdmissionInterview).where(AdmissionInterview.org_id == org_id))
    ).scalars().all()
    iv = InterviewSummary()
    scores: list[float] = []
    for i in interviews:
        if not rng.contains(to_day(i.scheduled_at)):
            continue
        s = str(getattr(i.status, "value", i.status))
        if hasattr(iv, s):
            setattr(iv, s, getattr(iv, s) + 1)
        if i.score is not None:
            scores.append(float(i.score))
    iv.avg_score = round(sum(scores) / len(scores), 1) if scores else None

    documents_pending = len(
        (
            await db_session.execute(
                select(ApplicationDocument.id).where(
                    ApplicationDocument.org_id == org_id,
                    ApplicationDocument.status == DocumentStatus.PENDING,
                )
            )
        ).all()
    )

    return AdmissionsReport(
        range=rng.to_read(),
        totals=_totals(current),
        previous=_totals(previous),
        drafts=drafts,
        documents_pending=documents_pending,
        monthly=list(monthly.values()),
        by_status=by_status,
        by_program=_group(current, lambda a: a.program_id, programs),
        by_intake=_group(current, lambda a: a.cohort_id, cohorts),
        interviews=iv,
    )
