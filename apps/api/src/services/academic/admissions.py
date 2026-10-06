"""Postgraduate admissions: requirements, entrance tests, applications,
documents, test attempts, interviews, eligibility and decisions.

Access:
- Program staff (anyone who can update the program) configure requirements
  and tests, review applications and decide. Reading needs program read.
- Applicants (org members) create, edit and submit their own application,
  upload documents and withdraw; they can always read their own application.

Accepting an applicant does not admit them yet: enrollment is a separate step
that creates the cohort student record (student number) via the students
service, so capacity and registration rules stay in one place.
"""
from typing import List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.admissions import (
    AdmissionApplication,
    AdmissionInterview,
    AdmissionRequirement,
    AdmissionRequirementCreate,
    AdmissionRequirementRead,
    AdmissionRequirementUpdate,
    ApplicantProfile,
    ApplicationCreate,
    ApplicationDocument,
    ApplicationEvent,
    ApplicationEventRead,
    ApplicationRead,
    ApplicationStatus,
    ApplicationSummary,
    ApplicationUpdate,
    CheckOverride,
    CheckStatus,
    DecisionRequest,
    DocumentRead,
    DocumentReview,
    DocumentStatus,
    EntranceTest,
    EntranceTestAttempt,
    EntranceTestCreate,
    EntranceTestRead,
    EntranceTestUpdate,
    InterviewCreate,
    InterviewEvaluation,
    InterviewRead,
    InterviewRecommendation,
    InterviewStatus,
    InterviewUpdate,
    PanelInterviewRead,
    RequirementCheck,
    RequirementType,
    TestAttemptCreate,
    TestAttemptRead,
    TestAttemptResult,
    TestAttemptStatus,
)
from src.db.academic.cohorts import Cohort
from src.db.academic.offerings import CohortMembership, MembershipStatus
from src.db.academic.programs import Program
from src.db.courses.assignments import (
    Assignment,
    AssignmentTask,
    AssignmentUserSubmission,
    AssignmentUserSubmissionStatus,
)
from src.db.organizations import Organization
from src.db.users import User, UserReadAuthor
from src.security.auth import resolve_acting_user_id
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic import students as students_svc
from src.services.academic.common import (
    Principal,
    bad_request,
    conflict,
    get_by_uuid_or_404,
    get_user_by_uuid_or_400,
    normalize_code,
    now,
    require_academic_manager,
    require_academic_member,
)
from src.services.academic.validation import resolve_org_user

OPEN_STATES = {
    ApplicationStatus.DRAFT,
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.WAITLISTED,
    ApplicationStatus.ACCEPTED,
}
DECISIONS = {ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED, ApplicationStatus.WAITLISTED}
DEGREE_RANK = {"bachelor": 1, "master": 2, "doctorate": 3}
DOCUMENT_TYPES = [
    "degree_certificate",
    "transcript",
    "national_id",
    "passport",
    "language_certificate",
    "cv",
    "recommendation_letter",
    "statement_of_purpose",
    "experience_letter",
    "photo",
    "other",
]


# ---------------------------------------------------------------------------
# Access helpers
# ---------------------------------------------------------------------------

