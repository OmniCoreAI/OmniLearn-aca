"""Service tests for the role-aware calendar feed."""

from datetime import datetime

import pytest
from sqlmodel import select

from src.db.academic.calendar import AcademicTerm, AcademicYear
from src.db.academic.catalog import AcademicCourse
from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, Enrollment, EnrollmentStatus, OfferingSession
from src.db.courses.assignments import Assignment, GradingTypeEnum
from src.db.roles import Role, RoleTypeEnum
from src.db.trail_runs import TrailRun
from src.db.trails import Trail
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.nav_items import ROLE_UUID_INSTRUCTOR
from src.services.calendar.events import get_calendar_events, parse_when

START = datetime(2026, 10, 1)
END = datetime(2026, 11, 1)
NOW = "2026-09-01 00:00:00"


def test_parse_when_handles_dates_and_datetimes():
    assert parse_when("2026-10-05") == (datetime(2026, 10, 5), True)
    assert parse_when("2026-10-05T09:30:00Z") == (datetime(2026, 10, 5, 9, 30), False)
    assert parse_when("2026-10-05 09:30:00.123") == (datetime(2026, 10, 5, 9, 30, 0, 123000), False)
    assert parse_when("not a date") == (None, False)
    assert parse_when(None) == (None, False)


async def _member(db, org, user_id: int, username: str, role_id: int) -> User:
    user = User(
        id=user_id,
        username=username,
        first_name=username.title(),
        last_name="Tester",
        email=f"{username}@test.com",
        password="x",
        user_uuid=f"user_{username}",
        creation_date=NOW,
        update_date=NOW,
    )
    db.add(user)
    db.add(UserOrganization(user_id=user_id, org_id=org.id, role_id=role_id, creation_date=NOW, update_date=NOW))
    await db.commit()
    return user


@pytest.fixture
async def world(db, org, admin_user, regular_user, course, activity):
    """One offering (with a lecture + an exam), one LMS course (with a class
    session and two assignments), an instructor, an enrolled trainee and an
    outsider trainee."""
    db.add(
        Role(
            id=3,
            name="Instructor",
            org_id=org.id,
            role_type=RoleTypeEnum.TYPE_ORGANIZATION,
            role_uuid=ROLE_UUID_INSTRUCTOR,
            rights={},
            creation_date=NOW,
            update_date=NOW,
        )
    )
    await db.commit()
    instructor = await _member(db, org, 10, "lecturer", 3)
    outsider = await _member(db, org, 11, "outsider", 4)

    year = AcademicYear(name="2026/27", code="2026-27", org_id=org.id, academic_year_uuid="ay_1")
    db.add(year)
    await db.commit()
    term = AcademicTerm(
        name="Fall 2026",
        code="FALL-2026",
        org_id=org.id,
        academic_year_id=year.id,
        term_uuid="term_fall",
        start_date="2026-09-15",
        exam_start="2026-10-20",
        exam_end="2026-10-25",
    )
    acourse = AcademicCourse(code="AI501", name="Machine Learning", org_id=org.id, academic_course_uuid="ac_1")
    db.add_all([term, acourse])
    await db.commit()
    offering = CourseOffering(
        org_id=org.id,
        academic_course_id=acourse.id,
        term_id=term.id,
        section="A",
        instructor_id=instructor.id,
        content_course_id=course.id,
        offering_uuid="offering_1",
    )
    db.add(offering)
    await db.commit()
    db.add_all(
        [
            OfferingSession(
                offering_id=offering.id,
                org_id=org.id,
                session_uuid="session_lecture",
                title="Week 1 lecture",
                session_type="lecture",
                start_datetime="2026-10-05T09:00:00",
                end_datetime="2026-10-05T11:00:00",
                location="Hall A",
            ),
            OfferingSession(
                offering_id=offering.id,
                org_id=org.id,
                session_uuid="session_exam",
                title="Midterm",
                session_type="exam",
                start_datetime="2026-10-21T10:00:00",
            ),
            # Outside the requested window
            OfferingSession(
                offering_id=offering.id,
                org_id=org.id,
                session_uuid="session_december",
                title="Final",
                session_type="exam",
                start_datetime="2026-12-10T10:00:00",
            ),
            Enrollment(
                offering_id=offering.id,
                user_id=regular_user.id,
                org_id=org.id,
                status=EnrollmentStatus.REGISTERED,
                enrollment_uuid="enrollment_1",
            ),
        ]
    )
    profile = CourseAcademicProfile(course_id=course.id, org_id=org.id, classroom="Lab 3", profile_uuid="profile_1")
    db.add(profile)
    await db.commit()
    db.add(
        CourseScheduleSession(
            profile_id=profile.id,
            org_id=org.id,
            title="Workshop",
            start_date="2026-10-08",
            session_uuid="class_1",
        )
    )
    for uuid, published in (("assignment_published", True), ("assignment_draft", False)):
        db.add(
            Assignment(
                title=uuid,
                description="",
                due_date="2026-10-12",
                published=published,
                grading_type=GradingTypeEnum.NUMERIC,
                org_id=org.id,
                course_id=course.id,
                chapter_id=1,
                activity_id=activity.id,
                assignment_uuid=uuid,
            )
        )
    await db.commit()
    return {"instructor": instructor, "outsider": outsider}


