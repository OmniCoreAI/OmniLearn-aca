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
