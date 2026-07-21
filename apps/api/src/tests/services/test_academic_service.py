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

from src.db.academic.programs import (
    ProgramCreate,
    ProgramLevel,
    ProgramStatus,
    ProgramUpdate,
)
from src.db.academic.cohorts import CohortCreate, CohortUpdate
from src.db.academic.semesters import SemesterCreate
from src.db.academic.links import SemesterCourseUpdate
from src.db.academic.training_programs import (
    TrainingProgramCreate,
    TrainingType,
)
from src.db.academic.course_profiles import (
    CourseAcademicProfileUpsert,
    CourseAddOn,
    CourseOfferingStatus,
    CourseScheduleSessionCreate,
)

from src.services.academic import programs as programs_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import semesters as semesters_svc
from src.services.academic import training_programs as tp_svc
from src.services.academic import course_profiles as course_profiles_svc
from src.services.academic.authors import get_resource_authors


@pytest.fixture
def bypass_academic_rbac():
    """No-op ``check_resource_access`` across all academic service modules."""
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, semesters_svc, tp_svc, course_profiles_svc):
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
# Postgraduate program/cohort metadata, coordinator, validation, enrollment
# ---------------------------------------------------------------------------

class TestPostgraduateFields:
    @pytest.mark.asyncio
    async def test_program_metadata_and_coordinator(
        self, db, org, admin_user, regular_user, mock_request, bypass_academic_rbac
    ):
        created = await programs_svc.create_program(
            mock_request,
            org.id,
            ProgramCreate(
                name="MSc AI",
                code="AI700",
                program_level=ProgramLevel.MASTERS,
                status=ProgramStatus.ACTIVE,
                capacity=30,
                is_paid=True,
                price=1500.0,
                currency="USD",
                in_plan=False,
                coordinator_uuid=regular_user.user_uuid,
            ),
            admin_user,
            db,
        )
        assert created.status == ProgramStatus.ACTIVE
        assert created.capacity == 30
        assert created.is_paid is True and created.price == 1500.0 and created.currency == "USD"
        assert created.in_plan is False
        # Coordinator is embedded and granted MAINTAINER access.
        assert created.coordinator is not None
        assert created.coordinator.user_uuid == regular_user.user_uuid
        assert any(
            a.authorship == "MAINTAINER" and a.user.user_uuid == regular_user.user_uuid
            for a in created.authors
        )

    @pytest.mark.asyncio
    async def test_program_code_unique_per_org(
        self, db, org, admin_user, mock_request, bypass_academic_rbac
    ):
        await programs_svc.create_program(
            mock_request, org.id, ProgramCreate(name="One", code="DUP"), admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await programs_svc.create_program(
                mock_request, org.id, ProgramCreate(name="Two", code="DUP"), admin_user, db
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_paid_program_requires_price(
        self, db, org, admin_user, mock_request, bypass_academic_rbac
    ):
        with pytest.raises(HTTPException) as exc:
            await programs_svc.create_program(
                mock_request, org.id, ProgramCreate(name="Paid", is_paid=True), admin_user, db
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_illegal_status_transition_rejected(
        self, db, org, admin_user, mock_request, bypass_academic_rbac
    ):
        program = await programs_svc.create_program(
            mock_request, org.id, ProgramCreate(name="Lifecycle"), admin_user, db
        )
        # draft -> suspended is not allowed (only active/archived).
        with pytest.raises(HTTPException) as exc:
            await programs_svc.update_program(
                mock_request,
                program.program_uuid,
                ProgramUpdate(status=ProgramStatus.SUSPENDED),
                admin_user,
                db,
            )
        assert exc.value.status_code == 409
        # draft -> active is allowed.
        updated = await programs_svc.update_program(
            mock_request,
            program.program_uuid,
            ProgramUpdate(status=ProgramStatus.ACTIVE),
            admin_user,
            db,
        )
        assert updated.status == ProgramStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_cohort_metadata_and_validation(
        self, db, org, admin_user, regular_user, mock_request, bypass_academic_rbac
    ):
        program = await programs_svc.create_program(
            mock_request, org.id, ProgramCreate(name="PG"), admin_user, db
        )
        cohort = await cohorts_svc.create_cohort(
            mock_request,
            program.program_uuid,
            CohortCreate(
                name="2026 Intake",
                academic_year="2026/2027",
                capacity=2,
                coordinator_uuid=regular_user.user_uuid,
            ),
            admin_user,
            db,
        )
        assert cohort.academic_year == "2026/2027"
        assert cohort.capacity == 2
        assert cohort.coordinator is not None
        assert cohort.enrolled_count == 0

        # Bad academic year format is rejected.
        with pytest.raises(HTTPException) as exc:
            await cohorts_svc.update_cohort(
                mock_request,
                cohort.cohort_uuid,
                CohortUpdate(academic_year="not-a-year"),
                admin_user,
                db,
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_capacity_enforced_and_enrollment_lifecycle(
        self, db, org, admin_user, regular_user, mock_request, bypass_academic_rbac
    ):
        program = await programs_svc.create_program(
            mock_request, org.id, ProgramCreate(name="Cap"), admin_user, db
        )
        cohort = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid, CohortCreate(name="Small", capacity=1), admin_user, db
        )

        await cohorts_svc.enroll_user_in_cohort(
            mock_request, cohort.cohort_uuid, admin_user.id, admin_user, db
        )
        members = await cohorts_svc.get_cohort_members(
            mock_request, cohort.cohort_uuid, admin_user, db
        )
        assert len(members) == 1 and members[0].id == admin_user.id

        # Second enrollment exceeds capacity of 1.
        with pytest.raises(HTTPException) as exc:
            await cohorts_svc.enroll_user_in_cohort(
                mock_request, cohort.cohort_uuid, regular_user.id, admin_user, db
            )
        assert exc.value.status_code == 409

        # Unenroll frees the seat.
        await cohorts_svc.unenroll_user_from_cohort(
            mock_request, cohort.cohort_uuid, admin_user.id, admin_user, db
        )
        members_after = await cohorts_svc.get_cohort_members(
            mock_request, cohort.cohort_uuid, admin_user, db
        )
        assert len(members_after) == 0


# ---------------------------------------------------------------------------
# Course Academic Profile (1:1 course extension, shared across academic + TP)
# ---------------------------------------------------------------------------

class TestCourseAcademicProfile:
    @pytest.mark.asyncio
    async def test_upsert_get_and_instructor_authorship(
        self, db, org, course, admin_user, regular_user, mock_request, bypass_academic_rbac
    ):
        profile = await course_profiles_svc.upsert_course_academic_profile(
            mock_request,
            course.course_uuid,
            CourseAcademicProfileUpsert(
                credit_hours=6.0,
                capacity=25,
                status=CourseOfferingStatus.OPEN,
                classroom="Hall A",
                issues_certificate=True,
                instructor_uuid=regular_user.user_uuid,
                add_ons=[CourseAddOn(name="Snacks", price=5.0)],
            ),
            admin_user,
            db,
        )
        assert profile.credit_hours == 6.0
        assert profile.capacity == 25
        assert profile.status == CourseOfferingStatus.OPEN
        assert profile.classroom == "Hall A"
        assert profile.issues_certificate is True
        assert profile.instructor is not None
        assert profile.instructor.user_uuid == regular_user.user_uuid
        assert profile.add_ons and profile.add_ons[0].name == "Snacks"

        # Instructor is granted co-teacher (MAINTAINER) access on the course.
        authors = await get_resource_authors(db, course.course_uuid)
        assert any(
            a.authorship == "MAINTAINER" and a.user.user_uuid == regular_user.user_uuid
            for a in authors
        )

        # A second upsert updates in place (still 1:1).
        again = await course_profiles_svc.upsert_course_academic_profile(
            mock_request,
            course.course_uuid,
            CourseAcademicProfileUpsert(capacity=40),
            admin_user,
            db,
        )
        assert again.id == profile.id
        assert again.capacity == 40

        fetched = await course_profiles_svc.get_course_academic_profile(
            mock_request, course.course_uuid, admin_user, db
        )
        assert fetched is not None and fetched.capacity == 40

    @pytest.mark.asyncio
    async def test_negative_values_rejected(
        self, db, org, course, admin_user, mock_request, bypass_academic_rbac
    ):
        with pytest.raises(HTTPException) as exc:
            await course_profiles_svc.upsert_course_academic_profile(
                mock_request,
                course.course_uuid,
                CourseAcademicProfileUpsert(capacity=-1),
                admin_user,
                db,
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_sessions_crud(
        self, db, org, course, admin_user, mock_request, bypass_academic_rbac
    ):
        session = await course_profiles_svc.create_session(
            mock_request,
            course.course_uuid,
            CourseScheduleSessionCreate(title="Lecture 1", location="Room 3"),
            admin_user,
            db,
        )
        assert session.session_uuid.startswith("session_")

        sessions = await course_profiles_svc.list_sessions(
            mock_request, course.course_uuid, admin_user, db
        )
        assert len(sessions) == 1 and sessions[0].title == "Lecture 1"

        await course_profiles_svc.delete_session(
            mock_request, course.course_uuid, session.session_uuid, admin_user, db
        )
        assert await course_profiles_svc.list_sessions(
            mock_request, course.course_uuid, admin_user, db
        ) == []

    @pytest.mark.asyncio
    async def test_profile_embedded_in_semester_listing(
        self, db, org, course, admin_user, mock_request, bypass_academic_rbac
    ):
        _, _, semester = await _build_semester(db, org, admin_user, mock_request)
        await semesters_svc.link_course_to_semester(
            mock_request, semester.semester_uuid, course.course_uuid, admin_user, db
        )
        await course_profiles_svc.upsert_course_academic_profile(
            mock_request,
            course.course_uuid,
            CourseAcademicProfileUpsert(credit_hours=3.0, classroom="Lab 1"),
            admin_user,
            db,
        )
        courses = await semesters_svc.get_semester_courses(
            mock_request, semester.semester_uuid, admin_user, db
        )
        assert courses[0].academic_profile is not None
        assert courses[0].academic_profile.credit_hours == 3.0
        assert courses[0].academic_profile.classroom == "Lab 1"

    @pytest.mark.asyncio
    async def test_profile_embedded_in_training_listing(
        self, db, org, course, admin_user, mock_request, bypass_academic_rbac
    ):
        tp = await tp_svc.create_training_program(
            mock_request,
            org.id,
            TrainingProgramCreate(name="Bootcamp", training_type=TrainingType.BOOTCAMP),
            admin_user,
            db,
        )
        await tp_svc.link_course_to_training_program(
            mock_request, tp.trainingprogram_uuid, course.course_uuid, admin_user, db
        )
        await course_profiles_svc.upsert_course_academic_profile(
            mock_request,
            course.course_uuid,
            CourseAcademicProfileUpsert(status=CourseOfferingStatus.IN_PROGRESS),
            admin_user,
            db,
        )
        courses = await tp_svc.get_training_program_courses(
            mock_request, tp.trainingprogram_uuid, admin_user, db
        )
        assert courses[0].academic_profile is not None
        assert courses[0].academic_profile.status == CourseOfferingStatus.IN_PROGRESS


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
            mock_request, org.id, TrainingProgramCreate(name="TP A", training_type=TrainingType.EVENT), admin_user, db
        )
        tp_b = await tp_svc.create_training_program(
            mock_request, org.id, TrainingProgramCreate(name="TP B", training_type=TrainingType.SEMINAR), admin_user, db
        )
        await tp_svc.link_course_to_training_program(
            mock_request, tp_a.trainingprogram_uuid, course.course_uuid, admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await tp_svc.link_course_to_training_program(
                mock_request, tp_b.trainingprogram_uuid, course.course_uuid, admin_user, db
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_metadata_and_coordinator(
        self, db, org, admin_user, regular_user, mock_request, bypass_academic_rbac
    ):
        created = await tp_svc.create_training_program(
            mock_request,
            org.id,
            TrainingProgramCreate(
                name="Cloud Bootcamp",
                code="CB100",
                training_type=TrainingType.BOOTCAMP,
                capacity=25,
                is_paid=True,
                price=499.0,
                currency="USD",
                in_plan=False,
                coordinator_uuid=regular_user.user_uuid,
            ),
            admin_user,
            db,
        )
        assert created.code == "CB100"
        assert created.capacity == 25
        assert created.is_paid is True and created.price == 499.0 and created.currency == "USD"
        assert created.in_plan is False
        # Coordinator embedded and granted MAINTAINER access.
        assert created.coordinator is not None
        assert created.coordinator.user_uuid == regular_user.user_uuid
        assert any(
            a.authorship == "MAINTAINER" and a.user.user_uuid == regular_user.user_uuid
            for a in created.authors
        )

    @pytest.mark.asyncio
    async def test_code_unique_per_org(
        self, db, org, admin_user, mock_request, bypass_academic_rbac
    ):
        await tp_svc.create_training_program(
            mock_request, org.id, TrainingProgramCreate(name="One", code="TP-DUP"), admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await tp_svc.create_training_program(
                mock_request, org.id, TrainingProgramCreate(name="Two", code="TP-DUP"), admin_user, db
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_paid_requires_price(
        self, db, org, admin_user, mock_request, bypass_academic_rbac
    ):
        with pytest.raises(HTTPException) as exc:
            await tp_svc.create_training_program(
                mock_request, org.id, TrainingProgramCreate(name="Paid", is_paid=True), admin_user, db
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_set_coordinator_endpoint(
        self, db, org, admin_user, regular_user, mock_request, bypass_academic_rbac
    ):
        tp = await tp_svc.create_training_program(
            mock_request, org.id, TrainingProgramCreate(name="Seminar"), admin_user, db
        )
        assert tp.coordinator is None
        updated = await tp_svc.set_training_program_coordinator(
            mock_request, tp.trainingprogram_uuid, regular_user.user_uuid, admin_user, db
        )
        assert updated.coordinator is not None
        assert updated.coordinator.user_uuid == regular_user.user_uuid
        # Clearing with empty string removes it.
        cleared = await tp_svc.set_training_program_coordinator(
            mock_request, tp.trainingprogram_uuid, "", admin_user, db
        )
        assert cleared.coordinator is None
