"""Service tests for the PostgreSQL-backed dashboard home overview."""

from datetime import datetime

from src.db.courses.courses import Course
from src.db.instructors.instructors import Instructor, InstructorStatus
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.trail_runs import StatusEnum, TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail
from src.services.analytics.home_overview import _month_keys, get_home_overview

NOW = datetime(2026, 9, 20, 12, 0, 0)


def test_month_keys_wraps_year():
    assert _month_keys(3, datetime(2026, 2, 10)) == ["2025-12", "2026-01", "2026-02"]


async def _enroll(db, org, user_id, course_id, created, status=StatusEnum.STATUS_IN_PROGRESS, updated=None):
    trail = Trail(org_id=org.id, user_id=user_id, trail_uuid=f"trail_{user_id}_{course_id}")
    db.add(trail)
    await db.commit()
    await db.refresh(trail)
    run = TrailRun(
        trail_id=trail.id,
        course_id=course_id,
        org_id=org.id,
        user_id=user_id,
        status=status,
        creation_date=created,
        update_date=updated or created,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def test_home_overview_aggregates_org_data(db, org, other_org, admin_user, regular_user, course, activity):
    draft = Course(
        id=2,
        name="Draft Course",
        description="",
        public=False,
        published=False,
        open_to_contributors=False,
        org_id=org.id,
        course_uuid="course_draft",
        creation_date="2026-09-15 09:00:00",
        update_date="2026-09-15 09:00:00",
    )
    foreign = Course(
        id=3,
        name="Other Org Course",
        description="",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=other_org.id,
        course_uuid="course_foreign",
        creation_date="2026-09-18 09:00:00",
        update_date="2026-09-18 09:00:00",
    )
    db.add_all([draft, foreign])
    await db.commit()

    run = await _enroll(
        db,
        org,
        regular_user.id,
        course.id,
        "2026-08-03 10:00:00",
        status=StatusEnum.STATUS_COMPLETED,
        updated="2026-09-02 10:00:00",
    )
    await _enroll(db, org, admin_user.id, course.id, "2026-09-10 10:00:00")
    await _enroll(db, org, regular_user.id, draft.id, "2026-09-16 10:00:00")
    # Runs on another org's course must never leak into this org's numbers
    await _enroll(db, other_org, regular_user.id, foreign.id, "2026-09-18 10:00:00")

    # Wednesday 2026-09-16 at 14:xx → weekday 2, hour 14
    db.add(
        TrailStep(
            complete=True,
            teacher_verified=False,
            grade="",
            trailrun_id=run.id,
            trail_id=run.trail_id,
            activity_id=activity.id,
            course_id=course.id,
            org_id=org.id,
            user_id=regular_user.id,
            creation_date="2026-09-16 14:05:00",
            update_date="2026-09-16 14:05:00",
        )
    )
    await db.commit()

    data = await get_home_overview(org.id, db, months=3, now=NOW)

    totals = data["totals"]
    assert totals["courses"] == 2
    assert totals["published_courses"] == 1
    assert totals["enrollments"] == 3
    assert totals["completions"] == 1
    assert totals["students"] == 2
    assert totals["enrollments_30d"] == 2
    assert data["attention"]["draft_courses"] == 1

    trend = data["enrollment_trend"]
    assert [{k: r[k] for k in ("month", "enrollments", "completions")} for r in trend] == [
        {"month": "2026-07", "enrollments": 0, "completions": 0},
        {"month": "2026-08", "enrollments": 1, "completions": 0},
        {"month": "2026-09", "enrollments": 2, "completions": 1},
    ]
    # Sparkline series ride along: the draft course was created 2026-09-15.
    assert trend[2]["courses"] >= 1
    assert all("members" in r for r in trend)
    assert data["activity_heatmap"] == [{"day": 2, "hour": 14, "count": 1}]

    top = data["top_courses"]
    assert [c["course_uuid"] for c in top] == ["course_test", "course_draft"]
    assert top[0]["enrollments"] == 2 and top[0]["completions"] == 1
    assert top[0]["lessons"] == 1

    recent = {c["course_uuid"]: c for c in data["recent_courses"]}
    assert set(recent) == {"course_test", "course_draft"}
    assert [u["username"] for u in recent["course_draft"]["learners"]] == [regular_user.username]
    assert {u["username"] for u in recent["course_test"]["learners"]} == {
        regular_user.username,
        admin_user.username,
    }

    feed = data["recent_activity"]
    timestamps = [e["timestamp"] for e in feed]
    assert timestamps == sorted(timestamps, reverse=True)
    assert {e["type"] for e in feed} >= {"enrollment", "completion", "course_created", "member_joined"}
    completion = next(e for e in feed if e["type"] == "completion")
    assert completion["timestamp"] == "2026-09-02 10:00:00"
    assert completion["user"]["username"] == regular_user.username
    assert all((e["course"] or {}).get("course_uuid") != "course_foreign" for e in feed)


async def test_home_overview_empty_org(db, org):
    data = await get_home_overview(org.id, db, now=NOW)
    assert data["totals"]["courses"] == 0
    assert data["totals"]["enrollments"] == 0
    assert len(data["enrollment_trend"]) == 7
    assert data["top_courses"] == []
    assert data["top_instructors"] == []
    assert data["recent_activity"] == []
    assert data["attention"] == {
        "submissions_to_grade": 0,
        "applications_to_review": 0,
        "tests_to_review": 0,
        "grades_to_approve": 0,
        "draft_courses": 0,
    }


def _author(user_id, course_uuid, authorship, status=ResourceAuthorshipStatusEnum.ACTIVE):
    return ResourceAuthor(
        resource_uuid=course_uuid,
        user_id=user_id,
        authorship=authorship,
        authorship_status=status,
    )


async def test_home_overview_ranks_instructors(db, org, admin_user, regular_user, course):
    await _enroll(db, org, regular_user.id, course.id, "2026-09-01 10:00:00", status=StatusEnum.STATUS_COMPLETED)
    await _enroll(db, org, admin_user.id, course.id, "2026-09-02 10:00:00")
    db.add_all(
        [
            _author(admin_user.id, course.course_uuid, ResourceAuthorshipEnum.CREATOR),
            # Pending invitations and reporters don't count as teaching.
            _author(regular_user.id, course.course_uuid, ResourceAuthorshipEnum.CONTRIBUTOR, ResourceAuthorshipStatusEnum.PENDING),
            _author(regular_user.id, course.course_uuid, ResourceAuthorshipEnum.REPORTER),
            # A registry lecturer shows up even without courses yet.
            Instructor(
                org_id=org.id,
                user_id=regular_user.id,
                instructor_uuid="instructor_reg",
                department="AI",
                status=InstructorStatus.ACTIVE,
            ),
        ]
    )
    await db.commit()

    data = await get_home_overview(org.id, db, now=NOW)

    top = data["top_instructors"]
    assert [i["user"]["username"] for i in top] == [admin_user.username, regular_user.username]
    assert top[0] | {"user": None} == {
        "instructor_uuid": None,
        "department": None,
        "courses": 1,
        "enrollments": 2,
        "completions": 1,
        "user": None,
    }
    assert top[1]["instructor_uuid"] == "instructor_reg"
    assert top[1]["department"] == "AI"
    assert top[1]["courses"] == 0


async def test_home_overview_counts_submissions_to_grade(db, org, user_submission, graded_submission):
    data = await get_home_overview(org.id, db, now=NOW)
    # Only the submitted one waits for a grade; the graded one is done.
    assert data["attention"]["submissions_to_grade"] == 1
