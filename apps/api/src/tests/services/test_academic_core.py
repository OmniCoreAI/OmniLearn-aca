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
from src.services.academic import grading as grading_svc
from src.services.academic import offerings as offerings_svc
from src.services.academic import programs as programs_svc
from src.services.academic import students as students_svc
from src.tests.conftest import register_instructor


@pytest.fixture
def bypass_program_rbac():
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, curricula_svc, offerings_svc, students_svc, grading_svc):
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


async def _pass_through_gradebook(request, offering_uuid, user, db, score=80.0):
    """Record an official result the only supported way: a 100% component,
    scores, submission and approval."""
    from src.db.academic.grading import AssessmentComponentCreate, ScoreUpdate

    component = await grading_svc.create_component(
        request, offering_uuid, AssessmentComponentCreate(name="Final", weight=100, max_score=100), user, db
    )
    book = await grading_svc.get_gradebook(request, offering_uuid, user, db)
    await grading_svc.set_scores(
        request,
        offering_uuid,
        [ScoreUpdate(enrollment_uuid=r.enrollment_uuid, component_uuid=component.component_uuid, score=score) for r in book.rows],
        user,
        db,
    )
    await grading_svc.submit_grades(request, offering_uuid, None, user, db)
    return await grading_svc.approve_grades(request, offering_uuid, None, user, db)


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
        # Suspension needs a reason, withdraws current registrations and revokes content access.
        with pytest.raises(HTTPException) as exc:
            await students_svc.update_student_status(
                mock_request, cohort.cohort_uuid, student.membership_uuid, MembershipStatus.SUSPENDED, admin_user, db
            )
        assert exc.value.status_code == 400
        suspended = await students_svc.update_student_status(
            mock_request, cohort.cohort_uuid, student.membership_uuid, MembershipStatus.SUSPENDED, admin_user, db,
            reason="Unpaid fees",
        )
        assert suspended.status_reason == "Unpaid fees"
        assert not await on_roster()
        roster = await offerings_svc.list_enrollments(mock_request, ml_offering.offering_uuid, admin_user, db)
        assert roster[0].status == EnrollmentStatus.WITHDRAWN

        # Returning to active restores the registrations the suspension withdrew.
        await students_svc.update_student_status(
            mock_request, cohort.cohort_uuid, student.membership_uuid, MembershipStatus.ACTIVE, admin_user, db
        )
        roster = await offerings_svc.list_enrollments(mock_request, ml_offering.offering_uuid, admin_user, db)
        assert roster[0].status == EnrollmentStatus.REGISTERED
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

        await offerings_svc.create_enrollment(
            mock_request, stats_off.offering_uuid, regular_user.user_uuid, admin_user, db
        )
        await _pass_through_gradebook(mock_request, stats_off.offering_uuid, admin_user, db)
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
        await register_instructor(db, org.id, admin_user.id, regular_user.id)
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


async def _intake(db, org, admin_user, request):
    """Program + cohort + generated fall offerings (ML required, elective)."""
    program, _, ml, nlp, _ = await _program_with_curriculum(db, org, admin_user, request)
    _, fall, spring = await _calendar(db, org, admin_user)
    cohort = await cohorts_svc.create_cohort(
        request, program.program_uuid, CohortCreate(name="Intake", intake_term_uuid=fall.term_uuid), admin_user, db
    )
    offerings = await offerings_svc.generate_cohort_offerings(
        request, cohort.cohort_uuid, fall.term_uuid, 1, 1, admin_user, db
    )
    ml_offering = next(o for o in offerings if o.course_code == "AI-501")
    return program, cohort, ml_offering, fall, spring


