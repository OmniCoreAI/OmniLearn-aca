from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.db.courses.courses import CourseRead


class SemesterCourseBase(SQLModel):
    # Academic metadata lives on the link so the core Course table stays pristine.
    order: int = Field(default=0)
    code: Optional[str] = None
    credit_hours: Optional[float] = None


class SemesterCourse(SemesterCourseBase, table=True):
    """Join table linking a Semester to existing LearnHouse Courses (1:N).

    The unique constraint on ``course_id`` enforces that a Course belongs to at
    most one Semester while a Semester may hold many Courses.
    """

    __table_args__ = (
        UniqueConstraint("course_id", name="uq_semestercourse_course"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    semester_id: int = Field(
        sa_column=Column(Integer, ForeignKey("semester.id", ondelete="CASCADE"), index=True)
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    creation_date: str = ""
    update_date: str = ""


class SemesterCourseUpdate(SQLModel):
    order: Optional[int] = None
    code: Optional[str] = None
    credit_hours: Optional[float] = None


class SemesterCourseRead(CourseRead):
    """An existing Course enriched with the academic metadata from its link."""

    academic_order: int = 0
    code: Optional[str] = None
    credit_hours: Optional[float] = None


class TrainingProgramCourse(SQLModel, table=True):
    """Join table linking a TrainingProgram to existing Courses (1:N)."""

    __table_args__ = (
        UniqueConstraint("course_id", name="uq_trainingprogramcourse_course"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    order: int = Field(default=0)
    training_program_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trainingprogram.id", ondelete="CASCADE"), index=True)
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    creation_date: str = ""
    update_date: str = ""
