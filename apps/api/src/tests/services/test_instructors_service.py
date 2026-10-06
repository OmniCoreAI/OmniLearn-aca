"""Service-level tests for the Instructor Management + Finance module.

Covers:
- Instructor Category CRUD + the editable per-language rate table.
- Instructor as a 1:1 extension of a User (uniqueness per org).
- Effective-rate resolution (category-language wins, category base, instructor
  fallback).
- Finance work logs computing Hours x Rate, plus org summaries.
- Authorization: only superadmins / org admins / holders of the ``instructors``
  right may manage this data.
"""
import pytest
from fastapi import HTTPException

from src.db.instructors.instructors import (
    InstructorCategoryCreate,
    InstructorCategoryLanguageRateInput,
    InstructorCategoryUpdate,
    InstructorCreate,
    InstructorStatus,
    InstructorUpdate,
)
from src.db.instructors.finance import (
    InstructorWorkLogCreate,
    InstructorWorkLogUpdate,
)
from src.services.instructors import categories as cat_svc
from src.services.instructors import instructors as inst_svc
from src.services.instructors import finance as fin_svc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_category(db, admin_user, org, *, name="Senior Lecturer", base=100.0, rates=None):
    return await cat_svc.create_category(
        db,
        admin_user,
        org.id,
        InstructorCategoryCreate(
            name=name,
            description="desc",
            hourly_rate=base,
            currency="USD",
            language_rates=[
                InstructorCategoryLanguageRateInput(language=lang, hourly_rate=rate)
                for (lang, rate) in (rates or [])
            ],
        ),
    )


async def _make_instructor(db, admin_user, org, user, *, category_uuid=None, hourly_rate=None):
    return await inst_svc.create_instructor(
        db,
        admin_user,
        org.id,
        InstructorCreate(
            user_uuid=user.user_uuid,
            category_uuid=category_uuid,
            department="Physics",
            languages=["English", "Arabic"],
            contact_info={"phone": "+100"},
            hourly_rate=hourly_rate,
            status=InstructorStatus.ACTIVE,
        ),
    )


# ---------------------------------------------------------------------------
# Category CRUD + language rates
# ---------------------------------------------------------------------------


class TestInstructorCategory:
    @pytest.mark.asyncio
    async def test_create_with_language_rates(self, db, org, admin_user):
        cat = await _make_category(
            db, admin_user, org, rates=[("English", 100.0), ("Arabic", 120.0)]
        )
        assert cat.category_uuid.startswith("instructorcategory_")
        assert cat.hourly_rate == 100.0
        langs = {r.language: r.hourly_rate for r in cat.language_rates}
        assert langs == {"English": 100.0, "Arabic": 120.0}

    @pytest.mark.asyncio
    async def test_update_replaces_language_rates(self, db, org, admin_user):
        cat = await _make_category(db, admin_user, org, rates=[("English", 100.0)])
        updated = await cat_svc.update_category(
            db,
            admin_user,
            cat.category_uuid,
            InstructorCategoryUpdate(
                language_rates=[
                    InstructorCategoryLanguageRateInput(language="Arabic", hourly_rate=150.0),
                    InstructorCategoryLanguageRateInput(language="French", hourly_rate=140.0),
                ],
            ),
        )
        langs = {r.language: r.hourly_rate for r in updated.language_rates}
        assert langs == {"Arabic": 150.0, "French": 140.0}
        assert "English" not in langs

    @pytest.mark.asyncio
    async def test_negative_rate_rejected(self, db, org, admin_user):
        with pytest.raises(HTTPException) as exc:
            await _make_category(db, admin_user, org, base=-5.0)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_list_and_delete(self, db, org, admin_user):
        cat = await _make_category(db, admin_user, org)
        listed = await cat_svc.list_categories(db, admin_user, org.id)
        assert any(c.category_uuid == cat.category_uuid for c in listed)
        msg = await cat_svc.delete_category(db, admin_user, cat.category_uuid)
        assert "deleted" in msg.lower()


# ---------------------------------------------------------------------------
# Instructor CRUD (user extension)
# ---------------------------------------------------------------------------


