"""Lecture-scoped content access (courses organised by lectures).

Runs the real RBAC (no bypass): the admin edits everything, a lecture's
instructor edits only that lecture's chapters / activities / assignments, and
everyone else is refused.
"""
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select
from starlette.requests import Request

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.courses.activities import (
    Activity,
    ActivityCreate,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
    ActivityUpdate,
)
from src.db.courses.assignments import Assignment
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter, ChapterCreate, ChapterUpdate, ChapterUpdateOrder
from src.db.courses.course_chapters import CourseChapter
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.security.rbac import AccessAction
from src.services.courses import chapters as chapters_svc
from src.services.courses.activities import activities as activities_svc
from src.services.courses.activities import assignments as assignments_svc
from src.services.courses.lecture_access import (
    check_course_content_access,
    teaches_any_lecture,
    teaches_lecture,
)


def _req() -> Request:
    """A fresh request per call so the per-request RBAC memo never leaks between users."""
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""})


def _now() -> str:
    return str(datetime.now())


async def _member(db, org, role, user_id: int, name: str) -> PublicUser:
    db.add(User(
        id=user_id, username=name, first_name=name, last_name="T", email=f"{name}@test.com",
        password="x", user_uuid=f"user_{name}", creation_date=_now(), update_date=_now(),
    ))
    await db.commit()
    db.add(UserOrganization(user_id=user_id, org_id=org.id, role_id=role.id, creation_date=_now(), update_date=_now()))
    await db.commit()
    return PublicUser(id=user_id, username=name, first_name=name, last_name="T", email=f"{name}@test.com", user_uuid=f"user_{name}")


async def _chapter(db, org, course, lecture, chapter_id: int, order: int) -> Chapter:
    ch = Chapter(
        id=chapter_id, name=f"Chapter {chapter_id}", org_id=org.id, course_id=course.id,
        chapter_uuid=f"chapter_{chapter_id}", lecture_id=lecture.id if lecture else None,
        creation_date=_now(), update_date=_now(),
    )
    db.add(ch)
    await db.commit()
    db.add(CourseChapter(chapter_id=chapter_id, course_id=course.id, org_id=org.id, order=order, creation_date=_now(), update_date=_now()))
    await db.commit()
    return ch


async def _activity(db, org, course, chapter, activity_id: int, order: int = 1) -> Activity:
    a = Activity(
        id=activity_id, name=f"Activity {activity_id}", activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE, content={}, published=False,
        org_id=org.id, course_id=course.id, activity_uuid=f"activity_{activity_id}",
        creation_date=_now(), update_date=_now(),
    )
    db.add(a)
    await db.commit()
    db.add(ChapterActivity(order=order, chapter_id=chapter.id, activity_id=activity_id, course_id=course.id, org_id=org.id, creation_date=_now(), update_date=_now()))
    await db.commit()
    return a


@pytest.fixture
def quiet():
    """Webhooks / analytics / version snapshots are side effects, not under test."""
    with patch("src.services.webhooks.dispatch.dispatch_webhooks", new_callable=AsyncMock), \
         patch("src.services.analytics.analytics.track", new_callable=AsyncMock):
        yield


