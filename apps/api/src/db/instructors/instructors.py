"""Instructor Management data models.

An **Instructor** is a 1:1 extension of an existing platform ``User`` inside an
organization (the user provides the name, email and login; the Instructor row
adds the management/finance metadata). Instructors are grouped by an
**InstructorCategory**, which carries a base hourly rate plus a table of
**per-language rates** (e.g. English vs Arabic delivery) that an admin/superadmin
can edit. The Finance layer (``finance.py``) resolves the effective rate from the
category for the chosen delivery language and computes ``hours × rate``.
"""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.users import UserReadAuthor


class InstructorStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_LEAVE = "on_leave"


# ---------------------------------------------------------------------------
# Instructor Category (+ per-language rate table)
# ---------------------------------------------------------------------------


class InstructorCategoryBase(SQLModel):
    name: str
    description: Optional[str] = None
    # Base/default rate used when a delivery language has no explicit rate row.
    hourly_rate: Optional[float] = None
    currency: Optional[str] = None


class InstructorCategory(InstructorCategoryBase, table=True):
    __table_args__ = ({"extend_existing": True},)
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    category_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class InstructorCategoryLanguageRate(SQLModel, table=True):
    """A delivery-language-specific hourly rate for a category (e.g. Arabic=X)."""

    __table_args__ = (
        UniqueConstraint("category_id", "language", name="uq_instructorcatlangrate_cat_lang"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("instructorcategory.id", ondelete="CASCADE"), index=True
        )
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    language: str
    hourly_rate: float


class InstructorCategoryLanguageRateRead(SQLModel):
    id: int
    language: str
    hourly_rate: float


class InstructorCategoryLanguageRateInput(SQLModel):
    language: str
    hourly_rate: float


class InstructorCategoryCreate(InstructorCategoryBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    language_rates: Optional[List[InstructorCategoryLanguageRateInput]] = None


class InstructorCategoryUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    hourly_rate: Optional[float] = None
    currency: Optional[str] = None
    # When provided, the language-rate table is fully replaced with this set.
    language_rates: Optional[List[InstructorCategoryLanguageRateInput]] = None


class InstructorCategoryRead(InstructorCategoryBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    category_uuid: str
    language_rates: List[InstructorCategoryLanguageRateRead] = []
    instructor_count: int = 0
    creation_date: str
    update_date: str


# ---------------------------------------------------------------------------
# Instructor (extension of a User)
# ---------------------------------------------------------------------------


class InstructorBase(SQLModel):
    department: Optional[str] = None
    # Languages the instructor can deliver in (labels, e.g. ["English","Arabic"]).
    languages: Optional[List[str]] = Field(default=None, sa_column=Column(JSONB))
    # Free-form contact block: phone, alt_email, address, etc.
    contact_info: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    # Instructor-level fallback rate (used only when the category has no rate).
    hourly_rate: Optional[float] = None
    status: InstructorStatus = Field(default=InstructorStatus.ACTIVE)


class Instructor(InstructorBase, table=True):
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", name="uq_instructor_org_user"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # 1:1 with a platform user (the "extension"). CASCADE: deleting the user
    # removes their instructor profile.
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    category_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("instructorcategory.id", ondelete="SET NULL"), nullable=True, index=True
        ),
    )
    status: InstructorStatus = Field(
        default=InstructorStatus.ACTIVE,
        sa_column=Column(SAEnum(InstructorStatus, name="instructor_status"), nullable=True),
    )
    instructor_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class InstructorCreate(InstructorBase):
    # The platform user this instructor extends, addressed by public user_uuid.
    user_uuid: str
    # Category addressed by its public uuid (optional).
    category_uuid: Optional[str] = None
    extra_metadata: Optional[dict] = None


class InstructorUpdate(SQLModel):
    department: Optional[str] = None
    languages: Optional[List[str]] = None
    contact_info: Optional[dict] = None
    hourly_rate: Optional[float] = None
    status: Optional[InstructorStatus] = None
    category_uuid: Optional[str] = None
    extra_metadata: Optional[dict] = None


class InstructorRead(InstructorBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    instructor_uuid: str
    user_id: int
    user: Optional[UserReadAuthor] = None
    category_id: Optional[int] = None
    category: Optional[InstructorCategoryRead] = None
    creation_date: str
    update_date: str
    extra_metadata: Optional[dict] = None
