"""
Service-level tests for the academic core: calendar, course catalog,
versioned curricula, course offerings, student records and enrollments.

The central guarantee under test is the single-source-of-truth model: a
catalog course is defined once and offered to many cohorts/terms without
being duplicated. Program-scoped RBAC (``check_resource_access``) is patched;
org-level admin checks run for real against the conftest org roles.
"""

import pytest
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlmodel import select

from src.db.academic.calendar import AcademicTermCreate, AcademicYearCreate, TermType
from src.db.academic.catalog import AcademicCourseCreate, PrerequisiteSet
from src.db.academic.cohorts import CohortCreate
from src.db.academic.curricula import (
    CurriculumClone,
    CurriculumCreate,
    CurriculumItemCreate,
    CurriculumRequirement,
    CurriculumStatus,
    CurriculumUpdate,
)
from src.db.academic.offerings import (
    CourseOffering,
    CourseOfferingCreate,
    EnrollmentStatus,
    MembershipStatus,
)
from src.db.academic.programs import ProgramCreate, ProgramLevel
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.services.academic import calendar as calendar_svc
from src.services.academic import catalog as catalog_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import curricula as curricula_svc
from src.services.academic import offerings as offerings_svc
from src.services.academic import programs as programs_svc
from src.services.academic import students as students_svc


@pytest.fixture
def bypass_program_rbac():
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, curricula_svc, offerings_svc, students_svc):
            stack.enter_context(patch.object(mod, "check_resource_access", new=AsyncMock()))
        yield


async def _calendar(db, org, user):
    year = await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026/2027"), user, db)
    fall = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.FALL), user, db
    )
    spring = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.SPRING), user, db
    )
    return year, fall, spring


async def _program_with_curriculum(db, org, user, request):
    program = await programs_svc.create_program(
        request, org.id, ProgramCreate(name="Master of AI", code="msc ai", program_level=ProgramLevel.MASTERS), user, db
    )
    ml = await catalog_svc.create_academic_course(
        org.id, AcademicCourseCreate(code="ai-501", name="Machine Learning", credits=3), user, db
    )
    nlp = await catalog_svc.create_academic_course(
        org.id, AcademicCourseCreate(code="AI-502", name="NLP", credits=3), user, db
    )
    elective = await catalog_svc.create_academic_course(
        org.id, AcademicCourseCreate(code="AI-590", name="Special Topics", credits=2, course_type="elective"), user, db
    )
    curriculum = await curricula_svc.create_curriculum(
        request, program.program_uuid, CurriculumCreate(version="2026.1"), user, db
    )
    for course, term_no, requirement in (
        (ml, 1, CurriculumRequirement.REQUIRED),
        (elective, 1, CurriculumRequirement.ELECTIVE),
        (nlp, 2, CurriculumRequirement.REQUIRED),
    ):
        await curricula_svc.add_curriculum_item(
            request,
            curriculum.curriculum_uuid,
            CurriculumItemCreate(academic_course_uuid=course.academic_course_uuid, term_no=term_no, requirement=requirement),
            user,
            db,
        )
    curriculum = await curricula_svc.update_curriculum(
        request, curriculum.curriculum_uuid, CurriculumUpdate(status=CurriculumStatus.ACTIVE), user, db
    )
    return program, curriculum, ml, nlp, elective


class TestCalendar:
    @pytest.mark.asyncio
    async def test_term_codes_are_generated(self, db, org, admin_user):
        _, fall, spring = await _calendar(db, org, admin_user)
        assert fall.code == "FALL-2026"
        assert spring.code == "SPRING-2027"

    @pytest.mark.asyncio
    async def test_invalid_and_duplicate_years(self, db, org, admin_user):
        with pytest.raises(HTTPException) as exc:
            await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026-2028"), admin_user, db)
        assert exc.value.status_code == 400
        await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026/2027"), admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026/2027"), admin_user, db)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_regular_user_cannot_manage_calendar(self, db, org, regular_user):
        with pytest.raises(HTTPException) as exc:
            await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2030/2031"), regular_user, db)
        assert exc.value.status_code == 403


