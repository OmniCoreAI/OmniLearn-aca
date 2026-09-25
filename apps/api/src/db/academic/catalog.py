"""Course catalog: the reusable, single-source-of-truth academic course.

An ``AcademicCourse`` (e.g. "AI-501 Machine Learning") is defined once and
offered many times (see ``CourseOffering``). Reusable materials live in an
optional template LMS course; semester-specific content lives on each
offering's own content course.
"""
from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.courses.courses import Course as _Course  # noqa: F401  (FK target)


class AcademicCourseType(str, Enum):
    CORE = "core"
    ELECTIVE = "elective"
    RESEARCH = "research"
    THESIS = "thesis"


class AcademicCourseStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    RETIRED = "retired"


class AcademicCourseBase(SQLModel):
    code: str
    name: str
    description: Optional[str] = None
    credits: float = Field(default=0)
    contact_hours: Optional[float] = None
    level: Optional[int] = None  # e.g. 500, 600, 700
    course_type: AcademicCourseType = Field(default=AcademicCourseType.CORE)
    department: Optional[str] = None
    status: AcademicCourseStatus = Field(default=AcademicCourseStatus.ACTIVE)


class AcademicCourse(AcademicCourseBase, table=True):
    __table_args__ = (
        Index("uq_academiccourse_org_code", "org_id", "code", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    course_type: AcademicCourseType = Field(
        default=AcademicCourseType.CORE,
        sa_column=Column(SAEnum(AcademicCourseType, name="academic_course_type"), nullable=True),
    )
    status: AcademicCourseStatus = Field(
        default=AcademicCourseStatus.ACTIVE,
        sa_column=Column(SAEnum(AcademicCourseStatus, name="academic_course_status"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # LMS course holding reusable materials (syllabus, references, standard
    # lecture notes). Offerings clone it into their own content course.
    template_course_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="SET NULL"), nullable=True),
    )
    learning_outcomes: Optional[list] = Field(default=None, sa_column=Column(JSONB))
    academic_course_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class AcademicCourseCreate(AcademicCourseBase):
    template_course_uuid: Optional[str] = None
    learning_outcomes: Optional[List[str]] = None


class AcademicCourseUpdate(SQLModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    credits: Optional[float] = None
    contact_hours: Optional[float] = None
    level: Optional[int] = None
    course_type: Optional[AcademicCourseType] = None
    department: Optional[str] = None
    status: Optional[AcademicCourseStatus] = None
    template_course_uuid: Optional[str] = None
    learning_outcomes: Optional[List[str]] = None


class PrerequisiteRef(SQLModel):
    academic_course_uuid: str
    code: str
    name: str
    min_grade: Optional[str] = None


class AcademicCourseRead(AcademicCourseBase):
    id: int
    org_id: int
    academic_course_uuid: str
    template_course_id: Optional[int] = None
    template_course_uuid: Optional[str] = None
    learning_outcomes: Optional[List[str]] = None
    prerequisites: List[PrerequisiteRef] = []
    offering_count: int = 0
    creation_date: str
    update_date: str


class CoursePrerequisite(SQLModel, table=True):
    """Course-level prerequisite (never mixed with admission requirements)."""

    __table_args__ = (
        UniqueConstraint("academic_course_id", "prerequisite_id", name="uq_courseprerequisite_pair"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    academic_course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("academiccourse.id", ondelete="CASCADE"), index=True)
    )
    prerequisite_id: int = Field(
        sa_column=Column(Integer, ForeignKey("academiccourse.id", ondelete="CASCADE"))
    )
    min_grade: Optional[str] = None
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    creation_date: str = ""


class PrerequisiteSet(SQLModel):
    prerequisite_uuid: str
    min_grade: Optional[str] = None
