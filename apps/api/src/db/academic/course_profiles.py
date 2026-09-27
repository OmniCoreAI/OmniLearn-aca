from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.administration.facilities import FacilityRef
from src.db.users import UserReadAuthor


class CourseOfferingStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"
    ARCHIVED = "archived"


class CourseAddOn(SQLModel):
    """A supplementary add-on for a course offering (e.g. snacks, materials kit)."""

    name: str
    price: Optional[float] = None


# ---------------------------------------------------------------------------
# CourseAcademicProfile — a 1:1 extension of the existing Course. Holds the
# academic/offering attributes so they follow the Course everywhere it is used
# (postgraduate semesters AND training programs) WITHOUT modifying the core
# ``course`` table. Learning materials + question bank are surfaced from the
# course's existing chapters/activities/assignments; certificate reuses the
# existing per-course Certification.
# ---------------------------------------------------------------------------

class CourseAcademicProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("course.id", ondelete="CASCADE"),
            unique=True,
            index=True,
        )
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    credit_hours: Optional[float] = None
    classroom: Optional[str] = None
    capacity: Optional[int] = None
    status: CourseOfferingStatus = Field(
        default=CourseOfferingStatus.DRAFT,
        sa_column=Column(SAEnum(CourseOfferingStatus, name="course_offering_status"), nullable=True),
    )
    issues_certificate: bool = Field(default=False)
    instructor_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    usergroup_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("usergroup.id", ondelete="SET NULL"), nullable=True),
    )
    add_ons: Optional[list] = Field(default=None, sa_column=Column(JSONB))
    # Default room for the course (sessions without their own facility use it).
    facility_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("facility.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    profile_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class CourseScheduleSession(SQLModel, table=True):
    """A scheduled session (class meeting) for a course offering."""

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("courseacademicprofile.id", ondelete="CASCADE"),
            index=True,
        )
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    facility_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("facility.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    order: int = Field(default=0)
    session_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


# ------------------------------- DTOs --------------------------------------

class CourseAcademicProfileUpsert(SQLModel):
    credit_hours: Optional[float] = None
    classroom: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[CourseOfferingStatus] = None
    issues_certificate: Optional[bool] = None
    instructor_uuid: Optional[str] = None
    usergroup_id: Optional[int] = None
    add_ons: Optional[List[CourseAddOn]] = None
    # Default facility (uuid; "" clears). Its sessions are checked for clashes.
    facility_uuid: Optional[str] = None
    allow_conflict: bool = False


class CourseScheduleSessionCreate(SQLModel):
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    order: int = 0
    facility_uuid: Optional[str] = None
    # Book the room even when it clashes with another session / blackout.
    allow_conflict: bool = False


class CourseScheduleSessionUpdate(SQLModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    order: Optional[int] = None
    facility_uuid: Optional[str] = None
    allow_conflict: bool = False


class CourseScheduleSessionRead(SQLModel):
    id: int
    session_uuid: str
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    facility: Optional[FacilityRef] = None
    order: int = 0
    creation_date: str = ""
    update_date: str = ""


class CourseAcademicProfileRead(SQLModel):
    id: int
    profile_uuid: str
    course_id: int
    course_uuid: str
    org_id: int
    credit_hours: Optional[float] = None
    classroom: Optional[str] = None
    capacity: Optional[int] = None
    status: CourseOfferingStatus = CourseOfferingStatus.DRAFT
    issues_certificate: bool = False
    instructor_id: Optional[int] = None
    instructor: Optional[UserReadAuthor] = None
    usergroup_id: Optional[int] = None
    add_ons: Optional[List[CourseAddOn]] = None
    facility: Optional[FacilityRef] = None
    # Surfaced (not stored) from the existing Course subsystems:
    has_course_certification: bool = False
    assignment_count: int = 0
    sessions: List[CourseScheduleSessionRead] = []
    creation_date: str = ""
    update_date: str = ""