class TestCatalog:
    @pytest.mark.asyncio
    async def test_codes_normalised_and_unique(self, db, org, admin_user):
        course = await catalog_svc.create_academic_course(
            org.id, AcademicCourseCreate(code="ai 501", name="Machine Learning", credits=3), admin_user, db
        )
        assert course.code == "AI-501"
        with pytest.raises(HTTPException) as exc:
            await catalog_svc.create_academic_course(
                org.id, AcademicCourseCreate(code="AI-501", name="Dup", credits=3), admin_user, db
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_prerequisite_cycles_rejected(self, db, org, admin_user):
        a = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="ST-101", name="Stats"), admin_user, db)
        b = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="ML-201", name="ML"), admin_user, db)
        updated = await catalog_svc.set_prerequisites(
            b.academic_course_uuid, [PrerequisiteSet(prerequisite_uuid=a.academic_course_uuid)], admin_user, db
        )
        assert [p.code for p in updated.prerequisites] == ["ST-101"]
        with pytest.raises(HTTPException) as exc:
            await catalog_svc.set_prerequisites(
                a.academic_course_uuid, [PrerequisiteSet(prerequisite_uuid=b.academic_course_uuid)], admin_user, db
            )
        assert exc.value.status_code == 409


class TestCurriculum:
    @pytest.mark.asyncio
    async def test_credits_and_version_freeze(self, db, org, admin_user, mock_request, bypass_program_rbac):
        program, curriculum, ml, *_ = await _program_with_curriculum(db, org, admin_user, mock_request)
        assert curriculum.required_credits == 6
        assert curriculum.elective_credits == 2

        # A cohort created now follows the active version automatically.
        cohort = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid, CohortCreate(name="Intake 2026", academic_year="2026/2027"), admin_user, db
        )
        assert cohort.curriculum_uuid == curriculum.curriculum_uuid
        assert cohort.code == "MSC-AI-2026"

        # The version is now frozen; changes go into a cloned version.
        with pytest.raises(HTTPException) as exc:
            await curricula_svc.remove_curriculum_item(
                mock_request, curriculum.curriculum_uuid, curriculum.items[0].curriculum_item_uuid, admin_user, db
            )
        assert exc.value.status_code == 409
        clone = await curricula_svc.clone_curriculum(
            mock_request, curriculum.curriculum_uuid, CurriculumClone(version="2027.1"), admin_user, db
        )
        assert clone.status == CurriculumStatus.DRAFT
        assert len(clone.items) == 3
        assert clone.cohort_count == 0


