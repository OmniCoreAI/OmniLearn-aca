"""Term auto-scheduling with OR-Tools CP-SAT.

``plan_term`` proposes, for every offering of a term, its weekly meetings
(days and time) and one room, so that no room, teacher (instructor or TA) or
cohort is double-booked:

* Hard rules: one room per offering that seats it, inside the chosen days and
  daily window and the room's opening hours; an offering's meetings fall on
  different days (and, by default, at the same time); no overlaps per room,
  per person and per cohort.
* Goals, in two passes: first place as many offerings as possible; then,
  keeping that many, prefer the tightest room that seats the class, the
  offering's own default room, no meetings on consecutive days and earlier
  starts.

Existing commitments come from the facility reservations and the schedule
sessions of other offerings and courses inside the teaching weeks. Those that
repeat weekly (same day and time in two or more weeks) block the weekly grid;
one-off ones only cost the dates they hit — each such date is listed as
skipped, with the reason, and no session is created on it.

The plan is a draft. ``apply_plan`` re-checks every date against the current
data and creates the offering sessions in one transaction (rooms go through
the reservation table, so the no-double-booking guarantee still holds).
"""
import asyncio
import time as clock
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Dict, Iterable, List, Optional, Set, Tuple
from uuid import uuid4

from fastapi import Request
from ortools.sat.python import cp_model
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.calendar import AcademicTerm
from src.db.academic.catalog import AcademicCourse
from src.db.academic.cohorts import Cohort
from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import (
    CourseOffering,
    Enrollment,
    EnrollmentStatus,
    OfferingSession,
    OfferingStatus,
)
from src.db.academic.scheduling import (
    PLANNER_WEEKDAYS,
    AppliedSkip,
    AutoScheduleApply,
    AutoScheduleApplyResult,
    AutoSchedulePlan,
    AutoScheduleRequest,
    PlannedMeeting,
    SkippedDate,
    UnplacedOffering,
)
from src.db.administration.facilities import (
    Facility,
    FacilityReservation,
    FacilityStatus,
    ReservationStatus,
)
from src.services.academic.common import (
    Principal,
    bad_request,
    get_by_uuid_or_404,
    now,
    require_academic_manager,
)
from src.services.administration.reservations import (
    availability_reasons,
    book_session,
    bookings_read,
    session_window,
)

DAY = 24 * 60
SCHEDULABLE = (OfferingStatus.PLANNED, OfferingStatus.OPEN, OfferingStatus.IN_PROGRESS)
NOT_DEFAULT_ROOM_PENALTY = 30
UNKNOWN_FIT_PENALTY = 50
CONSECUTIVE_DAY_PENALTY = 10
MAX_OFFERINGS = 300

Window = Tuple[datetime, datetime]


def _canon(d: date) -> int:
    """Index of a date's weekday in PLANNER_WEEKDAYS (Saturday = 0)."""
    return (d.weekday() + 2) % 7


def _minutes(hhmm: str, label: str) -> int:
    try:
        value = time.fromisoformat(hhmm)
    except (TypeError, ValueError):
        raise bad_request(f"{label} must use HH:MM")
    return value.hour * 60 + value.minute


def _hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_date(value: Optional[str]) -> Optional[date]:
    try:
        return date.fromisoformat(str(value)[:10]) if value else None
    except ValueError:
        return None


def teaching_weeks(term: AcademicTerm) -> Tuple[date, date]:
    """First and last teaching day: the term, up to the day before exams."""
    start, end = _parse_date(term.start_date), _parse_date(term.end_date)
    if not start or not end or end < start:
        raise bad_request("Set the term's start and end dates before scheduling it")
    exam = _parse_date(term.exam_start)
    if exam and start < exam <= end:
        end = exam - timedelta(days=1)
    return start, end


def _occurrences(first: date, last: date, day_index: int) -> List[date]:
    out, current = [], first
    while current <= last:
        if _canon(current) == day_index:
            out.append(current)
        current += timedelta(days=1)
    return out


