"""Session and assignment reminders (``training_reminder`` / ``exam_reminder``).

``scan_reminders`` runs every 10 minutes (see ``core/events/events.py``); a
Redis ``SET NX`` lock keeps it to one worker. For each upcoming session or
due assignment it sends, per org settings, the tightest reminder offset that
has been reached. ``NotificationLog.dedupe_key`` makes every reminder go out
once per person, even across restarts.
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, OfferingSession
from src.db.courses.assignments import Assignment, AssignmentUserSubmission
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun
from src.db.usergroup_user import UserGroupUser
from src.services.administration.facilities import session_window
from src.services.notifications.dispatcher import notify
from src.services.notifications.events import course_variables
from src.services.notifications.settings import NotificationSettings, load_notification_settings

logger = logging.getLogger(__name__)

SCAN_INTERVAL_SECONDS = 600
LOCK_KEY = "omnilearn:notifications:reminders:lock"
HORIZON = timedelta(days=31)


def _due_offset(begin: datetime, now: datetime, offsets: List[int]) -> Optional[int]:
    """The smallest configured offset (hours) already reached before ``begin``."""
    if begin <= now:
        return None
    remaining_hours = (begin - now).total_seconds() / 3600
    reached = [h for h in offsets if remaining_hours <= h]
    return min(reached) if reached else None


async def _enrolled(db_session: AsyncSession, course_id: int) -> List[int]:
    return list(
        dict.fromkeys(
            (await db_session.execute(select(TrailRun.user_id).where(TrailRun.course_id == course_id))).scalars().all()
        )
    )


async def _settings(db_session: AsyncSession, cache: Dict[int, NotificationSettings], org_id: int) -> NotificationSettings:
    if org_id not in cache:
        cache[org_id] = await load_notification_settings(db_session, org_id)
    return cache[org_id]


def _fmt(begin: datetime, raw: Optional[str]) -> Tuple[str, str]:
    date_only = raw is not None and len(str(raw).strip()) <= 10
    return begin.strftime("%Y-%m-%d"), "" if date_only else begin.strftime("%H:%M")


async def scan_reminders(db_session: AsyncSession, now: Optional[datetime] = None) -> int:
    now = now or datetime.now()
    low, high = now.strftime("%Y-%m-%d"), (now + HORIZON).strftime("%Y-%m-%dT23:59")
    cache: Dict[int, NotificationSettings] = {}
    sent = 0

    # Course schedule sessions → everyone enrolled in the course.
    rows = (
        await db_session.execute(
            select(CourseScheduleSession, Course)
            .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
            .join(Course, Course.id == CourseAcademicProfile.course_id)  # type: ignore[arg-type]
            .where(CourseScheduleSession.start_date >= low, CourseScheduleSession.start_date <= high)  # type: ignore[operator]
        )
    ).all()
    for session, course in rows:
        settings = await _settings(db_session, cache, course.org_id)
        window = session_window(session.start_date, session.end_date)
        offset = _due_offset(window[0], now, settings.session_reminder_hours) if window and settings.reminders_enabled else None
        if offset is None:
            continue
        date, time = _fmt(window[0], session.start_date)
        sent += await notify(
            db_session, course.org_id, "training_reminder", await _enrolled(db_session, course.id),
            {**(await course_variables(db_session, course)), "session_title": session.title, "session_date": date,
             "session_time": time, "location": session.location or ""},
            resource=("course", course.course_uuid), dedupe_prefix=f"training_reminder:{session.session_uuid}:{offset}h",
        )

    # Offering sessions → the offering's roster group.
    rows = (
        await db_session.execute(
            select(OfferingSession, CourseOffering)
            .join(CourseOffering, CourseOffering.id == OfferingSession.offering_id)  # type: ignore[arg-type]
            .where(OfferingSession.start_datetime >= low, OfferingSession.start_datetime <= high)  # type: ignore[operator]
        )
    ).all()
    for session, offering in rows:
        settings = await _settings(db_session, cache, offering.org_id)
        window = session_window(session.start_datetime, session.end_datetime)
        offset = _due_offset(window[0], now, settings.session_reminder_hours) if window and settings.reminders_enabled else None
        if offset is None or not offering.usergroup_id:
            continue
        users = list(
            dict.fromkeys(
                (await db_session.execute(select(UserGroupUser.user_id).where(UserGroupUser.usergroup_id == offering.usergroup_id))).scalars().all()
            )
        )
        course = await db_session.get(Course, offering.content_course_id) if offering.content_course_id else None
        variables = await course_variables(db_session, course) if course else {"course_name": getattr(offering, "title", None) or "", "course_url": ""}
        date, time = _fmt(window[0], session.start_datetime)
        sent += await notify(
            db_session, offering.org_id, "training_reminder", users,
            {**variables, "session_title": session.title or session.session_type or "", "session_date": date,
             "session_time": time, "location": session.location or ""},
            resource=("course", course.course_uuid) if course else None,
            dedupe_prefix=f"training_reminder:{session.session_uuid}:{offset}h",
        )

    # Published assignments → enrolled learners who have not submitted yet.
    rows = (
        await db_session.execute(
            select(Assignment, Course)
            .join(Course, Course.id == Assignment.course_id)  # type: ignore[arg-type]
            .where(Assignment.published == True, Assignment.due_date >= low, Assignment.due_date <= high)  # type: ignore[operator]  # noqa: E712
        )
    ).all()
    for assignment, course in rows:
        settings = await _settings(db_session, cache, course.org_id)
        window = session_window(assignment.due_date, None)
        offset = _due_offset(window[0], now, settings.exam_reminder_hours) if window and settings.reminders_enabled else None
        if offset is None:
            continue
        submitted = set(
            (await db_session.execute(select(AssignmentUserSubmission.user_id).where(AssignmentUserSubmission.assignment_id == assignment.id))).scalars().all()
        )
        users = [u for u in await _enrolled(db_session, course.id) if u not in submitted]
        sent += await notify(
            db_session, course.org_id, "exam_reminder", users,
            {**(await course_variables(db_session, course)), "exam_name": assignment.title, "due_date": window[0].strftime("%Y-%m-%d %H:%M")},
            resource=("course", course.course_uuid), dedupe_prefix=f"exam_reminder:{assignment.assignment_uuid}:{offset}h",
        )
    return sent


def _acquire_lock() -> bool:
    try:
        import redis

        from config.config import get_omnilearn_config

        url = get_omnilearn_config().redis_config.redis_connection_string
        if not url:
            return True
        client = redis.from_url(url, socket_connect_timeout=3, socket_timeout=3)
        return bool(client.set(LOCK_KEY, "1", nx=True, ex=SCAN_INTERVAL_SECONDS - 30))
    except Exception:
        logger.warning("Reminder lock unavailable; running the scan in this worker")
        return True


async def reminder_loop() -> None:
    from src.core.events.database import _async_session_factory

    while True:
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)
        if os.environ.get("TESTING") == "true" or not await asyncio.to_thread(_acquire_lock):
            continue
        try:
            async with _async_session_factory() as db_session:
                count = await scan_reminders(db_session)
            if count:
                logger.info("Queued %s reminder(s)", count)
        except Exception:
            logger.exception("Reminder scan failed")
