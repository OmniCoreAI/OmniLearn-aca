from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.courses.courses import AuthorWithRole
from src.db.users import UserReadAuthor


class ProgramLevel(str, Enum):
    PHD = "phd"
    MASTERS = "masters"
    DIPLOMA = "diploma"


class ProgramStatus(str, Enum):
    """Academic lifecycle of a program, independent of the publish flag."""

    DRAFT = "draft"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


class ProgramBase(SQLModel):
    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    code: Optional[str] = None
    program_level: ProgramLevel = Field(default=ProgramLevel.MASTERS)
    status: ProgramStatus = Field(default=ProgramStatus.DRAFT)
    capacity: Optional[int] = None
    is_paid: bool = Field(default=False)
    price: Optional[float] = None
    currency: Optional[str] = None
    in_plan: bool = Field(default=True)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    thumbnail_image: Optional[str] = Field(default="")
    banner_image: Optional[str] = Field(default="")
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
    status: ProgramStatus = Field(
        default=ProgramStatus.DRAFT,
        sa_column=Column(SAEnum(ProgramStatus, name="program_status"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # Single responsible user for the program. SET NULL so removing the user
    # never cascade-deletes the academic structure.
    coordinator_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    program_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class ProgramCreate(ProgramBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    # The coordinator is addressed by its public user_uuid; the service resolves
    # it to coordinator_id after verifying same-org membership.
    coordinator_uuid: Optional[str] = None
    extra_metadata: Optional[dict] = None


class ProgramUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    about: Optional[str] = None
    code: Optional[str] = None
    program_level: Optional[ProgramLevel] = None
    status: Optional[ProgramStatus] = None
    capacity: Optional[int] = None
    is_paid: Optional[bool] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    in_plan: Optional[bool] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    thumbnail_image: Optional[str] = None
    banner_image: Optional[str] = None
    coordinator_uuid: Optional[str] = None
    public: Optional[bool] = None
    published: Optional[bool] = None
    extra_metadata: Optional[dict] = None


class ProgramRead(ProgramBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    program_uuid: str
    coordinator_id: Optional[int] = None
    coordinator: Optional[UserReadAuthor] = None
    authors: List[AuthorWithRole]
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
