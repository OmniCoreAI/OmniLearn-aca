from enum import Enum
from typing import Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.users import UserReadAuthor


class CohortStatus(str, Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class CohortBase(SQLModel):
    name: str
    description: Optional[str] = None
    academic_year: Optional[str] = None
    capacity: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: CohortStatus = Field(default=CohortStatus.UPCOMING)


class Cohort(CohortBase, table=True):
    __table_args__ = (
        Index("ix_cohort_program", "program_id"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    status: CohortStatus = Field(
        default=CohortStatus.UPCOMING,
        sa_column=Column(SAEnum(CohortStatus, name="cohort_status"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("program.id", ondelete="CASCADE"), index=True)
    )
    coordinator_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    # The UserGroup created for this cohort drives enrollment/access. SET NULL so
    # deleting the group does not cascade-delete the cohort structure.
    usergroup_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("usergroup.id", ondelete="SET NULL"), nullable=True),
    )
    cohort_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class CohortCreate(CohortBase):
    coordinator_uuid: Optional[str] = None


class CohortUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    academic_year: Optional[str] = None
    capacity: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[CohortStatus] = None
    coordinator_uuid: Optional[str] = None
    extra_metadata: Optional[dict] = None


class CohortRead(CohortBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    program_id: int
    coordinator_id: Optional[int] = None
    coordinator: Optional[UserReadAuthor] = None
    usergroup_id: Optional[int] = None
    enrolled_count: int = 0
    cohort_uuid: str
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
