"""Every room's availability for a period — feeds the visual room picker.

Unlike ``hall_suggestions.suggest_rooms`` (free rooms only, top N), this
returns *all* facilities with a status, so the picker can draw every room on
its floor plan and explain why the unavailable ones are greyed out:

* ``unavailable`` — inactive / maintenance / not bookable, blacked out, or
  outside its opening hours;
* ``busy`` — an approved reservation overlaps one of the checked windows, or
  another training program holding the room has overlapping dates (programs do
  not create reservations themselves);
* ``too_small`` — fewer seats than the expected attendees;
* ``available`` — none of the above, scored like the suggestions (seat fit +
  day load) so the best matches can be listed first.

What is checked:

* ``start``/``end`` — one period (program dates, or a session's date-times);
* ``for_course`` / ``for_offering`` — a parent's *default* room: every session
  of that course / offering that has no room of its own (they inherit it);
  those sessions' own reservations do not count against the room;
* ``exclude`` — the booking or session being edited (its slot is not a
  conflict); ``exclude_program`` — the training program being edited.

Without any window only seats and the room status are checked.

Open to any org member (whoever schedules picks a room); never includes costs.
The response also lists the buildings that have a floor plan.
"""
from datetime import timedelta
from typing import Dict, List, Optional, Set

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, OfferingSession
from src.db.academic.training_programs import TrainingProgram
from src.db.administration.facilities import (
    Facility,
    FacilityReservation,
    FacilityStatus,
    Location,
    PlanBuilding,
    ReservationStatus,
    RoomAvailability,
    RoomAvailabilityRead,
    RoomAvailabilityStatus,
)
from src.db.courses.courses import Course
from src.services.administration.authz import AnyUser, require_org_member
from src.services.administration.common import bad_request
from src.services.administration.hall_suggestions import _score, _type_names
from src.services.administration.reservations import (
    Window,
    availability_reasons,
    overlaps,
    resolve_exclude,
    session_window,
)


async def _parent_windows(
    db_session: AsyncSession, org_id: int, course_uuid: Optional[str], offering_uuid: Optional[str]
) -> tuple[List[Window], Set[int]]:
    """Windows of the sessions inheriting a parent's room, and the reservation ids of all its sessions."""
    windows: List[Window] = []
    session_ids: List[int] = []
    column = None
    if course_uuid:
        rows = (
            await db_session.execute(
                select(CourseScheduleSession)
                .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
                .join(Course, Course.id == CourseAcademicProfile.course_id)  # type: ignore[arg-type]
                .where(Course.course_uuid == course_uuid, Course.org_id == org_id)
            )
        ).scalars().all()
        session_ids = [s.id for s in rows]
        windows = [w for s in rows if s.facility_id is None and (w := session_window(s.start_date, s.end_date))]
        column = FacilityReservation.course_session_id
    elif offering_uuid:
        rows = (
            await db_session.execute(
                select(OfferingSession)
                .join(CourseOffering, CourseOffering.id == OfferingSession.offering_id)  # type: ignore[arg-type]
                .where(CourseOffering.offering_uuid == offering_uuid, CourseOffering.org_id == org_id)
            )
        ).scalars().all()
        session_ids = [s.id for s in rows]
        windows = [w for s in rows if s.facility_id is None and (w := session_window(s.start_datetime, s.end_datetime))]
        column = FacilityReservation.offering_session_id
    own: Set[int] = set()
    if column is not None and session_ids:
        own = set(
            (
                await db_session.execute(select(FacilityReservation.id).where(column.in_(session_ids)))  # type: ignore[union-attr]
            ).scalars().all()
        )
    return windows, own


