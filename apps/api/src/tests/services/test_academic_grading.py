"""
Service tests for Phase 2 — assessment & results: grade scales, weighted
components, gradebook (manual scores + sync from LMS assignments), the
submit / return / approve workflow, GPA and transcripts (retake rule).
"""

import pytest
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from src.db.academic.calendar import AcademicTermCreate, AcademicYearCreate, TermType
from src.db.academic.catalog import AcademicCourseCreate
from src.db.academic.cohorts import CohortCreate
from src.db.academic.grading import (
    AssessmentComponentCreate,
    AssessmentComponentUpdate,
    GradeBand,
    GradeScaleCreate,
    ScoreUpdate,
)
from src.db.academic.offerings import CourseOfferingCreate, CourseOfferingUpdate, EnrollmentStatus
from src.db.academic.programs import ProgramCreate, ProgramLevel, ProgramUpdate
from src.db.courses.assignments import (
    Assignment,
    AssignmentTask,
    AssignmentUserSubmission,
    AssignmentUserSubmissionStatus,
    GradingTypeEnum,
)
from src.services.academic import calendar as calendar_svc
from src.services.academic import catalog as catalog_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import grading as grading_svc
from src.services.academic import offerings as offerings_svc
from src.services.academic import programs as programs_svc
from src.services.academic import students as students_svc


@pytest.fixture
def bypass_program_rbac():
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, offerings_svc, students_svc, grading_svc):
            stack.enter_context(patch.object(mod, "check_resource_access", new=AsyncMock()))
        yield


