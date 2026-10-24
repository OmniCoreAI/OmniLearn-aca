"""Graduate Studies Office overview: what needs attention today and how far the
academy's postgraduate setup has got. One read for the section's landing page,
built from counts so it stays cheap as the data grows."""
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.admissions import AdmissionApplication, AdmissionInterview, ApplicationStatus, InterviewStatus
from src.db.academic.calendar import AcademicTerm, AcademicYear
from src.db.academic.catalog import AcademicCourse
from src.db.academic.cohorts import Cohort
from src.db.academic.curricula import Curriculum, CurriculumStatus
from src.db.academic.grading import GradeScale
from src.db.academic.offerings import CohortMembership, CourseOffering, OfferingStatus
from src.db.academic.programs import Program
from src.db.users import User
from src.services.academic.common import Principal, require_academic_manager

ATTENTION_LIMIT = 6
LIVE_OFFERINGS = (OfferingStatus.PLANNED, OfferingStatus.OPEN, OfferingStatus.IN_PROGRESS)


class OverviewTerm(BaseModel):
    term_uuid: str
    code: str
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    academic_year_code: Optional[str] = None


class AttentionItem(BaseModel):
    """One thing waiting for the office. `kind` decides the link and wording in the UI."""

    kind: str  # application_new | application_review | application_accepted | grades_submitted | no_instructor | interview
    uuid: str
    title: str
    subtitle: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None


class SetupStep(BaseModel):
    key: str  # calendar | grading | catalog | program | curriculum | intake | admissions | offerings
    done: bool
    count: int


class AcademicOverview(BaseModel):
    current_term: Optional[OverviewTerm] = None
    programs: Dict[str, int]
    applications: Dict[str, int]
    students: Dict[str, int]
    offerings: Dict[str, int]
    grades: Dict[str, int]
    open_intakes: int
    offerings_without_instructor: int
    interviews_this_week: int
    attention: List[AttentionItem]
    setup: List[SetupStep]


def _day(value: Optional[str]) -> Optional[date]:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def pick_current_term(terms: List[AcademicTerm], today: date) -> Optional[AcademicTerm]:
    """The most specific dated term containing today; named terms win over catch-all custom ones."""
    current = []
    for term in terms:
        start, end = _day(term.start_date), _day(term.end_date)
        if start and end:
            if start <= today <= end:
                current.append(term)
        elif str(getattr(term.status, "value", term.status)) == "in_progress":
            current.append(term)

    def rank(term: AcademicTerm):
        start, end = _day(term.start_date), _day(term.end_date)
        span = (end - start).days if start and end else 10**6
        return (str(getattr(term.term_type, "value", term.term_type)) == "custom", span)

    return sorted(current, key=rank)[0] if current else None


async def _grouped(db_session: AsyncSession, column, *where) -> Dict[str, int]:
    rows = (await db_session.execute(select(column, func.count()).where(*where).group_by(column))).all()
    return {str(getattr(key, "value", key)): count for key, count in rows if key is not None}


async def _count(db_session: AsyncSession, model, *where) -> int:
    return int((await db_session.execute(select(func.count()).select_from(model).where(*where))).scalar() or 0)


def _person(user: Optional[User]) -> str:
    if not user:
        return ""
    return " ".join(part for part in (user.first_name, user.last_name) if part) or user.username


