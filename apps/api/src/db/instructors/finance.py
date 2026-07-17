"""Instructor Finance data models.

An **InstructorWorkLog** records billable hours delivered by an instructor. The
Finance layer resolves the effective hourly rate from the instructor's category
(for the chosen delivery language) and stores a snapshot of the rate and the
computed ``amount = hours × rate`` so financial history survives later rate or
instructor changes.
"""
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from src.db.instructors.instructors import InstructorStatus  # noqa: F401  (kept for module cohesion)


class InstructorWorkLog(SQLModel, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # SET NULL so finance history is retained even if the instructor is removed;
    # the snapshot fields below keep the record self-describing.
    instructor_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("instructor.id", ondelete="SET NULL"), nullable=True, index=True
        ),
    )
    hours: float
    language: Optional[str] = None
    # Snapshots captured at logging time.
    rate_applied: float = 0.0
    amount: float = 0.0
    currency: Optional[str] = None
    work_date: Optional[str] = None
    description: Optional[str] = None
    # Optional attribution to a course (by uuid, no FK to avoid coupling).
    course_uuid: Optional[str] = None
    worklog_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class InstructorWorkLogCreate(SQLModel):
    # Instructor addressed by public uuid.
    instructor_uuid: str
    hours: float
    language: Optional[str] = None
    work_date: Optional[str] = None
    description: Optional[str] = None
    course_uuid: Optional[str] = None


class InstructorWorkLogUpdate(SQLModel):
    hours: Optional[float] = None
    language: Optional[str] = None
    work_date: Optional[str] = None
    description: Optional[str] = None
    course_uuid: Optional[str] = None


class InstructorWorkLogRead(SQLModel):
    id: int
    org_id: int
    worklog_uuid: str
    instructor_id: Optional[int] = None
    instructor_uuid: Optional[str] = None
    instructor_name: Optional[str] = None
    hours: float
    language: Optional[str] = None
    rate_applied: float
    amount: float
    currency: Optional[str] = None
    work_date: Optional[str] = None
    description: Optional[str] = None
    course_uuid: Optional[str] = None
    creation_date: str
    update_date: str


class RateComputationRead(SQLModel):
    """Result of a pure Hours × Rate computation (no persistence)."""

    instructor_uuid: str
    language: Optional[str] = None
    hours: float
    rate_applied: float
    amount: float
    currency: Optional[str] = None
    rate_source: str  # "category_language" | "category_base" | "instructor"


class InstructorFinanceSummaryRead(SQLModel):
    instructor_id: Optional[int] = None
    instructor_uuid: Optional[str] = None
    instructor_name: Optional[str] = None
    total_hours: float = 0.0
    total_amount: float = 0.0
    entry_count: int = 0
    currency: Optional[str] = None


class OrgFinanceSummaryRead(SQLModel):
    org_id: int
    total_hours: float = 0.0
    total_amount: float = 0.0
    entry_count: int = 0
    per_instructor: List[InstructorFinanceSummaryRead] = []
