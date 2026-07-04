from typing import Optional
from sqlalchemy import Column, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class SemesterBase(SQLModel):
    name: str
    description: Optional[str] = None
    order: int = Field(default=0)
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class Semester(SemesterBase, table=True):
    __table_args__ = (
        Index("ix_semester_cohort", "cohort_id"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    cohort_id: int = Field(
        sa_column=Column(Integer, ForeignKey("cohort.id", ondelete="CASCADE"), index=True)
    )
    # Denormalized parent program id for efficient org/program scoped queries.
    program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), index=True)
    )
    semester_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class SemesterCreate(SemesterBase):
    pass


class SemesterUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    extra_metadata: Optional[dict] = None


class SemesterRead(SemesterBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    cohort_id: int
    program_id: int
    semester_uuid: str
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
