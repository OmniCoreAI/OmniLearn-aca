"""
PostgreSQL-backed overview for the admin dashboard home.

Unlike the Tinybird pipes, everything here comes from the primary database,
so the dashboard renders real numbers even when the analytics backend is not
configured. Timestamps in these tables are stored as ISO-ish strings
(``str(datetime.now())``), which sort lexicographically — range filters
compare strings and month buckets use ``substr(date, 1, 7)``.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import case, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from src.db.trail_runs import StatusEnum, TrailRun
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.users import User

TOP_COURSES_LIMIT = 5
RECENT_COURSES_LIMIT = 3
RECENT_ACTIVITY_LIMIT = 8
LEARNER_PREVIEW_LIMIT = 3
HEATMAP_DAYS = 30


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=None)


def _month_keys(months: int, now: datetime) -> list[str]:
    """Return the last ``months`` month keys (``YYYY-MM``), oldest first."""
    keys: list[str] = []
    year, month = now.year, now.month
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(keys))


def _user_payload(user: Optional[User]) -> Optional[dict[str, Any]]:
    if user is None:
        return None
    return {
        "user_uuid": user.user_uuid,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "avatar_image": user.avatar_image,
    }


async def get_home_overview(
    org_id: int,
    db_session: AsyncSession,
    months: int = 7,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    now = now or datetime.now()
    months = max(1, min(months, 12))
    month_keys = _month_keys(months, now)
    since_30d = str(now - timedelta(days=30))

    # --- Totals -----------------------------------------------------------
    members = (
        await db_session.execute(
            select(func.count()).select_from(UserOrganization).where(UserOrganization.org_id == org_id)
        )
    ).scalar_one()
    members_30d = (
        await db_session.execute(
            select(func.count())
            .select_from(UserOrganization)
            .where(UserOrganization.org_id == org_id, UserOrganization.creation_date >= since_30d)
        )
    ).scalar_one()

    course_rows = (
        await db_session.execute(
            select(
                Course.id,
                Course.course_uuid,
                Course.name,
                Course.thumbnail_image,
                Course.published,
                Course.creation_date,
            ).where(Course.org_id == org_id)
        )
    ).all()
    courses_by_id = {row.id: row for row in course_rows}
    courses_30d = sum(1 for row in course_rows if (row.creation_date or "") >= since_30d)

    run_filter = (TrailRun.org_id == org_id, TrailRun.course_id.in_(list(courses_by_id) or [-1]))  # type: ignore
    enrollments = (
        await db_session.execute(select(func.count()).select_from(TrailRun).where(*run_filter))
    ).scalar_one()
    enrollments_30d = (
        await db_session.execute(
            select(func.count())
            .select_from(TrailRun)
            .where(*run_filter, TrailRun.creation_date >= since_30d)
        )
    ).scalar_one()
    completions = (
        await db_session.execute(
            select(func.count())
            .select_from(TrailRun)
            .where(*run_filter, TrailRun.status == StatusEnum.STATUS_COMPLETED)
        )
    ).scalar_one()
    students = (
        await db_session.execute(
            select(func.count(func.distinct(TrailRun.user_id))).where(*run_filter)
        )
    ).scalar_one()

    # --- Monthly enrollment trend -----------------------------------------
    enroll_month = func.substr(TrailRun.creation_date, 1, 7)
    enroll_by_month = dict(
        (
            await db_session.execute(
                select(enroll_month, func.count())
                .where(*run_filter, TrailRun.creation_date >= month_keys[0])
                .group_by(enroll_month)
            )
        ).all()
    )
    complete_month = func.substr(TrailRun.update_date, 1, 7)
    complete_by_month = dict(
        (
            await db_session.execute(
                select(complete_month, func.count())
                .where(
                    *run_filter,
                    TrailRun.status == StatusEnum.STATUS_COMPLETED,
                    TrailRun.update_date >= month_keys[0],
                )
                .group_by(complete_month)
            )
        ).all()
    )
    member_month = func.substr(UserOrganization.creation_date, 1, 7)
    members_by_month = dict(
        (
            await db_session.execute(
                select(member_month, func.count())
                .where(UserOrganization.org_id == org_id, UserOrganization.creation_date >= month_keys[0])
                .group_by(member_month)
            )
        ).all()
    )
    courses_by_month: dict[str, int] = {}
    for row in course_rows:
        key = (row.creation_date or "")[:7]
        courses_by_month[key] = courses_by_month.get(key, 0) + 1
    # Per-month series behind the stat-card sparklines as well as the chart.
    enrollment_trend = [
        {
            "month": key,
            "enrollments": int(enroll_by_month.get(key, 0)),
            "completions": int(complete_by_month.get(key, 0)),
            "members": int(members_by_month.get(key, 0)),
            "courses": courses_by_month.get(key, 0),
        }
        for key in month_keys
    ]

    # --- Learning activity heatmap (completed steps, last 30 days) --------
    step_dates = (
        await db_session.execute(
            select(TrailStep.update_date).where(
                TrailStep.org_id == org_id,
                TrailStep.update_date >= str(now - timedelta(days=HEATMAP_DAYS)),
            )
        )
    ).scalars().all()
    heat: dict[tuple[int, int], int] = {}
    for raw in step_dates:
        ts = _parse_ts(raw)
        if ts is None:
            continue
        key = (ts.weekday(), ts.hour)  # Monday = 0
        heat[key] = heat.get(key, 0) + 1
    activity_heatmap = [
        {"day": day, "hour": hour, "count": count} for (day, hour), count in sorted(heat.items())
    ]

    # --- Per-course enrollment counts --------------------------------------
    per_course = {
        course_id: (int(total), int(done or 0))
        for course_id, total, done in (
            await db_session.execute(
                select(
                    TrailRun.course_id,
                    func.count(),
                    func.sum(case((TrailRun.status == StatusEnum.STATUS_COMPLETED, 1), else_=0)),
                )
                .where(*run_filter)
                .group_by(TrailRun.course_id)
            )
        ).all()
    }

    lesson_counts = dict(
        (
            await db_session.execute(
                select(Activity.course_id, func.count())
                .where(Activity.course_id.in_(list(courses_by_id) or [-1]))  # type: ignore
                .group_by(Activity.course_id)
            )
        ).all()
    )

    def course_payload(row: Any) -> dict[str, Any]:
        total, done = per_course.get(row.id, (0, 0))
        return {
            "course_uuid": row.course_uuid,
            "name": row.name,
            "thumbnail_image": row.thumbnail_image or "",
            "published": bool(row.published),
            "creation_date": row.creation_date,
            "lessons": int(lesson_counts.get(row.id, 0)),
            "enrollments": total,
            "completions": done,
        }

    top_courses = [
        course_payload(courses_by_id[course_id])
        for course_id, _ in sorted(per_course.items(), key=lambda item: item[1][0], reverse=True)
        if course_id in courses_by_id
    ][:TOP_COURSES_LIMIT]

    recent_rows = sorted(course_rows, key=lambda row: row.creation_date or "", reverse=True)[
        :RECENT_COURSES_LIMIT
    ]
    recent_courses = [course_payload(row) for row in recent_rows]

    # --- Recent activity feed + learner previews ---------------------------
    recent_runs = (
        await db_session.execute(
            select(TrailRun.user_id, TrailRun.course_id, TrailRun.status, TrailRun.creation_date, TrailRun.update_date)
            .where(*run_filter)
            .order_by(TrailRun.update_date.desc())  # type: ignore
            .limit(RECENT_ACTIVITY_LIMIT * 2)
        )
    ).all()
    recent_members = (
        await db_session.execute(
            select(UserOrganization.user_id, UserOrganization.creation_date)
            .where(UserOrganization.org_id == org_id)
            .order_by(UserOrganization.creation_date.desc())  # type: ignore
            .limit(RECENT_ACTIVITY_LIMIT)
        )
    ).all()

    preview_course_ids = [row.id for row in recent_rows]
    preview_runs = (
        await db_session.execute(
            select(TrailRun.course_id, TrailRun.user_id)
            .where(*run_filter, TrailRun.course_id.in_(preview_course_ids or [-1]))  # type: ignore
            .order_by(TrailRun.creation_date.desc())  # type: ignore
        )
    ).all()
    learners_by_course: dict[int, list[int]] = {}
    for course_id, user_id in preview_runs:
        bucket = learners_by_course.setdefault(course_id, [])
        if len(bucket) < LEARNER_PREVIEW_LIMIT and user_id not in bucket:
            bucket.append(user_id)

    user_ids = {row.user_id for row in recent_runs} | {row.user_id for row in recent_members}
    for ids in learners_by_course.values():
        user_ids.update(ids)
    users = {
        user.id: user
        for user in (
            await db_session.execute(select(User).where(User.id.in_(list(user_ids) or [-1])))  # type: ignore
        ).scalars().all()
    }

    for payload, row in zip(recent_courses, recent_rows):
        payload["learners"] = [
            _user_payload(users.get(user_id)) for user_id in learners_by_course.get(row.id, []) if user_id in users
        ]

    def course_ref(course_id: int) -> Optional[dict[str, Any]]:
        row = courses_by_id.get(course_id)
        return {"course_uuid": row.course_uuid, "name": row.name} if row else None

    events: list[dict[str, Any]] = []
    for run in recent_runs:
        completed = run.status == StatusEnum.STATUS_COMPLETED
        events.append(
            {
                "type": "completion" if completed else "enrollment",
                "timestamp": run.update_date if completed else run.creation_date,
                "user": _user_payload(users.get(run.user_id)),
                "course": course_ref(run.course_id),
            }
        )
    for member in recent_members:
        events.append(
            {
                "type": "member_joined",
                "timestamp": member.creation_date,
                "user": _user_payload(users.get(member.user_id)),
                "course": None,
            }
        )
    for row in recent_rows:
        events.append(
            {
                "type": "course_created",
                "timestamp": row.creation_date,
                "user": None,
                "course": {"course_uuid": row.course_uuid, "name": row.name},
            }
        )
    events.sort(key=lambda event: event["timestamp"] or "", reverse=True)

    return {
        "totals": {
            "students": int(students),
            "members": int(members),
            "members_30d": int(members_30d),
            "courses": len(course_rows),
            "published_courses": sum(1 for row in course_rows if row.published),
            "courses_30d": courses_30d,
            "enrollments": int(enrollments),
            "enrollments_30d": int(enrollments_30d),
            "completions": int(completions),
        },
        "enrollment_trend": enrollment_trend,
        "activity_heatmap": activity_heatmap,
        "top_courses": top_courses,
        "recent_courses": recent_courses,
        "recent_activity": events[:RECENT_ACTIVITY_LIMIT],
    }