async def _program(db_session: AsyncSession, program_id: int) -> Program:
    program = await db_session.get(Program, program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


async def _require_staff(request: Request, db_session: AsyncSession, current_user: Principal, program: Program) -> None:
    await check_resource_access(request, db_session, current_user, program.program_uuid, AccessAction.UPDATE)


async def _require_staff_read(
    request: Request, db_session: AsyncSession, current_user: Principal, program: Program
) -> None:
    await check_resource_access(
        request, db_session, current_user, program.program_uuid, AccessAction.READ, context=AccessContext.DASHBOARD
    )


def _is_applicant(current_user: Principal, application: AdmissionApplication) -> bool:
    user_id = resolve_acting_user_id(current_user)
    return bool(user_id) and user_id == application.applicant_id


async def _require_applicant_or_staff(
    request: Request, db_session: AsyncSession, current_user: Principal, application: AdmissionApplication, write: bool
) -> bool:
    """Returns True when the caller acts as staff."""
    if _is_applicant(current_user, application):
        return False
    program = await _program(db_session, application.program_id)
    if write:
        await _require_staff(request, db_session, current_user, program)
    else:
        await _require_staff_read(request, db_session, current_user, program)
    return True


async def _log(
    db_session: AsyncSession,
    application: AdmissionApplication,
    current_user: Optional[Principal],
    action: str,
    *,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    note: Optional[str] = None,
    data: Optional[dict] = None,
) -> None:
    db_session.add(
        ApplicationEvent(
            application_id=application.id,
            org_id=application.org_id,
            actor_id=(resolve_acting_user_id(current_user) or None) if current_user else None,
            action=action,
            from_status=from_status,
            to_status=to_status,
            note=note,
            data=data,
            created_at=now(),
        )
    )


async def _set_status(
    db_session: AsyncSession,
    application: AdmissionApplication,
    current_user: Principal,
    status: ApplicationStatus,
    note: Optional[str] = None,
    action: str = "status_changed",
) -> None:
    previous = application.status
    application.status = status
    application.update_date = now()
    db_session.add(application)
    await _log(
        db_session, application, current_user, action,
        from_status=previous.value, to_status=status.value, note=note,
    )


# ---------------------------------------------------------------------------
# Requirements (program configuration)
# ---------------------------------------------------------------------------

def _validate_requirement(requirement_type: RequirementType, config: dict) -> dict:
    config = dict(config or {})
    if requirement_type == RequirementType.DEGREE:
        level = str(config.get("degree_level") or "bachelor").lower()
        if level not in DEGREE_RANK:
            raise bad_request("Degree level must be bachelor, master or doctorate")
        config["degree_level"] = level
    elif requirement_type == RequirementType.MIN_GPA:
        try:
            value = float(config.get("min_gpa"))
        except (TypeError, ValueError):
            raise bad_request("Minimum GPA is required (4.0 scale)")
        if not 0 < value <= 4:
            raise bad_request("Minimum GPA must be between 0 and 4")
        config["min_gpa"] = value
    elif requirement_type in (RequirementType.LANGUAGE,):
        try:
            config["min_score"] = float(config.get("min_score"))
        except (TypeError, ValueError):
            raise bad_request("Minimum language score is required")
    elif requirement_type == RequirementType.EXPERIENCE:
        try:
            config["years"] = float(config.get("years"))
        except (TypeError, ValueError):
            raise bad_request("Required years of experience is required")
    elif requirement_type == RequirementType.DOCUMENT:
        if config.get("document_type") not in DOCUMENT_TYPES:
            raise bad_request(f"Document type must be one of: {', '.join(DOCUMENT_TYPES)}")
    elif requirement_type == RequirementType.ENTRANCE_TEST:
        if not config.get("test_uuid"):
            raise bad_request("Select the entrance test")
    elif requirement_type == RequirementType.INTERVIEW and config.get("min_score") is not None:
        config["min_score"] = float(config["min_score"])
    return config


async def list_requirements(
    request: Request, program_uuid: str, current_user: Principal, db_session: AsyncSession
) -> List[AdmissionRequirementRead]:
    """Public to org members: applicants need to see what is required."""
    program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
    await require_academic_member(current_user, program.org_id, db_session)
    rows = (
        await db_session.execute(
            select(AdmissionRequirement)
            .where(AdmissionRequirement.program_id == program.id)
            .order_by(AdmissionRequirement.order, AdmissionRequirement.id)  # type: ignore
        )
    ).scalars().all()
    return [AdmissionRequirementRead.model_validate(r) for r in rows]


async def create_requirement(
    request: Request,
    program_uuid: str,
    data: AdmissionRequirementCreate,
    current_user: Principal,
    db_session: AsyncSession,
) -> AdmissionRequirementRead:
    program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
    await _require_staff(request, db_session, current_user, program)
    config = _validate_requirement(data.requirement_type, data.config)
    if data.requirement_type == RequirementType.ENTRANCE_TEST:
        test = await get_by_uuid_or_404(db_session, EntranceTest, EntranceTest.test_uuid, config["test_uuid"], "Entrance test")
        if test.program_id != program.id:
            raise bad_request("The entrance test belongs to another program")
    if not data.label.strip():
        raise bad_request("Requirement label is required")
    requirement = AdmissionRequirement(
        requirement_type=data.requirement_type,
        label=data.label.strip(),
        description=data.description,
        mandatory=data.mandatory,
        order=data.order,
        config=config,
        program_id=program.id,
        org_id=program.org_id,
        requirement_uuid=f"admreq_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(requirement)
    await db_session.commit()
    await db_session.refresh(requirement)
    return AdmissionRequirementRead.model_validate(requirement)


async def update_requirement(
    request: Request,
    requirement_uuid: str,
    data: AdmissionRequirementUpdate,
    current_user: Principal,
    db_session: AsyncSession,
) -> AdmissionRequirementRead:
    requirement = await get_by_uuid_or_404(
        db_session, AdmissionRequirement, AdmissionRequirement.requirement_uuid, requirement_uuid, "Requirement"
    )
    await _require_staff(request, db_session, current_user, await _program(db_session, requirement.program_id))
    update = data.model_dump(exclude_unset=True)
    if "config" in update:
        update["config"] = _validate_requirement(requirement.requirement_type, update["config"] or {})
    for key, value in update.items():
        setattr(requirement, key, value)
    requirement.update_date = now()
    db_session.add(requirement)
    await db_session.commit()
    await db_session.refresh(requirement)
    return AdmissionRequirementRead.model_validate(requirement)


async def delete_requirement(
    request: Request, requirement_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    requirement = await get_by_uuid_or_404(
        db_session, AdmissionRequirement, AdmissionRequirement.requirement_uuid, requirement_uuid, "Requirement"
    )
    await _require_staff(request, db_session, current_user, await _program(db_session, requirement.program_id))
    await db_session.delete(requirement)
    await db_session.commit()
    return "Requirement deleted"


# ---------------------------------------------------------------------------
# Entrance tests
# ---------------------------------------------------------------------------

def _validate_test(data: dict) -> None:
    if data.get("max_score") is not None and data["max_score"] <= 0:
        raise bad_request("Maximum score must be positive")
    if data.get("passing_score") is not None and data["passing_score"] < 0:
        raise bad_request("Passing score cannot be negative")
    if data.get("passing_score") is not None and data.get("max_score") is not None and data["passing_score"] > data["max_score"]:
        raise bad_request("Passing score cannot exceed the maximum score")
    if data.get("attempt_limit") is not None and data["attempt_limit"] < 1:
        raise bad_request("At least one attempt must be allowed")


async def list_tests(
    request: Request, program_uuid: str, current_user: Principal, db_session: AsyncSession
) -> List[EntranceTestRead]:
    program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
    await require_academic_member(current_user, program.org_id, db_session)
    rows = (
        await db_session.execute(select(EntranceTest).where(EntranceTest.program_id == program.id).order_by(EntranceTest.code))  # type: ignore
    ).scalars().all()
    return [EntranceTestRead.model_validate(r) for r in rows]


async def create_test(
    request: Request, program_uuid: str, data: EntranceTestCreate, current_user: Principal, db_session: AsyncSession
) -> EntranceTestRead:
    program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
    await _require_staff(request, db_session, current_user, program)
    _validate_test(data.model_dump())
    code = normalize_code(data.code, "Test", max_len=24)
    if (
        await db_session.execute(select(EntranceTest).where(EntranceTest.org_id == program.org_id, EntranceTest.code == code))
    ).scalars().first():
        raise conflict(f"Entrance test code '{code}' already exists")
    if data.assignment_uuid:
        await get_by_uuid_or_404(db_session, Assignment, Assignment.assignment_uuid, data.assignment_uuid, "Assignment")
    test = EntranceTest(
        **data.model_dump(exclude={"code"}),
        code=code,
        program_id=program.id,
        org_id=program.org_id,
        test_uuid=f"entrancetest_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(test)
    await db_session.commit()
    await db_session.refresh(test)
    return EntranceTestRead.model_validate(test)


async def update_test(
    request: Request, test_uuid: str, data: EntranceTestUpdate, current_user: Principal, db_session: AsyncSession
) -> EntranceTestRead:
    test = await get_by_uuid_or_404(db_session, EntranceTest, EntranceTest.test_uuid, test_uuid, "Entrance test")
    await _require_staff(request, db_session, current_user, await _program(db_session, test.program_id))
    update = data.model_dump(exclude_unset=True)
    _validate_test({**test.model_dump(), **update})
    for key, value in update.items():
        setattr(test, key, value)
    test.update_date = now()
    db_session.add(test)
    await db_session.commit()
    await db_session.refresh(test)
    return EntranceTestRead.model_validate(test)


async def delete_test(request: Request, test_uuid: str, current_user: Principal, db_session: AsyncSession) -> str:
    test = await get_by_uuid_or_404(db_session, EntranceTest, EntranceTest.test_uuid, test_uuid, "Entrance test")
    await _require_staff(request, db_session, current_user, await _program(db_session, test.program_id))
    used = (
        await db_session.execute(select(func.count()).select_from(EntranceTestAttempt).where(EntranceTestAttempt.test_id == test.id))
    ).scalar() or 0
    if used:
        raise conflict("Applicants have attempts on this test; deactivate it instead")
    await db_session.delete(test)
    await db_session.commit()
    return "Entrance test deleted"


# ---------------------------------------------------------------------------
# Eligibility
# ---------------------------------------------------------------------------

async def evaluate_checks(db_session: AsyncSession, application: AdmissionApplication) -> List[RequirementCheck]:
    requirements = (
        await db_session.execute(
            select(AdmissionRequirement)
            .where(AdmissionRequirement.program_id == application.program_id)
            .order_by(AdmissionRequirement.order, AdmissionRequirement.id)  # type: ignore
        )
    ).scalars().all()
    profile = ApplicantProfile(**(application.profile or {}))
    documents = (
        await db_session.execute(select(ApplicationDocument).where(ApplicationDocument.application_id == application.id))
    ).scalars().all()
    attempts = (
        await db_session.execute(select(EntranceTestAttempt).where(EntranceTestAttempt.application_id == application.id))
    ).scalars().all()
    interviews = (
        await db_session.execute(select(AdmissionInterview).where(AdmissionInterview.application_id == application.id))
    ).scalars().all()

    checks: List[RequirementCheck] = []
    for req in requirements:
        cfg = req.config or {}
        status, detail = CheckStatus.PENDING, None
        rtype = req.requirement_type
        if rtype == RequirementType.DEGREE:
            need = cfg.get("degree_level", "bachelor")
            have = (profile.degree_level or "").lower()
            if not have:
                detail = "Degree not provided"
            elif DEGREE_RANK.get(have, 0) >= DEGREE_RANK[need]:
                status, detail = CheckStatus.MET, f"{have} (requires {need})"
            else:
                status, detail = CheckStatus.NOT_MET, f"{have} (requires {need})"
        elif rtype == RequirementType.MIN_GPA:
            if profile.gpa is None:
                detail = "GPA not provided"
            else:
                scale = profile.gpa_scale or 4.0
                normalized = round(profile.gpa / scale * 4.0, 2) if scale else 0
                status = CheckStatus.MET if normalized >= cfg["min_gpa"] else CheckStatus.NOT_MET
                detail = f"{profile.gpa:g}/{scale:g} = {normalized:g}/4 (min {cfg['min_gpa']:g})"
        elif rtype == RequirementType.LANGUAGE:
            if profile.language_score is None:
                detail = "Language score not provided"
            elif cfg.get("test") and profile.language_test and cfg["test"].lower() != profile.language_test.lower():
                detail = f"{profile.language_test} {profile.language_score:g} — different test, verify manually"
            else:
                ok = profile.language_score >= cfg["min_score"]
                status = CheckStatus.MET if ok else CheckStatus.NOT_MET
                detail = f"{profile.language_test or ''} {profile.language_score:g} (min {cfg['min_score']:g})".strip()
        elif rtype == RequirementType.EXPERIENCE:
            if profile.experience_years is None:
                detail = "Experience not provided"
            else:
                ok = profile.experience_years >= cfg["years"]
                status = CheckStatus.MET if ok else CheckStatus.NOT_MET
                detail = f"{profile.experience_years:g} years (min {cfg['years']:g})"
        elif rtype == RequirementType.DOCUMENT:
            docs = [d for d in documents if d.document_type == cfg.get("document_type")]
            if any(d.status == DocumentStatus.VERIFIED for d in docs):
                status, detail = CheckStatus.MET, "Verified"
            elif any(d.status == DocumentStatus.PENDING for d in docs):
                detail = "Awaiting verification"
            elif docs:
                status, detail = CheckStatus.NOT_MET, "Rejected — a new upload is needed"
            else:
                detail = "Not uploaded"
        elif rtype == RequirementType.ENTRANCE_TEST:
            test = (
                await db_session.execute(select(EntranceTest).where(EntranceTest.test_uuid == cfg.get("test_uuid")))
            ).scalars().first()
            mine = [a for a in attempts if test and a.test_id == test.id]
            if any(a.status == TestAttemptStatus.PASSED for a in mine):
                best = max((a.score or 0) for a in mine if a.status == TestAttemptStatus.PASSED)
                status, detail = CheckStatus.MET, f"Passed ({best:g})"
            elif test and sum(1 for a in mine if a.status in (TestAttemptStatus.FAILED, TestAttemptStatus.ABSENT)) >= test.attempt_limit:
                status, detail = CheckStatus.NOT_MET, "No attempts left"
            elif mine:
                detail = "Scheduled / awaiting result"
            else:
                detail = "Not scheduled"
        elif rtype == RequirementType.INTERVIEW:
            done = [i for i in interviews if i.status == InterviewStatus.COMPLETED]
            if any(i.recommendation == InterviewRecommendation.REJECT for i in done):
                status, detail = CheckStatus.NOT_MET, "Panel recommended rejection"
            elif done and cfg.get("min_score") is not None and max((i.score or 0) for i in done) < cfg["min_score"]:
                status, detail = CheckStatus.NOT_MET, f"Score below {cfg['min_score']:g}"
            elif done:
                status, detail = CheckStatus.MET, "Completed"
            elif interviews:
                detail = "Scheduled"
            else:
                detail = "Not scheduled"
        else:
            detail = "Staff verification required"

        override = (application.checks or {}).get(req.requirement_uuid)
        overridden = False
        if override and override.get("status"):
            status = CheckStatus(override["status"])
            detail = f"Set by staff: {override.get('note') or ''}".strip()
            overridden = True
        checks.append(
            RequirementCheck(
                requirement_uuid=req.requirement_uuid,
                requirement_type=rtype,
                label=req.label,
                mandatory=req.mandatory,
                status=status,
                detail=detail,
                overridden=overridden,
                document_type=cfg.get("document_type") if rtype == RequirementType.DOCUMENT else None,
            )
        )
    return checks


def _eligibility(checks: List[RequirementCheck]) -> Tuple[Optional[bool], int]:
    mandatory = [c for c in checks if c.mandatory]
    if any(c.status == CheckStatus.NOT_MET for c in mandatory):
        return False, sum(1 for c in mandatory if c.status == CheckStatus.PENDING)
    pending = sum(1 for c in mandatory if c.status == CheckStatus.PENDING)
    return (True if pending == 0 else None), pending


# ---------------------------------------------------------------------------
# Applications — reads
# ---------------------------------------------------------------------------

async def _summary(db_session: AsyncSession, application: AdmissionApplication) -> ApplicationSummary:
    program = await db_session.get(Program, application.program_id)
    cohort = await db_session.get(Cohort, application.cohort_id)
    applicant = await db_session.get(User, application.applicant_id)
    eligible, pending = _eligibility(await evaluate_checks(db_session, application))
    return ApplicationSummary(
        application_uuid=application.application_uuid,
        application_number=application.application_number,
        status=application.status,
        applicant=UserReadAuthor.model_validate(applicant),
        program_uuid=program.program_uuid if program else "",
        program_name=program.name if program else "",
        cohort_uuid=cohort.cohort_uuid if cohort else "",
        cohort_code=cohort.code if cohort else None,
        cohort_name=cohort.name if cohort else "",
        submitted_at=application.submitted_at,
        decided_at=application.decided_at,
        eligible=eligible,
        pending_checks=pending,
        creation_date=application.creation_date,
    )


async def _read(db_session: AsyncSession, application: AdmissionApplication) -> ApplicationRead:
    summary = await _summary(db_session, application)
    checks = await evaluate_checks(db_session, application)
    documents = (
        await db_session.execute(
            select(ApplicationDocument).where(ApplicationDocument.application_id == application.id)
            .order_by(ApplicationDocument.id)  # type: ignore
        )
    ).scalars().all()
    attempts = (
        await db_session.execute(
            select(EntranceTestAttempt, EntranceTest)
            .join(EntranceTest, EntranceTest.id == EntranceTestAttempt.test_id)  # type: ignore
            .where(EntranceTestAttempt.application_id == application.id)
            .order_by(EntranceTestAttempt.id)  # type: ignore
        )
    ).all()
    interviews = (
        await db_session.execute(
            select(AdmissionInterview).where(AdmissionInterview.application_id == application.id)
            .order_by(AdmissionInterview.id)  # type: ignore
        )
    ).scalars().all()
    events = (
        await db_session.execute(
            select(ApplicationEvent).where(ApplicationEvent.application_id == application.id)
            .order_by(ApplicationEvent.id)  # type: ignore
        )
    ).scalars().all()
    membership = (
        await db_session.get(CohortMembership, application.membership_id) if application.membership_id else None
    )

    async def author(user_id: Optional[int]) -> Optional[UserReadAuthor]:
        user = await db_session.get(User, user_id) if user_id else None
        return UserReadAuthor.model_validate(user) if user else None

    return ApplicationRead(
        **summary.model_dump(),
        profile=ApplicantProfile(**(application.profile or {})),
        checks=checks,
        documents=[DocumentRead.model_validate(d) for d in documents],
        test_attempts=[
            TestAttemptRead(
                attempt_uuid=a.attempt_uuid,
                test_uuid=t.test_uuid,
                test_code=t.code,
                test_name=t.name,
                attempt_number=a.attempt_number,
                scheduled_at=a.scheduled_at,
                score=a.score,
                passing_score=t.passing_score,
                status=a.status,
            )
            for a, t in attempts
        ],
        interviews=[
            InterviewRead(
                interview_uuid=i.interview_uuid,
                scheduled_at=i.scheduled_at,
                location=i.location,
                panel=[p for p in [await author(uid) for uid in (i.panel or [])] if p],
                status=i.status,
                score=i.score,
                recommendation=i.recommendation,
                notes=i.notes,
            )
            for i in interviews
        ],
        events=[
            ApplicationEventRead(
                action=e.action,
                from_status=e.from_status,
                to_status=e.to_status,
                note=e.note,
                actor=await author(e.actor_id),
                created_at=e.created_at,
            )
            for e in events
        ],
        decision_note=application.decision_note,
        student_number=membership.student_number if membership else None,
    )


async def _get(db_session: AsyncSession, application_uuid: str) -> AdmissionApplication:
    return await get_by_uuid_or_404(
        db_session, AdmissionApplication, AdmissionApplication.application_uuid, application_uuid, "Application"
    )


async def get_application(
    request: Request, application_uuid: str, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    staff = await _require_applicant_or_staff(request, db_session, current_user, application, write=False)
    read = await _read(db_session, application)
    return read if staff else _applicant_view(read)


async def _read_for(db_session: AsyncSession, application: AdmissionApplication, staff: bool) -> ApplicationRead:
    read = await _read(db_session, application)
    return read if staff else _applicant_view(read)


APPLICANT_EVENTS = {"created", "submitted", "review_started", "decision", "decision_override", "enrolled", "withdrawn"}


def _applicant_view(read: ApplicationRead) -> ApplicationRead:
    """What the applicant may see: no panel notes/scores/recommendations,
    no staff identities, and only the milestones of the audit trail."""
    for interview in read.interviews:
        interview.notes = None
        interview.score = None
        interview.recommendation = None
        interview.panel = []
    read.events = [
        e.model_copy(update={"actor": None, "note": None if e.action == "decision_override" else e.note,
                             "action": "decision" if e.action == "decision_override" else e.action})
        for e in read.events
        if e.action in APPLICANT_EVENTS
    ]
    return read


async def list_applications(
    request: Request,
    org_id: int,
    current_user: Principal,
    db_session: AsyncSession,
    program_uuid: Optional[str] = None,
    cohort_uuid: Optional[str] = None,
    status: Optional[ApplicationStatus] = None,
    query: Optional[str] = None,
) -> List[ApplicationSummary]:
    statement = (
        select(AdmissionApplication)
        .join(User, User.id == AdmissionApplication.applicant_id)  # type: ignore
        .where(AdmissionApplication.org_id == org_id)
    )
    if program_uuid:
        program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
        await _require_staff_read(request, db_session, current_user, program)
        statement = statement.where(AdmissionApplication.program_id == program.id)
    else:
        await require_academic_manager(current_user, org_id, db_session)
    if cohort_uuid:
        cohort = await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, cohort_uuid, "Cohort")
        statement = statement.where(AdmissionApplication.cohort_id == cohort.id)
    if status:
        statement = statement.where(AdmissionApplication.status == status)
    else:
        # Drafts are the applicant's private work until submitted.
        statement = statement.where(AdmissionApplication.status != ApplicationStatus.DRAFT)
    if query:
        like = f"%{query.strip()}%"
        statement = statement.where(
            AdmissionApplication.application_number.ilike(like)  # type: ignore[attr-defined]
            | User.first_name.ilike(like)  # type: ignore[attr-defined]
            | User.last_name.ilike(like)  # type: ignore[attr-defined]
            | User.email.ilike(like)  # type: ignore[attr-defined]
            | User.username.ilike(like)  # type: ignore[attr-defined]
        )
    rows = (await db_session.execute(statement.order_by(AdmissionApplication.id.desc()))).scalars().all()  # type: ignore
    return [await _summary(db_session, a) for a in rows]


async def list_my_applications(org_id: int, current_user: Principal, db_session: AsyncSession) -> List[ApplicationSummary]:
    await require_academic_member(current_user, org_id, db_session)
    user_id = resolve_acting_user_id(current_user)
    rows = (
        await db_session.execute(
            select(AdmissionApplication).where(
                AdmissionApplication.org_id == org_id, AdmissionApplication.applicant_id == user_id
            ).order_by(AdmissionApplication.id.desc())  # type: ignore
        )
    ).scalars().all()
    return [await _summary(db_session, a) for a in rows]


async def list_open_intakes(org_id: int, current_user: Principal, db_session: AsyncSession) -> List[dict]:
    """Cohorts currently accepting applications (for the applicant portal)."""
    await require_academic_member(current_user, org_id, db_session)
    rows = (
        await db_session.execute(
            select(Cohort, Program)
            .join(Program, Program.id == Cohort.program_id)  # type: ignore
            .where(Cohort.org_id == org_id, Cohort.admission_status == "open")
        )
    ).all()
    return [
        {
            "cohort_uuid": c.cohort_uuid,
            "cohort_code": c.code,
            "cohort_name": c.name,
            "start_date": c.start_date,
            "program_uuid": p.program_uuid,
            "program_name": p.name,
            "program_code": p.code,
            "program_level": getattr(p.program_level, "value", p.program_level),
        }
        for c, p in rows
    ]


# ---------------------------------------------------------------------------
# Applications — lifecycle
# ---------------------------------------------------------------------------

async def _next_number(db_session: AsyncSession, cohort: Cohort) -> str:
    prefix = f"APP-{cohort.code or f'C{cohort.id}'}"
    count = (
        await db_session.execute(
            select(func.count()).select_from(AdmissionApplication).where(AdmissionApplication.cohort_id == cohort.id)
        )
    ).scalar() or 0
    seq = int(count) + 1
    while (
        await db_session.execute(
            select(AdmissionApplication).where(
                AdmissionApplication.org_id == cohort.org_id,
                AdmissionApplication.application_number == f"{prefix}-{seq:04d}",
            )
        )
    ).scalars().first():
        seq += 1
    return f"{prefix}-{seq:04d}"


async def create_application(
    request: Request, data: ApplicationCreate, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    cohort = await get_by_uuid_or_404(db_session, Cohort, Cohort.cohort_uuid, data.cohort_uuid, "Cohort")
    program = await _program(db_session, cohort.program_id)
    acting = resolve_acting_user_id(current_user)
    on_behalf = bool(data.applicant_uuid)
    if on_behalf:
        await _require_staff(request, db_session, current_user, program)
        applicant = await get_user_by_uuid_or_400(db_session, data.applicant_uuid)  # type: ignore[arg-type]
        await resolve_org_user(db_session, cohort.org_id, applicant.user_uuid, label="Applicant")
        applicant_id = applicant.id
    else:
        await require_academic_member(current_user, cohort.org_id, db_session)
        if cohort.admission_status != "open":
            raise conflict("This intake is not accepting applications")
        applicant_id = acting
    existing = (
        await db_session.execute(
            select(AdmissionApplication).where(
                AdmissionApplication.cohort_id == cohort.id, AdmissionApplication.applicant_id == applicant_id
            )
        )
    ).scalars().first()
    if existing and existing.status != ApplicationStatus.WITHDRAWN:
        raise conflict(
            f"An application already exists for this intake ({existing.application_number}, {existing.status.value})"
        )
    already_student = (
        await db_session.execute(
            select(CohortMembership).where(
                CohortMembership.cohort_id == cohort.id, CohortMembership.user_id == applicant_id
            )
        )
    ).scalars().first()
    if already_student:
        raise conflict("The applicant is already a student of this cohort")

    if existing:
        # A withdrawn application is reopened as a draft (same number, full
        # history kept) instead of blocking the applicant from this intake.
        existing.profile = data.profile.model_dump()
        existing.checks = {}
        existing.decision_note = None
        existing.decided_at = None
        existing.decided_by_id = None
        existing.submitted_at = None
        await _set_status(
            db_session, existing, current_user, ApplicationStatus.DRAFT, action="reopened",
            note="Reopened by staff" if on_behalf else "Reopened by the applicant",
        )
        await db_session.commit()
        await db_session.refresh(existing)
        return await _read(db_session, existing)

    application = AdmissionApplication(
        application_number=await _next_number(db_session, cohort),
        program_id=program.id,
        cohort_id=cohort.id,
        applicant_id=applicant_id,
        org_id=cohort.org_id,
        status=ApplicationStatus.DRAFT,
        profile=data.profile.model_dump(),
        checks={},
        application_uuid=f"application_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(application)
    await db_session.flush()
    await _log(db_session, application, current_user, "created", to_status=ApplicationStatus.DRAFT.value,
               note="Created by staff" if on_behalf else None)
    await db_session.commit()
    await db_session.refresh(application)
    return await _read(db_session, application)


async def update_application(
    request: Request, application_uuid: str, data: ApplicationUpdate, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    staff = await _require_applicant_or_staff(request, db_session, current_user, application, write=True)
    editable = {ApplicationStatus.DRAFT} if not staff else {
        ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WAITLISTED
    }
    if application.status not in editable:
        raise conflict("This application can no longer be edited")
    profile = data.profile
    if profile.gpa is not None and (profile.gpa < 0 or (profile.gpa_scale and profile.gpa > profile.gpa_scale)):
        raise bad_request("GPA must be between 0 and the GPA scale")
    if profile.degree_level and profile.degree_level.lower() not in DEGREE_RANK:
        raise bad_request("Degree level must be bachelor, master or doctorate")
    application.profile = profile.model_dump()
    application.update_date = now()
    db_session.add(application)
    if staff:
        await _log(db_session, application, current_user, "profile_updated", note="Updated by staff")
    await db_session.commit()
    await db_session.refresh(application)
    return await _read_for(db_session, application, staff)


async def submit_application(
    request: Request, application_uuid: str, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    staff = await _require_applicant_or_staff(request, db_session, current_user, application, write=True)
    if application.status != ApplicationStatus.DRAFT:
        raise conflict("Only draft applications can be submitted")
    profile = ApplicantProfile(**(application.profile or {}))
    if not profile.degree_level or profile.gpa is None:
        raise bad_request("Complete your academic background (degree and GPA) before submitting")
    application.submitted_at = now()
    await _set_status(db_session, application, current_user, ApplicationStatus.SUBMITTED, action="submitted")
    await db_session.commit()
    await db_session.refresh(application)
    return await _read_for(db_session, application, staff)


async def start_review(
    request: Request, application_uuid: str, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    if application.status != ApplicationStatus.SUBMITTED:
        raise conflict("Only submitted applications can be taken into review")
    await _set_status(db_session, application, current_user, ApplicationStatus.UNDER_REVIEW, action="review_started")
    await db_session.commit()
    await db_session.refresh(application)
    return await _read(db_session, application)


async def override_check(
    request: Request,
    application_uuid: str,
    requirement_uuid: str,
    data: CheckOverride,
    current_user: Principal,
    db_session: AsyncSession,
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    if application.status not in OPEN_STATES - {ApplicationStatus.ACCEPTED}:
        raise conflict("Requirement checks are frozen once a decision is final")
    requirement = await get_by_uuid_or_404(
        db_session, AdmissionRequirement, AdmissionRequirement.requirement_uuid, requirement_uuid, "Requirement"
    )
    if requirement.program_id != application.program_id:
        raise bad_request("Requirement belongs to another program")
    checks = dict(application.checks or {})
    if data.status is None:
        checks.pop(requirement_uuid, None)
    else:
        if not (data.note or "").strip():
            raise bad_request("Explain why the requirement is being set manually")
        checks[requirement_uuid] = {
            "status": data.status.value,
            "note": data.note,
            "by": resolve_acting_user_id(current_user),
            "at": now(),
        }
    application.checks = checks
    application.update_date = now()
    db_session.add(application)
    await _log(
        db_session, application, current_user, "check_overridden" if data.status else "check_reset",
        note=f"{requirement.label}: {data.status.value if data.status else 'automatic'} — {data.note or ''}".strip(" —"),
    )
    await db_session.commit()
    await db_session.refresh(application)
    return await _read(db_session, application)


async def _assert_offer_capacity(db_session: AsyncSession, application: AdmissionApplication) -> None:
    """Accepting is an offer of a seat: active students plus outstanding
    (accepted, not yet enrolled) offers must stay within the cohort capacity."""
    cohort = await db_session.get(Cohort, application.cohort_id)
    if cohort is None or cohort.capacity is None:
        return
    students = (
        await db_session.execute(
            select(func.count()).select_from(CohortMembership).where(
                CohortMembership.cohort_id == cohort.id, CohortMembership.status == MembershipStatus.ACTIVE
            )
        )
    ).scalar() or 0
    offers = (
        await db_session.execute(
            select(func.count()).select_from(AdmissionApplication).where(
                AdmissionApplication.cohort_id == cohort.id,
                AdmissionApplication.status == ApplicationStatus.ACCEPTED,
                AdmissionApplication.id != application.id,
            )
        )
    ).scalar() or 0
    if students + offers >= cohort.capacity:
        raise conflict(
            f"The intake is full ({students} students and {offers} accepted offers for {cohort.capacity} seats); "
            "waitlist the applicant or increase the cohort capacity"
        )


async def decide(
    request: Request, application_uuid: str, data: DecisionRequest, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    if data.decision not in DECISIONS:
        raise bad_request("Decision must be accepted, rejected or waitlisted")
    if application.status not in (ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WAITLISTED):
        raise conflict("Take the application into review before deciding")
    if data.decision == application.status:
        raise conflict(f"The application is already {data.decision.value}")
    if data.decision == ApplicationStatus.ACCEPTED:
        await _assert_offer_capacity(db_session, application)
        eligible, _ = _eligibility(await evaluate_checks(db_session, application))
        if eligible is not True:
            if not data.override_requirements:
                raise conflict("Mandatory admission requirements are not all met")
            if not (data.note or "").strip():
                raise bad_request("Explain the exception when accepting despite unmet requirements")
    if data.decision == ApplicationStatus.REJECTED and not (data.note or "").strip():
        raise bad_request("A reason is required when rejecting an application")
    application.decision_note = data.note
    application.decided_at = now()
    application.decided_by_id = resolve_acting_user_id(current_user) or None
    await _set_status(
        db_session, application, current_user, data.decision, note=data.note,
        action="decision_override" if data.override_requirements and data.decision == ApplicationStatus.ACCEPTED else "decision",
    )
    await db_session.commit()
    await db_session.refresh(application)
    return await _read(db_session, application)


async def enroll_applicant(
    request: Request, application_uuid: str, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    """Accepted applicant -> cohort student record (student number)."""
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    if application.status != ApplicationStatus.ACCEPTED:
        raise conflict("Only accepted applicants can be enrolled")
    cohort = await db_session.get(Cohort, application.cohort_id)
    # Refuses (409) when the applicant already has an inactive record here.
    membership = await students_svc.admit_user(db_session, cohort, application.applicant_id)  # type: ignore[arg-type]
    application.membership_id = membership.id
    await _set_status(
        db_session, application, current_user, ApplicationStatus.ENROLLED, action="enrolled",
        note=f"Student number {membership.student_number}",
    )
    await db_session.commit()
    await db_session.refresh(application)
    return await _read(db_session, application)


async def withdraw_application(
    request: Request, application_uuid: str, note: Optional[str], current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    staff = await _require_applicant_or_staff(request, db_session, current_user, application, write=True)
    if application.status not in OPEN_STATES:
        raise conflict("This application is already closed")
    await _set_status(db_session, application, current_user, ApplicationStatus.WITHDRAWN, note=note, action="withdrawn")
    await db_session.commit()
    await db_session.refresh(application)
    return await _read_for(db_session, application, staff)


# ---------------------------------------------------------------------------
# Documents (private storage, served only through this service)
# ---------------------------------------------------------------------------

async def upload_document(
    request: Request,
    application_uuid: str,
    document_type: str,
    upload: UploadFile,
    current_user: Principal,
    db_session: AsyncSession,
) -> ApplicationRead:
    from src.services.utils.upload_content import upload_file

    application = await _get(db_session, application_uuid)
    staff = await _require_applicant_or_staff(request, db_session, current_user, application, write=True)
    if application.status not in OPEN_STATES - {ApplicationStatus.ACCEPTED}:
        raise conflict("Documents can no longer be added to this application")
    if document_type not in DOCUMENT_TYPES:
        raise bad_request(f"Document type must be one of: {', '.join(DOCUMENT_TYPES)}")
    org = await db_session.get(Organization, application.org_id)
    directory = f"admissions/{application.application_uuid}"
    filename = await upload_file(
        file=upload,
        directory=directory,
        type_of_dir="orgs",
        uuid=org.org_uuid,  # type: ignore[union-attr]
        allowed_types=["document", "image"],
        filename_prefix=document_type,
        max_size=15 * 1024 * 1024,
    )
    document = ApplicationDocument(
        application_id=application.id,
        org_id=application.org_id,
        document_type=document_type,
        original_name=(upload.filename or filename)[:255],
        storage_key=f"orgs/{org.org_uuid}/{directory}/{filename}",  # type: ignore[union-attr]
        mime_type=upload.content_type,
        status=DocumentStatus.PENDING,
        document_uuid=f"admdoc_{uuid4()}",
        creation_date=now(),
    )
    db_session.add(document)
    await _log(db_session, application, current_user, "document_uploaded", note=f"{document_type}: {document.original_name}")
    await db_session.commit()
    return await _read_for(db_session, application, staff)


async def _get_document(db_session: AsyncSession, application: AdmissionApplication, document_uuid: str) -> ApplicationDocument:
    document = await get_by_uuid_or_404(
        db_session, ApplicationDocument, ApplicationDocument.document_uuid, document_uuid, "Document"
    )
    if document.application_id != application.id:
        raise bad_request("Document does not belong to this application")
    return document


async def serve_document(
    request: Request, application_uuid: str, document_uuid: str, current_user: Principal, db_session: AsyncSession
):
    from src.services.courses.transfer.storage_utils import get_content_delivery_type
    from src.services.media.media_serve import _headers, _mime_for, _serve_fs, _serve_s3
    from src.services.utils.http_headers import content_disposition

    application = await _get(db_session, application_uuid)
    await _require_applicant_or_staff(request, db_session, current_user, application, write=False)
    document = await _get_document(db_session, application, document_uuid)
    mime = document.mime_type or _mime_for(document.storage_key)
    headers = _headers(mime, False)
    headers["Content-Disposition"] = content_disposition(document.original_name)
    if get_content_delivery_type() == "s3api":
        return _serve_s3(document.storage_key, mime, headers, None, False)
    return _serve_fs(document.storage_key, mime, headers, None, False)


async def review_document(
    request: Request,
    application_uuid: str,
    document_uuid: str,
    data: DocumentReview,
    current_user: Principal,
    db_session: AsyncSession,
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    document = await _get_document(db_session, application, document_uuid)
    if data.status == DocumentStatus.REJECTED and not (data.note or "").strip():
        raise bad_request("Explain why the document is rejected")
    document.status = data.status
    document.review_note = data.note
    document.reviewed_by_id = resolve_acting_user_id(current_user) or None
    document.reviewed_at = now()
    db_session.add(document)
    await _log(
        db_session, application, current_user, f"document_{data.status.value}",
        note=f"{document.document_type}: {data.note or ''}".strip(": "),
    )
    await db_session.commit()
    return await _read(db_session, application)


# ---------------------------------------------------------------------------
# Entrance test attempts
# ---------------------------------------------------------------------------

async def schedule_test(
    request: Request, application_uuid: str, data: TestAttemptCreate, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    if application.status not in (ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WAITLISTED):
        raise conflict("Tests can only be scheduled for applications in review")
    test = await get_by_uuid_or_404(db_session, EntranceTest, EntranceTest.test_uuid, data.test_uuid, "Entrance test")
    if test.program_id != application.program_id:
        raise bad_request("This test belongs to another program")
    if not test.active:
        raise conflict("This entrance test is inactive")
    attempts = (
        await db_session.execute(
            select(EntranceTestAttempt).where(
                EntranceTestAttempt.application_id == application.id, EntranceTestAttempt.test_id == test.id
            )
        )
    ).scalars().all()
    if any(a.status == TestAttemptStatus.PASSED for a in attempts):
        raise conflict("The applicant already passed this test")
    if any(a.status in (TestAttemptStatus.SCHEDULED, TestAttemptStatus.PENDING_REVIEW) for a in attempts):
        raise conflict("An attempt is already scheduled")
    if len(attempts) >= test.attempt_limit:
        raise conflict(f"Attempt limit reached ({test.attempt_limit})")
    attempt = EntranceTestAttempt(
        application_id=application.id,
        test_id=test.id,
        org_id=application.org_id,
        attempt_number=len(attempts) + 1,
        scheduled_at=data.scheduled_at,
        status=TestAttemptStatus.SCHEDULED,
        attempt_uuid=f"testattempt_{uuid4()}",
        update_date=now(),
    )
    db_session.add(attempt)
    await _log(db_session, application, current_user, "test_scheduled", note=f"{test.code} attempt {attempt.attempt_number}")
    await db_session.commit()
    return await _read(db_session, application)


async def _online_test_score(db_session: AsyncSession, test: EntranceTest, user_id: int) -> Optional[float]:
    if not test.assignment_uuid:
        return None
    assignment = (
        await db_session.execute(select(Assignment).where(Assignment.assignment_uuid == test.assignment_uuid))
    ).scalars().first()
    if not assignment:
        return None
    submission = (
        await db_session.execute(
            select(AssignmentUserSubmission).where(
                AssignmentUserSubmission.assignment_id == assignment.id,
                AssignmentUserSubmission.user_id == user_id,
                AssignmentUserSubmission.submission_status == AssignmentUserSubmissionStatus.GRADED,
            )
        )
    ).scalars().first()
    if not submission:
        return None
    total = (
        await db_session.execute(
            select(func.coalesce(func.sum(AssignmentTask.max_grade_value), 0)).where(AssignmentTask.assignment_id == assignment.id)
        )
    ).scalar() or 0
    if not total:
        return None
    return round((submission.grade or 0) / float(total) * test.max_score, 2)


async def record_test_result(
    request: Request,
    application_uuid: str,
    attempt_uuid: str,
    data: TestAttemptResult,
    current_user: Principal,
    db_session: AsyncSession,
) -> ApplicationRead:
    """Record a score (passed/failed is derived from the passing score), mark
    absent, or pull the score of an online test from its LMS assignment."""
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    attempt = await get_by_uuid_or_404(
        db_session, EntranceTestAttempt, EntranceTestAttempt.attempt_uuid, attempt_uuid, "Test attempt"
    )
    if attempt.application_id != application.id:
        raise bad_request("Attempt does not belong to this application")
    test = await db_session.get(EntranceTest, attempt.test_id)
    if data.absent:
        attempt.score = None
        attempt.status = TestAttemptStatus.ABSENT
    else:
        score = data.score
        if score is None:
            score = await _online_test_score(db_session, test, application.applicant_id)  # type: ignore[arg-type]
            if score is None:
                attempt.status = TestAttemptStatus.PENDING_REVIEW
        if score is not None:
            if not (0 <= score <= test.max_score):  # type: ignore[union-attr]
                raise bad_request(f"Score must be between 0 and {test.max_score:g}")  # type: ignore[union-attr]
            attempt.score = score
            attempt.status = TestAttemptStatus.PASSED if score >= test.passing_score else TestAttemptStatus.FAILED  # type: ignore[union-attr]
    attempt.recorded_by_id = resolve_acting_user_id(current_user) or None
    attempt.update_date = now()
    db_session.add(attempt)
    await _log(
        db_session, application, current_user, "test_result",
        note=f"{test.code} attempt {attempt.attempt_number}: {attempt.status.value}"  # type: ignore[union-attr]
        + (f" ({attempt.score:g})" if attempt.score is not None else ""),
    )
    await db_session.commit()
    return await _read(db_session, application)


# ---------------------------------------------------------------------------
# Interviews
# ---------------------------------------------------------------------------

async def _panel_ids(db_session: AsyncSession, org_id: int, uuids: List[str]) -> List[int]:
    ids = []
    for uuid in uuids:
        user_id = await resolve_org_user(db_session, org_id, uuid, label="Panel member")
        if user_id and user_id not in ids:
            ids.append(user_id)
    return ids


async def schedule_interview(
    request: Request, application_uuid: str, data: InterviewCreate, current_user: Principal, db_session: AsyncSession
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    if application.status not in (ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WAITLISTED):
        raise conflict("Interviews can only be scheduled for applications in review")
    interview = AdmissionInterview(
        application_id=application.id,
        org_id=application.org_id,
        scheduled_at=data.scheduled_at,
        location=data.location,
        panel=await _panel_ids(db_session, application.org_id, data.panel_uuids),
        status=InterviewStatus.SCHEDULED,
        interview_uuid=f"interview_{uuid4()}",
        update_date=now(),
    )
    db_session.add(interview)
    await _log(db_session, application, current_user, "interview_scheduled", note=data.scheduled_at)
    await db_session.commit()
    return await _read(db_session, application)


async def update_interview(
    request: Request,
    application_uuid: str,
    interview_uuid: str,
    data: InterviewUpdate,
    current_user: Principal,
    db_session: AsyncSession,
) -> ApplicationRead:
    application = await _get(db_session, application_uuid)
    await _require_staff(request, db_session, current_user, await _program(db_session, application.program_id))
    interview = await get_by_uuid_or_404(
        db_session, AdmissionInterview, AdmissionInterview.interview_uuid, interview_uuid, "Interview"
    )
    if interview.application_id != application.id:
        raise bad_request("Interview does not belong to this application")
    update = data.model_dump(exclude_unset=True)
    if "panel_uuids" in update:
        interview.panel = await _panel_ids(db_session, application.org_id, update.pop("panel_uuids") or [])
    if update.get("score") is not None and not (0 <= update["score"] <= 100):
        raise bad_request("Interview score must be between 0 and 100")
    if update.get("status") == InterviewStatus.COMPLETED and not (update.get("recommendation") or interview.recommendation):
        raise bad_request("Record the panel recommendation when completing the interview")
    for key, value in update.items():
        setattr(interview, key, value)
    interview.update_date = now()
    db_session.add(interview)
    if "status" in update or "recommendation" in update:
        await _log(
            db_session, application, current_user, "interview_updated",
            note=f"{interview.status.value}"
            + (f", {interview.recommendation.value}" if interview.recommendation else "")
            + (f", score {interview.score:g}" if interview.score is not None else ""),
        )
    await db_session.commit()
    return await _read(db_session, application)


# ---------------------------------------------------------------------------
# Interview panels (lecturers evaluate the applicants they interview)
# ---------------------------------------------------------------------------

# Applications a panel can still evaluate.
PANEL_OPEN_STATES = {ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WAITLISTED}


async def _panel_read(
    db_session: AsyncSession, interview: AdmissionInterview, application: AdmissionApplication, user_id: Optional[int]
) -> PanelInterviewRead:
    program = await db_session.get(Program, application.program_id)
    cohort = await db_session.get(Cohort, application.cohort_id)
    applicant = await db_session.get(User, application.applicant_id)
    panel = []
    for uid in interview.panel or []:
        member = await db_session.get(User, uid)
        if member:
            panel.append(UserReadAuthor.model_validate(member))
    return PanelInterviewRead(
        interview_uuid=interview.interview_uuid,
        scheduled_at=interview.scheduled_at,
        location=interview.location,
        status=interview.status,
        score=interview.score,
        recommendation=interview.recommendation,
        notes=interview.notes,
        panel=panel,
        application_uuid=application.application_uuid,
        application_number=application.application_number,
        application_status=application.status.value,
        applicant=UserReadAuthor.model_validate(applicant),
        program_name=program.name if program else "",
        cohort_code=cohort.code if cohort else None,
        cohort_name=cohort.name if cohort else "",
        profile=ApplicantProfile(**(application.profile or {})),
        can_evaluate=bool(user_id)
        and user_id in (interview.panel or [])
        and interview.status in (InterviewStatus.SCHEDULED, InterviewStatus.COMPLETED)
        and application.status in PANEL_OPEN_STATES,
    )


async def list_my_interviews(org_id: int, current_user: Principal, db_session: AsyncSession) -> List[PanelInterviewRead]:
    """Interviews the caller sits on the panel of, soonest first."""
    await require_academic_member(current_user, org_id, db_session)
    user_id = resolve_acting_user_id(current_user)
    if not user_id:
        return []
    rows = (
        await db_session.execute(
            select(AdmissionInterview, AdmissionApplication)
            .join(AdmissionApplication, AdmissionApplication.id == AdmissionInterview.application_id)  # type: ignore
            .where(AdmissionInterview.org_id == org_id)
        )
    ).all()
    mine = [(i, a) for i, a in rows if user_id in (i.panel or [])]
    mine.sort(key=lambda r: (r[0].status != InterviewStatus.SCHEDULED, r[0].scheduled_at or ""))
    return [await _panel_read(db_session, i, a, user_id) for i, a in mine]


async def evaluate_interview(
    interview_uuid: str, data: InterviewEvaluation, current_user: Principal, db_session: AsyncSession
) -> PanelInterviewRead:
    """A panel member records the score, recommendation and notes. The
    committee still takes the decision on the application."""
    interview = await get_by_uuid_or_404(
        db_session, AdmissionInterview, AdmissionInterview.interview_uuid, interview_uuid, "Interview"
    )
    application = await db_session.get(AdmissionApplication, interview.application_id)
    user_id = resolve_acting_user_id(current_user)
    if not user_id or user_id not in (interview.panel or []):
        raise HTTPException(status_code=403, detail="Only members of this interview panel can evaluate it")
    await require_academic_member(current_user, interview.org_id, db_session)
    if application is None or application.status not in PANEL_OPEN_STATES:
        raise conflict("The application is no longer under review; the interview can't be changed")
    if interview.status not in (InterviewStatus.SCHEDULED, InterviewStatus.COMPLETED):
        raise conflict(f"This interview is {interview.status.value}")
    if data.score is not None and not (0 <= data.score <= 100):
        raise bad_request("Interview score must be between 0 and 100")
    interview.score = data.score
    interview.recommendation = data.recommendation
    interview.notes = data.notes
    interview.status = InterviewStatus.COMPLETED
    interview.update_date = now()
    db_session.add(interview)
    await _log(
        db_session, application, current_user, "interview_evaluated",
        note=f"{data.recommendation.value}" + (f", score {data.score:g}" if data.score is not None else ""),
    )
    await db_session.commit()
    await db_session.refresh(interview)
    return await _panel_read(db_session, interview, application, user_id)
