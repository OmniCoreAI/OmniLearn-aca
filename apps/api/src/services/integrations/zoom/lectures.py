"""Lectures an online meeting can belong to, and who may host or join them.

A lecture is an existing schedule row: a course class session
(``CourseScheduleSession``) or a postgraduate offering session
(``OfferingSession``). Permissions reuse the LMS's own rules — nothing new:

* **Host** (create/edit/cancel/start, host signature, attendance): whoever can
  edit the course (course RBAC: admins, course authors/maintainers, which
  includes the assigned instructor) or the session's own guest instructor; for
  offerings, the offering's instructor/TA and program/org managers.
* **Join**: hosts, plus students actively enrolled — a course run (the same
  "enrolled" the calendar uses) or a registered offering enrollment. An
  offering's linked content course counts too.

API tokens never get host or join rights: Zoom host credentials are only
issued to a signed-in person.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, Enrollment, EnrollmentStatus, OfferingSession
from src.db.courses.courses import Course
from src.db.integrations.zoom import LectureRef, OnlineMeeting
from src.db.trail_runs import StatusEnum as TrailRunStatus, TrailRun
from src.db.users import PublicUser
from src.security.rbac import AccessAction, check_resource_access
from src.services.academic.offerings import require_offering_manager
from src.services.integrations.zoom import errors

COURSE_SESSION = "course_session"
OFFERING_SESSION = "offering_session"
# Students who may sit in a live class / watch its recordings.
JOIN_ENROLLMENT = (EnrollmentStatus.REGISTERED,)
RECORDING_ENROLLMENT = (EnrollmentStatus.REGISTERED, EnrollmentStatus.COMPLETED)


@dataclass
class Lecture:
    kind: str
    session: CourseScheduleSession | OfferingSession
    org_id: int
    title: str
    start: Optional[str]
    end: Optional[str]
    # The LMS course whose students attend (for offerings: the linked content course).
    course: Optional[Course] = None
    offering: Optional[CourseOffering] = None
    offering_code: Optional[str] = None
    teacher_ids: set[int] = field(default_factory=set)

    @property
    def session_uuid(self) -> str:
        return self.session.session_uuid

    def ref(self) -> LectureRef:
        return LectureRef(
            kind=self.kind,
            session_uuid=self.session_uuid,
            title=self.title,
            start=self.start,
            end=self.end,
            course_uuid=self.course.course_uuid if self.course else None,
            course_name=self.course.name if self.course else None,
            offering_uuid=self.offering.offering_uuid if self.offering else None,
            offering_code=self.offering_code,
        )

    def meeting_filter(self):
        if self.kind == COURSE_SESSION:
            return OnlineMeeting.course_session_id == self.session.id
        return OnlineMeeting.offering_session_id == self.session.id


async def _course_lecture(db: AsyncSession, session: CourseScheduleSession) -> Lecture:
    profile = await db.get(CourseAcademicProfile, session.profile_id)
    course = await db.get(Course, profile.course_id) if profile else None
    teachers = {i for i in (session.instructor_id, profile.instructor_id if profile else None) if i}
    return Lecture(
        kind=COURSE_SESSION,
        session=session,
        org_id=session.org_id,
        title=session.title,
        start=session.start_date,
        end=session.end_date,
        course=course,
        teacher_ids=teachers,
    )


async def _offering_lecture(db: AsyncSession, session: OfferingSession) -> Lecture:
    offering = await db.get(CourseOffering, session.offering_id)
    course = await db.get(Course, offering.content_course_id) if offering and offering.content_course_id else None
    teachers = {i for i in (offering.instructor_id, offering.teaching_assistant_id) if i} if offering else set()
    title = session.title or (session.session_type or "").replace("_", " ").title() or (offering.code if offering else "")
    return Lecture(
        kind=OFFERING_SESSION,
        session=session,
        org_id=session.org_id,
        title=title,
        start=session.start_datetime,
        end=session.end_datetime,
        course=course,
        offering=offering,
        offering_code=offering.code if offering else None,
        teacher_ids=teachers,
    )


async def resolve_lecture(db: AsyncSession, session_uuid: str) -> Lecture:
    if session_uuid:
        course_session = (
            await db.execute(select(CourseScheduleSession).where(CourseScheduleSession.session_uuid == session_uuid))
        ).scalars().first()
        if course_session:
            return await _course_lecture(db, course_session)
        offering_session = (
            await db.execute(select(OfferingSession).where(OfferingSession.session_uuid == session_uuid))
        ).scalars().first()
        if offering_session:
            return await _offering_lecture(db, offering_session)
    raise errors.lecture_not_found()


async def lecture_for_meeting(db: AsyncSession, meeting: OnlineMeeting) -> Optional[Lecture]:
    if meeting.course_session_id:
        session = await db.get(CourseScheduleSession, meeting.course_session_id)
        return await _course_lecture(db, session) if session else None
    if meeting.offering_session_id:
        session = await db.get(OfferingSession, meeting.offering_session_id)
        return await _offering_lecture(db, session) if session else None
    return None


def person_id(current_user) -> Optional[int]:
    """The signed-in person's id, or None for anonymous users and API tokens."""
    if isinstance(current_user, PublicUser) and current_user.id:
        return current_user.id
    return None


