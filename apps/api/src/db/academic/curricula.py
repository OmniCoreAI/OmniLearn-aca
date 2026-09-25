"""Versioned program curricula.

A Curriculum belongs to a Program and is versioned (e.g. "2026.1") so a new
cohort can follow a new structure without rewriting the academic history of
older cohorts. Items place catalog courses into (year, term) slots.
"""
from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.academic import catalog as _catalog  # noqa: F401  (FK target)
from src.db.academic import programs as _programs  # noqa: F401  (FK target)


class CurriculumStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    RETIRED = "retired"


class CurriculumRequirement(str, Enum):
    REQUIRED = "required"
    ELECTIVE = "elective"


class CurriculumBase(SQLModel):
    version: str  # e.g. "2026.1"
    name: Optional[str] = None
    description: Optional[str] = None
    effective_date: Optional[str] = None
    status: CurriculumStatus = Field(default=CurriculumStatus.DRAFT)


class Curriculum(CurriculumBase, table=True):
    __table_args__ = (
        Index("uq_curriculum_program_version", "program_id", "version", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    status: CurriculumStatus = Field(
        default=CurriculumStatus.DRAFT,
        sa_column=Column(SAEnum(CurriculumStatus, name="curriculum_status"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), index=True)
    )
    curriculum_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class CurriculumCreate(CurriculumBase):
    pass


class CurriculumUpdate(SQLModel):
    version: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    effective_date: Optional[str] = None
    status: Optional[CurriculumStatus] = None


class CurriculumItemBase(SQLModel):
    year_no: int = Field(default=1)
    term_no: int = Field(default=1)  # term within the year (1, 2, 3=summer)
    requirement: CurriculumRequirement = Field(default=CurriculumRequirement.REQUIRED)
    min_passing_grade: Optional[str] = None
    order: int = Field(default=0)


class CurriculumItem(CurriculumItemBase, table=True):
    __table_args__ = (
        UniqueConstraint("curriculum_id", "academic_course_id", name="uq_curriculumitem_course"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    requirement: CurriculumRequirement = Field(
        default=CurriculumRequirement.REQUIRED,
        sa_column=Column(SAEnum(CurriculumRequirement, name="curriculum_requirement"), nullable=True),
    )
    curriculum_id: int = Field(
        sa_column=Column(Integer, ForeignKey("curriculum.id", ondelete="CASCADE"), index=True)
    )
    academic_course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("academiccourse.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    curriculum_item_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class CurriculumItemCreate(CurriculumItemBase):
    academic_course_uuid: str


class CurriculumItemUpdate(SQLModel):
    year_no: Optional[int] = None
    term_no: Optional[int] = None
    requirement: Optional[CurriculumRequirement] = None
    min_passing_grade: Optional[str] = None
    order: Optional[int] = None


class CurriculumItemRead(CurriculumItemBase):
    curriculum_item_uuid: str
    academic_course_uuid: str
    course_code: str
    course_name: str
    credits: float
    course_type: str


class CurriculumRead(CurriculumBase):
    id: int
    org_id: int
    program_id: int
    curriculum_uuid: str
    items: List[CurriculumItemRead] = []
    total_credits: float = 0
    required_credits: float = 0
    elective_credits: float = 0
    cohort_count: int = 0
    creation_date: str
    update_date: str


class CurriculumClone(SQLModel):
    version: str
    name: Optional[str] = None