def _ids(feed):
    return {e["id"] for e in feed["events"]}


async def test_admin_sees_everything_in_range(db, org, admin_user, world):
    feed = await get_calendar_events(org.id, admin_user.id, db, START, END)
    assert feed["scope"] == "all"
    assert _ids(feed) == {
        "session:session_lecture",
        "session:session_exam",
        "class:class_1",
        "deadline:assignment_published",
        "deadline:assignment_draft",
        "term:term_fall:exams",
    }
    lecture = next(e for e in feed["events"] if e["id"] == "session:session_lecture")
    assert lecture["type"] == "lecture"
    assert lecture["location"] == "Hall A"
    assert lecture["instructor"] == "Lecturer Tester"
    assert lecture["refs"]["offering_uuid"] == "offering_1"
    exam = next(e for e in feed["events"] if e["id"] == "session:session_exam")
    assert exam["type"] == "exam"
    workshop = next(e for e in feed["events"] if e["id"] == "class:class_1")
    assert workshop["all_day"] is True and workshop["location"] == "Lab 3"


async def test_instructor_sees_what_they_teach(db, org, world):
    feed = await get_calendar_events(org.id, world["instructor"].id, db, START, END)
    assert feed["scope"] == "teaching"
    # Teaches the offering → its sessions, the linked content course's class and
    # both assignments (drafts included), plus the term's exam period.
    assert "session:session_lecture" in _ids(feed)
    assert "deadline:assignment_draft" in _ids(feed)
    assert "term:term_fall:exams" in _ids(feed)


async def test_enrolled_trainee_sees_only_published_work(db, org, regular_user, world):
    feed = await get_calendar_events(org.id, regular_user.id, db, START, END)
    assert feed["scope"] == "learning"
    assert "session:session_lecture" in _ids(feed)
    assert "deadline:assignment_published" in _ids(feed)
    assert "deadline:assignment_draft" not in _ids(feed)


async def test_lms_enrollment_brings_course_sessions(db, org, course, world):
    outsider = world["outsider"]
    assert (await get_calendar_events(org.id, outsider.id, db, START, END))["events"] == []

    trail = Trail(org_id=org.id, user_id=outsider.id, trail_uuid="trail_outsider")
    db.add(trail)
    await db.commit()
    db.add(
        TrailRun(
            trail_id=trail.id,
            course_id=course.id,
            org_id=org.id,
            user_id=outsider.id,
            creation_date=NOW,
            update_date=NOW,
        )
    )
    await db.commit()

    feed = await get_calendar_events(org.id, outsider.id, db, START, END)
    assert feed["scope"] == "learning"
    # Enrolled in the LMS course only — its class session and published
    # deadline, but not the postgraduate offering's lectures or term dates.
    assert _ids(feed) == {"class:class_1", "deadline:assignment_published"}


async def test_guest_instructor_sees_only_their_session(db, org, world):
    guest = await _member(db, org, 12, "guest", 3)
    profile_id = (await db.execute(select(CourseAcademicProfile.id))).scalars().first()
    db.add(
        CourseScheduleSession(
            profile_id=profile_id,
            org_id=org.id,
            title="Guest lecture",
            start_date="2026-10-09",
            session_uuid="class_guest",
            instructor_id=guest.id,
        )
    )
    await db.commit()

    feed = await get_calendar_events(org.id, guest.id, db, START, END)
    assert _ids(feed) == {"class:class_guest"}
    assert feed["events"][0]["instructor"] == "Guest Tester"
    # The course instructor still sees it, labelled with the guest's name.
    lecturer_feed = await get_calendar_events(org.id, world["instructor"].id, db, START, END)
    assert "class:class_guest" in _ids(lecturer_feed)
