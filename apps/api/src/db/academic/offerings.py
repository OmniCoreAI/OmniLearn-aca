"""Course offerings, their sessions, and student enrollments.

A ``CourseOffering`` is one delivery of a catalog course in a term (optionally
for a specific cohort and section). It owns its instructor, capacity, schedule,
roster and a content course holding the term-specific materials.

``CohortMembership`` is the student's program-level academic record (student
number + status). ``Enrollment`` is a student's registration in an offering.
"""
from enum import Enum
from typing import Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.users import UserReadAuthor
from src.db.academic import cohorts as _cohorts  # noqa: F401  (FK targets)
from src.db.usergroups import UserGroup as _UserGroup  # noqa: F401


class OfferingStatus(str, Enum):
    PLANNED = "planned"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CourseOfferingBase(SQLModel):
    section: str = Field(default="A")
    classroom: Optional[str] = None
    capacity: Optional[int] = None
    status: OfferingStatus = Field(default=OfferingStatus.PLANNED)


class CourseOffering(CourseOfferingBase, table=True):
    __table_args__ = (
        UniqueConstraint(
            "academic_course_id", "term_id", "cohort_id", "section",
            name="uq_courseoffering_course_term_cohort_section",
        ),
        Index("ix_courseoffering_term", "term_id"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    status: OfferingStatus = Field(
        default=OfferingStatus.PLANNED,
        sa_column=Column(SAEnum(OfferingStatus, name="offering_status"), nullable=True),
    )
    code: str = Field(default="")  # generated: "<COURSE>-<TERM>-<SECTION>"
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    academic_course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("academiccourse.id", ondelete="CASCADE"), index=True)
    )
    term_id: int = Field(
        sa_column=Column(Integer, ForeignKey("academicterm.id", ondelete="CASCADE"))
    )
    cohort_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("cohort.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    curriculum_item_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("curriculumitem.id", ondelete="SET NULL"), nullable=True),
    )
    instructor_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    teaching_assistant_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    # LMS course holding this delivery's materials/assignments.
    content_course_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="SET NULL"), nullable=True),
    )
    # Roster group: each registered enrollment is a member; the group is linked
    # to the content course so access is granted/revoked per enrollment.
    usergroup_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("usergroup.id", ondelete="SET NULL"), nullable=True),
    )
    offering_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    # Grade workflow: open -> submitted (instructor) -> approved | returned (coordinator)
    grade_status: str = Field(default="open")
    grade_note: Optional[str] = None
    grades_submitted_at: Optional[str] = None
    grades_submitted_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    grades_approved_at: Optional[str] = None
    grades_approved_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )


class CourseOfferingCreate(CourseOfferingBase):
    academic_course_uuid: str
    term_uuid: str
    cohort_uuid: Optional[str] = None
    instructor_uuid: Optional[str] = None
    teaching_assistant_uuid: Optional[str] = None
    content_course_uuid: Optional[str] = None
    # When no content course is given, clone the catalog template (if any).
    clone_template: bool = True


class CourseOfferingUpdate(SQLModel):
    section: Optional[str] = None
    classroom: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[OfferingStatus] = None
    instructor_uuid: Optional[str] = None
    teaching_assistant_uuid: Optional[str] = None
    content_course_uuid: Optional[str] = None


class CourseOfferingRead(CourseOfferingBase):
    id: int
    org_id: int
    code: str
    offering_uuid: str
    academic_course_uuid: str
    course_code: str
    course_name: str
    credits: float
    term_uuid: str
    term_code: str
    cohort_uuid: Optional[str] = None
    cohort_code: Optional[str] = None
    cohort_name: Optional[str] = None
    requirement: Optional[str] = None
    instructor: Optional[UserReadAuthor] = None
    teaching_assistant: Optional[UserReadAuthor] = None
    content_course_uuid: Optional[str] = None
    content_course_name: Optional[str] = None
    enrolled_count: int = 0
    grade_status: str = "open"
    creation_date: str
    update_date: str


