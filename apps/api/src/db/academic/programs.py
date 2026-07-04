from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.courses.courses import AuthorWithRole


class ProgramLevel(str, Enum):
    PHD = "phd"
    MASTERS = "masters"
    DIPLOMA = "diploma"


class ProgramBase(SQLModel):
    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    code: Optional[str] = None
    program_level: ProgramLevel = Field(default=ProgramLevel.MASTERS)
    thumbnail_image: Optional[str] = Field(default="")
    public: bool = Field(default=False)
    published: bool = Field(default=False)


class Program(ProgramBase, table=True):
    __table_args__ = (
        Index("ix_program_org_public_published", "org_id", "public", "published"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    program_level: ProgramLevel = Field(
        default=ProgramLevel.MASTERS,
        sa_column=Column(SAEnum(ProgramLevel, name="program_level"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    program_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class ProgramCreate(ProgramBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    extra_metadata: Optional[dict] = None


class ProgramUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    about: Optional[str] = None
    code: Optional[str] = None
    program_level: Optional[ProgramLevel] = None
    thumbnail_image: Optional[str] = None
    public: Optional[bool] = None
    published: Optional[bool] = None
    extra_metadata: Optional[dict] = None


class ProgramRead(ProgramBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    program_uuid: str
    authors: List[AuthorWithRole]
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
