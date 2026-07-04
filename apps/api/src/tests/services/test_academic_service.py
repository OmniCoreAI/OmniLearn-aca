"""
Service-level tests for the Academic Management layer.

Covers CRUD across the postgraduate hierarchy (Program -> Cohort -> Semester),
Training Programs, and the Semester/TrainingProgram <-> Course linking that
reuses the EXISTING Course implementation (including the 1:N constraint and the
academic metadata carried on the link).

RBAC is exercised elsewhere (test_academic_rbac_coverage); here we patch
``check_resource_access`` in each academic service module so the tests focus on
the business logic and persistence.
"""

import pytest
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from src.db.academic.programs import ProgramCreate, ProgramLevel, ProgramUpdate
from src.db.academic.cohorts import CohortCreate
from src.db.academic.semesters import SemesterCreate
from src.db.academic.links import SemesterCourseUpdate
from src.db.academic.training_programs import TrainingProgramCreate, TrainingType

from src.services.academic import programs as programs_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import semesters as semesters_svc
from src.services.academic import training_programs as tp_svc


@pytest.fixture
def bypass_academic_rbac():
    """No-op ``check_resource_access`` across all academic service modules."""
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, semesters_svc, tp_svc):
            stack.enter_context(
                patch.object(mod, "check_resource_access", new=AsyncMock())
            )
        yield


# ---------------------------------------------------------------------------
# Program CRUD
# ---------------------------------------------------------------------------

class TestProgramCrud:
    @pytest.mark.asyncio
    async def test_create_get_update_delete(self, db, org, admin_user, mock_request, bypass_academic_rbac):
        created = await programs_svc.create_program(
            mock_request,
            org.id,
            ProgramCreate(name="MSc CS", program_level=ProgramLevel.MASTERS),
            admin_user,
            db,
        )
        assert created.program_uuid.startswith("program_")
        assert created.org_id == org.id
        # CREATOR authorship is attached (reuses ResourceAuthor).
        assert any(a.authorship == "CREATOR" for a in created.authors)

        fetched = await programs_svc.get_program(mock_request, created.program_uuid, admin_user, db)
        assert fetched.name == "MSc CS"

        updated = await programs_svc.update_program(
            mock_request,
            created.program_uuid,
            ProgramUpdate(name="MSc Computer Science", published=True),
            admin_user,
            db,
        )
        assert updated.name == "MSc Computer Science"
        assert updated.published is True

        msg = await programs_svc.delete_program(mock_request, created.program_uuid, admin_user, db)
        assert "deleted" in msg.lower()
        with pytest.raises(HTTPException) as exc:
            await programs_svc.get_program(mock_request, created.program_uuid, admin_user, db)
        assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Full hierarchy + course linking
# ---------------------------------------------------------------------------

async def _build_semester(db, org, admin_user, mock_request):
    program = await programs_svc.create_program(
        mock_request, org.id, ProgramCreate(name="PhD Physics", program_level=ProgramLevel.PHD), admin_user, db
    )
    cohort = await cohorts_svc.create_cohort(
        mock_request, program.program_uuid, CohortCreate(name="2026 Intake"), admin_user, db
    )
    semester = await semesters_svc.create_semester(
        mock_request, cohort.cohort_uuid, SemesterCreate(name="Semester 1", order=1), admin_user, db
    )
    return program, cohort, semester


