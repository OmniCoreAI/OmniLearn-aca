"""
Role-aware calendar feed.

Aggregates every dated thing the platform knows about — course class sessions,
postgraduate offering sessions (lectures, labs, exams…), assignment deadlines,
academic-term milestones, training programs and admission interviews / entrance
tests — and narrows it to what the requesting user should see:

* ``all``      — superadmins and org admins/coordinators see the whole org.
* ``teaching`` — instructors see what they teach, author, coordinate or sit on
                 an interview panel for (plus anything they are enrolled in).
* ``learning`` — everyone else sees their enrolled courses and offerings,
                 published deadlines, and their own admission appointments.

Dates in these tables are stored as loosely formatted strings, so they are
parsed in Python and the requested window is applied after loading. Each source
is pre-filtered by org and scope in SQL, which keeps the loaded rows small.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Iterable, Literal, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.admissions import AdmissionApplication, AdmissionInterview, EntranceTest, EntranceTestAttempt
from src.db.academic.calendar import AcademicTerm
from src.db.academic.catalog import AcademicCourse
from src.db.academic.cohorts import Cohort
from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.links import TrainingProgramCourse
from src.db.academic.offerings import CourseOffering, Enrollment, EnrollmentStatus, OfferingSession
from src.db.academic.training_programs import TrainingProgram
from src.db.courses.activities import Activity
from src.db.courses.assignments import Assignment, AssignmentUserSubmission
from src.db.courses.courses import Course
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipStatusEnum
from src.db.roles import Role
from src.db.trail_runs import TrailRun
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.org_auth import is_org_admin
from src.security.rbac.nav_items import ROLE_UUID_INSTRUCTOR

Scope = Literal["all", "teaching", "learning"]

MAX_RANGE_DAYS = 400
ACTIVE_ENROLLMENT = (EnrollmentStatus.REGISTERED, EnrollmentStatus.COMPLETED)

# Academic-term milestone columns → event kind. exam_start/exam_end become one ranged event.
TERM_MILESTONES = (
    ("start_date", "term_start"),
    ("end_date", "term_end"),
    ("registration_start", "registration_start"),
    ("registration_end", "registration_end"),
    ("add_drop_end", "add_drop_end"),
    ("grade_deadline", "grade_deadline"),
)


def parse_when(value: Optional[str]) -> tuple[Optional[datetime], bool]:
    """Parse a stored date/datetime string → (naive datetime, all_day)."""
    if not value:
        return None, False
    raw = value.strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None, False
    date_only = len(raw) <= 10
    return parsed.replace(tzinfo=None), date_only


def _name(user: Optional[User]) -> Optional[str]:
    if user is None:
        return None
    full = " ".join(p for p in (user.first_name, user.last_name) if p).strip()
    return full or user.username


@dataclass
class _Feed:
    start: datetime
    end: datetime
    events: dict[str, dict[str, Any]] = field(default_factory=dict)

    def add(
        self,
        *,
        event_id: str,
        event_type: str,
        title: str,
        start: Optional[str],
        end: Optional[str] = None,
        kind: Optional[str] = None,
        subtitle: Optional[str] = None,
        location: Optional[str] = None,
        instructor: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        refs: Optional[dict[str, Optional[str]]] = None,
    ) -> None:
        start_dt, all_day = parse_when(start)
        if start_dt is None:
            return
        end_dt, end_all_day = parse_when(end)
        if end_dt is not None and end_dt < start_dt:
            end_dt = None
        # An all-day end date covers that whole day.
        last = (end_dt + timedelta(days=1) if end_all_day else end_dt) if end_dt else start_dt
        if start_dt >= self.end or last < self.start:
            return
        self.events[event_id] = {
            "id": event_id,
            "type": event_type,
            "kind": kind,
            "title": title,
            "subtitle": subtitle,
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat() if end_dt else None,
            "all_day": all_day,
            "location": location or None,
            "instructor": instructor,
            "description": description or None,
            "status": status,
            "refs": {k: v for k, v in (refs or {}).items() if v},
        }


async def _users(db: AsyncSession, ids: Iterable[Optional[int]]) -> dict[int, User]:
    wanted = {i for i in ids if i}
    if not wanted:
        return {}
    rows = (await db.execute(select(User).where(User.id.in_(wanted)))).scalars().all()  # type: ignore[union-attr]
    return {u.id: u for u in rows if u.id is not None}


async def _resolve_scope(org_id: int, user_id: int, db: AsyncSession) -> tuple[Scope, bool]:
    """Return (scope, is_instructor_role)."""
    if await is_org_admin(user_id, org_id, db):
        return "all", False
    role_uuid = (
        await db.execute(
            select(Role.role_uuid)
            .join(UserOrganization, UserOrganization.role_id == Role.id)  # type: ignore[arg-type]
            .where(UserOrganization.user_id == user_id, UserOrganization.org_id == org_id)
        )
    ).scalars().first()
    is_instructor = role_uuid == ROLE_UUID_INSTRUCTOR
    return ("teaching" if is_instructor else "learning"), is_instructor


async def get_calendar_events(
    org_id: int,
    user_id: int,
    db: AsyncSession,
    start: datetime,
    end: datetime,
) -> dict[str, Any]:
    if end <= start:
        end = start + timedelta(days=1)
    if (end - start).days > MAX_RANGE_DAYS:
        end = start + timedelta(days=MAX_RANGE_DAYS)

    scope, is_instructor_role = await _resolve_scope(org_id, user_id, db)
    feed = _Feed(start=start, end=end)
    see_all = scope == "all"

    # --- Which courses / offerings / programs this user is tied to --------------
    taught_course_ids: set[int] = set()
    enrolled_course_ids: set[int] = set()
    taught_offering_ids: set[int] = set()
    enrolled_offering_ids: set[int] = set()
    if not see_all:
        taught_course_ids |= set(
            (
                await db.execute(
                    select(CourseAcademicProfile.course_id).where(
                        CourseAcademicProfile.org_id == org_id, CourseAcademicProfile.instructor_id == user_id
                    )
                )
            ).scalars().all()
        )
        authored_uuids = (
            await db.execute(
                select(ResourceAuthor.resource_uuid).where(
                    ResourceAuthor.user_id == user_id,
                    ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
                    ResourceAuthor.resource_uuid.startswith("course_"),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
        if authored_uuids:
            taught_course_ids |= set(
                (
                    await db.execute(
                        select(Course.id).where(Course.org_id == org_id, Course.course_uuid.in_(authored_uuids))  # type: ignore[attr-defined]
                    )
                ).scalars().all()
            )
        enrolled_course_ids |= set(
            (
                await db.execute(
                    select(TrailRun.course_id).where(TrailRun.org_id == org_id, TrailRun.user_id == user_id)
                )
            ).scalars().all()
        )
        taught_offering_ids |= set(
            (
                await db.execute(
                    select(CourseOffering.id).where(
                        CourseOffering.org_id == org_id,
                        (CourseOffering.instructor_id == user_id) | (CourseOffering.teaching_assistant_id == user_id),
                    )
                )
            ).scalars().all()
        )
        enrolled_offering_ids |= set(
            (
                await db.execute(
                    select(Enrollment.offering_id).where(
                        Enrollment.org_id == org_id,
                        Enrollment.user_id == user_id,
                        Enrollment.status.in_(ACTIVE_ENROLLMENT),  # type: ignore[attr-defined]
                    )
                )
            ).scalars().all()
        )

    # --- Offerings (postgraduate) -------------------------------------------------
    offering_stmt = select(CourseOffering, AcademicCourse).join(
        AcademicCourse, AcademicCourse.id == CourseOffering.academic_course_id  # type: ignore[arg-type]
    ).where(CourseOffering.org_id == org_id)
    if not see_all:
        offering_stmt = offering_stmt.where(
            CourseOffering.id.in_(taught_offering_ids | enrolled_offering_ids or {-1})  # type: ignore[union-attr]
        )
    offerings = {o.id: (o, ac) for o, ac in (await db.execute(offering_stmt)).all()}
    # An offering's linked LMS content course counts as the same relationship.
    for oid, (o, _) in offerings.items():
        if o.content_course_id:
            if see_all or oid in taught_offering_ids:
                taught_course_ids.add(o.content_course_id)
            else:
                enrolled_course_ids.add(o.content_course_id)

    # Guest / substitute sessions: the course is shown only for those sessions.
    guest_profile_ids: set[int] = set()
    if not see_all:
        guest_profile_ids = set(
            (
                await db.execute(
                    select(CourseScheduleSession.profile_id).where(
                        CourseScheduleSession.org_id == org_id, CourseScheduleSession.instructor_id == user_id
                    )
                )
            ).scalars().all()
        )
    guest_course_ids: set[int] = set()
    if guest_profile_ids:
        guest_course_ids = set(
            (
                await db.execute(
                    select(CourseAcademicProfile.course_id).where(
                        CourseAcademicProfile.id.in_(guest_profile_ids)  # type: ignore[attr-defined]
                    )
                )
            ).scalars().all()
        )

    guest_only_course_ids = guest_course_ids - taught_course_ids - enrolled_course_ids
    course_ids = taught_course_ids | enrolled_course_ids | guest_course_ids
    course_stmt = select(Course.id, Course.course_uuid, Course.name).where(Course.org_id == org_id)
    if not see_all:
        course_stmt = course_stmt.where(Course.id.in_(course_ids or {-1}))  # type: ignore[union-attr]
    courses = {cid: (cuuid, cname) for cid, cuuid, cname in (await db.execute(course_stmt)).all()}

    profiles = {
        p.id: p
        for p in (
            await db.execute(
                select(CourseAcademicProfile).where(
                    CourseAcademicProfile.org_id == org_id,
                    CourseAcademicProfile.course_id.in_(list(courses) or [-1]),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
    }
    class_sessions = (
        await db.execute(
            select(CourseScheduleSession).where(
                CourseScheduleSession.org_id == org_id,
                CourseScheduleSession.profile_id.in_(list(profiles) or [-1]),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    users = await _users(
        db,
        [p.instructor_id for p in profiles.values()]
        + [o.instructor_id for o, _ in offerings.values()]
        + [sess.instructor_id for sess in class_sessions],
    )

    # --- Class sessions of LMS courses -------------------------------------------
    for sess in class_sessions:
        profile = profiles[sess.profile_id]
        if profile.course_id in guest_only_course_ids and sess.instructor_id != user_id:
            continue
        cuuid, cname = courses.get(profile.course_id, (None, None))
        feed.add(
            event_id=f"class:{sess.session_uuid or sess.id}",
            event_type="class",
            kind="class",
            title=sess.title,
            subtitle=cname,
            start=sess.start_date,
            end=sess.end_date,
            location=sess.location or profile.classroom,
            instructor=_name(users.get(sess.instructor_id or profile.instructor_id or 0)),
            refs={"course_uuid": cuuid},
        )

    # --- Offering sessions (lectures, seminars, labs, exams) ---------------------
    for sess in (
        await db.execute(
            select(OfferingSession).where(
                OfferingSession.org_id == org_id,
                OfferingSession.offering_id.in_(list(offerings) or [-1]),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all():
        offering, acourse = offerings[sess.offering_id]
        kind = (sess.session_type or "lecture").lower()
        content = courses.get(offering.content_course_id or 0)
        feed.add(
            event_id=f"session:{sess.session_uuid or sess.id}",
            event_type="exam" if kind == "exam" else "lecture",
            kind=kind,
            title=sess.title or f"{acourse.code} {acourse.name}",
            subtitle=f"{acourse.code} · {acourse.name} ({offering.section})",
            start=sess.start_datetime,
            end=sess.end_datetime,
            location=sess.location or offering.classroom,
            instructor=_name(users.get(offering.instructor_id or 0)),
            refs={"offering_uuid": offering.offering_uuid, "course_uuid": content[0] if content else None},
        )

    # --- Assignment deadlines -----------------------------------------------------
    assignment_stmt = (
        select(Assignment, Activity.activity_uuid)
        .join(Activity, Activity.id == Assignment.activity_id, isouter=True)  # type: ignore[arg-type]
        .where(
            Assignment.org_id == org_id,
            # Guest-session courses only contribute that session, not deadlines.
            Assignment.course_id.in_([c for c in courses if c not in guest_only_course_ids] or [-1]),  # type: ignore[attr-defined]
        )
    )
    assignments = (await db.execute(assignment_stmt)).all()
    submissions: dict[int, str] = {}
    if scope != "all" and assignments:
        submissions = {
            aid: str(getattr(st, "value", st))
            for aid, st in (
                await db.execute(
                    select(AssignmentUserSubmission.assignment_id, AssignmentUserSubmission.submission_status).where(
                        AssignmentUserSubmission.user_id == user_id,
                        AssignmentUserSubmission.assignment_id.in_([a.id for a, _ in assignments]),  # type: ignore[attr-defined]
                    )
                )
            ).all()
        }
    for assignment, activity_uuid in assignments:
        teaches = see_all or assignment.course_id in taught_course_ids
        if not teaches and not assignment.published:
            continue  # learners only ever see published work
        cuuid, cname = courses.get(assignment.course_id, (None, None))
        feed.add(
            event_id=f"deadline:{assignment.assignment_uuid}",
            event_type="deadline",
            kind="assignment",
            title=assignment.title,
            subtitle=cname,
            start=assignment.due_date,
            description=assignment.description,
            status=submissions.get(assignment.id or 0) if not teaches else ("published" if assignment.published else "draft"),
            refs={
                "assignment_uuid": assignment.assignment_uuid,
                "course_uuid": cuuid,
                "activity_uuid": activity_uuid,
            },
        )

    # --- Academic-term milestones -------------------------------------------------
    term_stmt = select(AcademicTerm).where(AcademicTerm.org_id == org_id)
    if not see_all:
        term_stmt = term_stmt.where(
            AcademicTerm.id.in_({o.term_id for o, _ in offerings.values()} or {-1})  # type: ignore[union-attr]
        )
    for term in (await db.execute(term_stmt)).scalars().all():
        name = term.name or "Term"
        for column, kind in TERM_MILESTONES:
            feed.add(
                event_id=f"term:{term.term_uuid}:{kind}",
                event_type="term",
                kind=kind,
                title=name,
                start=getattr(term, column),
                refs={"term_uuid": term.term_uuid},
            )
        feed.add(
            event_id=f"term:{term.term_uuid}:exams",
            event_type="term",
            kind="exam_period",
            title=name,
            start=term.exam_start,
            end=term.exam_end,
            refs={"term_uuid": term.term_uuid},
        )

    # --- Training programs --------------------------------------------------------
    program_stmt = select(TrainingProgram).where(TrainingProgram.org_id == org_id)
    if not see_all:
        linked = (
            await db.execute(
                select(TrainingProgramCourse.training_program_id).where(
                    TrainingProgramCourse.course_id.in_(course_ids or {-1})  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
        program_stmt = program_stmt.where(
            (TrainingProgram.coordinator_id == user_id) | (TrainingProgram.id.in_(set(linked) or {-1}))  # type: ignore[union-attr]
        )
    programs = (await db.execute(program_stmt)).scalars().all()
    coordinators = await _users(db, [p.coordinator_id for p in programs])
    for program in programs:
        feed.add(
            event_id=f"program:{program.trainingprogram_uuid}",
            event_type="program",
            kind=str(getattr(program.training_type, "value", program.training_type) or "program"),
            title=program.name,
            start=program.start_date,
            end=program.end_date,
            location=program.location,
            instructor=_name(coordinators.get(program.coordinator_id or 0)),
            description=program.description,
            refs={"trainingprogram_uuid": program.trainingprogram_uuid},
        )

    # --- Admission interviews & entrance tests ------------------------------------
    app_stmt = select(AdmissionApplication, Cohort.name).join(
        Cohort, Cohort.id == AdmissionApplication.cohort_id  # type: ignore[arg-type]
    ).where(AdmissionApplication.org_id == org_id)
    applications = {a.id: (a, cohort_name) for a, cohort_name in (await db.execute(app_stmt)).all()}
    if applications:
        applicants = await _users(db, [a.applicant_id for a, _ in applications.values()])
        interviews = (
            await db.execute(
                select(AdmissionInterview).where(
                    AdmissionInterview.org_id == org_id,
                    AdmissionInterview.application_id.in_(list(applications)),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
        for interview in interviews:
            application, cohort_name = applications[interview.application_id]
            is_applicant = application.applicant_id == user_id
            on_panel = user_id in (interview.panel or [])
            if not (see_all or is_applicant or on_panel):
                continue
            feed.add(
                event_id=f"interview:{interview.interview_uuid or interview.id}",
                event_type="interview",
                kind="interview",
                title=_name(applicants.get(application.applicant_id)) if not is_applicant else cohort_name,
                subtitle=cohort_name,
                start=interview.scheduled_at,
                location=interview.location,
                status=str(getattr(interview.status, "value", interview.status)),
                refs={"application_uuid": application.application_uuid, "role": "applicant" if is_applicant else "staff"},
            )
        attempts = (
            await db.execute(
                select(EntranceTestAttempt, EntranceTest.name).join(
                    EntranceTest, EntranceTest.id == EntranceTestAttempt.test_id  # type: ignore[arg-type]
                ).where(
                    EntranceTestAttempt.org_id == org_id,
                    EntranceTestAttempt.application_id.in_(list(applications)),  # type: ignore[attr-defined]
                )
            )
        ).all()
        for attempt, test_name in attempts:
            application, cohort_name = applications[attempt.application_id]
            is_applicant = application.applicant_id == user_id
            if not (see_all or is_applicant):
                continue
            feed.add(
                event_id=f"test:{attempt.id}",
                event_type="interview",
                kind="entrance_test",
                title=test_name,
                subtitle=cohort_name if is_applicant else _name(applicants.get(application.applicant_id)),
                start=attempt.scheduled_at,
                status=str(getattr(attempt.status, "value", attempt.status)),
                refs={"application_uuid": application.application_uuid, "role": "applicant" if is_applicant else "staff"},
            )

    teaches_anything = bool(taught_course_ids or taught_offering_ids) or any(
        p.coordinator_id == user_id for p in programs
    )
    if scope == "learning" and teaches_anything:
        scope = "teaching"
    if scope == "teaching" and not is_instructor_role and not teaches_anything:
        scope = "learning"

    events = sorted(feed.events.values(), key=lambda e: (e["start"], e["title"]))
    return {"scope": scope, "start": start.isoformat(), "end": end.isoformat(), "events": events}
