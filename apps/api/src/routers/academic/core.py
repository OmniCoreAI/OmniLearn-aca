"""Academic core API: calendar, course catalog, curricula, offerings and
student records. Paths are absolute (router mounted without a prefix)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.academic.calendar import (
    AcademicTermCreate,
    AcademicTermRead,
    AcademicTermUpdate,
    AcademicYearCreate,
    AcademicYearRead,
    AcademicYearUpdate,
)
from src.db.academic.catalog import (
    AcademicCourseCreate,
    AcademicCourseRead,
    AcademicCourseUpdate,
    PrerequisiteSet,
)
from src.db.academic.curricula import (
    CurriculumClone,
    CurriculumCreate,
    CurriculumItemCreate,
    CurriculumItemUpdate,
    CurriculumRead,
    CurriculumUpdate,
)
from src.db.academic.offerings import (
    CohortMembershipCreate,
    CohortMembershipRead,
    CohortMembershipUpdate,
    CourseOfferingCreate,
    CourseOfferingRead,
    CourseOfferingUpdate,
    EnrollmentCreate,
    EnrollmentRead,
    EnrollmentUpdate,
    MembershipStatus,
    OfferingSessionCreate,
    OfferingSessionRead,
    OfferingSessionUpdate,
    TeachingStaffRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.academic import calendar as calendar_svc
from src.services.academic import catalog as catalog_svc
from src.services.academic import curricula as curricula_svc
from src.services.academic import offerings as offerings_svc
from src.services.academic import students as students_svc

router = APIRouter()

Session = Depends(get_db_session)
User = Depends(get_current_user)


# ---------------------------------------------------------------------------
# Academic calendar
# ---------------------------------------------------------------------------

@router.get("/academic-years", response_model=List[AcademicYearRead], tags=["academic-calendar"])
async def api_list_academic_years(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await calendar_svc.list_academic_years(org_id, current_user, db_session)


@router.post("/academic-years", response_model=AcademicYearRead, tags=["academic-calendar"])
async def api_create_academic_year(
    org_id: int, data: AcademicYearCreate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await calendar_svc.create_academic_year(org_id, data, current_user, db_session)


@router.put("/academic-years/{academic_year_uuid}", response_model=AcademicYearRead, tags=["academic-calendar"])
async def api_update_academic_year(
    academic_year_uuid: str, data: AcademicYearUpdate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await calendar_svc.update_academic_year(academic_year_uuid, data, current_user, db_session)


@router.delete("/academic-years/{academic_year_uuid}", tags=["academic-calendar"])
async def api_delete_academic_year(
    academic_year_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await calendar_svc.delete_academic_year(academic_year_uuid, current_user, db_session)


@router.get("/terms", response_model=List[AcademicTermRead], tags=["academic-calendar"])
async def api_list_terms(
    org_id: int,
    academic_year_uuid: Optional[str] = None,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await calendar_svc.list_terms(org_id, current_user, db_session, academic_year_uuid)


@router.post("/terms", response_model=AcademicTermRead, tags=["academic-calendar"])
async def api_create_term(
    org_id: int, data: AcademicTermCreate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await calendar_svc.create_term(org_id, data, current_user, db_session)


@router.get("/terms/{term_uuid}", response_model=AcademicTermRead, tags=["academic-calendar"])
async def api_get_term(term_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await calendar_svc.get_term(term_uuid, current_user, db_session)


@router.put("/terms/{term_uuid}", response_model=AcademicTermRead, tags=["academic-calendar"])
async def api_update_term(
    term_uuid: str, data: AcademicTermUpdate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await calendar_svc.update_term(term_uuid, data, current_user, db_session)


@router.delete("/terms/{term_uuid}", tags=["academic-calendar"])
async def api_delete_term(term_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User) -> str:
    return await calendar_svc.delete_term(term_uuid, current_user, db_session)


# ---------------------------------------------------------------------------
# Course catalog
# ---------------------------------------------------------------------------

@router.get("/academic-courses", response_model=List[AcademicCourseRead], tags=["academic-catalog"])
async def api_list_academic_courses(
    org_id: int, q: Optional[str] = None, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await catalog_svc.list_academic_courses(org_id, current_user, db_session, q)


@router.post("/academic-courses", response_model=AcademicCourseRead, tags=["academic-catalog"])
async def api_create_academic_course(
    org_id: int, data: AcademicCourseCreate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await catalog_svc.create_academic_course(org_id, data, current_user, db_session)


@router.get("/academic-courses/{academic_course_uuid}", response_model=AcademicCourseRead, tags=["academic-catalog"])
async def api_get_academic_course(
    academic_course_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await catalog_svc.get_academic_course(academic_course_uuid, current_user, db_session)


@router.put("/academic-courses/{academic_course_uuid}", response_model=AcademicCourseRead, tags=["academic-catalog"])
async def api_update_academic_course(
    academic_course_uuid: str,
    data: AcademicCourseUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await catalog_svc.update_academic_course(academic_course_uuid, data, current_user, db_session)


@router.delete("/academic-courses/{academic_course_uuid}", tags=["academic-catalog"])
async def api_delete_academic_course(
    academic_course_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await catalog_svc.delete_academic_course(academic_course_uuid, current_user, db_session)


@router.put(
    "/academic-courses/{academic_course_uuid}/prerequisites",
    response_model=AcademicCourseRead,
    tags=["academic-catalog"],
)
async def api_set_prerequisites(
    academic_course_uuid: str,
    prerequisites: List[PrerequisiteSet],
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await catalog_svc.set_prerequisites(academic_course_uuid, prerequisites, current_user, db_session)


# ---------------------------------------------------------------------------
# Curricula
# ---------------------------------------------------------------------------

@router.get("/programs/{program_uuid}/curricula", response_model=List[CurriculumRead], tags=["academic-curricula"])
async def api_list_curricula(
    request: Request, program_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await curricula_svc.list_program_curricula(request, program_uuid, current_user, db_session)


@router.post("/programs/{program_uuid}/curricula", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_create_curriculum(
    request: Request,
    program_uuid: str,
    data: CurriculumCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await curricula_svc.create_curriculum(request, program_uuid, data, current_user, db_session)


@router.get("/curricula/{curriculum_uuid}", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_get_curriculum(
    request: Request, curriculum_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await curricula_svc.get_curriculum(request, curriculum_uuid, current_user, db_session)


@router.put("/curricula/{curriculum_uuid}", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_update_curriculum(
    request: Request,
    curriculum_uuid: str,
    data: CurriculumUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await curricula_svc.update_curriculum(request, curriculum_uuid, data, current_user, db_session)


@router.delete("/curricula/{curriculum_uuid}", tags=["academic-curricula"])
async def api_delete_curriculum(
    request: Request, curriculum_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await curricula_svc.delete_curriculum(request, curriculum_uuid, current_user, db_session)


@router.post("/curricula/{curriculum_uuid}/clone", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_clone_curriculum(
    request: Request,
    curriculum_uuid: str,
    data: CurriculumClone,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await curricula_svc.clone_curriculum(request, curriculum_uuid, data, current_user, db_session)


@router.post("/curricula/{curriculum_uuid}/items", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_add_curriculum_item(
    request: Request,
    curriculum_uuid: str,
    data: CurriculumItemCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await curricula_svc.add_curriculum_item(request, curriculum_uuid, data, current_user, db_session)


@router.put("/curricula/{curriculum_uuid}/items/{item_uuid}", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_update_curriculum_item(
    request: Request,
    curriculum_uuid: str,
    item_uuid: str,
    data: CurriculumItemUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await curricula_svc.update_curriculum_item(request, curriculum_uuid, item_uuid, data, current_user, db_session)


@router.delete("/curricula/{curriculum_uuid}/items/{item_uuid}", response_model=CurriculumRead, tags=["academic-curricula"])
async def api_remove_curriculum_item(
    request: Request,
    curriculum_uuid: str,
    item_uuid: str,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await curricula_svc.remove_curriculum_item(request, curriculum_uuid, item_uuid, current_user, db_session)


# ---------------------------------------------------------------------------
# Course offerings, sessions, enrollments
# ---------------------------------------------------------------------------

@router.get("/offerings", response_model=List[CourseOfferingRead], tags=["academic-offerings"])
async def api_list_offerings(
    org_id: int,
    term_uuid: Optional[str] = None,
    cohort_uuid: Optional[str] = None,
    academic_course_uuid: Optional[str] = None,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.list_offerings(
        org_id, current_user, db_session, term_uuid, cohort_uuid, academic_course_uuid
    )


@router.get("/offerings/mine", response_model=List[CourseOfferingRead], tags=["academic-offerings"])
async def api_my_offerings(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    """Offerings the caller teaches as instructor or teaching assistant."""
    return await offerings_svc.list_my_offerings(org_id, current_user, db_session)


@router.get("/academic-staff", response_model=List[TeachingStaffRead], tags=["academic-offerings"])
async def api_teaching_staff(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    """Active lecturers from the instructor registry (for assigning offerings)."""
    return await offerings_svc.list_teaching_staff(org_id, current_user, db_session)


@router.post("/offerings", response_model=CourseOfferingRead, tags=["academic-offerings"])
async def api_create_offering(
    request: Request,
    org_id: int,
    data: CourseOfferingCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.create_offering(request, org_id, data, current_user, db_session)


@router.get("/offerings/{offering_uuid}", response_model=CourseOfferingRead, tags=["academic-offerings"])
async def api_get_offering(
    request: Request, offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await offerings_svc.get_offering(request, offering_uuid, current_user, db_session)


@router.put("/offerings/{offering_uuid}", response_model=CourseOfferingRead, tags=["academic-offerings"])
async def api_update_offering(
    request: Request,
    offering_uuid: str,
    data: CourseOfferingUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.update_offering(request, offering_uuid, data, current_user, db_session)


@router.delete("/offerings/{offering_uuid}", tags=["academic-offerings"])
async def api_delete_offering(
    request: Request, offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await offerings_svc.delete_offering(request, offering_uuid, current_user, db_session)


@router.get("/offerings/{offering_uuid}/sessions", response_model=List[OfferingSessionRead], tags=["academic-offerings"])
async def api_list_sessions(offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await offerings_svc.list_sessions(offering_uuid, current_user, db_session)


@router.post("/offerings/{offering_uuid}/sessions", response_model=OfferingSessionRead, tags=["academic-offerings"])
async def api_create_session(
    request: Request,
    offering_uuid: str,
    data: OfferingSessionCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.create_session(request, offering_uuid, data, current_user, db_session)


@router.put(
    "/offerings/{offering_uuid}/sessions/{session_uuid}",
    response_model=OfferingSessionRead,
    tags=["academic-offerings"],
)
async def api_update_session(
    request: Request,
    offering_uuid: str,
    session_uuid: str,
    data: OfferingSessionUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.update_session(request, offering_uuid, session_uuid, data, current_user, db_session)


@router.delete("/offerings/{offering_uuid}/sessions/{session_uuid}", tags=["academic-offerings"])
async def api_delete_session(
    request: Request,
    offering_uuid: str,
    session_uuid: str,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
) -> str:
    return await offerings_svc.delete_session(request, offering_uuid, session_uuid, current_user, db_session)


@router.get("/offerings/{offering_uuid}/enrollments", response_model=List[EnrollmentRead], tags=["academic-offerings"])
async def api_list_enrollments(
    request: Request, offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await offerings_svc.list_enrollments(request, offering_uuid, current_user, db_session)


@router.post("/offerings/{offering_uuid}/enrollments", response_model=EnrollmentRead, tags=["academic-offerings"])
async def api_create_enrollment(
    request: Request,
    offering_uuid: str,
    data: EnrollmentCreate,
    override_prerequisites: bool = False,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.create_enrollment(
        request, offering_uuid, data.user_uuid, current_user, db_session, override_prerequisites
    )


@router.put(
    "/offerings/{offering_uuid}/enrollments/{enrollment_uuid}",
    response_model=EnrollmentRead,
    tags=["academic-offerings"],
)
async def api_update_enrollment(
    request: Request,
    offering_uuid: str,
    enrollment_uuid: str,
    data: EnrollmentUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.update_enrollment(
        request, offering_uuid, enrollment_uuid, data.status, current_user, db_session
    )


# ---------------------------------------------------------------------------
# Cohort students + curriculum-driven offering generation
# ---------------------------------------------------------------------------

class GenerateOfferingsRequest(BaseModel):
    term_uuid: str
    year_no: int = 1
    term_no: int = 1


@router.post(
    "/cohorts/{cohort_uuid}/generate-offerings",
    response_model=List[CourseOfferingRead],
    tags=["academic-offerings"],
)
async def api_generate_offerings(
    request: Request,
    cohort_uuid: str,
    data: GenerateOfferingsRequest,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await offerings_svc.generate_cohort_offerings(
        request, cohort_uuid, data.term_uuid, data.year_no, data.term_no, current_user, db_session
    )


@router.get("/cohorts/{cohort_uuid}/students", response_model=List[CohortMembershipRead], tags=["academic-students"])
async def api_list_cohort_students(
    request: Request, cohort_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await students_svc.list_cohort_students(request, cohort_uuid, current_user, db_session)


@router.post("/cohorts/{cohort_uuid}/students", response_model=CohortMembershipRead, tags=["academic-students"])
async def api_add_cohort_student(
    request: Request,
    cohort_uuid: str,
    data: CohortMembershipCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await students_svc.add_student(request, cohort_uuid, data.user_uuid, current_user, db_session)


@router.put(
    "/cohorts/{cohort_uuid}/students/{membership_uuid}",
    response_model=CohortMembershipRead,
    tags=["academic-students"],
)
async def api_update_cohort_student(
    request: Request,
    cohort_uuid: str,
    membership_uuid: str,
    data: CohortMembershipUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await students_svc.update_student_status(
        request, cohort_uuid, membership_uuid, data.status, current_user, db_session, reason=data.reason
    )


@router.delete("/cohorts/{cohort_uuid}/students/{membership_uuid}", tags=["academic-students"])
async def api_remove_cohort_student(
    request: Request,
    cohort_uuid: str,
    membership_uuid: str,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
) -> str:
    return await students_svc.remove_student(request, cohort_uuid, membership_uuid, current_user, db_session)


@router.get("/academic-students", response_model=List[CohortMembershipRead], tags=["academic-students"])
async def api_list_org_students(
    org_id: int,
    program_uuid: Optional[str] = None,
    status: Optional[MembershipStatus] = None,
    q: Optional[str] = None,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await students_svc.list_org_students(org_id, current_user, db_session, program_uuid, status, q)


@router.get("/academic-records/me", response_model=students_svc.MyAcademicRecord, tags=["academic-students"])
async def api_my_academic_record(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await students_svc.get_my_record(org_id, current_user, db_session)


# ---------------------------------------------------------------------------
# Assessment & results (Phase 2)
# ---------------------------------------------------------------------------

from src.db.academic.grading import (  # noqa: E402
    AssessmentComponentCreate,
    AssessmentComponentRead,
    AssessmentComponentUpdate,
    GradebookRead,
    GradeDecision,
    GradeScaleCreate,
    GradeScaleRead,
    GradeScaleUpdate,
    ScoreUpdate,
    Transcript,
)
from src.services.academic import grading as grading_svc  # noqa: E402


@router.get("/grade-scales", response_model=List[GradeScaleRead], tags=["academic-grading"])
async def api_list_grade_scales(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await grading_svc.list_grade_scales(org_id, current_user, db_session)


@router.post("/grade-scales", response_model=GradeScaleRead, tags=["academic-grading"])
async def api_create_grade_scale(
    org_id: int, data: GradeScaleCreate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await grading_svc.create_grade_scale(org_id, data, current_user, db_session)


@router.put("/grade-scales/{grade_scale_uuid}", response_model=GradeScaleRead, tags=["academic-grading"])
async def api_update_grade_scale(
    grade_scale_uuid: str, data: GradeScaleUpdate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await grading_svc.update_grade_scale(grade_scale_uuid, data, current_user, db_session)


@router.delete("/grade-scales/{grade_scale_uuid}", tags=["academic-grading"])
async def api_delete_grade_scale(
    grade_scale_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await grading_svc.delete_grade_scale(grade_scale_uuid, current_user, db_session)


@router.get(
    "/offerings/{offering_uuid}/components", response_model=List[AssessmentComponentRead], tags=["academic-grading"]
)
async def api_list_components(
    request: Request, offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await grading_svc.list_components(request, offering_uuid, current_user, db_session)


@router.post("/offerings/{offering_uuid}/components", response_model=AssessmentComponentRead, tags=["academic-grading"])
async def api_create_component(
    request: Request,
    offering_uuid: str,
    data: AssessmentComponentCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await grading_svc.create_component(request, offering_uuid, data, current_user, db_session)


@router.put(
    "/offerings/{offering_uuid}/components/{component_uuid}",
    response_model=AssessmentComponentRead,
    tags=["academic-grading"],
)
async def api_update_component(
    request: Request,
    offering_uuid: str,
    component_uuid: str,
    data: AssessmentComponentUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await grading_svc.update_component(request, offering_uuid, component_uuid, data, current_user, db_session)


@router.delete("/offerings/{offering_uuid}/components/{component_uuid}", tags=["academic-grading"])
async def api_delete_component(
    request: Request,
    offering_uuid: str,
    component_uuid: str,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
) -> str:
    return await grading_svc.delete_component(request, offering_uuid, component_uuid, current_user, db_session)


@router.get("/offerings/{offering_uuid}/gradebook", response_model=GradebookRead, tags=["academic-grading"])
async def api_get_gradebook(
    request: Request, offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await grading_svc.get_gradebook(request, offering_uuid, current_user, db_session)


@router.post("/offerings/{offering_uuid}/gradebook/sync", response_model=GradebookRead, tags=["academic-grading"])
async def api_sync_gradebook(
    request: Request, offering_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await grading_svc.sync_scores(request, offering_uuid, current_user, db_session)


@router.put("/offerings/{offering_uuid}/gradebook/scores", response_model=GradebookRead, tags=["academic-grading"])
async def api_set_scores(
    request: Request,
    offering_uuid: str,
    updates: List[ScoreUpdate],
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await grading_svc.set_scores(request, offering_uuid, updates, current_user, db_session)


@router.post("/offerings/{offering_uuid}/grades/submit", response_model=GradebookRead, tags=["academic-grading"])
async def api_submit_grades(
    request: Request,
    offering_uuid: str,
    data: GradeDecision,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await grading_svc.submit_grades(request, offering_uuid, data.note, current_user, db_session)


@router.post("/offerings/{offering_uuid}/grades/approve", response_model=GradebookRead, tags=["academic-grading"])
async def api_approve_grades(
    request: Request,
    offering_uuid: str,
    data: GradeDecision,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await grading_svc.approve_grades(request, offering_uuid, data.note, current_user, db_session)


@router.post("/offerings/{offering_uuid}/grades/return", response_model=GradebookRead, tags=["academic-grading"])
async def api_return_grades(
    request: Request,
    offering_uuid: str,
    data: GradeDecision,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await grading_svc.return_grades(request, offering_uuid, data.note, current_user, db_session)


@router.get("/academic-students/{membership_uuid}/transcript", response_model=Transcript, tags=["academic-grading"])
async def api_student_transcript(
    request: Request, membership_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await grading_svc.get_student_transcript(request, membership_uuid, current_user, db_session)


# ---------------------------------------------------------------------------
# Admissions (Phase 3)
# ---------------------------------------------------------------------------

from fastapi import File, Form, UploadFile  # noqa: E402

from src.db.academic.admissions import (  # noqa: E402
    AdmissionRequirementCreate,
    AdmissionRequirementRead,
    AdmissionRequirementUpdate,
    ApplicationCreate,
    ApplicationRead,
    ApplicationStatus,
    ApplicationSummary,
    ApplicationUpdate,
    CheckOverride,
    DecisionRequest,
    DocumentReview,
    EntranceTestCreate,
    EntranceTestRead,
    EntranceTestUpdate,
    InterviewCreate,
    InterviewEvaluation,
    InterviewUpdate,
    PanelInterviewRead,
    TestAttemptCreate,
    TestAttemptResult,
)
from src.services.academic import admissions as admissions_svc  # noqa: E402


class NoteRequest(BaseModel):
    note: Optional[str] = None


@router.get(
    "/programs/{program_uuid}/admission-requirements",
    response_model=List[AdmissionRequirementRead],
    tags=["academic-admissions"],
)
async def api_list_requirements(
    request: Request, program_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.list_requirements(request, program_uuid, current_user, db_session)


@router.post(
    "/programs/{program_uuid}/admission-requirements",
    response_model=AdmissionRequirementRead,
    tags=["academic-admissions"],
)
async def api_create_requirement(
    request: Request,
    program_uuid: str,
    data: AdmissionRequirementCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.create_requirement(request, program_uuid, data, current_user, db_session)


@router.put(
    "/admission-requirements/{requirement_uuid}", response_model=AdmissionRequirementRead, tags=["academic-admissions"]
)
async def api_update_requirement(
    request: Request,
    requirement_uuid: str,
    data: AdmissionRequirementUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.update_requirement(request, requirement_uuid, data, current_user, db_session)


@router.delete("/admission-requirements/{requirement_uuid}", tags=["academic-admissions"])
async def api_delete_requirement(
    request: Request, requirement_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await admissions_svc.delete_requirement(request, requirement_uuid, current_user, db_session)


@router.get(
    "/programs/{program_uuid}/entrance-tests", response_model=List[EntranceTestRead], tags=["academic-admissions"]
)
async def api_list_tests(
    request: Request, program_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.list_tests(request, program_uuid, current_user, db_session)


@router.post("/programs/{program_uuid}/entrance-tests", response_model=EntranceTestRead, tags=["academic-admissions"])
async def api_create_test(
    request: Request,
    program_uuid: str,
    data: EntranceTestCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.create_test(request, program_uuid, data, current_user, db_session)


@router.put("/entrance-tests/{test_uuid}", response_model=EntranceTestRead, tags=["academic-admissions"])
async def api_update_test(
    request: Request,
    test_uuid: str,
    data: EntranceTestUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.update_test(request, test_uuid, data, current_user, db_session)


@router.delete("/entrance-tests/{test_uuid}", tags=["academic-admissions"])
async def api_delete_test(
    request: Request, test_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
) -> str:
    return await admissions_svc.delete_test(request, test_uuid, current_user, db_session)


@router.get("/admissions/intakes", tags=["academic-admissions"])
async def api_open_intakes(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await admissions_svc.list_open_intakes(org_id, current_user, db_session)


@router.get("/admissions/applications", response_model=List[ApplicationSummary], tags=["academic-admissions"])
async def api_list_applications(
    request: Request,
    org_id: int,
    program_uuid: Optional[str] = None,
    cohort_uuid: Optional[str] = None,
    status: Optional[ApplicationStatus] = None,
    q: Optional[str] = None,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.list_applications(
        request, org_id, current_user, db_session, program_uuid, cohort_uuid, status, q
    )


@router.get("/admissions/my-interviews", response_model=List[PanelInterviewRead], tags=["academic-admissions"])
async def api_my_interviews(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    """Interviews the caller sits on the panel of."""
    return await admissions_svc.list_my_interviews(org_id, current_user, db_session)


@router.put(
    "/admissions/interviews/{interview_uuid}/evaluation",
    response_model=PanelInterviewRead,
    tags=["academic-admissions"],
)
async def api_evaluate_interview(
    interview_uuid: str, data: InterviewEvaluation, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    """A panel member records their evaluation (completes the interview)."""
    return await admissions_svc.evaluate_interview(interview_uuid, data, current_user, db_session)


@router.get("/admissions/my-applications", response_model=List[ApplicationSummary], tags=["academic-admissions"])
async def api_my_applications(org_id: int, db_session: AsyncSession = Session, current_user: PublicUser = User):
    return await admissions_svc.list_my_applications(org_id, current_user, db_session)


@router.post("/admissions/applications", response_model=ApplicationRead, tags=["academic-admissions"])
async def api_create_application(
    request: Request, data: ApplicationCreate, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.create_application(request, data, current_user, db_session)


@router.get("/admissions/applications/{application_uuid}", response_model=ApplicationRead, tags=["academic-admissions"])
async def api_get_application(
    request: Request, application_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.get_application(request, application_uuid, current_user, db_session)


@router.put("/admissions/applications/{application_uuid}", response_model=ApplicationRead, tags=["academic-admissions"])
async def api_update_application(
    request: Request,
    application_uuid: str,
    data: ApplicationUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.update_application(request, application_uuid, data, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/submit", response_model=ApplicationRead, tags=["academic-admissions"]
)
async def api_submit_application(
    request: Request, application_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.submit_application(request, application_uuid, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/review", response_model=ApplicationRead, tags=["academic-admissions"]
)
async def api_start_review(
    request: Request, application_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.start_review(request, application_uuid, current_user, db_session)


@router.put(
    "/admissions/applications/{application_uuid}/checks/{requirement_uuid}",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_override_check(
    request: Request,
    application_uuid: str,
    requirement_uuid: str,
    data: CheckOverride,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.override_check(
        request, application_uuid, requirement_uuid, data, current_user, db_session
    )


@router.post(
    "/admissions/applications/{application_uuid}/decision",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_decide(
    request: Request,
    application_uuid: str,
    data: DecisionRequest,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.decide(request, application_uuid, data, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/enroll", response_model=ApplicationRead, tags=["academic-admissions"]
)
async def api_enroll_applicant(
    request: Request, application_uuid: str, db_session: AsyncSession = Session, current_user: PublicUser = User
):
    return await admissions_svc.enroll_applicant(request, application_uuid, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/withdraw", response_model=ApplicationRead, tags=["academic-admissions"]
)
async def api_withdraw_application(
    request: Request,
    application_uuid: str,
    data: NoteRequest,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.withdraw_application(request, application_uuid, data.note, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/documents",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_upload_document(
    request: Request,
    application_uuid: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.upload_document(request, application_uuid, document_type, file, current_user, db_session)


@router.get("/admissions/applications/{application_uuid}/documents/{document_uuid}/file", tags=["academic-admissions"])
async def api_serve_document(
    request: Request,
    application_uuid: str,
    document_uuid: str,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.serve_document(request, application_uuid, document_uuid, current_user, db_session)


@router.put(
    "/admissions/applications/{application_uuid}/documents/{document_uuid}",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_review_document(
    request: Request,
    application_uuid: str,
    document_uuid: str,
    data: DocumentReview,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.review_document(request, application_uuid, document_uuid, data, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/tests",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_schedule_test(
    request: Request,
    application_uuid: str,
    data: TestAttemptCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.schedule_test(request, application_uuid, data, current_user, db_session)


@router.put(
    "/admissions/applications/{application_uuid}/tests/{attempt_uuid}",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_record_test_result(
    request: Request,
    application_uuid: str,
    attempt_uuid: str,
    data: TestAttemptResult,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.record_test_result(request, application_uuid, attempt_uuid, data, current_user, db_session)


@router.post(
    "/admissions/applications/{application_uuid}/interviews",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_schedule_interview(
    request: Request,
    application_uuid: str,
    data: InterviewCreate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.schedule_interview(request, application_uuid, data, current_user, db_session)


@router.put(
    "/admissions/applications/{application_uuid}/interviews/{interview_uuid}",
    response_model=ApplicationRead,
    tags=["academic-admissions"],
)
async def api_update_interview(
    request: Request,
    application_uuid: str,
    interview_uuid: str,
    data: InterviewUpdate,
    db_session: AsyncSession = Session,
    current_user: PublicUser = User,
):
    return await admissions_svc.update_interview(request, application_uuid, interview_uuid, data, current_user, db_session)