class TestInstructor:
    @pytest.mark.asyncio
    async def test_create_extends_user(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org)
        inst = await _make_instructor(
            db, admin_user, org, regular_user, category_uuid=cat.category_uuid
        )
        assert inst.instructor_uuid.startswith("instructor_")
        assert inst.user_id == regular_user.id
        assert inst.user is not None and inst.user.user_uuid == regular_user.user_uuid
        assert inst.category is not None
        assert inst.department == "Physics"
        assert inst.status == InstructorStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_unique_per_org(self, db, org, admin_user, regular_user):
        await _make_instructor(db, admin_user, org, regular_user)
        with pytest.raises(HTTPException) as exc:
            await _make_instructor(db, admin_user, org, regular_user)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_update_instructor(self, db, org, admin_user, regular_user):
        inst = await _make_instructor(db, admin_user, org, regular_user)
        updated = await inst_svc.update_instructor(
            db,
            admin_user,
            inst.instructor_uuid,
            InstructorUpdate(department="Chemistry", status=InstructorStatus.ON_LEAVE),
        )
        assert updated.department == "Chemistry"
        assert updated.status == InstructorStatus.ON_LEAVE


# ---------------------------------------------------------------------------
# Rate resolution + Finance (Hours x Rate)
# ---------------------------------------------------------------------------


class TestFinance:
    @pytest.mark.asyncio
    async def test_language_rate_wins(self, db, org, admin_user, regular_user):
        cat = await _make_category(
            db, admin_user, org, base=100.0, rates=[("English", 100.0), ("Arabic", 120.0)]
        )
        inst = await _make_instructor(
            db, admin_user, org, regular_user, category_uuid=cat.category_uuid
        )
        preview = await fin_svc.compute_rate(db, admin_user, inst.instructor_uuid, 3, "Arabic")
        assert preview.rate_source == "category_language"
        assert preview.rate_applied == 120.0
        assert preview.amount == 360.0

    @pytest.mark.asyncio
    async def test_category_base_fallback(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org, base=90.0, rates=[("Arabic", 120.0)])
        inst = await _make_instructor(
            db, admin_user, org, regular_user, category_uuid=cat.category_uuid
        )
        # English has no explicit row -> falls back to the category base rate.
        preview = await fin_svc.compute_rate(db, admin_user, inst.instructor_uuid, 2, "English")
        assert preview.rate_source == "category_base"
        assert preview.rate_applied == 90.0
        assert preview.amount == 180.0

    @pytest.mark.asyncio
    async def test_instructor_fallback_when_no_category(self, db, org, admin_user, regular_user):
        inst = await _make_instructor(db, admin_user, org, regular_user, hourly_rate=75.0)
        preview = await fin_svc.compute_rate(db, admin_user, inst.instructor_uuid, 4, None)
        assert preview.rate_source == "instructor"
        assert preview.amount == 300.0

    @pytest.mark.asyncio
    async def test_no_rate_configured_errors(self, db, org, admin_user, regular_user):
        inst = await _make_instructor(db, admin_user, org, regular_user)
        with pytest.raises(HTTPException) as exc:
            await fin_svc.compute_rate(db, admin_user, inst.instructor_uuid, 1, None)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_worklog_computes_and_summarizes(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org, base=100.0, rates=[("Arabic", 120.0)])
        inst = await _make_instructor(
            db, admin_user, org, regular_user, category_uuid=cat.category_uuid
        )
        log = await fin_svc.create_worklog(
            db,
            admin_user,
            org.id,
            InstructorWorkLogCreate(
                instructor_uuid=inst.instructor_uuid,
                hours=3,
                language="Arabic",
                description="Lecture week 1",
            ),
        )
        assert log.rate_applied == 120.0
        assert log.amount == 360.0
        assert log.instructor_uuid == inst.instructor_uuid

        # Second entry at the base rate (English -> base 100).
        await fin_svc.create_worklog(
            db,
            admin_user,
            org.id,
            InstructorWorkLogCreate(
                instructor_uuid=inst.instructor_uuid, hours=2, language="English"
            ),
        )

        summary = await fin_svc.org_finance_summary(db, admin_user, org.id)
        assert summary.entry_count == 2
        assert summary.total_hours == 5.0
        assert summary.total_amount == 560.0  # 360 + 200
        assert len(summary.per_instructor) == 1
        assert summary.per_instructor[0].total_amount == 560.0

    @pytest.mark.asyncio
    async def test_worklog_update_recomputes(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org, base=100.0, rates=[("Arabic", 120.0)])
        inst = await _make_instructor(
            db, admin_user, org, regular_user, category_uuid=cat.category_uuid
        )
        log = await fin_svc.create_worklog(
            db,
            admin_user,
            org.id,
            InstructorWorkLogCreate(instructor_uuid=inst.instructor_uuid, hours=1, language="Arabic"),
        )
        assert log.amount == 120.0
        updated = await fin_svc.update_worklog(
            db, admin_user, log.worklog_uuid, InstructorWorkLogUpdate(hours=5)
        )
        assert updated.amount == 600.0

    @pytest.mark.asyncio
    async def test_zero_hours_rejected(self, db, org, admin_user, regular_user):
        inst = await _make_instructor(db, admin_user, org, regular_user, hourly_rate=50.0)
        with pytest.raises(HTTPException) as exc:
            await fin_svc.create_worklog(
                db,
                admin_user,
                org.id,
                InstructorWorkLogCreate(instructor_uuid=inst.instructor_uuid, hours=0),
            )
        assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