class OfferingSessionBase(SQLModel):
    title: Optional[str] = None
    session_type: Optional[str] = None  # lecture, seminar, lab, exam...
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    location: Optional[str] = None
    order: int = Field(default=0)


class OfferingSession(OfferingSessionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    offering_id: int = Field(
        sa_column=Column(Integer, ForeignKey("courseoffering.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    session_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class OfferingSessionCreate(OfferingSessionBase):
    pass


class OfferingSessionUpdate(SQLModel):
    title: Optional[str] = None
    session_type: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    location: Optional[str] = None
    order: Optional[int] = None


class OfferingSessionRead(OfferingSessionBase):
    session_uuid: str


# ---------------------------------------------------------------------------
# Student records
# ---------------------------------------------------------------------------

class MembershipStatus(str, Enum):
    ACTIVE = "active"
    DEFERRED = "deferred"
    SUSPENDED = "suspended"
    WITHDRAWN = "withdrawn"
    COMPLETED = "completed"
    GRADUATED = "graduated"


class CohortMembership(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("cohort_id", "user_id", name="uq_cohortmembership_cohort_user"),
        Index("uq_cohortmembership_org_student_number", "org_id", "student_number", unique=True),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    cohort_id: int = Field(
        sa_column=Column(Integer, ForeignKey("cohort.id", ondelete="CASCADE"), index=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    student_number: str = Field(default="")
    status: MembershipStatus = Field(
        default=MembershipStatus.ACTIVE,
        sa_column=Column(SAEnum(MembershipStatus, name="cohort_membership_status"), nullable=True),
    )
    admitted_at: str = ""
    status_changed_at: str = ""
    membership_uuid: str = Field(default="", index=True)


class CohortMembershipCreate(SQLModel):
    user_uuid: str


class CohortMembershipUpdate(SQLModel):
    status: MembershipStatus


class CohortMembershipRead(SQLModel):
    membership_uuid: str
    student_number: str
    status: MembershipStatus
    admitted_at: str
    status_changed_at: str
    user: UserReadAuthor
    cohort_uuid: str
    cohort_code: Optional[str] = None
    cohort_name: Optional[str] = None
    program_name: Optional[str] = None
    program_uuid: Optional[str] = None
    enrolled_offerings: int = 0


class EnrollmentStatus(str, Enum):
    REGISTERED = "registered"
    DROPPED = "dropped"
    WITHDRAWN = "withdrawn"
    COMPLETED = "completed"
    FAILED = "failed"


class Enrollment(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("offering_id", "user_id", name="uq_enrollment_offering_user"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    offering_id: int = Field(
        sa_column=Column(Integer, ForeignKey("courseoffering.id", ondelete="CASCADE"), index=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    membership_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("cohortmembership.id", ondelete="SET NULL"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    status: EnrollmentStatus = Field(
        default=EnrollmentStatus.REGISTERED,
        sa_column=Column(SAEnum(EnrollmentStatus, name="enrollment_status"), nullable=True),
    )
    registered_at: str = ""
    status_changed_at: str = ""
    enrollment_uuid: str = Field(default="", index=True)
    # Official result, written when the offering's grades are approved.
    final_score: Optional[float] = None
    letter_grade: Optional[str] = None
    grade_points: Optional[float] = None
    result_passed: Optional[bool] = None
    graded_at: Optional[str] = None


class EnrollmentCreate(SQLModel):
    user_uuid: str


class EnrollmentUpdate(SQLModel):
    status: EnrollmentStatus


class EnrollmentRead(SQLModel):
    enrollment_uuid: str
    status: EnrollmentStatus
    registered_at: str
    status_changed_at: str
    user: UserReadAuthor
    student_number: Optional[str] = None
    offering_uuid: str
    offering_code: str
    final_score: Optional[float] = None
    letter_grade: Optional[str] = None
    grade_points: Optional[float] = None
    result_passed: Optional[bool] = None