class TestOfferingsAndStudents:
    @pytest.mark.asyncio
    async def test_one_catalog_course_offered_to_two_cohorts(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        program, _, ml, _, _ = await _program_with_curriculum(db, org, admin_user, mock_request)
        _, fall, _ = await _calendar(db, org, admin_user)
        cohort_a = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid,
            CohortCreate(name="Intake A", intake_term_uuid=fall.term_uuid), admin_user, db,
        )
        cohort_b = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid,
            CohortCreate(name="Intake B", intake_term_uuid=fall.term_uuid), admin_user, db,
        )
        assert cohort_a.code == "MSC-AI-2026"
        assert cohort_b.code == "MSC-AI-2026-2"

        for cohort in (cohort_a, cohort_b):
            generated = await offerings_svc.generate_cohort_offerings(
                mock_request, cohort.cohort_uuid, fall.term_uuid, 1, 1, admin_user, db
            )
            assert {o.course_code for o in generated} == {"AI-501", "AI-590"}

        # Still exactly one catalog record; two offerings of it.
        course = await catalog_svc.get_academic_course(ml.academic_course_uuid, admin_user, db)
        assert course.offering_count == 2
        # Generation is idempotent.
        again = await offerings_svc.generate_cohort_offerings(
            mock_request, cohort_a.cohort_uuid, fall.term_uuid, 1, 1, admin_user, db
        )
        assert len(again) == 2
        assert course.offering_count == 2

    @pytest.mark.asyncio
    async def test_admission_auto_enrolls_required_and_access_follows_status(
        self, db, org, course, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        program, _, ml, _, _ = await _program_with_curriculum(db, org, admin_user, mock_request)
        _, fall, _ = await _calendar(db, org, admin_user)
        cohort = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid, CohortCreate(name="Intake", intake_term_uuid=fall.term_uuid), admin_user, db
        )
        offerings = await offerings_svc.generate_cohort_offerings(
            mock_request, cohort.cohort_uuid, fall.term_uuid, 1, 1, admin_user, db
        )
        ml_offering = next(o for o in offerings if o.course_code == "AI-501")
        # Attach an LMS content course to the ML offering.
        from src.db.academic.offerings import CourseOfferingUpdate

        await offerings_svc.update_offering(
            mock_request, ml_offering.offering_uuid, CourseOfferingUpdate(content_course_uuid=course.course_uuid), admin_user, db
        )

        student = await students_svc.add_student(
            mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db
        )
        assert student.student_number == "MSC-AI-2026-001"
        assert student.enrolled_offerings == 1  # required only, not the elective

        offering = (
            await db.execute(select(CourseOffering).where(CourseOffering.offering_uuid == ml_offering.offering_uuid))
        ).scalars().first()
        grant = (
            await db.execute(
                select(UserGroupResource).where(
                    UserGroupResource.usergroup_id == offering.usergroup_id,
                    UserGroupResource.resource_uuid == course.course_uuid,
                )
            )
        ).scalars().first()
        assert grant is not None

        async def on_roster() -> bool:
            row = (
                await db.execute(
                    select(UserGroupUser).where(
                        UserGroupUser.usergroup_id == offering.usergroup_id,
                        UserGroupUser.user_id == regular_user.id,
                    )
                )
            ).scalars().first()
            return row is not None

        assert await on_roster()
        # Suspension withdraws current registrations and revokes content access.
        await students_svc.update_student_status(
            mock_request, cohort.cohort_uuid, student.membership_uuid, MembershipStatus.SUSPENDED, admin_user, db
        )
        assert not await on_roster()
        roster = await offerings_svc.list_enrollments(mock_request, ml_offering.offering_uuid, admin_user, db)
        assert roster[0].status == EnrollmentStatus.WITHDRAWN

        # Re-registering restores access.
        await students_svc.update_student_status(
            mock_request, cohort.cohort_uuid, student.membership_uuid, MembershipStatus.ACTIVE, admin_user, db
        )
        await offerings_svc.update_enrollment(
            mock_request, ml_offering.offering_uuid, roster[0].enrollment_uuid, EnrollmentStatus.REGISTERED, admin_user, db
        )
        assert await on_roster()

    @pytest.mark.asyncio
    async def test_prerequisites_enforced_on_enrollment(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, fall, spring = await _calendar(db, org, admin_user)
        stats = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="ST-101", name="Stats"), admin_user, db)
        ml = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="ML-201", name="ML"), admin_user, db)
        await catalog_svc.set_prerequisites(
            ml.academic_course_uuid, [PrerequisiteSet(prerequisite_uuid=stats.academic_course_uuid)], admin_user, db
        )
        stats_off = await offerings_svc.create_offering(
            mock_request, org.id, CourseOfferingCreate(academic_course_uuid=stats.academic_course_uuid, term_uuid=fall.term_uuid), admin_user, db
        )
        ml_off = await offerings_svc.create_offering(
            mock_request, org.id, CourseOfferingCreate(academic_course_uuid=ml.academic_course_uuid, term_uuid=spring.term_uuid), admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await offerings_svc.create_enrollment(mock_request, ml_off.offering_uuid, regular_user.user_uuid, admin_user, db)
        assert exc.value.status_code == 409
        assert "ST-101" in exc.value.detail

        enrollment = await offerings_svc.create_enrollment(
            mock_request, stats_off.offering_uuid, regular_user.user_uuid, admin_user, db
        )
        await offerings_svc.update_enrollment(
            mock_request, stats_off.offering_uuid, enrollment.enrollment_uuid, EnrollmentStatus.COMPLETED, admin_user, db
        )
        ok = await offerings_svc.create_enrollment(mock_request, ml_off.offering_uuid, regular_user.user_uuid, admin_user, db)
        assert ok.status == EnrollmentStatus.REGISTERED

    @pytest.mark.asyncio
    async def test_deleting_offering_removes_roster_group(
        self, db, org, admin_user, mock_request, bypass_program_rbac
    ):
        _, fall, _ = await _calendar(db, org, admin_user)
        course = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="X-100", name="Xray"), admin_user, db)
        offering = await offerings_svc.create_offering(
            mock_request, org.id, CourseOfferingCreate(academic_course_uuid=course.academic_course_uuid, term_uuid=fall.term_uuid), admin_user, db
        )
        row = (
            await db.execute(select(CourseOffering).where(CourseOffering.offering_uuid == offering.offering_uuid))
        ).scalars().first()
        group_id = row.usergroup_id
        assert group_id is not None
        await offerings_svc.delete_offering(mock_request, offering.offering_uuid, admin_user, db)
        from src.db.usergroups import UserGroup

        assert await db.get(UserGroup, group_id) is None