@pytest.fixture
async def setup(db, org, course, admin_user, regular_user, user_role):
    """Course organised by lectures: L1 taught by ``regular_user``, L2 by ``other``.

    Chapters: 11 and 12 in L1, 21 in L2, 31 outside any lecture.
    """
    other = await _member(db, org, user_role, 3, "other")
    outsider = await _member(db, org, user_role, 4, "outsider")
    profile = CourseAcademicProfile(
        course_id=course.id, org_id=org.id, organize_by_lectures=True,
        profile_uuid="courseprofile_test", creation_date=_now(), update_date=_now(),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    lectures = []
    for i, teacher in ((1, regular_user), (2, other)):
        lecture = CourseScheduleSession(
            profile_id=profile.id, org_id=org.id, title=f"Lecture {i}", instructor_id=teacher.id,
            order=i, session_uuid=f"session_l{i}", creation_date=_now(), update_date=_now(),
        )
        db.add(lecture)
        await db.commit()
        await db.refresh(lecture)
        lectures.append(lecture)
    l1, l2 = lectures
    ch11 = await _chapter(db, org, course, l1, 11, order=1)
    ch12 = await _chapter(db, org, course, l1, 12, order=4)
    ch21 = await _chapter(db, org, course, l2, 21, order=2)
    ch31 = await _chapter(db, org, course, None, 31, order=3)
    a1 = await _activity(db, org, course, ch11, 101)
    a2 = await _activity(db, org, course, ch12, 102)
    a3 = await _activity(db, org, course, ch21, 201)
    return {
        "course": course, "profile": profile, "l1": l1, "l2": l2,
        "teacher": regular_user, "other": other, "outsider": outsider, "admin": admin_user,
        "ch11": ch11, "ch12": ch12, "ch21": ch21, "ch31": ch31, "a1": a1, "a2": a2, "a3": a3,
    }


async def _denied(coro):
    with pytest.raises(HTTPException) as exc:
        await coro
    return exc.value.status_code


# ---------------------------------------------------------------------------
# The helper
# ---------------------------------------------------------------------------


class TestHelper:
    @pytest.mark.asyncio
    async def test_matrix(self, db, setup):
        s = setup
        check = lambda user, action, **kw: check_course_content_access(_req(), db, user, s["course"], action, **kw)  # noqa: E731
        # Course editors: everything.
        await check(s["admin"], AccessAction.UPDATE, chapter_id=s["ch21"].id)
        await check(s["admin"], AccessAction.UPDATE)
        # Lecture instructor: their lecture only.
        await check(s["teacher"], AccessAction.CREATE, lecture=s["l1"])
        await check(s["teacher"], AccessAction.UPDATE, chapter_id=s["ch12"].id)
        await check(s["teacher"], AccessAction.DELETE, activity_id=s["a1"].id)
        assert await _denied(check(s["teacher"], AccessAction.UPDATE, chapter_id=s["ch21"].id)) == 403
        assert await _denied(check(s["teacher"], AccessAction.UPDATE, activity_id=s["a3"].id)) == 403
        assert await _denied(check(s["teacher"], AccessAction.UPDATE, chapter_id=s["ch31"].id)) == 403
        assert await _denied(check(s["teacher"], AccessAction.UPDATE)) == 403  # course-level
        assert await _denied(check(s["outsider"], AccessAction.UPDATE, chapter_id=s["ch11"].id)) == 403

    @pytest.mark.asyncio
    async def test_only_courses_organised_by_lectures(self, db, setup):
        s = setup
        s["profile"].organize_by_lectures = False
        db.add(s["profile"])
        await db.commit()
        assert not await teaches_lecture(db, s["teacher"], s["course"], s["l1"])
        assert await _denied(check_course_content_access(
            _req(), db, s["teacher"], s["course"], AccessAction.UPDATE, chapter_id=s["ch11"].id
        )) == 403

    @pytest.mark.asyncio
    async def test_empty_lecture_instructor_means_course_instructor(self, db, setup):
        s = setup
        s["l2"].instructor_id = None
        s["profile"].instructor_id = s["outsider"].id
        db.add_all([s["l2"], s["profile"]])
        await db.commit()
        assert await teaches_lecture(db, s["outsider"], s["course"], s["l2"])
        assert not await teaches_lecture(db, s["other"], s["course"], s["l2"])

    @pytest.mark.asyncio
    async def test_leaving_the_organisation_ends_access(self, db, setup):
        s = setup
        membership = (await db.execute(select(UserOrganization).where(UserOrganization.user_id == s["teacher"].id))).scalars().first()
        await db.delete(membership)
        await db.commit()
        assert not await teaches_lecture(db, s["teacher"], s["course"], s["l1"])

    @pytest.mark.asyncio
    async def test_anonymous_and_lecture_of_another_course(self, db, setup, other_org):
        s = setup
        assert not await teaches_lecture(db, AnonymousUser(), s["course"], s["l1"])
        assert not await teaches_lecture(db, s["teacher"], s["course"], None)

    @pytest.mark.asyncio
    async def test_teaches_any_lecture(self, db, setup):
        s = setup
        assert await teaches_any_lecture(db, s["teacher"], s["course"])
        assert not await teaches_any_lecture(db, s["outsider"], s["course"])


# ---------------------------------------------------------------------------
# Chapters
# ---------------------------------------------------------------------------


class TestChapters:
    def _create(self, s, lecture_uuid=None, name="New"):
        return ChapterCreate(name=name, org_id=s["course"].org_id, course_id=s["course"].id, lecture_uuid=lecture_uuid)

    @pytest.mark.asyncio
    async def test_create_in_own_lecture_only(self, db, setup):
        s = setup
        created = await chapters_svc.create_chapter(_req(), self._create(s, "session_l1"), s["teacher"], db)
        assert created.lecture_uuid == "session_l1"
        row = await db.get(Chapter, created.id)
        assert row.lecture_id == s["l1"].id
        assert await _denied(chapters_svc.create_chapter(_req(), self._create(s, "session_l2"), s["teacher"], db)) == 403
        assert await _denied(chapters_svc.create_chapter(_req(), self._create(s, None), s["teacher"], db)) == 403
        # Admin may create anywhere, and outside lectures.
        await chapters_svc.create_chapter(_req(), self._create(s, "session_l2"), s["admin"], db)
        await chapters_svc.create_chapter(_req(), self._create(s, None), s["admin"], db)

    @pytest.mark.asyncio
    async def test_create_rejects_foreign_lecture_and_flat_courses(self, db, setup):
        s = setup
        assert await _denied(chapters_svc.create_chapter(_req(), self._create(s, "session_nope"), s["admin"], db)) == 400
        s["profile"].organize_by_lectures = False
        db.add(s["profile"])
        await db.commit()
        assert await _denied(chapters_svc.create_chapter(_req(), self._create(s, "session_l1"), s["admin"], db)) == 400

    @pytest.mark.asyncio
    async def test_update_and_move(self, db, setup):
        s = setup
        updated = await chapters_svc.update_chapter(_req(), ChapterUpdate(name="Renamed"), s["ch11"].id, s["teacher"], db)
        assert updated.name == "Renamed" and updated.lecture_uuid == "session_l1"
        assert await _denied(chapters_svc.update_chapter(_req(), ChapterUpdate(name="X"), s["ch21"].id, s["teacher"], db)) == 403
        # Moving into a lecture they do not teach, or out of every lecture: refused.
        assert await _denied(chapters_svc.update_chapter(_req(), ChapterUpdate(lecture_uuid="session_l2"), s["ch11"].id, s["teacher"], db)) == 403
        assert await _denied(chapters_svc.update_chapter(_req(), ChapterUpdate(lecture_uuid=""), s["ch11"].id, s["teacher"], db)) == 403
        assert (await db.get(Chapter, s["ch11"].id)).lecture_id == s["l1"].id
        # The admin moves it.
        moved = await chapters_svc.update_chapter(_req(), ChapterUpdate(lecture_uuid="session_l2"), s["ch11"].id, s["admin"], db)
        assert moved.lecture_uuid == "session_l2"
        cleared = await chapters_svc.update_chapter(_req(), ChapterUpdate(lecture_uuid=""), s["ch11"].id, s["admin"], db)
        assert cleared.lecture_uuid is None

    @pytest.mark.asyncio
    async def test_delete(self, db, setup):
        s = setup
        assert await _denied(chapters_svc.delete_chapter(_req(), s["ch21"].id, s["teacher"], db)) == 403
        await chapters_svc.delete_chapter(_req(), s["ch12"].id, s["teacher"], db)
        assert await db.get(Chapter, s["ch12"].id) is None

    @pytest.mark.asyncio
    async def test_course_outline_carries_lecture_uuids(self, db, setup):
        s = setup
        chapters = await chapters_svc.get_course_chapters(_req(), s["course"].id, db, s["admin"], True)
        by_id = {c.id: c.lecture_uuid for c in chapters}
        assert by_id == {11: "session_l1", 21: "session_l2", 31: None, 12: "session_l1"}

    @pytest.mark.asyncio
    async def test_deleting_a_lecture_keeps_its_chapters(self, db, setup):
        s = setup
        await db.delete(s["l2"])
        await db.commit()
        # SQLite does not enforce ON DELETE SET NULL; emulate the FK so the
        # read path is exercised the way PostgreSQL leaves it.
        ch = await db.get(Chapter, s["ch21"].id)
        ch.lecture_id = None
        db.add(ch)
        await db.commit()
        chapters = await chapters_svc.get_course_chapters(_req(), s["course"].id, db, s["admin"], True)
        assert {c.id: c.lecture_uuid for c in chapters}[21] is None


# ---------------------------------------------------------------------------
# Lecture reordering
# ---------------------------------------------------------------------------


class TestLectureReorder:
    def _order(self, *chapters):
        return ChapterUpdateOrder(chapter_order_by_ids=[
            {"chapter_id": cid, "activities_order_by_ids": [{"activity_id": a} for a in acts]} for cid, acts in chapters
        ])

    @pytest.mark.asyncio
    async def test_reorder_keeps_other_lectures_in_place(self, db, setup):
        s = setup
        # Swap L1's chapters (slots 1 and 4) and move activity 101 into chapter 12.
        await chapters_svc.reorder_lecture_content(
            _req(), s["course"].course_uuid, "session_l1", self._order((12, [101, 102]), (11, [])), s["teacher"], db
        )
        orders = dict((await db.execute(select(CourseChapter.chapter_id, CourseChapter.order))).all())
        assert orders == {12: 1, 21: 2, 31: 3, 11: 4}
        links = {ca.activity_id: (ca.chapter_id, ca.order) for ca in (await db.execute(select(ChapterActivity))).scalars().all()}
        assert links[101] == (12, 0) and links[102] == (12, 1) and links[201] == (21, 1)

    @pytest.mark.asyncio
    async def test_reorder_validation_and_access(self, db, setup):
        s = setup
        course_uuid = s["course"].course_uuid
        # Missing a chapter, smuggling another lecture's chapter or activity: 400.
        assert await _denied(chapters_svc.reorder_lecture_content(_req(), course_uuid, "session_l1", self._order((11, [101])), s["teacher"], db)) == 400
        assert await _denied(chapters_svc.reorder_lecture_content(_req(), course_uuid, "session_l1", self._order((11, [101]), (12, [102]), (21, [])), s["teacher"], db)) == 400
        assert await _denied(chapters_svc.reorder_lecture_content(_req(), course_uuid, "session_l1", self._order((11, [101, 201]), (12, [102])), s["teacher"], db)) == 400
        # Someone else's lecture: 403.
        assert await _denied(chapters_svc.reorder_lecture_content(_req(), course_uuid, "session_l2", self._order((21, [201])), s["teacher"], db)) == 403


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------


class TestActivities:
    def _new(self, chapter_id):
        return ActivityCreate(
            name="Slides", chapter_id=chapter_id, activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
            activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
        )

    @pytest.mark.asyncio
    async def test_create_update_delete(self, db, setup, quiet):
        s = setup
        created = await activities_svc.create_activity(_req(), self._new(s["ch11"].id), s["teacher"], db)
        assert created.name == "Slides"
        assert await _denied(activities_svc.create_activity(_req(), self._new(s["ch21"].id), s["teacher"], db)) == 403
        assert await _denied(activities_svc.create_activity(_req(), self._new(s["ch31"].id), s["teacher"], db)) == 403

        await activities_svc.update_activity(_req(), ActivityUpdate(name="Week 1"), "activity_101", s["teacher"], db)
        assert (await db.get(Activity, 101)).name == "Week 1"
        assert await _denied(activities_svc.update_activity(_req(), ActivityUpdate(name="X"), "activity_201", s["teacher"], db)) == 403

        assert await _denied(activities_svc.delete_activity(_req(), "activity_201", s["teacher"], db)) == 403
        await activities_svc.delete_activity(_req(), "activity_102", s["teacher"], db)
        assert await db.get(Activity, 102) is None
        # The other lecture's instructor gets the mirror image.
        await activities_svc.update_activity(_req(), ActivityUpdate(name="Mine"), "activity_201", s["other"], db)


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------


class TestAssignments:
    @pytest.mark.asyncio
    async def test_lecture_instructor_manages_and_grades_own_assignments(self, db, setup):
        s = setup
        course_uuid = s["course"].course_uuid
        own = Assignment(
            title="Quiz", description="", due_date="", published=False, grading_type="NUMERIC",
            org_id=s["course"].org_id, course_id=s["course"].id, chapter_id=s["ch11"].id, activity_id=101,
            assignment_uuid="assignment_own", creation_date=_now(), update_date=_now(),
        )
        db.add(own)
        await db.commit()
        await assignments_svc.authorize_assignment_access(
            _req(), db, s["teacher"], course_uuid, AccessAction.UPDATE, activity_id=101
        )
        assert await _denied(assignments_svc.authorize_assignment_access(
            _req(), db, s["teacher"], course_uuid, AccessAction.UPDATE, activity_id=201
        )) == 403
        # Without the assignment's activity the old course-wide rule applies.
        assert await _denied(assignments_svc.authorize_assignment_access(
            _req(), db, s["teacher"], course_uuid, AccessAction.UPDATE
        )) == 403
        assert await assignments_svc._is_assignment_instructor(_req(), s["teacher"], course_uuid, db, activity_id=101)
        assert not await assignments_svc._is_assignment_instructor(_req(), s["teacher"], course_uuid, db, activity_id=201)
        assert not await assignments_svc._is_assignment_instructor(_req(), s["outsider"], course_uuid, db, activity_id=101)


# ---------------------------------------------------------------------------
# Training programs switch lectures on
# ---------------------------------------------------------------------------


class TestTrainingProgramLink:
    @pytest.mark.asyncio
    async def test_linking_a_course_organises_it_by_lectures(self, db, org, course, admin_user):
        from src.db.academic.training_programs import TrainingProgram
        from src.services.academic import training_programs as tp_svc

        db.add(TrainingProgram(
            name="Bootcamp", org_id=org.id, trainingprogram_uuid="trainingprogram_x",
            creation_date=_now(), update_date=_now(),
        ))
        await db.commit()
        with patch.object(tp_svc, "check_resource_access", new=AsyncMock()), \
             patch("src.services.administration.audience.sync_resource_audience", new=AsyncMock()):
            await tp_svc.link_course_to_training_program(_req(), "trainingprogram_x", course.course_uuid, admin_user, db)
        profile = (await db.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id))).scalars().first()
        assert profile is not None and profile.organize_by_lectures is True
