from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.courses.courses import AuthorWithRole


class TrainingType(str, Enum):
    TRAINING_COURSE = "training_course"
    WORKSHOP = "workshop"
    EVENT = "event"
    BOOTCAMP = "bootcamp"
    CONFERENCE = "conference"
    SEMINAR = "seminar"
    CERTIFICATION_PROGRAM = "certification_program"


class TrainingProgramBase(SQLModel):
    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    training_type: TrainingType = Field(default=TrainingType.WORKSHOP)
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    thumbnail_image: Optional[str] = Field(default="")
    public: bool = Field(default=False)
    published: bool = Field(default=False)


class TrainingProgram(TrainingProgramBase, table=True):
    __table_args__ = (
        Index("ix_trainingprogram_org_public_published", "org_id", "public", "published"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    training_type: TrainingType = Field(
        default=TrainingType.WORKSHOP,
        sa_column=Column(SAEnum(TrainingType, name="training_type"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    trainingprogram_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class TrainingProgramCreate(TrainingProgramBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    extra_metadata: Optional[dict] = None


class TrainingProgramUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    about: Optional[str] = None
    training_type: Optional[TrainingType] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    thumbnail_image: Optional[str] = None
    public: Optional[bool] = None
    published: Optional[bool] = None
    extra_metadata: Optional[dict] = None


class TrainingProgramRead(TrainingProgramBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    trainingprogram_uuid: str
    authors: List[AuthorWithRole]
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
