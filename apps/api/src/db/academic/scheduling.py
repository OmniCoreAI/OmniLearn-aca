"""Term auto-scheduling: request, draft plan and apply schemas (no tables).

The planner proposes a weekly timetable for a term's offerings — which days,
which time and which room — with no room, teacher or cohort clashes. The plan
is a draft: nothing is saved until it is applied, which re-checks every date
and creates the offering sessions.
"""
from typing import List, Optional

from sqlmodel import SQLModel

# Week days in the academy's order (the week starts on Saturday).
PLANNER_WEEKDAYS = ("sat", "sun", "mon", "tue", "wed", "thu", "fri")


class AutoScheduleOfferingOption(SQLModel):
    offering_uuid: str
    meetings_per_week: Optional[int] = None
    duration_minutes: Optional[int] = None


class AutoScheduleRequest(SQLModel):
    # Default: every planned/open/in-progress offering of the term without sessions.
    offerings: Optional[List[AutoScheduleOfferingOption]] = None
    days: List[str] = ["sun", "mon", "tue", "wed", "thu"]
    day_start: str = "08:00"
    day_end: str = "18:00"
    meetings_per_week: int = 2
    duration_minutes: int = 90
    step_minutes: int = 30
    # Every meeting of an offering starts at the same time of day.
    same_time: bool = True
    time_limit_seconds: int = 20


class SkippedDate(SQLModel):
    date: str
    reasons: List[str] = []


class PlannedMeeting(SQLModel):
    offering_uuid: str
    offering_code: str
    course_name: Optional[str] = None
    cohort_name: Optional[str] = None
    day: str  # sat … fri
    start: str  # HH:MM
    end: str
    facility_uuid: str
    facility_name: str
    facility_capacity: Optional[int] = None
    size: Optional[int] = None
    # Dates a session will be created on, and dates left out (with why).
    dates: List[str] = []
    skipped: List[SkippedDate] = []


class UnplacedOffering(SQLModel):
    offering_uuid: str
    offering_code: str
    course_name: Optional[str] = None
    # no_room | no_slot | too_many_meetings | too_long | already_scheduled | not_schedulable
    reason: str
    params: dict = {}


class AutoSchedulePlan(SQLModel):
    status: str  # optimal | feasible | timeout | empty
    term_uuid: str
    term_name: Optional[str] = None
    teaching_start: str
    teaching_end: str
    weeks: int
    meetings: List[PlannedMeeting] = []
    unplaced: List[UnplacedOffering] = []
    sessions_to_create: int = 0
    solve_ms: int = 0


class AutoScheduleApplyMeeting(SQLModel):
    offering_uuid: str
    day: str
    start: str
    end: str
    facility_uuid: str


class AutoScheduleApply(SQLModel):
    meetings: List[AutoScheduleApplyMeeting]


class AppliedSkip(SQLModel):
    offering_code: str
    date: str
    reasons: List[str] = []


class AutoScheduleApplyResult(SQLModel):
    offerings: int = 0
    created: int = 0
    skipped: List[AppliedSkip] = []
    # Offerings left alone because they were scheduled in the meantime.
    already_scheduled: List[str] = []
