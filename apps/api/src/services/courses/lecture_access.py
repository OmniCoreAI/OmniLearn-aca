"""Lecture-scoped access to course content.

A course organised by lectures (``CourseAcademicProfile.organize_by_lectures``)
groups its chapters under lectures (``CourseScheduleSession``; a chapter points
at its lecture through ``Chapter.lecture_id``). Each lecture has an instructor —
its own ``instructor_id``, or the course instructor when that is empty.

Course-wide rights are unchanged: whoever may edit the course (admins, course
authors/maintainers, the course instructor) may edit every lecture. On top of
that, a lecture's instructor may create, edit and delete the chapters and
activities *inside that lecture* — and nothing else of the course (settings,
other lectures, enrolments, certificates).

Content services call :func:`check_course_content_access` instead of
``check_resource_access(course_uuid)`` and pass what the operation touches
(a chapter, an activity or a lecture). The course-wide check always runs first;
the lecture fallback only applies to signed-in users (never API tokens or
anonymous visitors) who are still members of the course's organisation.
"""
from typing import Optional, Union

from fastapi import HTTPException, Request, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.rbac import AccessAction, check_resource_access

AnyPrincipal = Union[PublicUser, AnonymousUser, APITokenUser]

# Actions a lecture instructor may perform on their lecture's content.
LECTURE_ACTIONS = {AccessAction.READ, AccessAction.CREATE, AccessAction.UPDATE, AccessAction.DELETE}


async def get_course_lecture(db_session: AsyncSession, course: Course, lecture_uuid: str) -> CourseScheduleSession:
    """The lecture ``lecture_uuid`` of ``course`` (400 when it belongs elsewhere)."""
    row = (
        await db_session.execute(
            select(CourseScheduleSession, CourseAcademicProfile)
            .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
            .where(CourseScheduleSession.session_uuid == lecture_uuid)
        )
    ).first()
    if not row or row[1].course_id != course.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lecture is not part of this course")
    return row[0]


async def lecture_of_chapter(db_session: AsyncSession, chapter_id: Optional[int]) -> Optional[CourseScheduleSession]:
    if not chapter_id:
        return None
    lecture_id = (await db_session.execute(select(Chapter.lecture_id).where(Chapter.id == chapter_id))).scalar()
    return await db_session.get(CourseScheduleSession, lecture_id) if lecture_id else None


async def lecture_of_activity(db_session: AsyncSession, activity_id: Optional[int]) -> Optional[CourseScheduleSession]:
    if not activity_id:
        return None
    chapter_id = (
        await db_session.execute(select(ChapterActivity.chapter_id).where(ChapterActivity.activity_id == activity_id))
    ).scalar()
    return await lecture_of_chapter(db_session, chapter_id)


async def teaches_lecture(
    db_session: AsyncSession, current_user: AnyPrincipal, course: Course, lecture: Optional[CourseScheduleSession]
) -> bool:
    """Whether a signed-in user teaches ``lecture`` of ``course`` (organised by lectures)."""
    if lecture is None or not isinstance(current_user, PublicUser) or not getattr(current_user, "id", None):
        return False
    profile = await db_session.get(CourseAcademicProfile, lecture.profile_id)
    if profile is None or profile.course_id != course.id or not profile.organize_by_lectures:
        return False
    teacher_id = lecture.instructor_id or profile.instructor_id
    if teacher_id != current_user.id:
        return False
    member = (
        await db_session.execute(
            select(UserOrganization.id).where(
                UserOrganization.user_id == current_user.id, UserOrganization.org_id == course.org_id
            )
        )
    ).first()
    return member is not None


async def check_course_content_access(
    request: Request,
    db_session: AsyncSession,
    current_user: AnyPrincipal,
    course: Course,
    action: AccessAction,
    *,
    chapter_id: Optional[int] = None,
    activity_id: Optional[int] = None,
    lecture: Optional[CourseScheduleSession] = None,
) -> None:
    """Course-wide RBAC, or — failing that — the instructor of the lecture the content is in.

    Pass the lecture directly (creating a chapter in it), or the chapter /
    activity being touched; the lecture is resolved from them. Raises 403 with
    the course check's reason when neither grants access.
    """
    decision = await check_resource_access(
        request, db_session, current_user, course.course_uuid, action, raise_on_deny=False
    )
    if decision.allowed:
        return
    if action in LECTURE_ACTIONS:
        if lecture is None and chapter_id:
            lecture = await lecture_of_chapter(db_session, chapter_id)
        if lecture is None and activity_id:
            lecture = await lecture_of_activity(db_session, activity_id)
        if await teaches_lecture(db_session, current_user, course, lecture):
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=decision.reason)