async def can_host(request: Request, db: AsyncSession, current_user, lecture: Lecture) -> bool:
    user_id = person_id(current_user)
    if not user_id:
        return False
    if user_id in lecture.teacher_ids:
        return True
    try:
        if lecture.kind == COURSE_SESSION:
            if not lecture.course:
                return False
            await check_resource_access(request, db, current_user, lecture.course.course_uuid, AccessAction.UPDATE)
            return True
        if lecture.offering:
            await require_offering_manager(request, db, current_user, lecture.offering)
            return True
    except HTTPException:
        return False
    return False


async def is_enrolled(db: AsyncSession, user_id: int, lecture: Lecture, statuses=JOIN_ENROLLMENT) -> bool:
    if lecture.offering:
        enrolled = (
            await db.execute(
                select(Enrollment.id).where(
                    Enrollment.offering_id == lecture.offering.id,
                    Enrollment.user_id == user_id,
                    Enrollment.status.in_(statuses),  # type: ignore[attr-defined]
                )
            )
        ).first()
        if enrolled:
            return True
    if lecture.course and lecture.kind == COURSE_SESSION:
        run = (
            await db.execute(
                select(TrailRun.id).where(
                    TrailRun.course_id == lecture.course.id,
                    TrailRun.user_id == user_id,
                    TrailRun.status != TrailRunStatus.STATUS_CANCELLED,
                )
            )
        ).first()
        if run:
            return True
        # Registered in an offering that delivers this course.
        via_offering = (
            await db.execute(
                select(Enrollment.id)
                .join(CourseOffering, CourseOffering.id == Enrollment.offering_id)  # type: ignore[arg-type]
                .where(
                    CourseOffering.content_course_id == lecture.course.id,
                    Enrollment.user_id == user_id,
                    Enrollment.status.in_(statuses),  # type: ignore[attr-defined]
                )
            )
        ).first()
        if via_offering:
            return True
    return False


async def enrolled_count(db: AsyncSession, lecture: Lecture) -> int:
    ids: set[int] = set()
    if lecture.offering:
        ids |= set(
            (
                await db.execute(
                    select(Enrollment.user_id).where(
                        Enrollment.offering_id == lecture.offering.id,
                        Enrollment.status.in_(JOIN_ENROLLMENT),  # type: ignore[attr-defined]
                    )
                )
            ).scalars().all()
        )
    elif lecture.course:
        ids |= set(
            (
                await db.execute(
                    select(TrailRun.user_id).where(
                        TrailRun.course_id == lecture.course.id,
                        TrailRun.status != TrailRunStatus.STATUS_CANCELLED,
                    )
                )
            ).scalars().all()
        )
    return len(ids - lecture.teacher_ids)


async def require_host(request: Request, db: AsyncSession, current_user, lecture: Lecture) -> int:
    user_id = person_id(current_user)
    if not user_id or not await can_host(request, db, current_user, lecture):
        raise errors.forbidden("Only the class's instructors and administrators can manage its online meeting.")
    return user_id
