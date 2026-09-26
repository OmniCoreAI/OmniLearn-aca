"""Postgraduate admissions.

Program-level admission requirements (structured rules, separate from course
prerequisites), entrance tests, applications to a cohort intake with
documents, test attempts, interviews and a full audit trail of decisions.

Workflow:
    draft -> submitted -> under_review -> accepted | rejected | waitlisted
    waitlisted -> accepted | rejected
    accepted -> enrolled (creates the student record in the cohort)
    any open state -> withdrawn
"""
from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.academic import offerings as _offerings  # noqa: F401  (FK targets)
from src.db.users import UserReadAuthor


# ---------------------------------------------------------------------------
# Requirements & entrance tests (program configuration)
# ---------------------------------------------------------------------------

class RequirementType(str, Enum):
    DEGREE = "degree"              # config: {"degree_level": "bachelor"|"master"}
    MIN_GPA = "min_gpa"            # config: {"min_gpa": 2.75} on a 4.0 scale
    LANGUAGE = "language"          # config: {"test": "IELTS", "min_score": 6.5}
    EXPERIENCE = "experience"      # config: {"years": 2}
    DOCUMENT = "document"          # config: {"document_type": "transcript"}
    ENTRANCE_TEST = "entrance_test"  # config: {"test_uuid": "..."}
    INTERVIEW = "interview"        # config: {"min_score": 60} (optional)
    OTHER = "other"                # checked manually by staff


class AdmissionRequirementBase(SQLModel):
    requirement_type: RequirementType
    label: str
    description: Optional[str] = None
    mandatory: bool = Field(default=True)
    order: int = Field(default=0)


class AdmissionRequirement(AdmissionRequirementBase, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    requirement_type: RequirementType = Field(
        sa_column=Column(SAEnum(RequirementType, name="admission_requirement_type"), nullable=False)
    )
    program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    config: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    requirement_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class AdmissionRequirementCreate(AdmissionRequirementBase):
    config: dict = {}


class AdmissionRequirementUpdate(SQLModel):
    label: Optional[str] = None
    description: Optional[str] = None
    mandatory: Optional[bool] = None
    order: Optional[int] = None
    config: Optional[dict] = None


class AdmissionRequirementRead(AdmissionRequirementBase):
    requirement_uuid: str
    config: dict


class EntranceTestBase(SQLModel):
    code: str
    name: str
    description: Optional[str] = None
    passing_score: float = Field(default=60)
    max_score: float = Field(default=100)
    duration_minutes: Optional[int] = None
    attempt_limit: int = Field(default=1)
    active: bool = Field(default=True)


class EntranceTest(EntranceTestBase, table=True):
    __table_args__ = (
        Index("uq_entrancetest_org_code", "org_id", "code", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    # Optional online test: an LMS assignment/quiz whose graded score is used.
    assignment_uuid: Optional[str] = None
    test_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class EntranceTestCreate(EntranceTestBase):
    assignment_uuid: Optional[str] = None


class EntranceTestUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    passing_score: Optional[float] = None
    max_score: Optional[float] = None
    duration_minutes: Optional[int] = None
    attempt_limit: Optional[int] = None
    active: Optional[bool] = None
    assignment_uuid: Optional[str] = None


class EntranceTestRead(EntranceTestBase):
    test_uuid: str
    assignment_uuid: Optional[str] = None


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WAITLISTED = "waitlisted"
    ENROLLED = "enrolled"
    WITHDRAWN = "withdrawn"


class ApplicantProfile(SQLModel):
    """Self-declared academic background (verified against documents)."""

    degree_level: Optional[str] = None  # bachelor | master | doctorate
    degree_field: Optional[str] = None
    institution: Optional[str] = None
    graduation_year: Optional[int] = None
    gpa: Optional[float] = None
    gpa_scale: Optional[float] = 4.0
    language_test: Optional[str] = None
    language_score: Optional[float] = None
    experience_years: Optional[float] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    statement: Optional[str] = None


class AdmissionApplication(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("cohort_id", "applicant_id", name="uq_application_cohort_applicant"),
        Index("uq_application_org_number", "org_id", "application_number", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    application_number: str = Field(default="")
    program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), index=True)
    )
    cohort_id: int = Field(
        sa_column=Column(Integer, ForeignKey("cohort.id", ondelete="CASCADE"), index=True)
    )
    applicant_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    status: ApplicationStatus = Field(
        default=ApplicationStatus.DRAFT,
        sa_column=Column(SAEnum(ApplicationStatus, name="application_status"), nullable=False),
    )
    profile: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    # Staff overrides of requirement checks: {requirement_uuid: {status, note, by, at}}
    checks: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    decision_note: Optional[str] = None
    decided_by_id: Optional[int] = Field(
        default=None, sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    )
    decided_at: Optional[str] = None
    submitted_at: Optional[str] = None
    membership_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("cohortmembership.id", ondelete="SET NULL"), nullable=True),
    )
    application_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class ApplicationCreate(SQLModel):
    cohort_uuid: str
    # Staff may create on behalf of an org member; applicants omit it.
    applicant_uuid: Optional[str] = None
    profile: ApplicantProfile = ApplicantProfile()


class ApplicationUpdate(SQLModel):
    profile: ApplicantProfile


class DocumentStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class ApplicationDocument(SQLModel, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(
        sa_column=Column(Integer, ForeignKey("admissionapplication.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    document_type: str
    original_name: str = ""
    # Private storage key (orgs/{org}/admissions/{application}/{file}); never public.
    storage_key: str = ""
    mime_type: Optional[str] = None
    status: DocumentStatus = Field(
        default=DocumentStatus.PENDING,
        sa_column=Column(SAEnum(DocumentStatus, name="admission_document_status"), nullable=False),
    )
    review_note: Optional[str] = None
    reviewed_by_id: Optional[int] = Field(
        default=None, sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    )
    reviewed_at: Optional[str] = None
    document_uuid: str = Field(default="", index=True)
    creation_date: str = ""


class DocumentReview(SQLModel):
    status: DocumentStatus
    note: Optional[str] = None


class DocumentRead(SQLModel):
    document_uuid: str
    document_type: str
    original_name: str
    mime_type: Optional[str] = None
    status: DocumentStatus
    review_note: Optional[str] = None
    reviewed_at: Optional[str] = None
    creation_date: str


class TestAttemptStatus(str, Enum):
    SCHEDULED = "scheduled"
    PENDING_REVIEW = "pending_review"
    PASSED = "passed"
    FAILED = "failed"
    ABSENT = "absent"


class EntranceTestAttempt(SQLModel, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(
        sa_column=Column(Integer, ForeignKey("admissionapplication.id", ondelete="CASCADE"), index=True)
    )
    test_id: int = Field(
        sa_column=Column(Integer, ForeignKey("entrancetest.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    attempt_number: int = Field(default=1)
    scheduled_at: Optional[str] = None
    score: Optional[float] = None
    status: TestAttemptStatus = Field(
        default=TestAttemptStatus.SCHEDULED,
        sa_column=Column(SAEnum(TestAttemptStatus, name="entrance_attempt_status"), nullable=False),
    )
    recorded_by_id: Optional[int] = Field(
        default=None, sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    )
    attempt_uuid: str = Field(default="", index=True)
    update_date: str = ""


class TestAttemptCreate(SQLModel):
    test_uuid: str
    scheduled_at: Optional[str] = None


class TestAttemptResult(SQLModel):
    score: Optional[float] = None
    absent: bool = False


class TestAttemptRead(SQLModel):
    attempt_uuid: str
    test_uuid: str
    test_code: str
    test_name: str
    attempt_number: int
    scheduled_at: Optional[str] = None
    score: Optional[float] = None
    passing_score: float
    status: TestAttemptStatus


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class InterviewRecommendation(str, Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    WAITLIST = "waitlist"


class AdmissionInterview(SQLModel, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(
        sa_column=Column(Integer, ForeignKey("admissionapplication.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    scheduled_at: Optional[str] = None
    location: Optional[str] = None
    panel: list = Field(default_factory=list, sa_column=Column(JSONB))  # user ids
    status: InterviewStatus = Field(
        default=InterviewStatus.SCHEDULED,
        sa_column=Column(SAEnum(InterviewStatus, name="admission_interview_status"), nullable=False),
    )
    score: Optional[float] = None
    recommendation: Optional[InterviewRecommendation] = Field(
        default=None,
        sa_column=Column(SAEnum(InterviewRecommendation, name="interview_recommendation"), nullable=True),
    )
    notes: Optional[str] = None
    interview_uuid: str = Field(default="", index=True)
    update_date: str = ""


class InterviewCreate(SQLModel):
    scheduled_at: Optional[str] = None
    location: Optional[str] = None
    panel_uuids: List[str] = []


class InterviewUpdate(SQLModel):
    scheduled_at: Optional[str] = None
    location: Optional[str] = None
    panel_uuids: Optional[List[str]] = None
    status: Optional[InterviewStatus] = None
    score: Optional[float] = None
    recommendation: Optional[InterviewRecommendation] = None
    notes: Optional[str] = None


class InterviewRead(SQLModel):
    interview_uuid: str
    scheduled_at: Optional[str] = None
    location: Optional[str] = None
    panel: List[UserReadAuthor] = []
    status: InterviewStatus
    score: Optional[float] = None
    recommendation: Optional[InterviewRecommendation] = None
    notes: Optional[str] = None


class ApplicationEvent(SQLModel, table=True):
    """Audit trail: every status change, check override and decision."""

    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(
        sa_column=Column(Integer, ForeignKey("admissionapplication.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")))
    actor_id: Optional[int] = Field(
        default=None, sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    )
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    note: Optional[str] = None
    data: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    created_at: str = ""


class ApplicationEventRead(SQLModel):
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    note: Optional[str] = None
    actor: Optional[UserReadAuthor] = None
    created_at: str


class CheckStatus(str, Enum):
    MET = "met"
    NOT_MET = "not_met"
    PENDING = "pending"


class RequirementCheck(SQLModel):
    requirement_uuid: str
    requirement_type: RequirementType
    label: str
    mandatory: bool
    status: CheckStatus
    detail: Optional[str] = None
    overridden: bool = False


class CheckOverride(SQLModel):
    status: Optional[CheckStatus] = None  # None removes the override
    note: Optional[str] = None


class DecisionRequest(SQLModel):
    decision: ApplicationStatus  # accepted | rejected | waitlisted
    note: Optional[str] = None
    # Accept despite unmet mandatory requirements (recorded in the audit trail).
    override_requirements: bool = False


class ApplicationSummary(SQLModel):
    application_uuid: str
    application_number: str
    status: ApplicationStatus
    applicant: UserReadAuthor
    program_uuid: str
    program_name: str
    cohort_uuid: str
    cohort_code: Optional[str] = None
    cohort_name: str
    submitted_at: Optional[str] = None
    decided_at: Optional[str] = None
    eligible: Optional[bool] = None  # all mandatory requirements met
    pending_checks: int = 0
    creation_date: str


class ApplicationRead(ApplicationSummary):
    profile: ApplicantProfile
    checks: List[RequirementCheck]
    documents: List[DocumentRead]
    test_attempts: List[TestAttemptRead]
    interviews: List[InterviewRead]
    events: List[ApplicationEventRead]
    decision_note: Optional[str] = None
    student_number: Optional[str] = None