class TestHierarchyAndLinking:
    @pytest.mark.asyncio
    async def test_cohort_creates_usergroup(self, db, org, admin_user, mock_request, bypass_academic_rbac):
        program = await programs_svc.create_program(
            mock_request, org.id, ProgramCreate(name="Dip Data", program_level=ProgramLevel.DIPLOMA), admin_user, db
        )
        cohort = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid, CohortCreate(name="Batch A"), admin_user, db
        )
        # The cohort auto-links to a UserGroup for enrollment/access.
        assert cohort.usergroup_id is not None

    @pytest.mark.asyncio
    async def test_link_and_list_courses(self, db, org, course, admin_user, mock_request, bypass_academic_rbac):
        _, _, semester = await _build_semester(db, org, admin_user, mock_request)

        msg = await semesters_svc.link_course_to_semester(
            mock_request,
            semester.semester_uuid,
            course.course_uuid,
            admin_user,
            db,
            order=1,
            code="PHY601",
            credit_hours=9.0,
        )
        assert "linked" in msg.lower()

        courses = await semesters_svc.get_semester_courses(
            mock_request, semester.semester_uuid, admin_user, db
        )
        assert len(courses) == 1
        assert courses[0].course_uuid == course.course_uuid
        # Academic metadata is carried on the link, not the Course.
        assert courses[0].code == "PHY601"
        assert courses[0].credit_hours == 9.0
        assert courses[0].academic_order == 1

        # Unlink removes the association but never touches the course itself.
        await semesters_svc.unlink_course_from_semester(
            mock_request, semester.semester_uuid, course.course_uuid, admin_user, db
        )
        courses_after = await semesters_svc.get_semester_courses(
            mock_request, semester.semester_uuid, admin_user, db
        )
        assert len(courses_after) == 0

    @pytest.mark.asyncio
    async def test_update_course_link_metadata(self, db, org, course, admin_user, mock_request, bypass_academic_rbac):
        _, _, semester = await _build_semester(db, org, admin_user, mock_request)
        await semesters_svc.link_course_to_semester(
            mock_request, semester.semester_uuid, course.course_uuid, admin_user, db
        )

        await semesters_svc.update_semester_course(
            mock_request,
            semester.semester_uuid,
            course.course_uuid,
            SemesterCourseUpdate(code="CS500", credit_hours=6.0, order=2),
            admin_user,
            db,
        )
        courses = await semesters_svc.get_semester_courses(
            mock_request, semester.semester_uuid, admin_user, db
        )
        assert courses[0].code == "CS500"
        assert courses[0].credit_hours == 6.0
        assert courses[0].academic_order == 2

    @pytest.mark.asyncio
    async def test_course_is_one_to_many(self, db, org, course, admin_user, mock_request, bypass_academic_rbac):
        program, cohort, semester_a = await _build_semester(db, org, admin_user, mock_request)
        semester_b = await semesters_svc.create_semester(
            mock_request, cohort.cohort_uuid, SemesterCreate(name="Semester 2", order=2), admin_user, db
        )

        await semesters_svc.link_course_to_semester(
            mock_request, semester_a.semester_uuid, course.course_uuid, admin_user, db
        )
        # A course may belong to at most one semester.
        with pytest.raises(HTTPException) as exc:
            await semesters_svc.link_course_to_semester(
                mock_request, semester_b.semester_uuid, course.course_uuid, admin_user, db
            )
        assert exc.value.status_code == 409


# ---------------------------------------------------------------------------
# Training Programs
# ---------------------------------------------------------------------------

class TestTrainingProgram:
    @pytest.mark.asyncio
    async def test_create_and_link_course(self, db, org, course, admin_user, mock_request, bypass_academic_rbac):
        tp = await tp_svc.create_training_program(
            mock_request,
            org.id,
            TrainingProgramCreate(name="K8s Workshop", training_type=TrainingType.WORKSHOP),
            admin_user,
            db,
        )
        assert tp.trainingprogram_uuid.startswith("trainingprogram_")

        await tp_svc.link_course_to_training_program(
            mock_request, tp.trainingprogram_uuid, course.course_uuid, admin_user, db
        )
        courses = await tp_svc.get_training_program_courses(
            mock_request, tp.trainingprogram_uuid, admin_user, db
        )
        assert len(courses) == 1
        assert courses[0].course_uuid == course.course_uuid

    @pytest.mark.asyncio
    async def test_course_one_to_many_enforced(self, db, org, course, admin_user, mock_request, bypass_academic_rbac):
        tp_a = await tp_svc.create_training_program(
            mock_request, org.id, TrainingProgramCreate(name="A", training_type=TrainingType.EVENT), admin_user, db
        )
        tp_b = await tp_svc.create_training_program(
            mock_request, org.id, TrainingProgramCreate(name="B", training_type=TrainingType.SEMINAR), admin_user, db
        )
        await tp_svc.link_course_to_training_program(
            mock_request, tp_a.trainingprogram_uuid, course.course_uuid, admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await tp_svc.link_course_to_training_program(
                mock_request, tp_b.trainingprogram_uuid, course.course_uuid, admin_user, db
            )
        assert exc.value.status_code == 409
