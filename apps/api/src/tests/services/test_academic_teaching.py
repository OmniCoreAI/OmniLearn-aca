"""
Service tests for the lecturer workspace ("My Teaching"): the offerings a
lecturer teaches, what each viewer may do on an offering, the lecturer list
used to assign offerings, and interview panels evaluating applicants.
"""

import pytest
from contextlib import ExitStack
from datetime import datetime
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from src.db.academic.admissions import (
    ApplicantProfile,
    ApplicationCreate,
    ApplicationStatus,
    DecisionRequest,
    InterviewCreate,
    InterviewEvaluation,
    InterviewRecommendation,
    InterviewStatus,
)
from src.db.academic.calendar import AcademicTermCreate, AcademicYearCreate, TermType
from src.db.academic.catalog import AcademicCourseCreate
from src.db.academic.cohorts import CohortCreate, CohortUpdate
from src.db.academic.offerings import CourseOfferingCreate
from src.db.academic.programs import ProgramCreate, ProgramLevel
from src.db.instructors.instructors import Instructor, InstructorStatus
from src.security.rbac.nav_items import DEFAULT_VISIBILITY_BY_ROLE_UUID, ROLE_UUID_INSTRUCTOR
from src.services.academic import admissions as admissions_svc
from src.services.academic import calendar as calendar_svc
from src.services.academic import catalog as catalog_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import offerings as offerings_svc
from src.services.academic import programs as programs_svc


@pytest.fixture
def bypass_program_rbac():
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, admissions_svc):
            stack.enter_context(patch.object(mod, "check_resource_access", new=AsyncMock()))
        yield


async def _open_offerings(db, org, admin_user, request, instructor_uuid=None, ta_uuid=None):
    """Two open (cohort-less) offerings; only the first has teaching staff."""
    year = await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026/2027"), admin_user, db)
    fall = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.FALL), admin_user, db
    )
    ml = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="AI-501", name="ML"), admin_user, db)
    nlp = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="AI-502", name="NLP"), admin_user, db)
    taught = await offerings_svc.create_offering(
        request, org.id,
        CourseOfferingCreate(
            academic_course_uuid=ml.academic_course_uuid, term_uuid=fall.term_uuid,
            instructor_uuid=instructor_uuid, teaching_assistant_uuid=ta_uuid,
        ),
        admin_user, db,
    )
    other = await offerings_svc.create_offering(
        request, org.id,
        CourseOfferingCreate(academic_course_uuid=nlp.academic_course_uuid, term_uuid=fall.term_uuid),
        admin_user, db,
    )
    return taught, other


class TestMyTeaching:
    def test_instructors_see_the_teaching_workspace_by_default(self):
        assert "postgraduate-teaching" in DEFAULT_VISIBILITY_BY_ROLE_UUID[ROLE_UUID_INSTRUCTOR]
        # The full admin module stays hidden from lecturers.
        assert "postgraduate" not in DEFAULT_VISIBILITY_BY_ROLE_UUID[ROLE_UUID_INSTRUCTOR]

    @pytest.mark.asyncio
    async def test_my_offerings_lists_only_what_the_lecturer_teaches(self, db, org, admin_user, regular_user, mock_request):
        taught, _ = await _open_offerings(db, org, admin_user, mock_request, instructor_uuid=regular_user.user_uuid)
        mine = await offerings_svc.list_my_offerings(org.id, regular_user, db)
        assert [o.offering_uuid for o in mine] == [taught.offering_uuid]
        assert mine[0].viewer_teaches is True
        # The admin manages the offering but teaches nothing.
        assert await offerings_svc.list_my_offerings(org.id, admin_user, db) == []

    @pytest.mark.asyncio
    async def test_teaching_assistant_sees_the_offering(self, db, org, admin_user, regular_user, mock_request):
        taught, _ = await _open_offerings(db, org, admin_user, mock_request, ta_uuid=regular_user.user_uuid)
        mine = await offerings_svc.list_my_offerings(org.id, regular_user, db)
        assert [o.offering_uuid for o in mine] == [taught.offering_uuid]

    @pytest.mark.asyncio
    async def test_viewer_permissions_on_an_offering(self, db, org, admin_user, regular_user, mock_request):
        taught, _ = await _open_offerings(db, org, admin_user, mock_request, instructor_uuid=regular_user.user_uuid)
        as_lecturer = await offerings_svc.get_offering(mock_request, taught.offering_uuid, regular_user, db)
        assert as_lecturer.viewer_teaches is True and as_lecturer.viewer_can_manage is False
        as_admin = await offerings_svc.get_offering(mock_request, taught.offering_uuid, admin_user, db)
        assert as_admin.viewer_teaches is False and as_admin.viewer_can_manage is True

    @pytest.mark.asyncio
    async def test_lecturer_list_comes_from_the_active_registry(self, db, org, admin_user, regular_user):
        now = str(datetime.now())
        db.add(Instructor(
            org_id=org.id, user_id=regular_user.id, department="Computer Science", status=InstructorStatus.ACTIVE,
            instructor_uuid="instructor_active", creation_date=now, update_date=now,
        ))
        db.add(Instructor(
            org_id=org.id, user_id=admin_user.id, status=InstructorStatus.INACTIVE,
            instructor_uuid="instructor_inactive", creation_date=now, update_date=now,
        ))
        await db.commit()
        staff = await offerings_svc.list_teaching_staff(org.id, regular_user, db)
        assert [s.user.user_uuid for s in staff] == [regular_user.user_uuid]
        assert staff[0].department == "Computer Science"
        assert not hasattr(staff[0], "hourly_rate")


