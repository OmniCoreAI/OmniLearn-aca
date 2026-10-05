"""Organization-wide academic calendar: Academic Years and Terms.

Terms are master data shared by every program and cohort (a single "Fall 2026"
rather than one semester row per cohort). Course offerings are scheduled into a
term; cohorts reference the term they were admitted in.
"""
from enum import Enum
from typing import Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AcademicYearStatus(str, Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    CLOSED = "closed"


class AcademicYearBase(SQLModel):
    code: str  # e.g. "2026/2027" (validated)
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: AcademicYearStatus = Field(default=AcademicYearStatus.PLANNED)


class AcademicYear(AcademicYearBase, table=True):
    __table_args__ = (
        Index("uq_academicyear_org_code", "org_id", "code", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    status: AcademicYearStatus = Field(
        default=AcademicYearStatus.PLANNED,
        sa_column=Column(SAEnum(AcademicYearStatus, name="academic_year_status"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    academic_year_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class AcademicYearCreate(AcademicYearBase):
    pass


class AcademicYearUpdate(SQLModel):
    code: Optional[str] = None
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[AcademicYearStatus] = None


class AcademicYearRead(AcademicYearBase):
    id: int
    org_id: int
    academic_year_uuid: str
    creation_date: str
    update_date: str


class TermType(str, Enum):
    FALL = "fall"
    SPRING = "spring"
    SUMMER = "summer"
    CUSTOM = "custom"


class TermStatus(str, Enum):
    PLANNED = "planned"
    REGISTRATION = "registration"
    IN_PROGRESS = "in_progress"
    EXAMS = "exams"
    CLOSED = "closed"


class AcademicTermBase(SQLModel):
    name: Optional[str] = None
    term_type: TermType = Field(default=TermType.FALL)
    order: int = Field(default=0)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    add_drop_end: Optional[str] = None
    exam_start: Optional[str] = None
    exam_end: Optional[str] = None
    grade_deadline: Optional[str] = None
    status: TermStatus = Field(default=TermStatus.PLANNED)


class AcademicTerm(AcademicTermBase, table=True):
    __table_args__ = (
        Index("uq_academicterm_org_code", "org_id", "code", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    term_type: TermType = Field(
        default=TermType.FALL,
        sa_column=Column(SAEnum(TermType, name="academic_term_type"), nullable=True),
    )
    status: TermStatus = Field(
        default=TermStatus.PLANNED,
        sa_column=Column(SAEnum(TermStatus, name="academic_term_status"), nullable=True),
    )
    # System-generated, e.g. "FALL-2026".
    code: str = Field(default="")
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    academic_year_id: int = Field(
        sa_column=Column(Integer, ForeignKey("academicyear.id", ondelete="CASCADE"), index=True)
    )
    term_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class AcademicTermCreate(AcademicTermBase):
    academic_year_uuid: str
    # Optional explicit code for CUSTOM terms; otherwise generated.
    code: Optional[str] = None


class AcademicTermUpdate(SQLModel):
    name: Optional[str] = None
    order: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    add_drop_end: Optional[str] = None
    exam_start: Optional[str] = None
    exam_end: Optional[str] = None
    grade_deadline: Optional[str] = None
    status: Optional[TermStatus] = None


class AcademicTermRead(AcademicTermBase):
    id: int
    org_id: int
    code: str
    academic_year_id: int
    academic_year_code: Optional[str] = None
    term_uuid: str
    creation_date: str
    update_date: str