class TestInstructorAuthz:
    @pytest.mark.asyncio
    async def test_regular_user_cannot_manage(self, db, org, admin_user, regular_user):
        # A plain org member (user role) has no instructors right -> denied.
        with pytest.raises(HTTPException) as exc:
            await cat_svc.create_category(
                db,
                regular_user,
                org.id,
                InstructorCategoryCreate(name="Blocked", hourly_rate=10.0),
            )
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_regular_user_cannot_list(self, db, org, admin_user, regular_user):
        await _make_category(db, admin_user, org)
        with pytest.raises(HTTPException) as exc:
            await cat_svc.list_categories(db, regular_user, org.id)
        assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Administration & Configuration extensions (profiles, override, approval,
# new-user creation, pickers, course links)
# ---------------------------------------------------------------------------

from contextlib import ExitStack  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402

from sqlmodel import select  # noqa: E402

from src.db.academic.course_profiles import CourseAcademicProfile  # noqa: E402
from src.db.instructors.instructors import (  # noqa: E402
    InstructorApprove,
    InstructorNewUser,
)
from src.db.administration.lookups import ConfigStatus  # noqa: E402
from src.db.resource_authors import ResourceAuthor  # noqa: E402
from src.db.user_organizations import UserOrganization  # noqa: E402
from src.db.users import User  # noqa: E402


def _provisioning_patches():
    stack = ExitStack()
    for target in (
        "src.services.orgs.users.check_limits_with_usage",
        "src.services.orgs.users.increase_feature_usage",
        "src.services.orgs.users.track",
        "src.services.orgs.users.dispatch_webhooks",
    ):
        stack.enter_context(patch(target, new_callable=AsyncMock))
    return stack


class TestRateOverride:
    @pytest.mark.asyncio
    async def test_instructor_override_beats_category_rates(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org, base=500.0, rates=[("Arabic", 550.0)])
        inst = await _make_instructor(
            db, admin_user, org, regular_user, category_uuid=cat.category_uuid, hourly_rate=650.0
        )
        assert inst.effective_hourly_rate == 650.0
        assert inst.rate_source == "instructor"
        assert inst.rate_currency == "USD"  # currency follows the category
        preview = await fin_svc.compute_rate(db, admin_user, inst.instructor_uuid, 2, "Arabic")
        assert preview.rate_source == "instructor"
        assert preview.amount == 1300.0

        # Clearing the override falls back to the category.
        cleared = await inst_svc.update_instructor(
            db, admin_user, inst.instructor_uuid, InstructorUpdate(hourly_rate=None)
        )
        assert cleared.effective_hourly_rate == 500.0
        assert cleared.rate_source == "category_base"

    @pytest.mark.asyncio
    async def test_worklog_snapshot_survives_rate_change(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org, base=100.0)
        inst = await _make_instructor(db, admin_user, org, regular_user, category_uuid=cat.category_uuid)
        log = await fin_svc.create_worklog(
            db, admin_user, org.id, InstructorWorkLogCreate(instructor_uuid=inst.instructor_uuid, hours=1)
        )
        await inst_svc.update_instructor(db, admin_user, inst.instructor_uuid, InstructorUpdate(hourly_rate=999.0))
        logs = await fin_svc.list_worklogs(db, admin_user, org.id, None)
        assert [entry.amount for entry in logs if entry.worklog_uuid == log.worklog_uuid] == [100.0]


class TestInstructorProfiles:
    @pytest.mark.asyncio
    async def test_profile_fields_and_availability(self, db, org, admin_user, regular_user):
        inst = await _make_instructor(db, admin_user, org, regular_user)
        updated = await inst_svc.update_instructor(
            db,
            admin_user,
            inst.instructor_uuid,
            InstructorUpdate(
                bio="Aviation safety expert",
                specializations=["Safety", "CRM"],
                availability={"slots": [{"day": "sun", "start": "09:00", "end": "13:00"}], "notes": "AM only"},
            ),
        )
        assert updated.bio == "Aviation safety expert"
        assert updated.specializations == ["Safety", "CRM"]
        assert updated.availability["slots"][0]["day"] == "sun"

        for bad in (
            {"slots": [{"day": "funday", "start": "09:00", "end": "10:00"}]},
            {"slots": [{"day": "sun", "start": "13:00", "end": "09:00"}]},
            {"slots": [{"day": "sun", "start": "9am", "end": "10:00"}]},
        ):
            with pytest.raises(HTTPException) as exc:
                await inst_svc.update_instructor(
                    db, admin_user, inst.instructor_uuid, InstructorUpdate(availability=bad)
                )
            assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_with_new_user_account(self, db, org, admin_user, user_role):
        with _provisioning_patches():
            inst = await inst_svc.create_instructor(
                db,
                admin_user,
                org.id,
                InstructorCreate(
                    new_user=InstructorNewUser(
                        first_name="Ahmed", last_name="Mohamed", email="Ahmed.M@Example.com", phone="+2010"
                    ),
                    hourly_rate=650.0,
                ),
            )
        assert inst.temporary_password
        assert inst.user.first_name == "Ahmed"
        user = (await db.execute(select(User).where(User.email == "ahmed.m@example.com"))).scalars().first()
        assert user.must_change_password is True
        assert user.username.startswith("ahmed")
        assert user.extra_metadata == {"phone": "+2010"}
        membership = (
            await db.execute(select(UserOrganization).where(UserOrganization.user_id == user.id))
        ).scalars().first()
        assert membership.role_id == 3  # Instructor role

        # A second read never exposes the password again.
        again = await inst_svc.get_instructor(db, admin_user, inst.instructor_uuid)
        assert again.temporary_password is None

    @pytest.mark.asyncio
    async def test_create_rejects_both_or_neither_user(self, db, org, admin_user, regular_user):
        with pytest.raises(HTTPException) as exc:
            await inst_svc.create_instructor(
                db,
                admin_user,
                org.id,
                InstructorCreate(
                    user_uuid=regular_user.user_uuid,
                    new_user=InstructorNewUser(first_name="A", email="a@b.co"),
                ),
            )
        assert exc.value.status_code == 400
        with pytest.raises(HTTPException) as exc:
            await inst_svc.create_instructor(db, admin_user, org.id, InstructorCreate())
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_existing_user_must_be_member(self, db, org, other_org, admin_user):
        outsider = User(
            id=77,
            username="outsider",
            first_name="Out",
            last_name="Sider",
            email="out@x.com",
            password="x",
            user_uuid="user_outsider",
            creation_date="",
            update_date="",
        )
        db.add(outsider)
        await db.commit()
        with pytest.raises(HTTPException) as exc:
            await inst_svc.create_instructor(
                db, admin_user, org.id, InstructorCreate(user_uuid="user_outsider")
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_active_instructor_gets_instructor_role(self, db, org, admin_user, regular_user):
        await _make_instructor(db, admin_user, org, regular_user)
        membership = (
            await db.execute(select(UserOrganization).where(UserOrganization.user_id == regular_user.id))
        ).scalars().first()
        assert membership.role_id == 3


class TestApprovalAndPickers:
    @pytest.mark.asyncio
    async def test_pending_instructor_approval(self, db, org, admin_user, regular_user):
        cat = await _make_category(db, admin_user, org, base=300.0)
        inst = await inst_svc.create_instructor(
            db,
            admin_user,
            org.id,
            InstructorCreate(user_uuid=regular_user.user_uuid, status=InstructorStatus.PENDING_APPROVAL),
        )
        membership = (
            await db.execute(select(UserOrganization).where(UserOrganization.user_id == regular_user.id))
        ).scalars().first()
        assert membership.role_id == 4  # not promoted while pending

        # Pending instructors are hidden from pickers.
        options = await inst_svc.list_instructor_options(db, regular_user, org.id)
        assert options == []

        approved = await inst_svc.approve_instructor(
            db, admin_user, inst.instructor_uuid, InstructorApprove(category_uuid=cat.category_uuid)
        )
        assert approved.status == InstructorStatus.ACTIVE
        assert approved.effective_hourly_rate == 300.0
        await db.refresh(membership)
        assert membership.role_id == 3

        with pytest.raises(HTTPException) as exc:
            await inst_svc.approve_instructor(db, admin_user, inst.instructor_uuid, InstructorApprove())
        assert exc.value.status_code == 409

        options = await inst_svc.list_instructor_options(db, regular_user, org.id)
        assert [o.name for o in options] == ["Regular User"]
        assert not hasattr(options[0], "hourly_rate")

    @pytest.mark.asyncio
    async def test_regular_user_cannot_approve(self, db, org, admin_user, regular_user):
        inst = await inst_svc.create_instructor(
            db,
            admin_user,
            org.id,
            InstructorCreate(user_uuid=regular_user.user_uuid, status=InstructorStatus.PENDING_APPROVAL),
        )
        with pytest.raises(HTTPException) as exc:
            await inst_svc.approve_instructor(db, regular_user, inst.instructor_uuid, InstructorApprove())
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_category_status(self, db, org, admin_user):
        cat = await _make_category(db, admin_user, org)
        assert cat.status == ConfigStatus.ACTIVE
        updated = await cat_svc.update_category(
            db, admin_user, cat.category_uuid, InstructorCategoryUpdate(status=ConfigStatus.INACTIVE)
        )
        assert updated.status == ConfigStatus.INACTIVE


class TestInstructorCourses:
    @pytest.mark.asyncio
    async def test_list_counts_zero_without_courses(self, db, org, admin_user, regular_user):
        inst = await _make_instructor(db, admin_user, org, regular_user)
        listed = await inst_svc.list_instructors(db, admin_user, org.id)
        assert [(i.instructor_uuid, i.course_count) for i in listed] == [(inst.instructor_uuid, 0)]

    @pytest.mark.asyncio
    async def test_assign_list_unassign(self, db, org, admin_user, regular_user, course):
        inst = await _make_instructor(db, admin_user, org, regular_user)
        courses = await inst_svc.assign_instructor_course(db, admin_user, inst.instructor_uuid, course.course_uuid)
        assert [(c.course_uuid, c.source) for c in courses] == [(course.course_uuid, "profile")]

        profile = (
            await db.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id))
        ).scalars().first()
        assert profile.instructor_id == regular_user.id
        author = (
            await db.execute(
                select(ResourceAuthor).where(
                    ResourceAuthor.resource_uuid == course.course_uuid, ResourceAuthor.user_id == regular_user.id
                )
            )
        ).scalars().first()
        assert author is not None

        # The list read counts it once, even though it comes from two sources
        # (academic profile + authorship).
        listed = {i.instructor_uuid: i for i in await inst_svc.list_instructors(db, admin_user, org.id)}
        assert listed[inst.instructor_uuid].course_count == 1

        courses = await inst_svc.unassign_instructor_course(db, admin_user, inst.instructor_uuid, course.course_uuid)
        # Authorship is kept, so the course is still listed as co-authored.
        assert [(c.course_uuid, c.source) for c in courses] == [(course.course_uuid, "author")]
        await db.refresh(profile)
        assert profile.instructor_id is None

    @pytest.mark.asyncio
    async def test_my_assignments(self, db, org, admin_user, regular_user, course):
        from src.db.academic.training_programs import TrainingProgram
        from src.db.resource_authors import ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum

        inst = await _make_instructor(db, admin_user, org, regular_user)
        await inst_svc.assign_instructor_course(db, admin_user, inst.instructor_uuid, course.course_uuid)
        db.add(TrainingProgram(
            name="Coordinated", org_id=org.id, trainingprogram_uuid="trainingprogram_coord",
            coordinator_id=regular_user.id, creation_date="", update_date="",
        ))
        db.add(TrainingProgram(
            name="Other", org_id=org.id, trainingprogram_uuid="trainingprogram_other",
            creation_date="", update_date="",
        ))
        # A pending application is not an assignment.
        db.add(ResourceAuthor(
            resource_uuid="trainingprogram_other", user_id=regular_user.id,
            authorship=ResourceAuthorshipEnum.CONTRIBUTOR,
            authorship_status=ResourceAuthorshipStatusEnum.PENDING,
            creation_date="", update_date="",
        ))
        await db.commit()

        mine = await inst_svc.list_my_assignments(db, regular_user, org.id)
        assert [(c.course_uuid, c.source) for c in mine.courses] == [(course.course_uuid, "profile")]
        assert [(p.name, p.role) for p in mine.training_programs] == [("Coordinated", "coordinator")]

    @pytest.mark.asyncio
    async def test_assignments_cover_offerings_trainer_programs_and_sessions(
        self, db, org, admin_user, regular_user, course
    ):
        from src.db.academic.calendar import AcademicTerm, AcademicYear
        from src.db.academic.catalog import AcademicCourse
        from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
        from src.db.academic.links import TrainingProgramCourse
        from src.db.academic.offerings import CourseOffering
        from src.db.academic.training_programs import TrainingProgram

        inst = await _make_instructor(db, admin_user, org, regular_user)
        # Course instructor of a course that belongs to a training program → trainer.
        await inst_svc.assign_instructor_course(db, admin_user, inst.instructor_uuid, course.course_uuid)
        tp = TrainingProgram(name="Bootcamp", org_id=org.id, trainingprogram_uuid="trainingprogram_boot",
                             creation_date="", update_date="")
        db.add(tp)
        await db.commit()
        db.add(TrainingProgramCourse(training_program_id=tp.id, course_id=course.id, org_id=org.id))
        profile = (await db.execute(select(CourseAcademicProfile))).scalars().one()
        db.add_all([
            CourseScheduleSession(profile_id=profile.id, org_id=org.id, title="Upcoming", start_date="2999-01-01",
                                  session_uuid="session_next"),
            CourseScheduleSession(profile_id=profile.id, org_id=org.id, title="Past", start_date="2000-01-01",
                                  session_uuid="session_past"),
            # Taught by someone else: not theirs.
            CourseScheduleSession(profile_id=profile.id, org_id=org.id, title="Guest slot", start_date="2999-02-01",
                                  session_uuid="session_guest", instructor_id=admin_user.id),
        ])
        year = AcademicYear(name="2026/27", code="2026-27", org_id=org.id, academic_year_uuid="ay_x")
        db.add(year)
        await db.commit()
        term = AcademicTerm(name="Fall", code="FALL", org_id=org.id, academic_year_id=year.id, term_uuid="term_x")
        ac = AcademicCourse(code="AI-1", name="AI", org_id=org.id, academic_course_uuid="ac_x")
        db.add_all([term, ac])
        await db.commit()
        db.add(CourseOffering(org_id=org.id, academic_course_id=ac.id, term_id=term.id, section="A", code="AI-1-FALL-A",
                              teaching_assistant_id=regular_user.id, offering_uuid="offering_x"))
        await db.commit()

        mine = await inst_svc.list_instructor_assignments(db, admin_user, inst.instructor_uuid)
        assert [(p.name, p.role) for p in mine.training_programs] == [("Bootcamp", "trainer")]
        assert [(o.offering_uuid, o.role, o.term_code) for o in mine.offerings] == [("offering_x", "assistant", "FALL")]
        assert [(x.session_uuid, x.role) for x in mine.upcoming_sessions] == [("session_next", "course")]
        # The guest sees only their own slot, flagged as a guest session.
        guest = await inst_svc._assignments_for_user(db, admin_user.id, org.id)
        assert [(x.session_uuid, x.role) for x in guest.upcoming_sessions] == [("session_guest", "guest")]

    @pytest.mark.asyncio
    async def test_inactive_instructor_cannot_be_assigned(self, db, org, admin_user, regular_user, course):
        inst = await _make_instructor(db, admin_user, org, regular_user)
        await inst_svc.update_instructor(
            db, admin_user, inst.instructor_uuid, InstructorUpdate(status=InstructorStatus.INACTIVE)
        )
        with pytest.raises(HTTPException) as exc:
            await inst_svc.assign_instructor_course(db, admin_user, inst.instructor_uuid, course.course_uuid)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_course_must_belong_to_org(self, db, org, other_org, admin_user, regular_user):
        from src.db.courses.courses import Course

        foreign = Course(
            id=99,
            name="Foreign",
            description="",
            public=True,
            published=True,
            open_to_contributors=False,
            org_id=other_org.id,
            course_uuid="course_foreign",
            creation_date="",
            update_date="",
        )
        db.add(foreign)
        await db.commit()
        inst = await _make_instructor(db, admin_user, org, regular_user)
        with pytest.raises(HTTPException) as exc:
            await inst_svc.assign_instructor_course(db, admin_user, inst.instructor_uuid, "course_foreign")
        assert exc.value.status_code == 404
