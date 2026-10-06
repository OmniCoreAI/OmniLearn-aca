"""Course Academic Profile service.

The profile is a 1:1 extension of an existing Course, so these attributes follow
the course everywhere it is used (postgraduate semesters and training programs).
All access is gated on the COURSE's own RBAC (course_uuid), reusing the existing
course permission model — no new rights bucket is introduced.

Learning materials and the question bank are surfaced from the course's existing
chapters/activities and assignments (no new storage); the certificate reuses the
existing per-course Certification.
"""
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from fastapi import HTTPException, Request
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser
from src.db.courses.courses import Course
from src.db.courses.certifications import Certifications
from src.db.courses.assignments import Assignment
from src.db.academic.course_profiles import (
    CourseAcademicProfile,
    CourseAcademicProfileRead,
    CourseAcademicProfileUpsert,
    CourseScheduleSession,
    CourseScheduleSessionCreate,
    CourseScheduleSessionRead,
    CourseScheduleSessionUpdate,
)
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import ensure_coordinator_authorship, get_user_author
from src.services.administration.addons import course_addons_as_legacy, sync_legacy_course_addons
from src.services.administration.facilities import (
    check_session_booking,
    facility_ref,
    resolve_facility_id,
)
from src.services.academic.validation import resolve_teaching_staff
from src.services.notifications.assignments import slug, staff_assigned
from src.security.auth import resolve_acting_user_id


async def _get_course_or_404(db_session: AsyncSession, course_uuid: str) -> Course:
    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


async def _get_profile(db_session: AsyncSession, course_id: int) -> Optional[CourseAcademicProfile]:
    return (
        await db_session.execute(
            select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course_id)
        )
    ).scalars().first()


async def _sessions_read(
    db_session: AsyncSession, profile_id: int
) -> List[CourseScheduleSessionRead]:
    rows = (
        await db_session.execute(
            select(CourseScheduleSession)
            .where(CourseScheduleSession.profile_id == profile_id)
            .order_by(CourseScheduleSession.order.asc())  # type: ignore
        )
    ).scalars().all()
    return [await _session_read(db_session, s) for s in rows]


async def _session_read(db_session: AsyncSession, session: CourseScheduleSession) -> CourseScheduleSessionRead:
    return CourseScheduleSessionRead(
        **session.model_dump(),
        facility=await facility_ref(db_session, session.facility_id),
        instructor=await get_user_author(db_session, session.instructor_id),
    )


async def build_profile_read(
    db_session: AsyncSession, course: Course, profile: CourseAcademicProfile
) -> CourseAcademicProfileRead:
    """Assemble the read model, surfacing certificate + assignment info."""
    instructor = await get_user_author(db_session, profile.instructor_id)

    has_cert = (
        await db_session.execute(
            select(func.count()).select_from(Certifications).where(
                Certifications.course_id == course.id
            )
        )
    ).scalar() or 0
    assignment_count = (
        await db_session.execute(
            select(func.count()).select_from(Assignment).where(
                Assignment.course_id == course.id
            )
        )
    ).scalar() or 0

    sessions = await _sessions_read(db_session, profile.id)

    return CourseAcademicProfileRead(
        **profile.model_dump(exclude={"add_ons"}),
        course_uuid=course.course_uuid,
        instructor=instructor,
        has_course_certification=bool(has_cert),
        assignment_count=int(assignment_count),
        sessions=sessions,
        facility=await facility_ref(db_session, profile.facility_id),
        add_ons=await course_addons_as_legacy(db_session, course.course_uuid),
    )


async def get_profile_read_for_course(
    db_session: AsyncSession, course: Course
) -> Optional[CourseAcademicProfileRead]:
    """Fetch (without RBAC) the profile read for embedding into course listings."""
    profile = await _get_profile(db_session, course.id)
    if not profile:
        return None
    return await build_profile_read(db_session, course, profile)