async def _setup(db, org, admin_user, regular_user, request):
    """Program + cohort + a 3-credit offering with one admitted student."""
    year = await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026/2027"), admin_user, db)
    fall = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.FALL), admin_user, db
    )
    spring = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.SPRING), admin_user, db
    )
    program = await programs_svc.create_program(
        request, org.id, ProgramCreate(name="MSc AI", code="MSC-AI", program_level=ProgramLevel.MASTERS, min_credits=36),
        admin_user, db,
    )
    cohort = await cohorts_svc.create_cohort(
        request, program.program_uuid, CohortCreate(name="Intake", intake_term_uuid=fall.term_uuid), admin_user, db
    )
    course = await catalog_svc.create_academic_course(
        org.id, AcademicCourseCreate(code="AI-501", name="Machine Learning", credits=3), admin_user, db
    )
    student = await students_svc.add_student(request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
    offering = await offerings_svc.create_offering(
        request, org.id,
        CourseOfferingCreate(academic_course_uuid=course.academic_course_uuid, term_uuid=fall.term_uuid, cohort_uuid=cohort.cohort_uuid),
        admin_user, db,
    )
    await offerings_svc.create_enrollment(request, offering.offering_uuid, regular_user.user_uuid, admin_user, db)
    return program, cohort, course, student, offering, fall, spring


async def _scheme(request, offering_uuid, user, db, weights=(("Midterm", 40), ("Final exam", 60))):
    return [
        await grading_svc.create_component(
            request, offering_uuid, AssessmentComponentCreate(name=name, weight=weight, max_score=100), user, db
        )
        for name, weight in weights
    ]


async def _grade(request, offering_uuid, components, scores, user, db):
    book = await grading_svc.get_gradebook(request, offering_uuid, user, db)
    enrollment_uuid = book.rows[0].enrollment_uuid
    return await grading_svc.set_scores(
        request,
        offering_uuid,
        [ScoreUpdate(enrollment_uuid=enrollment_uuid, component_uuid=c.component_uuid, score=s) for c, s in zip(components, scores)],
        user,
        db,
    )


class TestGradeScales:
    @pytest.mark.asyncio
    async def test_default_scale_and_mapping(self, db, org, admin_user):
        scales = await grading_svc.list_grade_scales(org.id, admin_user, db)
        assert len(scales) == 1 and scales[0].is_default
        assert scales[0].pass_mark == 60
        bands = [b.model_dump() for b in scales[0].bands]
        assert grading_svc.grade_for(bands, 91) == ("A", 4.0, True)
        assert grading_svc.grade_for(bands, 77.5) == ("B", 3.0, True)
        assert grading_svc.grade_for(bands, 55) == ("D", 1.0, False)

    @pytest.mark.asyncio
    async def test_invalid_bands_rejected(self, db, org, admin_user):
        with pytest.raises(HTTPException) as exc:
            await grading_svc.create_grade_scale(
                org.id,
                GradeScaleCreate(name="Broken", bands=[GradeBand(letter="P", min_score=50, points=1)]),
                admin_user,
                db,
            )
        assert exc.value.status_code == 400  # lowest band must start at 0

    @pytest.mark.asyncio
    async def test_program_scale_is_used(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        program, _, _, _, offering, _, _ = await _setup(db, org, admin_user, regular_user, mock_request)
        pf = await grading_svc.create_grade_scale(
            org.id,
            GradeScaleCreate(
                name="Pass/Fail 70",
                bands=[GradeBand(letter="P", min_score=70, points=4, passing=True), GradeBand(letter="F", min_score=0, points=0, passing=False)],
            ),
            admin_user,
            db,
        )
        await programs_svc.update_program(
            mock_request, program.program_uuid, ProgramUpdate(grade_scale_uuid=pf.grade_scale_uuid), admin_user, db
        )
        book = await grading_svc.get_gradebook(mock_request, offering.offering_uuid, admin_user, db)
        assert book.scale.name == "Pass/Fail 70"


class TestGradebookWorkflow:
    @pytest.mark.asyncio
    async def test_weights_capped_at_100(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        *_, offering, _, _ = await _setup(db, org, admin_user, regular_user, mock_request)
        await _scheme(mock_request, offering.offering_uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await grading_svc.create_component(
                mock_request, offering.offering_uuid, AssessmentComponentCreate(name="Extra", weight=5), admin_user, db
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_submit_return_approve(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, _, _, student, offering, _, _ = await _setup(db, org, admin_user, regular_user, mock_request)
        components = await _scheme(mock_request, offering.offering_uuid, admin_user, db)

        # Incomplete scores cannot be submitted.
        await _grade(mock_request, offering.offering_uuid, components[:1], [80], admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await grading_svc.submit_grades(mock_request, offering.offering_uuid, None, admin_user, db)
        assert exc.value.status_code == 409

        book = await _grade(mock_request, offering.offering_uuid, components, [80, 75], admin_user, db)
        row = book.rows[0]
        assert row.complete and row.weighted_total == 77.0 and row.letter_grade == "B"

        book = await grading_svc.submit_grades(mock_request, offering.offering_uuid, "ready", admin_user, db)
        assert book.grade_status == "submitted"
        # Scheme and scores are locked while submitted.
        with pytest.raises(HTTPException):
            await grading_svc.update_component(
                mock_request, offering.offering_uuid, components[0].component_uuid,
                AssessmentComponentUpdate(weight=30), admin_user, db,
            )
        with pytest.raises(HTTPException):
            await grading_svc.return_grades(mock_request, offering.offering_uuid, "", admin_user, db)
        await grading_svc.return_grades(mock_request, offering.offering_uuid, "Check the final exam", admin_user, db)
        await _grade(mock_request, offering.offering_uuid, components[1:], [95], admin_user, db)
        await grading_svc.submit_grades(mock_request, offering.offering_uuid, None, admin_user, db)
        book = await grading_svc.approve_grades(mock_request, offering.offering_uuid, None, admin_user, db)
        assert book.grade_status == "approved"
        assert book.rows[0].enrollment_status == EnrollmentStatus.COMPLETED.value
        assert book.rows[0].letter_grade == "A-"  # 0.4*80 + 0.6*95 = 89

        transcript = await grading_svc.get_student_transcript(mock_request, student.membership_uuid, admin_user, db)
        assert transcript.credits_earned == 3 and transcript.cgpa == 3.7
        assert transcript.credits_remaining == 33
        assert transcript.terms[0].term_code == "FALL-2026"

    @pytest.mark.asyncio
    async def test_manual_result_blocked_with_scheme(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        *_, offering, _, _ = await _setup(db, org, admin_user, regular_user, mock_request)
        await _scheme(mock_request, offering.offering_uuid, admin_user, db)
        roster = await offerings_svc.list_enrollments(mock_request, offering.offering_uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await offerings_svc.update_enrollment(
                mock_request, offering.offering_uuid, roster[0].enrollment_uuid, EnrollmentStatus.COMPLETED, admin_user, db
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_retake_replaces_failed_attempt(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, course, student, offering, _, spring = await _setup(db, org, admin_user, regular_user, mock_request)
        components = await _scheme(mock_request, offering.offering_uuid, admin_user, db)
        await _grade(mock_request, offering.offering_uuid, components, [30, 40], admin_user, db)
        await grading_svc.submit_grades(mock_request, offering.offering_uuid, None, admin_user, db)
        book = await grading_svc.approve_grades(mock_request, offering.offering_uuid, None, admin_user, db)
        assert book.rows[0].enrollment_status == EnrollmentStatus.FAILED.value

        retake = await offerings_svc.create_offering(
            mock_request, org.id,
            CourseOfferingCreate(academic_course_uuid=course.academic_course_uuid, term_uuid=spring.term_uuid, cohort_uuid=cohort.cohort_uuid),
            admin_user, db,
        )
        await offerings_svc.create_enrollment(mock_request, retake.offering_uuid, regular_user.user_uuid, admin_user, db)
        components = await _scheme(mock_request, retake.offering_uuid, admin_user, db)
        await _grade(mock_request, retake.offering_uuid, components, [95, 92], admin_user, db)
        await grading_svc.submit_grades(mock_request, retake.offering_uuid, None, admin_user, db)
        await grading_svc.approve_grades(mock_request, retake.offering_uuid, None, admin_user, db)

        transcript = await grading_svc.get_student_transcript(mock_request, student.membership_uuid, admin_user, db)
        assert [t.term_code for t in transcript.terms] == ["FALL-2026", "SPRING-2027"]
        first = transcript.terms[0].courses[0]
        assert first.letter_grade == "F" and first.counted_in_gpa is False
        assert transcript.terms[0].term_gpa == 0.0
        assert transcript.cgpa == 4.0 and transcript.credits_attempted == 3 and transcript.credits_earned == 3


class TestSyncFromAssignments:
    @pytest.mark.asyncio
    async def test_sync_uses_graded_submissions_and_keeps_overrides(
        self, db, org, course, chapter, activity, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        *_, offering, _, _ = await _setup(db, org, admin_user, regular_user, mock_request)
        await offerings_svc.update_offering(
            mock_request, offering.offering_uuid, CourseOfferingUpdate(content_course_uuid=course.course_uuid), admin_user, db
        )
        assignment = Assignment(
            title="Quiz 1", description="", due_date="", grading_type=GradingTypeEnum.PERCENTAGE,
            org_id=org.id, course_id=course.id, chapter_id=chapter.id, activity_id=activity.id,
            assignment_uuid="assignment_quiz1", creation_date="", update_date="",
        )
        db.add(assignment)
        await db.flush()
        for i, max_value in enumerate((10, 30)):
            db.add(AssignmentTask(
                title=f"Q{i}", description="", hint="", assignment_type="QUIZ", contents={}, max_grade_value=max_value,
                assignment_task_uuid=f"assignmenttask_{i}", org_id=org.id, course_id=course.id,
                chapter_id=chapter.id, activity_id=activity.id, assignment_id=assignment.id,
                creation_date="", update_date="",
            ))
        db.add(AssignmentUserSubmission(
            assignment_id=assignment.id, user_id=regular_user.id, grade=30, attempt_number=1,
            submission_status=AssignmentUserSubmissionStatus.GRADED,
            assignmentusersubmission_uuid="assignmentusersubmission_1", creation_date="", update_date="",
        ))
        await db.commit()

        quiz = await grading_svc.create_component(
            mock_request, offering.offering_uuid,
            AssessmentComponentCreate(name="Quizzes", weight=20, max_score=20, source_assignments=["assignment_quiz1"]),
            admin_user, db,
        )
        book = await grading_svc.sync_scores(mock_request, offering.offering_uuid, admin_user, db)
        assert book.rows[0].cells[0].score == 15.0  # 30/40 = 75% of 20
        assert book.rows[0].cells[0].source == "auto"

        await _grade(mock_request, offering.offering_uuid, [quiz], [18], admin_user, db)
        book = await grading_svc.sync_scores(mock_request, offering.offering_uuid, admin_user, db)
        assert book.rows[0].cells[0].score == 18.0 and book.rows[0].cells[0].source == "manual"
