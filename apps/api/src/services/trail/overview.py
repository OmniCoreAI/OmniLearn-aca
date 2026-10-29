"""The signed-in learner's own dashboard: where they stopped, how far they are,
how regularly they learn and what they recently did.

Everything here is scoped to one user inside one organization — never
academy-wide numbers. Learning time is *estimated* from completed lessons
(the LMS does not record time on page), so the response flags it as such.
"""

from datetime import date, datetime, timedelta
from typing import Literal, Optional

from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.offerings import CourseOffering
from src.db.courses.activities import Activity, ActivityTypeEnum
from src.db.courses.assignments import (
    Assignment,
    AssignmentUserSubmission,
    AssignmentUserSubmissionStatus,
    GradingTypeEnum,
)
from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.course_updates import CourseUpdate
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail

# Rough minutes a learner spends on one lesson of each kind.
EST_MINUTES: dict[str, int] = {
    ActivityTypeEnum.TYPE_VIDEO.value: 12,
    ActivityTypeEnum.TYPE_DOCUMENT.value: 10,
    ActivityTypeEnum.TYPE_DYNAMIC.value: 8,
    ActivityTypeEnum.TYPE_ASSIGNMENT.value: 20,
    ActivityTypeEnum.TYPE_SCORM.value: 15,
    ActivityTypeEnum.TYPE_CUSTOM.value: 10,
}
DEFAULT_MINUTES = 10
HISTORY_DAYS = 90
RECENT_LIMIT = 12


class OverviewNextLesson(BaseModel):
    activity_uuid: str
    name: str
    activity_type: str
    chapter_name: Optional[str] = None
    est_minutes: int


class OverviewCourse(BaseModel):
    course_uuid: str
    name: str
    thumbnail_image: Optional[str] = None
    code: Optional[str] = None
    total_lessons: int
    completed_lessons: int
    progress: int
    completed: bool
    started_at: Optional[str] = None
    last_activity_at: Optional[str] = None
    next_lesson: Optional[OverviewNextLesson] = None


class OverviewDay(BaseModel):
    date: str
    lessons: int
    minutes: int


class OverviewEvent(BaseModel):
    kind: Literal[
        "lesson_completed",
        "course_started",
        "certificate",
        "assessment_graded",
        "assessment_submitted",
        "course_update",
    ]
    title: str
    course_uuid: Optional[str] = None
    course_name: Optional[str] = None
    activity_uuid: Optional[str] = None
    ref: Optional[str] = None
    grade: Optional[int] = None
    at: str


class OverviewAssessment(BaseModel):
    assignment_uuid: str
    title: str
    course_uuid: str
    course_name: str
    activity_uuid: Optional[str] = None
    due_date: Optional[str] = None
    status: str
    grade: Optional[int] = None
    grading_type: str
    attempt_number: int = 0
    updated_at: Optional[str] = None


class OverviewTotals(BaseModel):
    courses: int
    in_progress: int
    completed_courses: int
    lessons_completed: int
    lessons_total: int
    learning_minutes: int
    minutes_estimated: bool = True
    streak_days: int
    best_streak_days: int
    active_days_30: int
    certificates: int
    assessments_total: int
    assessments_completed: int
    average_score: Optional[int] = None
    lessons_this_week: int
    lessons_last_week: int
    minutes_this_week: int
    minutes_last_week: int


class LearnerOverview(BaseModel):
    today: str
    totals: OverviewTotals
    courses: list[OverviewCourse]
    days: list[OverviewDay]
    recent: list[OverviewEvent]
    assessments: list[OverviewAssessment]


