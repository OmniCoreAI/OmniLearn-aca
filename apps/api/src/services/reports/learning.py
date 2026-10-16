"""Learning & completion report: enrollments, completions, active learners,
lessons completed and certificates — per month and per course.

A course counts as completed when every lesson in it has a completion step
(the same rule as ``is_course_fully_completed``); its completion date is the
date of the last of those steps.
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.reports.common import ReportRange, authorize_reports, month_of, org_or_404, pct, resolve_range, to_day


class LearningTotals(BaseModel):
    enrollments: int = 0
    completions: int = 0
    active_learners: int = 0
    lessons_completed: int = 0
    certificates: int = 0


class LearningMonth(BaseModel):
    month: str
    enrollments: int = 0
    completions: int = 0
    active_learners: int = 0
    lessons_completed: int = 0


class CourseLearningRow(BaseModel):
    course_uuid: str
    course_name: str
    published: bool
    lessons: int
    enrolled: int
    new_enrollments: int
    active_learners: int
    completed: int
    completion_rate: float
    avg_progress: float


class LearningReport(BaseModel):
    range: ReportRange
    totals: LearningTotals
    previous: LearningTotals
    overall_completion_rate: float
    total_enrolled: int
    monthly: list[LearningMonth]
    courses: list[CourseLearningRow]


async def learning_report(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> LearningReport:
    await authorize_reports(db_session, current_user, org_id)
    await org_or_404(db_session, org_id)
    rng = resolve_range(date_from, date_to)
    prev = rng.prev

    courses = {c.id: c for c in (await db_session.execute(select(Course).where(Course.org_id == org_id))).scalars().all()}
    lessons = {
        row[0]: row[1]
        for row in (
            await db_session.execute(
                select(ChapterActivity.course_id, func.count(ChapterActivity.id))
                .where(ChapterActivity.org_id == org_id)
                .group_by(ChapterActivity.course_id)
            )
        ).all()
    }
    runs = (await db_session.execute(select(TrailRun).where(TrailRun.org_id == org_id))).scalars().all()

    # Per run: distinct lessons done and when the last one was done.
    done_rows = (
        await db_session.execute(
            select(TrailStep.trailrun_id, func.count(func.distinct(TrailStep.activity_id)), func.max(TrailStep.creation_date))
            .where(TrailStep.org_id == org_id, TrailStep.complete == True)  # noqa: E712
            .group_by(TrailStep.trailrun_id)
        )
    ).all()
    done = {r[0]: (r[1], r[2]) for r in done_rows}

    # Steps in the current + previous period, for activity counts.
    steps = (
        await db_session.execute(
            select(TrailStep.user_id, TrailStep.course_id, TrailStep.creation_date).where(
                TrailStep.org_id == org_id,
                TrailStep.complete == True,  # noqa: E712
                TrailStep.creation_date >= prev.start.isoformat(),
                TrailStep.creation_date <= rng.end.isoformat() + "~",
            )
        )
    ).all()

    certs = (
        await db_session.execute(
            select(CertificateUser.created_at)
            .join(Certifications, Certifications.id == CertificateUser.certification_id)
            .join(Course, Course.id == Certifications.course_id)
            .where(Course.org_id == org_id)
        )
    ).all()

    def totals(period) -> LearningTotals:
        t = LearningTotals()
        active: set[int] = set()
        for run in runs:
            if period.contains(to_day(run.creation_date)):
                t.enrollments += 1
            total = lessons.get(run.course_id, 0)
            count, last = done.get(run.id, (0, None))
            if total and count >= total and period.contains(to_day(last)):
                t.completions += 1
        for user_id, _course_id, stamp in steps:
            if period.contains(to_day(stamp)):
                t.lessons_completed += 1
                active.add(user_id)
        t.active_learners = len(active)
        t.certificates = sum(1 for (stamp,) in certs if period.contains(to_day(stamp)))
        return t

    # ---- monthly
    monthly = {m: LearningMonth(month=m) for m in rng.months()}
    month_active: dict[str, set[int]] = {m: set() for m in monthly}
    for run in runs:
        d = to_day(run.creation_date)
        if rng.contains(d):
            monthly[month_of(d)].enrollments += 1  # type: ignore[index]
        total = lessons.get(run.course_id, 0)
        count, last = done.get(run.id, (0, None))
        ld = to_day(last)
        if total and count >= total and rng.contains(ld):
            monthly[month_of(ld)].completions += 1  # type: ignore[index]
    for user_id, _course_id, stamp in steps:
        d = to_day(stamp)
        if rng.contains(d):
            monthly[month_of(d)].lessons_completed += 1  # type: ignore[index]
            month_active[month_of(d)].add(user_id)  # type: ignore[index]
    for m, row in monthly.items():
        row.active_learners = len(month_active[m])

    # ---- per course
    per: dict[int, dict] = {}
    for run in runs:
        b = per.setdefault(run.course_id, {"enrolled": 0, "new": 0, "completed": 0, "progress": [], "active": set()})
        b["enrolled"] += 1
        if rng.contains(to_day(run.creation_date)):
            b["new"] += 1
        total = lessons.get(run.course_id, 0)
        count, _last = done.get(run.id, (0, None))
        b["progress"].append(min(100.0, count * 100 / total) if total else 0.0)
        if total and count >= total:
            b["completed"] += 1
    for user_id, course_id, stamp in steps:
        if rng.contains(to_day(stamp)) and course_id in per:
            per[course_id]["active"].add(user_id)

    rows = []
    for course_id, b in per.items():
        course = courses.get(course_id)
        if not course:
            continue
        rows.append(
            CourseLearningRow(
                course_uuid=course.course_uuid,
                course_name=course.name,
                published=bool(course.published),
                lessons=lessons.get(course_id, 0),
                enrolled=b["enrolled"],
                new_enrollments=b["new"],
                active_learners=len(b["active"]),
                completed=b["completed"],
                completion_rate=pct(b["completed"], b["enrolled"]),
                avg_progress=round(sum(b["progress"]) / len(b["progress"]), 1) if b["progress"] else 0.0,
            )
        )
    rows.sort(key=lambda r: (r.enrolled, r.completed), reverse=True)

    total_completed = sum(r.completed for r in rows)
    return LearningReport(
        range=rng.to_read(),
        totals=totals(rng),
        previous=totals(prev),
        overall_completion_rate=pct(total_completed, len(runs)),
        total_enrolled=len(runs),
        monthly=list(monthly.values()),
        courses=rows,
    )
