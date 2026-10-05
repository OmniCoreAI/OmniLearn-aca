"""Graduate Studies Office overview: counts, the attention list and the setup checklist."""

from datetime import date

import pytest
from fastapi import HTTPException

from src.db.academic.admissions import ApplicantProfile, ApplicationCreate
from src.db.academic.calendar import AcademicTerm, TermType
from src.db.academic.cohorts import CohortCreate, CohortUpdate
from src.services.academic import admissions as admissions_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import offerings as offerings_svc
from src.services.academic import overview as overview_svc
from src.tests.services.test_academic_core import _calendar, _program_with_curriculum, bypass_program_rbac  # noqa: F401

PROFILE = ApplicantProfile(degree_level="bachelor", gpa=3.4, gpa_scale=4.0)


def _term(name, start, end, term_type=TermType.FALL):
    return AcademicTerm(name=name, start_date=start, end_date=end, term_type=term_type, code=name, org_id=1, academic_year_id=1)


class TestCurrentTerm:
    def test_named_term_beats_catch_all_and_dates_decide(self):
        today = date(2026, 10, 5)
        fall = _term("Fall 2026", "2026-09-15", "2027-01-20")
        whole_year = _term("2026", "2026-08-10", "2027-02-10", TermType.CUSTOM)
        spring = _term("Spring 2027", "2027-02-01", "2027-06-15", TermType.SPRING)
        assert overview_svc.pick_current_term([whole_year, spring, fall], today) is fall
        assert overview_svc.pick_current_term([spring], today) is None
        # Between terms only the catch-all applies.
        assert overview_svc.pick_current_term([fall, whole_year], date(2027, 1, 25)) is whole_year


class TestOverview:
    @pytest.mark.asyncio
    async def test_empty_org_has_nothing_set_up(self, db, org, admin_user):
        overview = await overview_svc.get_overview(org.id, admin_user, db)
        assert overview.current_term is None
        assert overview.attention == []
        assert [step.key for step in overview.setup] == [
            "calendar", "grading", "catalog", "program", "curriculum", "intake", "admissions", "offerings",
        ]
        assert not any(step.done for step in overview.setup)

    @pytest.mark.asyncio
    async def test_regular_user_cannot_read_overview(self, db, org, regular_user):
        with pytest.raises(HTTPException) as exc:
            await overview_svc.get_overview(org.id, regular_user, db)
        assert exc.value.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_counts_setup_and_attention(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):  # noqa: F811
        program, _, _, _, _ = await _program_with_curriculum(db, org, admin_user, mock_request)
        _, fall, _ = await _calendar(db, org, admin_user)
        cohort = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid, CohortCreate(name="Fall intake", intake_term_uuid=fall.term_uuid), admin_user, db
        )
        await cohorts_svc.update_cohort(mock_request, cohort.cohort_uuid, CohortUpdate(admission_status="open"), admin_user, db)
        await offerings_svc.generate_cohort_offerings(mock_request, cohort.cohort_uuid, fall.term_uuid, 1, 1, admin_user, db)
        app = await admissions_svc.create_application(
            mock_request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid, profile=PROFILE), regular_user, db
        )
        await admissions_svc.submit_application(mock_request, app.application_uuid, regular_user, db)

        overview = await overview_svc.get_overview(org.id, admin_user, db)

        assert overview.open_intakes == 1
        assert overview.applications == {"submitted": 1}
        # Generated offerings have no lecturer yet.
        assert overview.offerings_without_instructor == 2
        kinds = [item.kind for item in overview.attention]
        assert kinds[0] == "application_new"
        assert kinds.count("no_instructor") == 2
        new_app = overview.attention[0]
        assert new_app.uuid == app.application_uuid and new_app.subtitle.startswith(app.application_number)

        setup = {step.key: step for step in overview.setup}
        assert setup["program"].count == 1 and setup["curriculum"].count == 1
        assert setup["catalog"].count == 3 and setup["intake"].count == 1
        assert setup["admissions"].done and setup["offerings"].count == 2
        # No grade scale was created in this org.
        assert not setup["grading"].done