def _day_segments(window: Window) -> Iterable[Tuple[date, int, int]]:
    """Split an occupied range into (date, start minute, end minute) per day."""
    current, finish = window
    while current < finish:
        midnight = datetime.combine(current.date(), time.min)
        day_end = midnight + timedelta(days=1)
        segment_end = min(finish, day_end)
        yield current.date(), int((current - midnight).total_seconds() // 60), int((segment_end - midnight).total_seconds() // 60)
        current = segment_end


def _merge(blocks: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    merged: List[Tuple[int, int]] = []
    for start, end in sorted(blocks):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


# ---------------------------------------------------------------------------
# Context: offerings to plan and what is already booked
# ---------------------------------------------------------------------------


@dataclass
class _Offering:
    row: CourseOffering
    course_name: Optional[str]
    cohort_name: Optional[str]
    size: Optional[int]
    meetings: int
    duration: int
    people: List[int]


@dataclass
class _Busy:
    """Occupied ranges per room / person / cohort, with what occupies them."""

    rooms: Dict[int, List[Tuple[datetime, datetime, str]]] = field(default_factory=lambda: defaultdict(list))
    people: Dict[int, List[Tuple[datetime, datetime, str]]] = field(default_factory=lambda: defaultdict(list))
    cohorts: Dict[int, List[Tuple[datetime, datetime, str]]] = field(default_factory=lambda: defaultdict(list))


async def _load_busy(
    db_session: AsyncSession, org_id: int, first: date, last: date, skip_offering_ids: Set[int]
) -> _Busy:
    busy = _Busy()
    lo, hi = datetime.combine(first, time.min), datetime.combine(last + timedelta(days=1), time.min)

    reservations = (
        await db_session.execute(
            select(FacilityReservation).where(
                FacilityReservation.org_id == org_id,
                FacilityReservation.status == ReservationStatus.APPROVED.value,
                FacilityReservation.starts_at < hi,
                FacilityReservation.ends_at > lo,
            )
        )
    ).scalars().all()
    skip_sessions: Set[int] = set()
    if skip_offering_ids:
        skip_sessions = set(
            (
                await db_session.execute(
                    select(OfferingSession.id).where(OfferingSession.offering_id.in_(skip_offering_ids))  # type: ignore[attr-defined]
                )
            ).scalars().all()
        )
    reservations = [r for r in reservations if r.offering_session_id not in skip_sessions]
    for row, booking in zip(reservations, await bookings_read(db_session, list(reservations))):
        label = " — ".join(part for part in (booking.parent_name, booking.title) if part) or "a booking"
        busy.rooms[row.facility_id].append((row.starts_at, row.ends_at, label))

    offering_sessions = (
        await db_session.execute(
            select(OfferingSession, CourseOffering)
            .join(CourseOffering, CourseOffering.id == OfferingSession.offering_id)  # type: ignore[arg-type]
            .where(CourseOffering.org_id == org_id, CourseOffering.status != OfferingStatus.CANCELLED)
        )
    ).all()
    for session, offering in offering_sessions:
        if offering.id in skip_offering_ids:
            continue
        window = session_window(session.start_datetime, session.end_datetime)
        if not window or window[1] <= lo or window[0] >= hi:
            continue
        for person in {offering.instructor_id, offering.teaching_assistant_id} - {None}:
            busy.people[person].append((*window, offering.code))  # type: ignore[index]
        if offering.cohort_id:
            busy.cohorts[offering.cohort_id].append((*window, offering.code))

    course_sessions = (
        await db_session.execute(
            select(CourseScheduleSession, CourseAcademicProfile)
            .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
            .where(CourseScheduleSession.org_id == org_id)
        )
    ).all()
    for session, profile in course_sessions:
        person = session.instructor_id or profile.instructor_id
        window = session_window(session.start_date, session.end_date)
        if person and window and window[1] > lo and window[0] < hi:
            busy.people[person].append((*window, session.title or "a course session"))
    return busy


def _weekly_blocks(
    ranges: List[Tuple[datetime, datetime, str]], first: date, days: Set[int]
) -> List[Tuple[int, int]]:
    """Week-grid blocks for ranges that repeat on two or more weeks."""
    weeks: Dict[Tuple[int, int, int], Set[int]] = defaultdict(set)
    for start, end, _label in ranges:
        for day, s, e in _day_segments((start, end)):
            weeks[(_canon(day), s, e)].add((day - first).days // 7)
    blocks = [(d * DAY + s, d * DAY + e) for (d, s, e), seen in weeks.items() if len(seen) >= 2 and d in days]
    return _merge(blocks)


def _date_reasons(
    busy: _Busy, facility: Facility, people: List[int], cohort_id: Optional[int], window: Window
) -> List[str]:
    reasons = availability_reasons(facility, window)
    for start, end, label in busy.rooms.get(facility.id, []):
        if start < window[1] and window[0] < end:
            reasons.append(f"{facility.name} is booked by {label}")
    for person in people:
        for start, end, label in busy.people.get(person, []):
            if start < window[1] and window[0] < end:
                reasons.append(f"The teacher already has {label}")
                break
    if cohort_id:
        for start, end, label in busy.cohorts.get(cohort_id, []):
            if start < window[1] and window[0] < end:
                reasons.append(f"The cohort already has {label}")
                break
    return reasons


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------


def _room_starts(facility: Facility, day_index: int, duration: int, global_starts: List[int]) -> List[int]:
    """Starts (minute of day) allowed by the room's opening hours on that day."""
    slots = (facility.availability or {}).get("slots") or []
    if not slots:
        return global_starts
    key = PLANNER_WEEKDAYS[day_index]
    hours = []
    for slot in slots:
        if slot.get("day") == key:
            try:
                hours.append((_minutes(slot["start"], "Opening hours"), _minutes(slot["end"], "Opening hours")))
            except Exception:
                continue
    return [s for s in global_starts if any(a <= s and s + duration <= b for a, b in hours)]


async def plan_term(
    request: Request, term_uuid: str, payload: AutoScheduleRequest, current_user: Principal, db_session: AsyncSession
) -> AutoSchedulePlan:
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
    await require_academic_manager(current_user, term.org_id, db_session)
    first, last = teaching_weeks(term)

    days = sorted({PLANNER_WEEKDAYS.index(d) for d in payload.days if d in PLANNER_WEEKDAYS})
    if not days:
        raise bad_request("Choose at least one teaching day")
    day_start, day_end = _minutes(payload.day_start, "Day start"), _minutes(payload.day_end, "Day end")
    if day_end <= day_start:
        raise bad_request("The teaching day must end after it starts")
    step = payload.step_minutes
    if step not in (15, 30, 60):
        raise bad_request("Start times step by 15, 30 or 60 minutes")
    time_limit = max(2, min(payload.time_limit_seconds, 60))

    offerings, unplaced = await _offerings_to_plan(db_session, term, payload)
    plan = AutoSchedulePlan(
        status="empty",
        term_uuid=term.term_uuid,
        term_name=term.name or term.code,
        teaching_start=first.isoformat(),
        teaching_end=last.isoformat(),
        weeks=(last - first).days // 7 + 1,
        unplaced=unplaced,
    )
    rooms = (
        await db_session.execute(
            select(Facility).where(
                Facility.org_id == term.org_id,
                Facility.status == FacilityStatus.ACTIVE.value,
                Facility.is_bookable == True,  # noqa: E712
            )
        )
    ).scalars().all()

    # Offerings that cannot be placed whatever the solver does.
    window_length = day_end - day_start
    candidates: Dict[int, List[Facility]] = {}
    plannable: List[_Offering] = []
    for item in offerings:
        reason = None
        params: dict = {}
        if item.meetings > len(days):
            reason, params = "too_many_meetings", {"meetings": item.meetings, "days": len(days)}
        elif item.duration > window_length:
            reason, params = "too_long", {"minutes": item.duration}
        else:
            fitting = [r for r in rooms if r.capacity is None or not item.size or r.capacity >= item.size]
            starts = list(range(day_start, day_end - item.duration + 1, step))
            fitting = [r for r in fitting if any(_room_starts(r, d, item.duration, starts) for d in days)]
            if not fitting:
                reason, params = "no_room", {"size": item.size or 0}
            else:
                candidates[item.row.id] = fitting  # type: ignore[index]
        if reason:
            plan.unplaced.append(_unplaced(item, reason, params))
        else:
            plannable.append(item)
    if not plannable:
        return plan

    busy = await _load_busy(db_session, term.org_id, first, last, {o.row.id for o in plannable})  # type: ignore[misc]
    started = clock.monotonic()
    # CPU-bound: keep the event loop free while the solver runs.
    solution, status = await asyncio.to_thread(
        _solve, plannable, candidates, busy, first, days, day_start, day_end, step, payload.same_time, time_limit
    )
    plan.solve_ms = int((clock.monotonic() - started) * 1000)
    plan.status = status
    rooms_by_id = {r.id: r for r in rooms}
    for item in plannable:
        placed = solution.get(item.row.id)  # type: ignore[arg-type]
        if not placed:
            plan.unplaced.append(_unplaced(item, "no_slot", {}))
            continue
        room_id, starts = placed
        room = rooms_by_id[room_id]
        for week_minute in starts:
            day_index, minute = divmod(week_minute, DAY)
            meeting = PlannedMeeting(
                offering_uuid=item.row.offering_uuid,
                offering_code=item.row.code,
                course_name=item.course_name,
                cohort_name=item.cohort_name,
                day=PLANNER_WEEKDAYS[day_index],
                start=_hhmm(minute),
                end=_hhmm(minute + item.duration),
                facility_uuid=room.facility_uuid,
                facility_name=room.name,
                facility_capacity=room.capacity,
                size=item.size,
            )
            _fill_dates(meeting, busy, room, item.people, item.row.cohort_id, first, last)
            plan.meetings.append(meeting)
    plan.meetings.sort(key=lambda m: (PLANNER_WEEKDAYS.index(m.day), m.start, m.facility_name))
    plan.sessions_to_create = sum(len(m.dates) for m in plan.meetings)
    return plan


def _unplaced(item: _Offering, reason: str, params: dict) -> UnplacedOffering:
    return UnplacedOffering(
        offering_uuid=item.row.offering_uuid,
        offering_code=item.row.code,
        course_name=item.course_name,
        reason=reason,
        params=params,
    )


def _fill_dates(
    meeting: PlannedMeeting, busy: _Busy, room: Facility, people: List[int], cohort_id: Optional[int], first: date, last: date
) -> None:
    start, end = _minutes(meeting.start, "Start"), _minutes(meeting.end, "End")
    for day in _occurrences(first, last, PLANNER_WEEKDAYS.index(meeting.day)):
        midnight = datetime.combine(day, time.min)
        window = (midnight + timedelta(minutes=start), midnight + timedelta(minutes=end))
        reasons = _date_reasons(busy, room, people, cohort_id, window)
        if reasons:
            meeting.skipped.append(SkippedDate(date=day.isoformat(), reasons=reasons))
        else:
            meeting.dates.append(day.isoformat())


async def _offerings_to_plan(
    db_session: AsyncSession, term: AcademicTerm, payload: AutoScheduleRequest
) -> Tuple[List[_Offering], List[UnplacedOffering]]:
    rows = (
        await db_session.execute(select(CourseOffering).where(CourseOffering.term_id == term.id))
    ).scalars().all()
    by_uuid = {o.offering_uuid: o for o in rows}
    session_counts = dict(
        (
            await db_session.execute(
                select(OfferingSession.offering_id, func.count(OfferingSession.id))
                .where(OfferingSession.offering_id.in_([o.id for o in rows]))  # type: ignore[attr-defined]
                .group_by(OfferingSession.offering_id)
            )
        ).all()
    ) if rows else {}
    options = {o.offering_uuid: o for o in payload.offerings or []}
    if payload.offerings is None:
        chosen = [o for o in rows if o.status in SCHEDULABLE and not session_counts.get(o.id)]
    else:
        missing = [uuid for uuid in options if uuid not in by_uuid]
        if missing:
            raise bad_request("Some offerings do not belong to this term")
        chosen = [by_uuid[uuid] for uuid in options]
    if len(chosen) > MAX_OFFERINGS:
        raise bad_request(f"Schedule at most {MAX_OFFERINGS} offerings at once")

    courses = {
        c.id: c
        for c in (
            await db_session.execute(
                select(AcademicCourse).where(AcademicCourse.id.in_({o.academic_course_id for o in chosen} or {0}))  # type: ignore[attr-defined]
            )
        ).scalars().all()
    }
    cohort_ids = {o.cohort_id for o in chosen if o.cohort_id}
    cohorts = {
        c.id: c
        for c in (await db_session.execute(select(Cohort).where(Cohort.id.in_(cohort_ids or {0})))).scalars().all()  # type: ignore[attr-defined]
    }
    registered = dict(
        (
            await db_session.execute(
                select(Enrollment.offering_id, func.count(Enrollment.id))
                .where(
                    Enrollment.offering_id.in_([o.id for o in chosen] or [0]),  # type: ignore[attr-defined]
                    Enrollment.status == EnrollmentStatus.REGISTERED,
                )
                .group_by(Enrollment.offering_id)
            )
        ).all()
    )

    out, unplaced = [], []
    for offering in chosen:
        option = options.get(offering.offering_uuid)
        course = courses.get(offering.academic_course_id)
        item = _Offering(
            row=offering,
            course_name=course.name if course else None,
            cohort_name=cohorts[offering.cohort_id].name if offering.cohort_id in cohorts else None,
            # Plan for the seat limit when there is one, else the current class.
            size=offering.capacity or registered.get(offering.id) or None,
            meetings=(option.meetings_per_week if option and option.meetings_per_week else payload.meetings_per_week),
            duration=(option.duration_minutes if option and option.duration_minutes else payload.duration_minutes),
            people=[p for p in (offering.instructor_id, offering.teaching_assistant_id) if p],
        )
        if not 1 <= item.meetings <= 7 or not 15 <= item.duration <= 8 * 60:
            raise bad_request("Meetings per week must be 1–7 and each meeting 15 minutes to 8 hours")
        if offering.status not in SCHEDULABLE:
            unplaced.append(_unplaced(item, "not_schedulable", {"status": str(offering.status)}))
        elif session_counts.get(offering.id):
            unplaced.append(_unplaced(item, "already_scheduled", {"sessions": session_counts[offering.id]}))
        else:
            out.append(item)
    return out, unplaced


def _solve(
    offerings: List[_Offering],
    candidates: Dict[int, List[Facility]],
    busy: _Busy,
    first: date,
    days: List[int],
    day_start: int,
    day_end: int,
    step: int,
    same_time: bool,
    time_limit: int,
) -> Tuple[Dict[int, Tuple[int, List[int]]], str]:
    """Two passes: place as many offerings as possible, then — keeping that
    many — find the best rooms and times. Returns {offering id: (room id,
    [week-minute starts])} and the status of the last pass."""
    model = cp_model.CpModel()
    day_set = set(days)
    room_intervals: Dict[int, list] = defaultdict(list)
    person_intervals: Dict[int, list] = defaultdict(list)
    cohort_intervals: Dict[int, list] = defaultdict(list)
    costs = []
    placed_vars = []
    decisions = []
    vars_by_offering = {}

    for item in offerings:
        oid = item.row.id
        starts = list(range(day_start, day_end - item.duration + 1, step))
        placed = model.NewBoolVar(f"placed_{oid}")
        placed_vars.append(placed)
        tods = (
            [model.NewIntVarFromDomain(cp_model.Domain.FromValues(starts), f"tod_{oid}")] * item.meetings
            if same_time
            else [model.NewIntVarFromDomain(cp_model.Domain.FromValues(starts), f"tod_{oid}_{k}") for k in range(item.meetings)]
        )
        day_vars = [model.NewIntVarFromDomain(cp_model.Domain.FromValues(days), f"day_{oid}_{k}") for k in range(item.meetings)]
        start_vars = []
        for k in range(item.meetings):
            start = model.NewIntVar(min(days) * DAY + day_start, max(days) * DAY + day_end, f"start_{oid}_{k}")
            model.Add(start == DAY * day_vars[k] + tods[k])
            start_vars.append(start)
            interval = model.NewOptionalFixedSizeIntervalVar(start, item.duration, placed, f"meet_{oid}_{k}")
            for person in item.people:
                person_intervals[person].append(interval)
            if item.row.cohort_id:
                cohort_intervals[item.row.cohort_id].append(interval)
        for k in range(1, item.meetings):
            model.Add(day_vars[k] > day_vars[k - 1])
            consecutive = model.NewBoolVar(f"consecutive_{oid}_{k}")
            model.Add(day_vars[k] - day_vars[k - 1] == 1).OnlyEnforceIf(consecutive)
            model.Add(day_vars[k] - day_vars[k - 1] >= 2).OnlyEnforceIf(consecutive.Not())
            costs.append(CONSECUTIVE_DAY_PENALTY * consecutive)
        # Earlier starts as a light tie-breaker: one point per step after the day start.
        for tod in set(tods):
            late = model.NewIntVar(0, (day_end - day_start) // step, f"late_{tod.Name()}")
            model.Add(late * step == tod - day_start)
            costs.append(late)

        room_vars = {}
        for room in candidates[oid]:
            use = model.NewBoolVar(f"room_{oid}_{room.id}")
            room_vars[room.id] = use
            for k, start in enumerate(start_vars):
                room_intervals[room.id].append(
                    model.NewOptionalFixedSizeIntervalVar(start, item.duration, use, f"room_{oid}_{room.id}_{k}")
                )
                allowed = [d * DAY + s for d in days for s in _room_starts(room, d, item.duration, starts)]
                if len(allowed) < len(days) * len(starts):
                    model.AddLinearExpressionInDomain(start, cp_model.Domain.FromValues(allowed)).OnlyEnforceIf(use)
            if room.capacity and item.size:
                fit = round(100 * (room.capacity - item.size) / room.capacity)
            else:
                fit = UNKNOWN_FIT_PENALTY
            if item.row.facility_id and room.id != item.row.facility_id:
                fit += NOT_DEFAULT_ROOM_PENALTY
            costs.append(fit * use)
        model.Add(sum(room_vars.values()) == placed)
        decisions += [placed, *set(tods), *day_vars, *room_vars.values()]
        vars_by_offering[oid] = (placed, start_vars, room_vars)

    def fixed(blocks: List[Tuple[int, int]], name: str):
        return [model.NewIntervalVar(s, e - s, e, f"{name}_{i}") for i, (s, e) in enumerate(blocks)]

    for room_id, intervals in room_intervals.items():
        model.AddNoOverlap(intervals + fixed(_weekly_blocks(busy.rooms.get(room_id, []), first, day_set), f"busy_room_{room_id}"))
    for person, intervals in person_intervals.items():
        model.AddNoOverlap(intervals + fixed(_weekly_blocks(busy.people.get(person, []), first, day_set), f"busy_person_{person}"))
    for cohort_id, intervals in cohort_intervals.items():
        model.AddNoOverlap(intervals + fixed(_weekly_blocks(busy.cohorts.get(cohort_id, []), first, day_set), f"busy_cohort_{cohort_id}"))

    def run(seconds: float):
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = seconds
        solver.parameters.num_search_workers = 8
        return solver, solver.Solve(model)

    # Pass 1: as many offerings as possible.
    model.Maximize(sum(placed_vars))
    started = clock.monotonic()
    solver, result = run(time_limit * 0.5)
    if result not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {}, "timeout"
    best = int(round(solver.ObjectiveValue()))
    proven = result == cp_model.OPTIMAL
    # Pass 2: keep that many and optimise rooms and times, starting from pass 1.
    for var in decisions:
        model.AddHint(var, solver.Value(var))
    model.Add(sum(placed_vars) >= best)
    model.Minimize(sum(costs))
    second, result2 = run(max(1.0, time_limit - (clock.monotonic() - started)))
    if result2 in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        solver, proven = second, proven and result2 == cp_model.OPTIMAL

    solution = {}
    for oid, (placed, start_vars, room_vars) in vars_by_offering.items():
        if not solver.Value(placed):
            continue
        room_id = next(rid for rid, use in room_vars.items() if solver.Value(use))
        solution[oid] = (room_id, [solver.Value(s) for s in start_vars])
    return solution, "optimal" if proven else "feasible"


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------


async def apply_plan(
    request: Request, term_uuid: str, payload: AutoScheduleApply, current_user: Principal, db_session: AsyncSession
) -> AutoScheduleApplyResult:
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
    await require_academic_manager(current_user, term.org_id, db_session)
    first, last = teaching_weeks(term)
    if not payload.meetings:
        raise bad_request("The plan has no meetings")

    offerings = {
        o.offering_uuid: o
        for o in (
            await db_session.execute(
                select(CourseOffering).where(
                    CourseOffering.term_id == term.id,
                    CourseOffering.offering_uuid.in_({m.offering_uuid for m in payload.meetings}),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
    }
    rooms = {
        f.facility_uuid: f
        for f in (
            await db_session.execute(
                select(Facility).where(
                    Facility.org_id == term.org_id,
                    Facility.facility_uuid.in_({m.facility_uuid for m in payload.meetings}),  # type: ignore[attr-defined]
                )
            )
        ).scalars().all()
    }
    weekly: List[Tuple[CourseOffering, Facility, int, int, int]] = []
    for meeting in payload.meetings:
        offering = offerings.get(meeting.offering_uuid)
        room = rooms.get(meeting.facility_uuid)
        if offering is None:
            raise bad_request("Some offerings do not belong to this term")
        if room is None or room.status != FacilityStatus.ACTIVE.value or not room.is_bookable:
            raise bad_request(f"{room.name if room else 'A room'} is not available for booking")
        if offering.status not in SCHEDULABLE:
            raise bad_request(f"{offering.code} cannot be scheduled in its current status")
        if meeting.day not in PLANNER_WEEKDAYS:
            raise bad_request("Unknown day")
        start, end = _minutes(meeting.start, "Start"), _minutes(meeting.end, "End")
        if end <= start:
            raise bad_request("A meeting must end after it starts")
        weekly.append((offering, room, PLANNER_WEEKDAYS.index(meeting.day), start, end))
    _assert_no_weekly_clashes(weekly)

    result = AutoScheduleApplyResult()
    session_counts = dict(
        (
            await db_session.execute(
                select(OfferingSession.offering_id, func.count(OfferingSession.id))
                .where(OfferingSession.offering_id.in_([o.id for o in offerings.values()]))  # type: ignore[attr-defined]
                .group_by(OfferingSession.offering_id)
            )
        ).all()
    )
    busy = await _load_busy(db_session, term.org_id, first, last, set())
    order: Dict[int, int] = defaultdict(int)
    touched: Set[int] = set()
    stamp = now()
    pending: List[Tuple[datetime, CourseOffering, Facility, Window]] = []
    for offering, room, day_index, start, end in weekly:
        if session_counts.get(offering.id):
            if offering.code not in result.already_scheduled:
                result.already_scheduled.append(offering.code)
            continue
        people = [p for p in (offering.instructor_id, offering.teaching_assistant_id) if p]
        for day in _occurrences(first, last, day_index):
            midnight = datetime.combine(day, time.min)
            window = (midnight + timedelta(minutes=start), midnight + timedelta(minutes=end))
            reasons = _date_reasons(busy, room, people, offering.cohort_id, window)
            if reasons:
                result.skipped.append(AppliedSkip(offering_code=offering.code, date=day.isoformat(), reasons=reasons))
            else:
                pending.append((window[0], offering, room, window))

    # Sessions are numbered in date order within each offering.
    for _, offering, room, window in sorted(pending, key=lambda p: (p[1].id, p[0])):
        order[offering.id] += 1  # type: ignore[index]
        session = OfferingSession(
            offering_id=offering.id,
            org_id=offering.org_id,
            facility_id=room.id,
            session_type="lecture",
            start_datetime=window[0].isoformat(timespec="minutes"),
            end_datetime=window[1].isoformat(timespec="minutes"),
            order=order[offering.id],  # type: ignore[index]
            session_uuid=f"offeringsession_{uuid4()}",
            creation_date=stamp,
            update_date=stamp,
        )
        await book_session(db_session, session, room.id)
        db_session.add(session)
        touched.add(offering.id)  # type: ignore[arg-type]
        if not offering.facility_id:
            offering.facility_id = room.id
            db_session.add(offering)
        result.created += 1
    result.offerings = len(touched)
    await db_session.commit()
    return result


def _assert_no_weekly_clashes(weekly: List[Tuple[CourseOffering, Facility, int, int, int]]) -> None:
    """An edited plan must still be clash-free between its own meetings."""
    for i, (a, room_a, day_a, start_a, end_a) in enumerate(weekly):
        for b, room_b, day_b, start_b, end_b in weekly[i + 1:]:
            if day_a != day_b or not (start_a < end_b and start_b < end_a):
                continue
            shared_people = {a.instructor_id, a.teaching_assistant_id} & {b.instructor_id, b.teaching_assistant_id} - {None}
            if room_a.id == room_b.id or shared_people or (a.cohort_id and a.cohort_id == b.cohort_id):
                if a.id == b.id:
                    raise bad_request(f"{a.code} has two meetings at the same time")
                raise bad_request(f"{a.code} and {b.code} clash on {PLANNER_WEEKDAYS[day_a]} {_hhmm(start_a)}")