async def teaches_any_lecture(db_session: AsyncSession, current_user: AnyPrincipal, course: Course) -> bool:
    """Whether a signed-in user teaches at least one lecture of ``course``.

    Lecture instructors are course staff: the editor shows them the course's
    draft (unpublished) activities like it does for course editors.
    """
    if not isinstance(current_user, PublicUser) or not getattr(current_user, "id", None):
        return False
    profile = (
        await db_session.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id))
    ).scalars().first()
    if profile is None or not profile.organize_by_lectures:
        return False
    lectures = (
        await db_session.execute(select(CourseScheduleSession).where(CourseScheduleSession.profile_id == profile.id))
    ).scalars().all()
    for lecture in lectures:
        if (lecture.instructor_id or profile.instructor_id) == current_user.id:
            return await teaches_lecture(db_session, current_user, course, lecture)
    return False


async def lecture_rights(db_session: AsyncSession, current_user: AnyPrincipal, course: Course) -> dict:
    """For the course-rights endpoint: is the course organised by lectures, and
    which lectures (session uuids) may this user edit on their own?"""
    profile = (
        await db_session.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id))
    ).scalars().first()
    organized = bool(profile and profile.organize_by_lectures)
    taught: list[str] = []
    if organized and isinstance(current_user, PublicUser) and getattr(current_user, "id", None):
        lectures = (
            await db_session.execute(
                select(CourseScheduleSession).where(CourseScheduleSession.profile_id == profile.id)  # type: ignore[union-attr]
            )
        ).scalars().all()
        mine = [lec for lec in lectures if (lec.instructor_id or profile.instructor_id) == current_user.id]  # type: ignore[union-attr]
        if mine and await teaches_lecture(db_session, current_user, course, mine[0]):
            taught = [lec.session_uuid for lec in mine]
    return {"organized": organized, "taught": taught}


async def course_lecture_summaries(db_session: AsyncSession, course: Course) -> list:
    """The lectures of a course organised by lectures, for the learner course page."""
    from src.db.administration.facilities import Facility
    from src.db.courses.courses import CourseLectureSummary
    from src.db.users import User

    profile = (
        await db_session.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id))
    ).scalars().first()
    if profile is None or not profile.organize_by_lectures:
        return []
    lectures = (
        await db_session.execute(
            select(CourseScheduleSession)
            .where(CourseScheduleSession.profile_id == profile.id)
            .order_by(CourseScheduleSession.order, CourseScheduleSession.id)  # type: ignore[arg-type]
        )
    ).scalars().all()
    user_ids = {lec.instructor_id or profile.instructor_id for lec in lectures} - {None}
    users = (
        {u.id: u for u in (await db_session.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()}  # type: ignore[union-attr]
        if user_ids
        else {}
    )
    room_ids = {lec.facility_id or profile.facility_id for lec in lectures} - {None}
    rooms = (
        dict((await db_session.execute(select(Facility.id, Facility.name).where(Facility.id.in_(room_ids)))).all())  # type: ignore[union-attr]
        if room_ids
        else {}
    )
    out = []
    for lec in lectures:
        teacher = users.get(lec.instructor_id or profile.instructor_id)
        name = f"{teacher.first_name or ''} {teacher.last_name or ''}".strip() or teacher.username if teacher else None
        out.append(
            CourseLectureSummary(
                lecture_uuid=lec.session_uuid,
                title=lec.title,
                description=lec.description,
                order=lec.order or 0,
                start_date=lec.start_date,
                end_date=lec.end_date,
                location=lec.location,
                room=rooms.get(lec.facility_id or profile.facility_id),
                instructor_uuid=teacher.user_uuid if teacher else None,
                instructor_name=name,
                instructor_avatar=teacher.avatar_image if teacher else None,
            )
        )
    return out
