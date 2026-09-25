"""Assessment & results: grade scales, weighted assessment components and
component scores per enrollment.

Final results (score, letter, grade points, pass) are stored on the
``Enrollment`` once an offering's grades are approved; GPA and transcripts are
derived from those approved results.
"""
from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.academic import offerings as _offerings  # noqa: F401  (FK targets)


# ---------------------------------------------------------------------------
# Grade scales
# ---------------------------------------------------------------------------

class GradeBand(SQLModel):
    letter: str
    min_score: float  # inclusive lower bound on the 0-100 weighted total
    points: float
    passing: bool = True


class GradeScaleBase(SQLModel):
    name: str
    description: Optional[str] = None
    is_default: bool = Field(default=False)


class GradeScale(GradeScaleBase, table=True):
    __table_args__ = (
        Index("uq_gradescale_org_name", "org_id", "name", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    bands: list = Field(default_factory=list, sa_column=Column(JSONB))
    grade_scale_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class GradeScaleCreate(GradeScaleBase):
    bands: List[GradeBand]


class GradeScaleUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    bands: Optional[List[GradeBand]] = None


class GradeScaleRead(GradeScaleBase):
    id: int
    org_id: int
    grade_scale_uuid: str
    bands: List[GradeBand]
    pass_mark: Optional[float] = None
    program_count: int = 0
    creation_date: str
    update_date: str


# ---------------------------------------------------------------------------
# Assessment components (per offering)
# ---------------------------------------------------------------------------

class ComponentType(str, Enum):
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    MIDTERM = "midterm"
    FINAL_EXAM = "final_exam"
    PROJECT = "project"
    PRACTICAL = "practical"
    RESEARCH_PAPER = "research_paper"
    PRESENTATION = "presentation"
    PARTICIPATION = "participation"
    OTHER = "other"


class AssessmentComponentBase(SQLModel):
    name: str
    component_type: ComponentType = Field(default=ComponentType.ASSIGNMENT)
    weight: float  # percent of the final grade
    max_score: float = Field(default=100)
    due_date: Optional[str] = None
    order: int = Field(default=0)


class AssessmentComponent(AssessmentComponentBase, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    component_type: ComponentType = Field(
        default=ComponentType.ASSIGNMENT,
        sa_column=Column(SAEnum(ComponentType, name="assessment_component_type"), nullable=True),
    )
    offering_id: int = Field(
        sa_column=Column(Integer, ForeignKey("courseoffering.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    # LMS assignments (assignment_uuid) of the content course whose graded
    # submissions feed this component (their percentages are averaged).
    source_assignments: list = Field(default_factory=list, sa_column=Column(JSONB))
    component_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class AssessmentComponentCreate(AssessmentComponentBase):
    source_assignments: List[str] = []


class AssessmentComponentUpdate(SQLModel):
    name: Optional[str] = None
    component_type: Optional[ComponentType] = None
    weight: Optional[float] = None
    max_score: Optional[float] = None
    due_date: Optional[str] = None
    order: Optional[int] = None
    source_assignments: Optional[List[str]] = None


class SourceAssignmentRef(SQLModel):
    assignment_uuid: str
    title: str


class AssessmentComponentRead(AssessmentComponentBase):
    component_uuid: str
    source_assignments: List[SourceAssignmentRef] = []


class ScoreSource(str, Enum):
    AUTO = "auto"      # computed from linked LMS assignment submissions
    MANUAL = "manual"  # entered / overridden by staff


class ComponentScore(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("component_id", "enrollment_id", name="uq_componentscore_component_enrollment"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    component_id: int = Field(
        sa_column=Column(Integer, ForeignKey("assessmentcomponent.id", ondelete="CASCADE"), index=True)
    )
    enrollment_id: int = Field(
        sa_column=Column(Integer, ForeignKey("enrollment.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    score: Optional[float] = None
    source: ScoreSource = Field(
        default=ScoreSource.AUTO,
        sa_column=Column(SAEnum(ScoreSource, name="component_score_source"), nullable=True),
    )
    updated_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    # Audit trail of changes: [{at, by, from, to, source, note}]
    history: list = Field(default_factory=list, sa_column=Column(JSONB))
    update_date: str = ""


class ScoreUpdate(SQLModel):
    enrollment_uuid: str
    component_uuid: str
    score: Optional[float] = None  # None clears a manual override (back to auto)
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Gradebook / results reads
# ---------------------------------------------------------------------------

class GradeStatus(str, Enum):
    OPEN = "open"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    RETURNED = "returned"


class GradebookCell(SQLModel):
    component_uuid: str
    score: Optional[float] = None
    source: Optional[str] = None


class GradebookRow(SQLModel):
    enrollment_uuid: str
    student_number: Optional[str] = None
    user_uuid: str
    name: str
    email: Optional[str] = None
    enrollment_status: str
    cells: List[GradebookCell]
    weighted_total: Optional[float] = None  # 0-100, over components scored so far
    complete: bool = False
    letter_grade: Optional[str] = None
    grade_points: Optional[float] = None
    passed: Optional[bool] = None


class GradebookRead(SQLModel):
    offering_uuid: str
    grade_status: GradeStatus
    grade_note: Optional[str] = None
    grades_submitted_at: Optional[str] = None
    grades_approved_at: Optional[str] = None
    total_weight: float
    scale: GradeScaleRead
    components: List[AssessmentComponentRead]
    rows: List[GradebookRow]


class GradeDecision(SQLModel):
    note: Optional[str] = None


class TranscriptCourse(SQLModel):
    offering_uuid: str
    course_code: str
    course_name: str
    credits: float
    final_score: Optional[float] = None
    letter_grade: Optional[str] = None
    grade_points: Optional[float] = None
    status: str
    counted_in_gpa: bool = True  # False when superseded by a later attempt


class TranscriptTerm(SQLModel):
    term_code: str
    term_name: Optional[str] = None
    courses: List[TranscriptCourse]
    credits_attempted: float
    credits_earned: float
    term_gpa: Optional[float] = None
    cumulative_gpa: Optional[float] = None


class Transcript(SQLModel):
    membership_uuid: str
    student_number: str
    student_name: str
    program_name: Optional[str] = None
    cohort_code: Optional[str] = None
    status: str
    terms: List[TranscriptTerm]
    credits_attempted: float
    credits_earned: float
    cgpa: Optional[float] = None
    program_min_credits: Optional[float] = None
    credits_remaining: Optional[float] = None