async def _second_user(db, org, user_role):
    from datetime import datetime

    from src.db.user_organizations import UserOrganization
    from src.db.users import PublicUser, User

    u = User(
        id=3, username="second", first_name="Second", last_name="Trainee", email="second@test.com",
        password="x", user_uuid="user_second", creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    db.add(UserOrganization(
        user_id=u.id, org_id=org.id, role_id=user_role.id,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    await db.commit()
    return PublicUser(id=u.id, username=u.username, first_name=u.first_name, last_name=u.last_name,
                      email=u.email, user_uuid=u.user_uuid)


class TestFlowIntegrity:
    """Phase 0 fixes from the postgraduate flow review."""

    @pytest.mark.asyncio
    async def test_generation_never_revives_a_dropped_registration(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, cohort, ml_offering, fall, spring = await _intake(db, org, admin_user, mock_request)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        roster = await offerings_svc.list_enrollments(mock_request, ml_offering.offering_uuid, admin_user, db)
        await offerings_svc.update_enrollment(
            mock_request, ml_offering.offering_uuid, roster[0].enrollment_uuid, EnrollmentStatus.DROPPED, admin_user, db
        )
        # Generating the next term's offerings registers the cohort there...
        spring_offerings = await offerings_svc.generate_cohort_offerings(
            mock_request, cohort.cohort_uuid, spring.term_uuid, 1, 2, admin_user, db
        )
        spring_roster = await offerings_svc.list_enrollments(mock_request, spring_offerings[0].offering_uuid, admin_user, db)
        assert [e.status for e in spring_roster] == [EnrollmentStatus.REGISTERED]
        # ...but the dropped fall registration stays dropped.
        roster = await offerings_svc.list_enrollments(mock_request, ml_offering.offering_uuid, admin_user, db)
        assert roster[0].status == EnrollmentStatus.DROPPED

    @pytest.mark.asyncio
    async def test_readmitting_an_inactive_record_is_refused(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, cohort, _, _, _ = await _intake(db, org, admin_user, mock_request)
        student = await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        await students_svc.update_student_status(
            mock_request, cohort.cohort_uuid, student.membership_uuid, MembershipStatus.WITHDRAWN, admin_user, db,
            reason="Left the program",
        )
        with pytest.raises(HTTPException) as exc:
            await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        assert exc.value.status_code == 409 and "withdrawn" in exc.value.detail

    @pytest.mark.asyncio
    async def test_reactivation_respects_cohort_capacity(
        self, db, org, admin_user, regular_user, user_role, mock_request, bypass_program_rbac
    ):
        from src.db.academic.cohorts import CohortUpdate

        _, cohort, _, _, _ = await _intake(db, org, admin_user, mock_request)
        await cohorts_svc.update_cohort(mock_request, cohort.cohort_uuid, CohortUpdate(capacity=1), admin_user, db)
        first = await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        await students_svc.update_student_status(
            mock_request, cohort.cohort_uuid, first.membership_uuid, MembershipStatus.DEFERRED, admin_user, db,
            reason="Medical leave",
        )
        second = await _second_user(db, org, user_role)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, second.user_uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await students_svc.update_student_status(
                mock_request, cohort.cohort_uuid, first.membership_uuid, MembershipStatus.ACTIVE, admin_user, db
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_results_only_come_from_the_gradebook(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, cohort, ml_offering, _, _ = await _intake(db, org, admin_user, mock_request)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        roster = await offerings_svc.list_enrollments(mock_request, ml_offering.offering_uuid, admin_user, db)
        for status in (EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED):
            with pytest.raises(HTTPException) as exc:
                await offerings_svc.update_enrollment(
                    mock_request, ml_offering.offering_uuid, roster[0].enrollment_uuid, status, admin_user, db
                )
            assert exc.value.status_code == 409 and "gradebook" in exc.value.detail

    @pytest.mark.asyncio
    async def test_completing_requires_approved_grades_and_cancelling_revokes_access(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        from src.db.academic.offerings import CourseOfferingUpdate

        _, cohort, ml_offering, _, _ = await _intake(db, org, admin_user, mock_request)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        uuid = ml_offering.offering_uuid
        for status in ("open", "in_progress"):
            await offerings_svc.update_offering(mock_request, uuid, CourseOfferingUpdate(status=status), admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await offerings_svc.update_offering(mock_request, uuid, CourseOfferingUpdate(status="completed"), admin_user, db)
        assert exc.value.status_code == 409 and "approve" in exc.value.detail

        await offerings_svc.update_offering(mock_request, uuid, CourseOfferingUpdate(status="cancelled"), admin_user, db)
        roster = await offerings_svc.list_enrollments(mock_request, uuid, admin_user, db)
        assert roster[0].status == EnrollmentStatus.WITHDRAWN
        offering = (await db.execute(select(CourseOffering).where(CourseOffering.offering_uuid == uuid))).scalars().first()
        member = (
            await db.execute(select(UserGroupUser).where(UserGroupUser.usergroup_id == offering.usergroup_id))
        ).scalars().first()
        assert member is None

    @pytest.mark.asyncio
    async def test_completing_after_approval_is_allowed(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        from src.db.academic.offerings import CourseOfferingUpdate

        _, cohort, ml_offering, _, _ = await _intake(db, org, admin_user, mock_request)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        uuid = ml_offering.offering_uuid
        for status in ("open", "in_progress"):
            await offerings_svc.update_offering(mock_request, uuid, CourseOfferingUpdate(status=status), admin_user, db)
        await _pass_through_gradebook(mock_request, uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await offerings_svc.update_offering(mock_request, uuid, CourseOfferingUpdate(status="cancelled"), admin_user, db)
        assert exc.value.status_code == 409
        done = await offerings_svc.update_offering(mock_request, uuid, CourseOfferingUpdate(status="completed"), admin_user, db)
        assert done.status == "completed"

    @pytest.mark.asyncio
    async def test_prerequisite_minimum_grade_is_enforced(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, fall, spring = await _calendar(db, org, admin_user)
        stats = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="ST-101", name="Stats"), admin_user, db)
        ml = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="ML-201", name="ML"), admin_user, db)
        await catalog_svc.set_prerequisites(
            ml.academic_course_uuid,
            [PrerequisiteSet(prerequisite_uuid=stats.academic_course_uuid, min_grade="B")],
            admin_user,
            db,
        )
        stats_off = await offerings_svc.create_offering(
            mock_request, org.id, CourseOfferingCreate(academic_course_uuid=stats.academic_course_uuid, term_uuid=fall.term_uuid), admin_user, db
        )
        ml_off = await offerings_svc.create_offering(
            mock_request, org.id, CourseOfferingCreate(academic_course_uuid=ml.academic_course_uuid, term_uuid=spring.term_uuid), admin_user, db
        )
        await offerings_svc.create_enrollment(mock_request, stats_off.offering_uuid, regular_user.user_uuid, admin_user, db)
        await _pass_through_gradebook(mock_request, stats_off.offering_uuid, admin_user, db, score=65)  # C+: passed, below B
        with pytest.raises(HTTPException) as exc:
            await offerings_svc.create_enrollment(mock_request, ml_off.offering_uuid, regular_user.user_uuid, admin_user, db)
        assert exc.value.status_code == 409 and "ST-101 (min B)" in exc.value.detail

    @pytest.mark.asyncio
    async def test_replaced_instructor_loses_course_rights(
        self, db, org, course, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        await register_instructor(db, org.id, admin_user.id, regular_user.id)
        from src.db.academic.offerings import CourseOfferingUpdate
        from src.db.resource_authors import ResourceAuthor

        _, fall, _ = await _calendar(db, org, admin_user)
        catalog = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="X-100", name="Xray"), admin_user, db)
        offering = await offerings_svc.create_offering(
            mock_request, org.id,
            CourseOfferingCreate(
                academic_course_uuid=catalog.academic_course_uuid, term_uuid=fall.term_uuid,
                content_course_uuid=course.course_uuid, instructor_uuid=regular_user.user_uuid,
            ),
            admin_user, db,
        )

        async def is_author() -> bool:
            row = (
                await db.execute(
                    select(ResourceAuthor).where(
                        ResourceAuthor.resource_uuid == course.course_uuid, ResourceAuthor.user_id == regular_user.id
                    )
                )
            ).scalars().first()
            return row is not None

        assert await is_author()
        await offerings_svc.update_offering(
            mock_request, offering.offering_uuid, CourseOfferingUpdate(instructor_uuid=admin_user.user_uuid), admin_user, db
        )
        assert not await is_author()

    @pytest.mark.asyncio
    async def test_section_change_cannot_duplicate_an_offering(
        self, db, org, admin_user, mock_request, bypass_program_rbac
    ):
        from src.db.academic.offerings import CourseOfferingUpdate

        _, fall, _ = await _calendar(db, org, admin_user)
        catalog = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code="X-100", name="Xray"), admin_user, db)
        create = CourseOfferingCreate(academic_course_uuid=catalog.academic_course_uuid, term_uuid=fall.term_uuid)
        await offerings_svc.create_offering(mock_request, org.id, create, admin_user, db)
        b = await offerings_svc.create_offering(
            mock_request, org.id, create.model_copy(update={"section": "B"}), admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await offerings_svc.update_offering(mock_request, b.offering_uuid, CourseOfferingUpdate(section="a"), admin_user, db)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_cohort_and_program_with_results_cannot_be_deleted(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        program, cohort, ml_offering, _, _ = await _intake(db, org, admin_user, mock_request)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        await _pass_through_gradebook(mock_request, ml_offering.offering_uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await cohorts_svc.delete_cohort(mock_request, cohort.cohort_uuid, admin_user, db)
        assert exc.value.status_code == 409 and "archive the cohort" in exc.value.detail
        with pytest.raises(HTTPException) as exc:
            await programs_svc.delete_program(mock_request, program.program_uuid, admin_user, db)
        assert exc.value.status_code == 409 and "archive the program" in exc.value.detail

    @pytest.mark.asyncio
    async def test_cohort_without_history_can_still_be_deleted(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, cohort, _, _, _ = await _intake(db, org, admin_user, mock_request)
        await students_svc.add_student(mock_request, cohort.cohort_uuid, regular_user.user_uuid, admin_user, db)
        assert await cohorts_svc.delete_cohort(mock_request, cohort.cohort_uuid, admin_user, db) == "Cohort deleted"