def _parse(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        try:
            return datetime.fromisoformat(value[:19])
        except ValueError:
            return None


def _kind(activity: Activity) -> str:
    return str(getattr(activity.activity_type, "value", activity.activity_type))


def _minutes(activity: Optional[Activity]) -> int:
    return EST_MINUTES.get(_kind(activity), DEFAULT_MINUTES) if activity else DEFAULT_MINUTES


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat(timespec="seconds") if value else None


def _streaks(active: set[date], today: date) -> tuple[int, int]:
    """Current streak (ending today, or yesterday if nothing yet today) and the best one."""
    current = 0
    day = today if today in active else today - timedelta(days=1)
    while day in active:
        current += 1
        day -= timedelta(days=1)
    best = run = 0
    previous: Optional[date] = None
    for d in sorted(active):
        run = run + 1 if previous and d - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = d
    return current, best


def _empty(today: date) -> LearnerOverview:
    return LearnerOverview(
        today=today.isoformat(),
        totals=OverviewTotals(
            courses=0, in_progress=0, completed_courses=0, lessons_completed=0, lessons_total=0,
            learning_minutes=0, streak_days=0, best_streak_days=0, active_days_30=0, certificates=0,
            assessments_total=0, assessments_completed=0, lessons_this_week=0, lessons_last_week=0,
            minutes_this_week=0, minutes_last_week=0,
        ),
        courses=[],
        days=[
            OverviewDay(date=(today - timedelta(days=i)).isoformat(), lessons=0, minutes=0)
            for i in range(HISTORY_DAYS - 1, -1, -1)
        ],
        recent=[],
        assessments=[],
    )


async def get_learner_overview(
    user_id: int, org_id: int, db_session: AsyncSession, now: Optional[datetime] = None
) -> LearnerOverview:
    now = now or datetime.now()
    today = now.date()

    trail = (
        await db_session.execute(select(Trail).where(Trail.org_id == org_id, Trail.user_id == user_id))
    ).scalars().first()
    if not trail:
        return _empty(today)

    runs = (
        await db_session.execute(
            select(TrailRun).where(TrailRun.trail_id == trail.id, TrailRun.user_id == user_id)
        )
    ).scalars().all()
    course_ids = list({r.course_id for r in runs})
    if not course_ids:
        return _empty(today)

    courses = {
        c.id: c
        for c in (await db_session.execute(select(Course).where(Course.id.in_(course_ids)))).scalars().all()  # type: ignore[union-attr]
    }

    # Lesson order: chapters by their course order, then activities by chapter order.
    chapter_rows = (
        await db_session.execute(
            select(CourseChapter.course_id, CourseChapter.order, Chapter.id, Chapter.name)
            .join(Chapter, Chapter.id == CourseChapter.chapter_id)
            .where(CourseChapter.course_id.in_(course_ids))  # type: ignore[union-attr]
        )
    ).all()
    chapter_order = {row[2]: (row[1], row[3]) for row in chapter_rows}

    lesson_rows = (
        await db_session.execute(
            select(ChapterActivity.course_id, ChapterActivity.chapter_id, ChapterActivity.order, Activity)
            .join(Activity, Activity.id == ChapterActivity.activity_id)
            .where(ChapterActivity.course_id.in_(course_ids))  # type: ignore[union-attr]
        )
    ).all()
    activities: dict[int, Activity] = {}
    lessons_by_course: dict[int, list[tuple[tuple[int, int], Activity, Optional[str]]]] = {}
    for course_id, chapter_id, order, activity in lesson_rows:
        activities[activity.id] = activity
        ch_order, ch_name = chapter_order.get(chapter_id, (10**6, None))
        lessons_by_course.setdefault(course_id, []).append(((ch_order, order), activity, ch_name))
    for lessons in lessons_by_course.values():
        lessons.sort(key=lambda item: item[0])

    steps = (
        await db_session.execute(
            select(TrailStep).where(
                TrailStep.trailrun_id.in_([r.id for r in runs]),  # type: ignore[union-attr]
                TrailStep.user_id == user_id,
            )
        )
    ).scalars().all()
    # Steps can point at activities that left the course; look those up for names.
    missing = {s.activity_id for s in steps} - set(activities)
    if missing:
        for a in (await db_session.execute(select(Activity).where(Activity.id.in_(missing)))).scalars().all():  # type: ignore[union-attr]
            activities[a.id] = a

    done_by_course: dict[int, set[int]] = {}
    last_by_course: dict[int, datetime] = {}
    for s in steps:
        if not s.complete:
            continue
        done_by_course.setdefault(s.course_id, set()).add(s.activity_id)
        at = _parse(s.creation_date)
        if at and (s.course_id not in last_by_course or at > last_by_course[s.course_id]):
            last_by_course[s.course_id] = at

    offering_codes = {
        row[0]: row[1]
        for row in (
            await db_session.execute(
                select(CourseOffering.content_course_id, CourseOffering.code).where(
                    CourseOffering.content_course_id.in_(course_ids)  # type: ignore[union-attr]
                )
            )
        ).all()
        if row[1]
    }

    # ---- courses
    overview_courses: list[OverviewCourse] = []
    lessons_total = 0
    for run in runs:
        course = courses.get(run.course_id)
        if not course:
            continue
        lessons = lessons_by_course.get(course.id, [])
        lesson_ids = {a.id for _, a, _ in lessons}
        done = done_by_course.get(course.id, set()) & lesson_ids
        total = len(lessons)
        lessons_total += total
        progress = min(100, round(len(done) * 100 / total)) if total else 0
        next_lesson = None
        if total and len(done) < total:
            for _, activity, chapter_name in lessons:
                if activity.id not in done and activity.published:
                    next_lesson = OverviewNextLesson(
                        activity_uuid=activity.activity_uuid,
                        name=activity.name,
                        activity_type=_kind(activity),
                        chapter_name=chapter_name,
                        est_minutes=_minutes(activity),
                    )
                    break
        overview_courses.append(
            OverviewCourse(
                course_uuid=course.course_uuid,
                name=course.name,
                thumbnail_image=course.thumbnail_image or None,
                code=offering_codes.get(course.id),
                total_lessons=total,
                completed_lessons=len(done),
                progress=progress,
                completed=total > 0 and len(done) >= total,
                started_at=_iso(_parse(run.creation_date)),
                last_activity_at=_iso(last_by_course.get(course.id)),
                next_lesson=next_lesson,
            )
        )

    epoch = datetime(1970, 1, 1)
    overview_courses.sort(
        key=lambda c: (
            c.completed,
            -(_parse(c.last_activity_at) or _parse(c.started_at) or epoch).timestamp(),
        )
    )

    # ---- daily activity (lessons and estimated minutes per day)
    per_day_lessons: dict[date, int] = {}
    per_day_minutes: dict[date, int] = {}
    learning_minutes = 0
    completed_steps: list[tuple[datetime, TrailStep]] = []
    for s in steps:
        if not s.complete:
            continue
        minutes = _minutes(activities.get(s.activity_id))
        learning_minutes += minutes
        at = _parse(s.creation_date)
        if not at:
            continue
        completed_steps.append((at, s))
        per_day_lessons[at.date()] = per_day_lessons.get(at.date(), 0) + 1
        per_day_minutes[at.date()] = per_day_minutes.get(at.date(), 0) + minutes

    days = [
        OverviewDay(
            date=(d := today - timedelta(days=i)).isoformat(),
            lessons=per_day_lessons.get(d, 0),
            minutes=per_day_minutes.get(d, 0),
        )
        for i in range(HISTORY_DAYS - 1, -1, -1)
    ]

    def window(values: dict[date, int], start: int, end: int) -> int:
        return sum(values.get(today - timedelta(days=i), 0) for i in range(start, end))

    streak, best_streak = _streaks(set(per_day_lessons), today)

    # ---- assessments in the learner's courses
    assignments = (
        await db_session.execute(
            select(Assignment).where(
                Assignment.course_id.in_(course_ids),  # type: ignore[union-attr]
                Assignment.published == True,  # noqa: E712
            )
        )
    ).scalars().all()
    submissions = {
        sub.assignment_id: sub
        for sub in (
            await db_session.execute(
                select(AssignmentUserSubmission).where(
                    AssignmentUserSubmission.user_id == user_id,
                    AssignmentUserSubmission.assignment_id.in_([a.id for a in assignments]),  # type: ignore[union-attr]
                )
            )
        ).scalars().all()
    } if assignments else {}

    overview_assessments: list[OverviewAssessment] = []
    scores: list[int] = []
    for a in assignments:
        course = courses.get(a.course_id)
        if not course:
            continue
        sub = submissions.get(a.id)
        status = sub.submission_status.value if sub else AssignmentUserSubmissionStatus.PENDING.value
        grading_type = getattr(a.grading_type, "value", a.grading_type)
        graded = sub is not None and sub.submission_status == AssignmentUserSubmissionStatus.GRADED
        if graded and grading_type in (GradingTypeEnum.PERCENTAGE.value, GradingTypeEnum.NUMERIC.value):
            scores.append(sub.grade)  # type: ignore[union-attr]
        activity = activities.get(a.activity_id)
        overview_assessments.append(
            OverviewAssessment(
                assignment_uuid=a.assignment_uuid,
                title=a.title,
                course_uuid=course.course_uuid,
                course_name=course.name,
                activity_uuid=activity.activity_uuid if activity else None,
                due_date=a.due_date or None,
                status=status,
                grade=sub.grade if graded else None,  # type: ignore[union-attr]
                grading_type=str(grading_type),
                attempt_number=sub.attempt_number if sub else 0,
                updated_at=_iso(_parse(sub.update_date)) if sub else None,
            )
        )
    open_first = {"PENDING": 0, "NOT_SUBMITTED": 0, "LATE": 1, "SUBMITTED": 2, "GRADED": 3}
    overview_assessments.sort(key=lambda x: (open_first.get(x.status, 0), x.due_date or "9999"))
    assessments_completed = sum(1 for x in overview_assessments if x.status in ("SUBMITTED", "GRADED"))

    # ---- certificates earned in this org's courses
    certificate_rows = (
        await db_session.execute(
            select(CertificateUser, Certifications.course_id)
            .join(Certifications, Certifications.id == CertificateUser.certification_id)
            .join(Course, Course.id == Certifications.course_id)
            .where(CertificateUser.user_id == user_id, Course.org_id == org_id)
        )
    ).all()

    # ---- recent activity: lessons, starts, certificates, assessments, course news
    recent: list[OverviewEvent] = []
    for at, s in sorted(completed_steps, key=lambda item: item[0], reverse=True)[:RECENT_LIMIT]:
        activity = activities.get(s.activity_id)
        course = courses.get(s.course_id)
        if not activity:
            continue
        recent.append(
            OverviewEvent(
                kind="lesson_completed", title=activity.name, activity_uuid=activity.activity_uuid,
                course_uuid=course.course_uuid if course else None, course_name=course.name if course else None,
                at=_iso(at) or "",
            )
        )
    for run in runs:
        course = courses.get(run.course_id)
        started = _parse(run.creation_date)
        if course and started:
            recent.append(
                OverviewEvent(kind="course_started", title=course.name, course_uuid=course.course_uuid,
                              course_name=course.name, at=_iso(started) or "")
            )
    for cert_user, course_id in certificate_rows:
        course = courses.get(course_id)
        earned = _parse(cert_user.created_at)
        if earned:
            recent.append(
                OverviewEvent(
                    kind="certificate", title=course.name if course else "", ref=cert_user.user_certification_uuid,
                    course_uuid=course.course_uuid if course else None, course_name=course.name if course else None,
                    at=_iso(earned) or "",
                )
            )
    for x in overview_assessments:
        if x.status in ("GRADED", "SUBMITTED") and x.updated_at:
            recent.append(
                OverviewEvent(
                    kind="assessment_graded" if x.status == "GRADED" else "assessment_submitted",
                    title=x.title, course_uuid=x.course_uuid, course_name=x.course_name,
                    activity_uuid=x.activity_uuid, grade=x.grade, at=x.updated_at,
                )
            )
    first_seen = {r.course_id: _parse(r.creation_date) for r in runs}
    updates = (
        await db_session.execute(
            select(CourseUpdate).where(CourseUpdate.course_id.in_(course_ids))  # type: ignore[union-attr]
        )
    ).scalars().all()
    for u in updates:
        posted = _parse(u.creation_date)
        course = courses.get(u.course_id)
        since = first_seen.get(u.course_id)
        if posted and course and (since is None or posted >= since):
            recent.append(
                OverviewEvent(kind="course_update", title=u.title, course_uuid=course.course_uuid,
                              course_name=course.name, at=_iso(posted) or "")
            )
    recent.sort(key=lambda e: e.at, reverse=True)

    completed_courses = sum(1 for c in overview_courses if c.completed)
    return LearnerOverview(
        today=today.isoformat(),
        totals=OverviewTotals(
            courses=len(overview_courses),
            in_progress=len(overview_courses) - completed_courses,
            completed_courses=completed_courses,
            lessons_completed=sum(c.completed_lessons for c in overview_courses),
            lessons_total=lessons_total,
            learning_minutes=learning_minutes,
            streak_days=streak,
            best_streak_days=best_streak,
            active_days_30=sum(1 for d in per_day_lessons if (today - d).days < 30),
            certificates=len(certificate_rows),
            assessments_total=len(overview_assessments),
            assessments_completed=assessments_completed,
            average_score=round(sum(scores) / len(scores)) if scores else None,
            lessons_this_week=window(per_day_lessons, 0, 7),
            lessons_last_week=window(per_day_lessons, 7, 14),
            minutes_this_week=window(per_day_minutes, 0, 7),
            minutes_last_week=window(per_day_minutes, 7, 14),
        ),
        courses=overview_courses,
        days=days,
        recent=recent[:RECENT_LIMIT],
        assessments=overview_assessments,
    )