async def _application_in_review(db, org, admin_user, applicant, request):
    program = await programs_svc.create_program(
        request, org.id, ProgramCreate(name="MSc AI", code="MSC-AI", program_level=ProgramLevel.MASTERS), admin_user, db
    )
    cohort = await cohorts_svc.create_cohort(
        request, program.program_uuid, CohortCreate(name="Fall intake", academic_year="2026/2027"), admin_user, db
    )
    await cohorts_svc.update_cohort(request, cohort.cohort_uuid, CohortUpdate(admission_status="open"), admin_user, db)
    profile = ApplicantProfile(degree_level="bachelor", gpa=3.2, gpa_scale=4.0)
    app = await admissions_svc.create_application(
        request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid, profile=profile), applicant, db
    )
    await admissions_svc.submit_application(request, app.application_uuid, applicant, db)
    return await admissions_svc.start_review(request, app.application_uuid, admin_user, db)


class TestInterviewPanels:
    @pytest.mark.asyncio
    async def test_panel_member_lists_and_evaluates_their_interview(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        # The admin applies (as a staff member taking a second degree); the lecturer sits on the panel.
        app = await _application_in_review(db, org, admin_user, admin_user, mock_request)
        app = await admissions_svc.schedule_interview(
            mock_request, app.application_uuid,
            InterviewCreate(scheduled_at="2026-10-01T10:00", location="Room 4", panel_uuids=[regular_user.user_uuid]),
            admin_user, db,
        )
        mine = await admissions_svc.list_my_interviews(org.id, regular_user, db)
        assert len(mine) == 1 and mine[0].can_evaluate is True
        assert mine[0].profile.gpa == 3.2
        assert mine[0].application_number == app.application_number

        done = await admissions_svc.evaluate_interview(
            mine[0].interview_uuid,
            InterviewEvaluation(score=82, recommendation=InterviewRecommendation.ACCEPT, notes="Strong research fit"),
            regular_user, db,
        )
        assert done.status == InterviewStatus.COMPLETED and done.score == 82
        full = await admissions_svc.get_application(mock_request, app.application_uuid, admin_user, db)
        assert full.interviews[0].recommendation == InterviewRecommendation.ACCEPT
        assert full.events[-1].action == "interview_evaluated"

    @pytest.mark.asyncio
    async def test_only_panel_members_evaluate_and_only_while_in_review(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        app = await _application_in_review(db, org, admin_user, admin_user, mock_request)
        await admissions_svc.schedule_interview(
            mock_request, app.application_uuid, InterviewCreate(panel_uuids=[regular_user.user_uuid]), admin_user, db
        )
        interview_uuid = (await admissions_svc.list_my_interviews(org.id, regular_user, db))[0].interview_uuid
        evaluation = InterviewEvaluation(score=50, recommendation=InterviewRecommendation.REJECT)

        with pytest.raises(HTTPException) as exc:
            await admissions_svc.evaluate_interview(interview_uuid, evaluation, admin_user, db)  # not on the panel
        assert exc.value.status_code == 403

        await admissions_svc.decide(
            mock_request, app.application_uuid,
            DecisionRequest(decision=ApplicationStatus.REJECTED, note="Incomplete file"), admin_user, db,
        )
        mine = await admissions_svc.list_my_interviews(org.id, regular_user, db)
        assert mine[0].can_evaluate is False
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.evaluate_interview(interview_uuid, evaluation, regular_user, db)
        assert exc.value.status_code == 409