async def get_course_academic_profile(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> Optional[CourseAcademicProfileRead]:
    course = await _get_course_or_404(db_session, course_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        course.course_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )
    profile = await _get_profile(db_session, course.id)
    if not profile:
        return None
    return await build_profile_read(db_session, course, profile)


def _validate(data: dict) -> None:
    if data.get("capacity") is not None and data["capacity"] < 0:
        raise HTTPException(status_code=400, detail="Capacity cannot be negative")
    if data.get("credit_hours") is not None and data["credit_hours"] < 0:
        raise HTTPException(status_code=400, detail="Credit hours cannot be negative")


async def upsert_course_academic_profile(
    request: Request,
    course_uuid: str,
    payload: CourseAcademicProfileUpsert,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CourseAcademicProfileRead:
    course = await _get_course_or_404(db_session, course_uuid)
    # Editing the profile is a mutation on the course (reuses course RBAC).
    await check_resource_access(
        request, db_session, current_user, course.course_uuid, AccessAction.UPDATE
    )

    data = payload.model_dump(exclude_unset=True)
    _validate(data)

    instructor_changed = "instructor_uuid" in data
    instructor_id = None
    previous_instructor_id = None
    if instructor_changed:
        existing = await _get_profile(db_session, course.id)
        previous_instructor_id = existing.instructor_id if existing else None
        instructor_id = await resolve_teaching_staff(
            db_session,
            course.org_id,
            data.pop("instructor_uuid"),
            label="Instructor",
            keep_id=existing.instructor_id if existing else None,
        )

    allow_conflict = bool(data.pop("allow_conflict", False))
    facility_changed = "facility_uuid" in data
    facility_id = None
    if facility_changed:
        facility_id = await resolve_facility_id(db_session, course.org_id, data.pop("facility_uuid"))

    add_ons = None
    if "add_ons" in data:
        # Legacy field: mapped onto the add-on catalog + course attachments
        # (Administration → Add-ons) instead of the deprecated JSON column.
        add_ons = [a.model_dump() for a in (payload.add_ons or [])]
        data.pop("add_ons", None)

    profile = await _get_profile(db_session, course.id)
    if not profile:
        profile = CourseAcademicProfile(
            course_id=course.id,
            org_id=course.org_id,
            profile_uuid=f"courseprofile_{uuid4()}",
            creation_date=str(datetime.now()),
        )

    for key, value in data.items():
        setattr(profile, key, value)
    if instructor_changed:
        profile.instructor_id = instructor_id
    if add_ons is not None:
        await sync_legacy_course_addons(db_session, course.org_id, course.course_uuid, add_ons)
    if facility_changed:
        if facility_id and profile.id and not allow_conflict:
            # Sessions without their own room move to the new default: check them.
            inheriting = (
                await db_session.execute(
                    select(CourseScheduleSession).where(
                        CourseScheduleSession.profile_id == profile.id,
                        CourseScheduleSession.facility_id.is_(None),  # type: ignore[union-attr]
                    )
                )
            ).scalars().all()
            for session in inheriting:
                await check_session_booking(
                    db_session, facility_id, session.start_date, session.end_date,
                    exclude=("course_session", session.id),
                )
        profile.facility_id = facility_id
    profile.update_date = str(datetime.now())

    db_session.add(profile)
    # Instructor gets co-teacher (maintainer) access on the course.
    if instructor_changed and instructor_id:
        await ensure_coordinator_authorship(db_session, course.course_uuid, instructor_id)
    await db_session.commit()
    await db_session.refresh(profile)

    if instructor_changed and instructor_id and instructor_id != previous_instructor_id:
        await staff_assigned(
            db_session, course.org_id, [instructor_id], "course_instructor", course.name,
            f"/dash/courses/course/{slug(course.course_uuid, 'course_')}/content",
            actor_id=resolve_acting_user_id(current_user), resource=("course", course.course_uuid),
        )
        await db_session.refresh(profile)

    return await build_profile_read(db_session, course, profile)


# ------------------------- Schedule sessions -------------------------------

async def _ensure_profile(db_session: AsyncSession, course: Course) -> CourseAcademicProfile:
    profile = await _get_profile(db_session, course.id)
    if profile:
        return profile
    profile = CourseAcademicProfile(
        course_id=course.id,
        org_id=course.org_id,
        profile_uuid=f"courseprofile_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db_session.add(profile)
    await db_session.flush()
    await db_session.refresh(profile)
    return profile


async def list_sessions(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[CourseScheduleSessionRead]:
    course = await _get_course_or_404(db_session, course_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        course.course_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )
    profile = await _get_profile(db_session, course.id)
    if not profile:
        return []
    return await _sessions_read(db_session, profile.id)


async def create_session(
    request: Request,
    course_uuid: str,
    payload: CourseScheduleSessionCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CourseScheduleSessionRead:
    course = await _get_course_or_404(db_session, course_uuid)
    await check_resource_access(
        request, db_session, current_user, course.course_uuid, AccessAction.UPDATE
    )
    profile = await _ensure_profile(db_session, course)
    facility_id = await resolve_facility_id(db_session, course.org_id, payload.facility_uuid)
    instructor_id = await resolve_teaching_staff(
        db_session, course.org_id, payload.instructor_uuid, label="Session instructor"
    )
    await check_session_booking(
        db_session,
        facility_id or profile.facility_id,
        payload.start_date,
        payload.end_date,
        allow_conflict=payload.allow_conflict,
    )

    session = CourseScheduleSession(
        profile_id=profile.id,
        org_id=course.org_id,
        facility_id=facility_id,
        instructor_id=instructor_id,
        session_uuid=f"session_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        **payload.model_dump(exclude={"facility_uuid", "allow_conflict", "instructor_uuid"}),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    await _notify_session_instructor(db_session, course, session, None, current_user)
    return await _session_read(db_session, session)


async def _notify_session_instructor(
    db_session: AsyncSession, course: Course, session: CourseScheduleSession, previous_id: Optional[int], current_user
) -> None:
    if session.instructor_id and session.instructor_id != previous_id:
        await staff_assigned(
            db_session, course.org_id, [session.instructor_id], "session_instructor",
            f"{session.title} · {course.name}", "/dash/calendar",
            actor_id=resolve_acting_user_id(current_user), resource=("course", course.course_uuid),
        )
        await db_session.refresh(session)


async def _get_session_or_404(
    db_session: AsyncSession, profile_id: int, session_uuid: str
) -> CourseScheduleSession:
    session = (
        await db_session.execute(
            select(CourseScheduleSession).where(
                CourseScheduleSession.profile_id == profile_id,
                CourseScheduleSession.session_uuid == session_uuid,
            )
        )
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def update_session(
    request: Request,
    course_uuid: str,
    session_uuid: str,
    payload: CourseScheduleSessionUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CourseScheduleSessionRead:
    course = await _get_course_or_404(db_session, course_uuid)
    await check_resource_access(
        request, db_session, current_user, course.course_uuid, AccessAction.UPDATE
    )
    profile = await _get_profile(db_session, course.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Session not found")

    session = await _get_session_or_404(db_session, profile.id, session_uuid)
    data = payload.model_dump(exclude_unset=True)
    allow_conflict = bool(data.pop("allow_conflict", False))
    if "facility_uuid" in data:
        session.facility_id = await resolve_facility_id(db_session, course.org_id, data.pop("facility_uuid"))
        data["facility_id"] = session.facility_id
    previous_instructor_id = session.instructor_id
    if "instructor_uuid" in data:
        session.instructor_id = await resolve_teaching_staff(
            db_session, course.org_id, data.pop("instructor_uuid"), label="Session instructor",
            keep_id=session.instructor_id,
        )
    for key, value in data.items():
        setattr(session, key, value)
    if {"facility_id", "start_date", "end_date"} & set(data):
        await check_session_booking(
            db_session,
            session.facility_id or profile.facility_id,
            session.start_date,
            session.end_date,
            exclude=("course_session", session.id),
            allow_conflict=allow_conflict,
        )
    session.update_date = str(datetime.now())

    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    await _notify_session_instructor(db_session, course, session, previous_instructor_id, current_user)
    return await _session_read(db_session, session)


async def delete_session(
    request: Request,
    course_uuid: str,
    session_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    course = await _get_course_or_404(db_session, course_uuid)
    await check_resource_access(
        request, db_session, current_user, course.course_uuid, AccessAction.UPDATE
    )
    profile = await _get_profile(db_session, course.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Session not found")

    session = await _get_session_or_404(db_session, profile.id, session_uuid)
    await db_session.delete(session)
    await db_session.commit()
    return "Session deleted"