async def get_overview(org_id: int, current_user: Principal, db_session: AsyncSession, today: Optional[date] = None) -> AcademicOverview:
    await require_academic_manager(current_user, org_id, db_session)
    today = today or date.today()

    terms = (await db_session.execute(select(AcademicTerm).where(AcademicTerm.org_id == org_id))).scalars().all()
    term = pick_current_term(list(terms), today)
    current_term = None
    if term:
        year = await db_session.get(AcademicYear, term.academic_year_id)
        current_term = OverviewTerm(
            term_uuid=term.term_uuid, code=term.code, name=term.name, start_date=term.start_date, end_date=term.end_date,
            academic_year_code=year.code if year else None,
        )

    programs = await _grouped(db_session, Program.status, Program.org_id == org_id)
    applications = await _grouped(db_session, AdmissionApplication.status, AdmissionApplication.org_id == org_id)
    students = await _grouped(db_session, CohortMembership.status, CohortMembership.org_id == org_id)
    term_filter = [CourseOffering.term_id == term.id] if term else []
    offerings = await _grouped(db_session, CourseOffering.status, CourseOffering.org_id == org_id, *term_filter)
    grades = await _grouped(
        db_session, CourseOffering.grade_status, CourseOffering.org_id == org_id, CourseOffering.status.in_(LIVE_OFFERINGS)  # type: ignore[attr-defined]
    )
    open_intakes = await _count(db_session, Cohort, Cohort.org_id == org_id, Cohort.admission_status == "open")
    without_instructor_where = (
        CourseOffering.org_id == org_id,
        CourseOffering.instructor_id.is_(None),  # type: ignore[union-attr]
        CourseOffering.status.in_(LIVE_OFFERINGS),  # type: ignore[attr-defined]
    )
    offerings_without_instructor = await _count(db_session, CourseOffering, *without_instructor_where)

    week_start = datetime.combine(today, datetime.min.time())
    week_end = week_start + timedelta(days=7)
    interviews_where = (
        AdmissionInterview.org_id == org_id,
        AdmissionInterview.status == InterviewStatus.SCHEDULED,
        AdmissionInterview.scheduled_at >= week_start.isoformat(),  # type: ignore[operator]
        AdmissionInterview.scheduled_at < week_end.isoformat(),  # type: ignore[operator]
    )
    interviews_this_week = await _count(db_session, AdmissionInterview, *interviews_where)

    attention: List[AttentionItem] = []

    # Applications: new ones first, then those in review, then offers still to be turned into students.
    for status, kind in (
        (ApplicationStatus.SUBMITTED, "application_new"),
        (ApplicationStatus.UNDER_REVIEW, "application_review"),
        (ApplicationStatus.ACCEPTED, "application_accepted"),
    ):
        rows = (
            await db_session.execute(
                select(AdmissionApplication, User, Program)
                .join(User, User.id == AdmissionApplication.applicant_id)  # type: ignore[arg-type]
                .join(Program, Program.id == AdmissionApplication.program_id)  # type: ignore[arg-type]
                .where(AdmissionApplication.org_id == org_id, AdmissionApplication.status == status)
                .order_by(AdmissionApplication.submitted_at)  # oldest waiting first
                .limit(ATTENTION_LIMIT)
            )
        ).all()
        for app, user, program in rows:
            attention.append(
                AttentionItem(
                    kind=kind, uuid=app.application_uuid, title=_person(user), subtitle=f"{app.application_number} · {program.name}",
                    status=str(getattr(app.status, 'value', app.status)), date=app.decided_at if kind == "application_accepted" else app.submitted_at,
                )
            )

    grade_rows = (
        await db_session.execute(
            select(CourseOffering, AcademicCourse)
            .join(AcademicCourse, AcademicCourse.id == CourseOffering.academic_course_id)  # type: ignore[arg-type]
            .where(CourseOffering.org_id == org_id, CourseOffering.grade_status == "submitted")
            .order_by(CourseOffering.grades_submitted_at)
            .limit(ATTENTION_LIMIT)
        )
    ).all()
    for offering, course in grade_rows:
        attention.append(
            AttentionItem(
                kind="grades_submitted", uuid=offering.offering_uuid, title=course.name, subtitle=offering.code,
                status="submitted", date=offering.grades_submitted_at,
            )
        )

    staffing_rows = (
        await db_session.execute(
            select(CourseOffering, AcademicCourse)
            .join(AcademicCourse, AcademicCourse.id == CourseOffering.academic_course_id)  # type: ignore[arg-type]
            .where(*without_instructor_where)
            .order_by(CourseOffering.code)
            .limit(ATTENTION_LIMIT)
        )
    ).all()
    for offering, course in staffing_rows:
        attention.append(
            AttentionItem(
                kind="no_instructor", uuid=offering.offering_uuid, title=course.name, subtitle=offering.code,
                status=str(getattr(offering.status, "value", offering.status)),
            )
        )

    interview_rows = (
        await db_session.execute(
            select(AdmissionInterview, AdmissionApplication, User)
            .join(AdmissionApplication, AdmissionApplication.id == AdmissionInterview.application_id)  # type: ignore[arg-type]
            .join(User, User.id == AdmissionApplication.applicant_id)  # type: ignore[arg-type]
            .where(*interviews_where)
            .order_by(AdmissionInterview.scheduled_at)
            .limit(ATTENTION_LIMIT)
        )
    ).all()
    for interview, app, user in interview_rows:
        attention.append(
            AttentionItem(
                kind="interview", uuid=app.application_uuid, title=_person(user), subtitle=app.application_number,
                status="scheduled", date=interview.scheduled_at,
            )
        )

    # Setup, in the order a graduate school is normally configured.
    active_curricula = int(
        (
            await db_session.execute(
                select(func.count(func.distinct(Curriculum.program_id))).where(
                    Curriculum.org_id == org_id, Curriculum.status == CurriculumStatus.ACTIVE
                )
            )
        ).scalar()
        or 0
    )
    counts = {
        "calendar": len(terms),
        "grading": await _count(db_session, GradeScale, GradeScale.org_id == org_id),
        "catalog": await _count(db_session, AcademicCourse, AcademicCourse.org_id == org_id),
        "program": sum(programs.values()),
        "curriculum": active_curricula,
        "intake": await _count(db_session, Cohort, Cohort.org_id == org_id),
        "admissions": open_intakes,
        "offerings": await _count(db_session, CourseOffering, CourseOffering.org_id == org_id),
    }
    setup = [SetupStep(key=key, count=count, done=count > 0) for key, count in counts.items()]

    return AcademicOverview(
        current_term=current_term,
        programs=programs,
        applications=applications,
        students=students,
        offerings=offerings,
        grades=grades,
        open_intakes=open_intakes,
        offerings_without_instructor=offerings_without_instructor,
        interviews_this_week=interviews_this_week,
        attention=attention,
        setup=setup,
    )