async def room_availability(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    start: Optional[str] = None,
    end: Optional[str] = None,
    attendees: Optional[int] = None,
    exclude_program_uuid: Optional[str] = None,
    exclude: Optional[str] = None,
    for_course: Optional[str] = None,
    for_offering: Optional[str] = None,
) -> RoomAvailabilityRead:
    await require_org_member(db_session, current_user, org_id)
    if attendees is not None and attendees < 0:
        raise bad_request("Attendees cannot be negative")

    windows: List[Window] = []
    ignored: Set[int] = set()
    if start:
        window = session_window(start, end or start)
        if window is None:
            raise bad_request("A valid start date is required")
        windows.append(window)
    if for_course or for_offering:
        parent_windows, ignored = await _parent_windows(db_session, org_id, for_course, for_offering)
        windows.extend(parent_windows)
    excluded = await resolve_exclude(db_session, org_id, exclude)
    if excluded:
        ignored.add(excluded)

    facilities = (
        await db_session.execute(select(Facility).where(Facility.org_id == org_id).order_by(Facility.name))
    ).scalars().all()
    locations: Dict[int, Location] = {
        loc.id: loc
        for loc in (await db_session.execute(select(Location).where(Location.org_id == org_id))).scalars().all()
    }
    type_names = await _type_names(db_session, [f.facility_type_id for f in facilities if f.facility_type_id])

    bookings: Dict[int, int] = {}
    load: Dict[int, int] = {}
    programs: Dict[int, List[str]] = {}
    if windows:
        span = (min(w[0] for w in windows), max(w[1] for w in windows))
        first_day = (min(w[0] for w in windows), min(w[0] for w in windows) + timedelta(days=1))
        reservations = (
            await db_session.execute(
                select(FacilityReservation).where(
                    FacilityReservation.org_id == org_id,
                    FacilityReservation.status == ReservationStatus.APPROVED.value,
                    FacilityReservation.starts_at < max(span[1], first_day[1]),
                    FacilityReservation.ends_at > span[0],
                )
            )
        ).scalars().all()
        for res in reservations:
            if res.id in ignored:
                continue
            slot = (res.starts_at, res.ends_at)
            if any(overlaps(slot, w) for w in windows):
                bookings[res.facility_id] = bookings.get(res.facility_id, 0) + 1
            # Day load of the first day, to prefer quieter rooms among the free ones.
            if overlaps(slot, first_day):
                load[res.facility_id] = load.get(res.facility_id, 0) + 1
        others = (
            await db_session.execute(
                select(TrainingProgram).where(
                    TrainingProgram.org_id == org_id,
                    TrainingProgram.facility_id.is_not(None),  # type: ignore[union-attr]
                )
            )
        ).scalars().all()
        for program in others:
            if exclude_program_uuid and program.trainingprogram_uuid == exclude_program_uuid:
                continue
            program_window = session_window(program.start_date, program.end_date or program.start_date)
            if program_window and any(overlaps(w, program_window) for w in windows):
                programs.setdefault(program.facility_id, []).append(program.name)

    rooms: List[RoomAvailability] = []
    for facility in facilities:
        location = locations.get(facility.location_id) if facility.location_id else None
        if windows:
            blocked = list(dict.fromkeys(reason for w in windows for reason in availability_reasons(facility, w)))
        elif facility.status != FacilityStatus.ACTIVE.value or not facility.is_bookable:
            blocked = [f"{facility.name} is not available for booking"]
        else:
            blocked = []
        busy_count = bookings.get(facility.id, 0)
        held_by = programs.get(facility.id, [])
        if blocked:
            status = RoomAvailabilityStatus.UNAVAILABLE
        elif busy_count or held_by:
            status = RoomAvailabilityStatus.BUSY
        elif attendees and facility.capacity is not None and facility.capacity < attendees:
            status = RoomAvailabilityStatus.TOO_SMALL
        else:
            status = RoomAvailabilityStatus.AVAILABLE
        score, reasons = 0, []
        if status == RoomAvailabilityStatus.AVAILABLE:
            points, available, reasons = _score(facility, attendees, None, locations, {}, load.get(facility.id, 0))
            score = round(100 * points / available)
        rooms.append(
            RoomAvailability(
                facility_uuid=facility.facility_uuid,
                name=facility.name,
                code=facility.code,
                capacity=facility.capacity,
                facility_type_name=type_names.get(facility.facility_type_id) if facility.facility_type_id else None,
                location_uuid=location.location_uuid if location else None,
                location_name=location.name if location else None,
                floor=facility.floor,
                room_number=facility.room_number,
                status=status,
                bookings=busy_count,
                programs=held_by,
                blocked=blocked[:5],
                score=score,
                reasons=reasons,
            )
        )
    rooms.sort(key=lambda r: (r.status != RoomAvailabilityStatus.AVAILABLE, -r.score, r.capacity or 10**9, r.name))

    buildings = [
        PlanBuilding(
            location_uuid=loc.location_uuid,
            name=loc.name,
            parent_uuid=locations[loc.parent_id].location_uuid if loc.parent_id in locations else None,
            parent_name=locations[loc.parent_id].name if loc.parent_id in locations else None,
            floor_count=len((loc.floor_plan or {}).get("floors") or []),
        )
        for loc in sorted(locations.values(), key=lambda loc: loc.name)
        if (loc.floor_plan or {}).get("floors")
    ]
    return RoomAvailabilityRead(
        checked_period=bool(windows), windows=len(windows), rooms=rooms, buildings=buildings
    )
