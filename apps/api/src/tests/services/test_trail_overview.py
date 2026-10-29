"""Tests for the learner's own dashboard overview (src/services/trail/overview.py)."""

from datetime import datetime, timedelta

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.assignments import (
    Assignment,
    AssignmentUserSubmission,
    AssignmentUserSubmissionStatus,
    GradingTypeEnum,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail
from src.services.trail.overview import _streaks, get_learner_overview

NOW = datetime(2026, 10, 6, 15, 0, 0)


async def _add_video(db, org, course, chapter, *, id: int, order: int, published: bool = True) -> Activity:
    a = Activity(
        id=id,
        name=f"Lesson {id}",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        content={},
        published=published,
        org_id=org.id,
        course_id=course.id,
        activity_uuid=f"activity_{id}",
        creation_date=str(NOW),
        update_date=str(NOW),
    )
    db.add(a)
    db.add(
        ChapterActivity(
            order=order, chapter_id=chapter.id, activity_id=id, course_id=course.id, org_id=org.id,
            creation_date=str(NOW), update_date=str(NOW),
        )
    )
    await db.commit()
    return a


async def _enroll(db, org, course, user_id: int) -> TrailRun:
    trail = Trail(id=1, org_id=org.id, user_id=user_id, trail_uuid="trail_x", creation_date=str(NOW), update_date=str(NOW))
    db.add(trail)
    await db.commit()
    run = TrailRun(
        id=1, trail_id=trail.id, course_id=course.id, org_id=org.id, user_id=user_id,
        creation_date=str(NOW - timedelta(days=10)), update_date=str(NOW),
    )
    db.add(run)
    await db.commit()
    return run


async def _complete(db, org, course, run, activity_id: int, user_id: int, at: datetime):
    db.add(
        TrailStep(
            complete=True, teacher_verified=False, grade="", trailrun_id=run.id, trail_id=run.trail_id,
            activity_id=activity_id, course_id=course.id, org_id=org.id, user_id=user_id,
            creation_date=str(at), update_date=str(at),
        )
    )
    await db.commit()


class TestLearnerOverview:
    async def test_no_trail_returns_empty_overview(self, db, org, regular_user):
        overview = await get_learner_overview(regular_user.id, org.id, db, now=NOW)
        assert overview.courses == []
        assert overview.totals.courses == 0
        assert len(overview.days) == 90
        assert overview.days[-1].date == "2026-10-06"

    async def test_progress_next_lesson_and_activity(self, db, org, course, chapter, activity, regular_user):
        # `activity` (id 1, dynamic page, order 1) + three videos; lesson 3 is unpublished.
        await _add_video(db, org, course, chapter, id=2, order=2)
        await _add_video(db, org, course, chapter, id=3, order=3, published=False)
        await _add_video(db, org, course, chapter, id=4, order=4)
        run = await _enroll(db, org, course, regular_user.id)
        await _complete(db, org, course, run, 1, regular_user.id, NOW - timedelta(days=1))
        await _complete(db, org, course, run, 2, regular_user.id, NOW - timedelta(hours=2))

        overview = await get_learner_overview(regular_user.id, org.id, db, now=NOW)

        [c] = overview.courses
        assert (c.completed_lessons, c.total_lessons, c.progress, c.completed) == (2, 4, 50, False)
        # The unpublished lesson is skipped when picking what to do next.
        assert c.next_lesson is not None and c.next_lesson.activity_uuid == "activity_4"
        assert c.next_lesson.est_minutes == 12
        assert c.last_activity_at and c.last_activity_at.startswith("2026-10-06")

        t = overview.totals
        assert (t.courses, t.in_progress, t.lessons_completed, t.lessons_total) == (1, 1, 2, 4)
        assert t.learning_minutes == 8 + 12  # dynamic page + video
        assert t.streak_days == 2 and t.lessons_this_week == 2
        assert overview.days[-1].lessons == 1 and overview.days[-2].lessons == 1

        kinds = [e.kind for e in overview.recent]
        assert kinds[0] == "lesson_completed" and overview.recent[0].title == "Lesson 2"
        assert "course_started" in kinds

    async def test_assessments_are_the_learners_own(self, db, org, course, chapter, activity, regular_user, admin_user):
        run = await _enroll(db, org, course, regular_user.id)
        assignment = Assignment(
            id=1, title="Midterm", description="", due_date="2026-10-08", published=True,
            grading_type=GradingTypeEnum.PERCENTAGE, org_id=org.id, course_id=course.id,
            chapter_id=chapter.id, activity_id=activity.id, assignment_uuid="assignment_mid",
            creation_date=str(NOW), update_date=str(NOW),
        )
        db.add(assignment)
        await db.commit()
        for user_id, grade in ((regular_user.id, 80), (admin_user.id, 20)):
            db.add(
                AssignmentUserSubmission(
                    creation_date=str(NOW), update_date=str(NOW - timedelta(hours=1)),
                    assignmentusersubmission_uuid=f"sub_{user_id}", submission_status=AssignmentUserSubmissionStatus.GRADED,
                    grade=grade, user_id=user_id, assignment_id=assignment.id,
                )
            )
        await db.commit()
        assert run is not None

        overview = await get_learner_overview(regular_user.id, org.id, db, now=NOW)

        [a] = overview.assessments
        assert (a.status, a.grade) == ("GRADED", 80)
        assert overview.totals.average_score == 80
        assert overview.totals.assessments_completed == 1
        assert any(e.kind == "assessment_graded" and e.grade == 80 for e in overview.recent)


def test_streaks():
    today = NOW.date()
    days = {today - timedelta(days=i) for i in (1, 2, 3, 7, 8)}
    assert _streaks(days, today) == (3, 3)
    assert _streaks(set(), today) == (0, 0)