class TestContentCourseReuse:
    """The offering's content course is a standard LMS course: staff get the
    usual course rights and students reach it once the offering opens."""

    @pytest.mark.asyncio
    async def test_open_publishes_and_staff_become_maintainers(
        self, db, org, course, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        from src.db.academic.offerings import CourseOfferingUpdate
        from src.db.courses.courses import Course
        from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum
        from src.services.finance.reporting import _course_program

        course.published = False
        was_public = course.public
        db.add(course)
        await db.commit()

        program, _, ml, _, _ = await _program_with_curriculum(db, org, admin_user, mock_request)
        _, fall, _ = await _calendar(db, org, admin_user)
        cohort = await cohorts_svc.create_cohort(
            mock_request, program.program_uuid, CohortCreate(name="Intake", intake_term_uuid=fall.term_uuid), admin_user, db
        )
        offering = await offerings_svc.create_offering(
            mock_request,
            org.id,
            CourseOfferingCreate(
                academic_course_uuid=ml.academic_course_uuid,
                term_uuid=fall.term_uuid,
                cohort_uuid=cohort.cohort_uuid,
                content_course_uuid=course.course_uuid,
                instructor_uuid=regular_user.user_uuid,
            ),
            admin_user,
            db,
        )

        author = (
            await db.execute(
                select(ResourceAuthor).where(
                    ResourceAuthor.resource_uuid == course.course_uuid,
                    ResourceAuthor.user_id == regular_user.id,
                )
            )
        ).scalars().first()
        assert author is not None and author.authorship == ResourceAuthorshipEnum.MAINTAINER

        # Planned: not yet visible to the roster.
        assert (await db.get(Course, course.id)).published is False
        await offerings_svc.update_offering(
            mock_request, offering.offering_uuid, CourseOfferingUpdate(status="open"), admin_user, db
        )
        refreshed = await db.get(Course, course.id)
        await db.refresh(refreshed)
        assert refreshed.published is True
        assert refreshed.public == was_public  # visibility unchanged; access stays roster-only

        # Finance recognises the content course as postgraduate.
        program_uuid, _, program_type = await _course_program(db, org.id, course.course_uuid)
        assert program_type == "postgraduate"
        assert program_uuid == program.program_uuid
