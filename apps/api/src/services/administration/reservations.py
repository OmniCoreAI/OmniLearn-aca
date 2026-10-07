"""Facility reservations — who occupies which room, and when.

``FacilityReservation`` is the single source of truth for room occupancy:

* Schedule sessions (course and offering) mirror themselves into it through
  ``book_session`` while they are saved, using their *effective* room (their
  own facility, or the parent's default). ``release_session`` /
  ``release_offering`` drop the mirror again.
* Halls can also be booked directly (events, exams, meetings, maintenance).

``find_conflicts`` explains why a time range cannot use a room — overlapping
bookings, blackout dates, opening hours, an unavailable room — and callers turn
that into a 409 unless the user chose to book anyway (the row is then flagged
``conflict_override``). On PostgreSQL an exclusion constraint backs this up, so
two concurrent saves cannot both claim the same slot.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Union
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, OfferingSession, OfferingStatus
from src.db.administration.facilities import (
    NO_OVERLAP_CONSTRAINT,
    Facility,
    FacilityBooking,
    FacilityReservation,
    FacilityReservationCreate,
    FacilityReservationUpdate,
    FacilityStatus,
    ReservationKind,
    ReservationSource,
    ReservationStatus,
)
from src.db.courses.courses import Course
from src.services.administration.authz import AnyUser, authorize_admin, require_org_member
from src.services.administration.common import bad_request, get_by_uuid_or_404, now
from src.services.administration.facilities import get_facility_by_uuid

WHAT = "book facilities"
# The web client recognises a double-booking by this prefix (Pickers.tsx).
CONFLICT_PREFIX = "Facility conflict: "
# datetime.weekday() order; availability slots use these keys.
WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
MAX_BOOKING = timedelta(days=31)

Window = Tuple[datetime, datetime]
ScheduleSession = Union[CourseScheduleSession, OfferingSession]


# ---------------------------------------------------------------------------
# Time windows
# ---------------------------------------------------------------------------


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=None)


def session_window(start: Optional[str], end: Optional[str]) -> Optional[Window]:
    """Occupied time range of a session. Date-only values cover whole days."""
    begin = parse_datetime(start)
    if begin is None:
        return None
    start_is_date = len(str(start).strip()) <= 10
    finish = parse_datetime(end)
    if finish is None:
        finish = begin + (timedelta(days=1) if start_is_date else timedelta(hours=1))
    elif len(str(end).strip()) <= 10:
        finish = finish + timedelta(days=1)  # an end *date* is inclusive
    if finish <= begin:
        finish = begin + timedelta(hours=1)
    return begin, finish


def overlaps(a: Window, b: Window) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def format_minute(value: datetime) -> str:
    return value.isoformat(timespec="minutes")


# ---------------------------------------------------------------------------
# Conflicts
# ---------------------------------------------------------------------------


def availability_reasons(facility: Facility, window: Window) -> List[str]:
    reasons = []
    if facility.status != FacilityStatus.ACTIVE.value or not facility.is_bookable:
        reasons.append(f"{facility.name} is not available for booking")
    availability = facility.availability or {}
    for blackout in availability.get("blackout_dates") or []:
        blackout_window = session_window(blackout.get("start"), blackout.get("end") or blackout.get("start"))
        if blackout_window and overlaps(window, blackout_window):
            reason = blackout.get("reason") or "unavailable"
            reasons.append(f"{facility.name} is blocked ({reason}) {blackout.get('start')}")
    # Opening hours only apply to timed bookings within a single day.
    slots = availability.get("slots") or []
    if slots and window[1] - window[0] < timedelta(days=1):
        day = WEEKDAY_KEYS[window[0].weekday()]
        begin = window[0].strftime("%H:%M")
        finish = window[1].strftime("%H:%M") if window[1].date() == window[0].date() else "24:00"
        day_slots = [s for s in slots if s.get("day") == day]
        if not any(s.get("start", "") <= begin and finish <= s.get("end", "") for s in day_slots):
            hours = ", ".join(f"{s.get('start')}–{s.get('end')}" for s in day_slots) or "closed"
            reasons.append(f"{facility.name} is outside its opening hours ({day.capitalize()}: {hours})")
    return reasons


async def _overlapping(
    db_session: AsyncSession, facility_id: int, window: Window, exclude_id: Optional[int] = None
) -> List[FacilityReservation]:
    query = select(FacilityReservation).where(
        FacilityReservation.facility_id == facility_id,
        FacilityReservation.status == ReservationStatus.APPROVED.value,
        FacilityReservation.starts_at < window[1],
        FacilityReservation.ends_at > window[0],
    )
    if exclude_id:
        query = query.where(FacilityReservation.id != exclude_id)
    return list((await db_session.execute(query.order_by(FacilityReservation.starts_at))).scalars().all())


async def find_conflicts(
    db_session: AsyncSession, facility: Facility, window: Window, exclude_id: Optional[int] = None
) -> List[str]:
    """Human-readable reasons this time range cannot use the facility."""
    reasons = availability_reasons(facility, window)
    clashes = await _overlapping(db_session, facility.id, window, exclude_id)
    for booking in await _bookings_read(db_session, clashes):
        label = " — ".join(part for part in (booking.parent_name, booking.title) if part)
        reasons.append(f"{facility.name} is already booked by {label} ({booking.start})")
    return reasons


def conflict_error(reasons: List[str]) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail=CONFLICT_PREFIX + "; ".join(reasons[:3]) + " (save again with allow_conflict to book anyway)",
    )


async def _flush_or_conflict(db_session: AsyncSession, facility_name: str) -> None:
    """Flush, turning a lost race on the exclusion constraint into a 409."""
    try:
        await db_session.flush()
    except IntegrityError as exc:
        await db_session.rollback()
        if NO_OVERLAP_CONSTRAINT in str(exc.orig):
            raise conflict_error([f"{facility_name} was just booked by someone else for that time"])
        raise


async def check_facility(
    db_session: AsyncSession, facility_uuid: str, current_user: AnyUser,
    start: Optional[str], end: Optional[str], exclude_uuid: Optional[str] = None,
) -> List[str]:
    """Conflict preview for forms: why ``start``–``end`` cannot use the room."""
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await require_org_member(db_session, current_user, facility.org_id)
    window = session_window(start, end)
    if window is None:
        raise bad_request("A valid start date/time is required")
    exclude_id = await resolve_exclude(db_session, facility.org_id, exclude_uuid)
    return await find_conflicts(db_session, facility, window, exclude_id)


async def resolve_exclude(db_session: AsyncSession, org_id: int, ref: Optional[str]) -> Optional[int]:
    """Reservation id to ignore: the booking (or session) being edited."""
    if not ref:
        return None
    query = select(FacilityReservation.id).where(FacilityReservation.org_id == org_id)
    if ref.startswith("offeringsession_"):
        query = query.join(OfferingSession, OfferingSession.id == FacilityReservation.offering_session_id).where(  # type: ignore[arg-type]
            OfferingSession.session_uuid == ref
        )
    elif ref.startswith("session_"):
        query = query.join(CourseScheduleSession, CourseScheduleSession.id == FacilityReservation.course_session_id).where(  # type: ignore[arg-type]
            CourseScheduleSession.session_uuid == ref
        )
    else:
        query = query.where(FacilityReservation.reservation_uuid == ref)
    return (await db_session.execute(query)).scalar()


# ---------------------------------------------------------------------------
# Schedule sessions
# ---------------------------------------------------------------------------


def _session_link(session: ScheduleSession) -> Tuple[ReservationSource, str]:
    if isinstance(session, CourseScheduleSession):
        return ReservationSource.COURSE_SESSION, "course_session_id"
    return ReservationSource.OFFERING_SESSION, "offering_session_id"


def _session_times(session: ScheduleSession) -> Tuple[Optional[str], Optional[str]]:
    if isinstance(session, CourseScheduleSession):
        return session.start_date, session.end_date
    return session.start_datetime, session.end_datetime


async def _session_reservation(db_session: AsyncSession, session: ScheduleSession) -> Optional[FacilityReservation]:
    if not session.id:
        return None
    _, column = _session_link(session)
    return (
        await db_session.execute(
            select(FacilityReservation).where(getattr(FacilityReservation, column) == session.id)
        )
    ).scalars().first()


async def book_session(
    db_session: AsyncSession,
    session: ScheduleSession,
    facility_id: Optional[int],
    *,
    allow_conflict: bool = False,
    active: bool = True,
) -> None:
    """Check the session's effective room and mirror it into a reservation.

    ``facility_id`` is the effective room (the session's own or its parent's
    default). Raises 409 on a conflict unless ``allow_conflict``. Call before
    committing: a new session is only added and flushed here once its room is
    known to be free, so a rejected session never stays pending.
    """
    existing = await _session_reservation(db_session, session)
    window = session_window(*_session_times(session))
    facility = await db_session.get(Facility, facility_id) if facility_id else None
    if not active or facility is None or window is None:
        if existing:
            await db_session.delete(existing)
        return
    reasons = await find_conflicts(db_session, facility, window, existing.id if existing else None)
    if reasons and not allow_conflict:
        raise conflict_error(reasons)
    if session.id is None:
        db_session.add(session)
        await db_session.flush()
    source, column = _session_link(session)
    reservation = existing or FacilityReservation(
        org_id=session.org_id,
        facility_id=facility.id,
        source=source.value,
        starts_at=window[0],
        ends_at=window[1],
        kind=ReservationKind.SESSION.value,
        reservation_uuid=f"reservation_{uuid4()}",
        creation_date=now(),
    )
    setattr(reservation, column, session.id)
    reservation.facility_id = facility.id
    reservation.starts_at, reservation.ends_at = window
    reservation.status = ReservationStatus.APPROVED.value
    reservation.conflict_override = bool(reasons)
    reservation.update_date = now()
    db_session.add(reservation)
    await _flush_or_conflict(db_session, facility.name)


async def release_session(db_session: AsyncSession, session: ScheduleSession) -> None:
    existing = await _session_reservation(db_session, session)
    if existing:
        await db_session.delete(existing)


async def release_offering(db_session: AsyncSession, offering_id: int) -> None:
    """A cancelled offering gives its rooms back."""
    rows = (
        await db_session.execute(
            select(FacilityReservation)
            .join(OfferingSession, OfferingSession.id == FacilityReservation.offering_session_id)  # type: ignore[arg-type]
            .where(OfferingSession.offering_id == offering_id)
        )
    ).scalars().all()
    for row in rows:
        await db_session.delete(row)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def _bookings_read(db_session: AsyncSession, rows: List[FacilityReservation]) -> List[FacilityBooking]:
    course_ids = [r.course_session_id for r in rows if r.course_session_id]
    offering_ids = [r.offering_session_id for r in rows if r.offering_session_id]
    facility_ids = list({r.facility_id for r in rows})
    course_sessions: Dict[int, Tuple[CourseScheduleSession, Course]] = {}
    if course_ids:
        result = await db_session.execute(
            select(CourseScheduleSession, Course)
            .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
            .join(Course, Course.id == CourseAcademicProfile.course_id)  # type: ignore[arg-type]
            .where(CourseScheduleSession.id.in_(course_ids))  # type: ignore[union-attr]
        )
        course_sessions = {s.id: (s, c) for s, c in result.all()}
    offering_sessions: Dict[int, Tuple[OfferingSession, CourseOffering]] = {}
    if offering_ids:
        result = await db_session.execute(
            select(OfferingSession, CourseOffering)
            .join(CourseOffering, CourseOffering.id == OfferingSession.offering_id)  # type: ignore[arg-type]
            .where(OfferingSession.id.in_(offering_ids))  # type: ignore[union-attr]
        )
        offering_sessions = {s.id: (s, o) for s, o in result.all()}
    facilities: Dict[int, Facility] = {}
    if facility_ids:
        result = await db_session.execute(select(Facility).where(Facility.id.in_(facility_ids)))  # type: ignore[union-attr]
        facilities = {f.id: f for f in result.scalars().all()}

    out = []
    for row in rows:
        facility = facilities.get(row.facility_id)
        booking = FacilityBooking(
            booking_uuid=row.reservation_uuid,
            source=row.source,
            facility_uuid=facility.facility_uuid if facility else None,
            facility_name=facility.name if facility else None,
            title=row.title,
            start=format_minute(row.starts_at),
            end=format_minute(row.ends_at),
            starts_at=format_minute(row.starts_at),
            ends_at=format_minute(row.ends_at),
            kind=row.kind,
            status=row.status,
            attendees=row.attendees,
            notes=row.notes,
            double_booked=row.conflict_override,
        )
        if row.course_session_id in course_sessions:
            session, course = course_sessions[row.course_session_id]
            booking.session_uuid = session.session_uuid
            booking.title = session.title
            booking.start, booking.end = session.start_date, session.end_date
            booking.parent_name, booking.parent_uuid = course.name, course.course_uuid
            booking.inherited = session.facility_id is None
        elif row.offering_session_id in offering_sessions:
            session, offering = offering_sessions[row.offering_session_id]
            booking.session_uuid = session.session_uuid
            booking.title = session.title or session.session_type
            booking.start, booking.end = session.start_datetime, session.end_datetime
            booking.parent_name, booking.parent_uuid = offering.code, offering.offering_uuid
            booking.inherited = session.facility_id is None
        out.append(booking)
    return out


async def _list(
    db_session: AsyncSession,
    *conditions,
    since: Optional[str] = None,
    until: Optional[str] = None,
    include_cancelled: bool = False,
) -> List[FacilityBooking]:
    query = select(FacilityReservation).where(*conditions)
    if not include_cancelled:
        query = query.where(FacilityReservation.status == ReservationStatus.APPROVED.value)
    if parse_datetime(since):
        query = query.where(FacilityReservation.ends_at >= parse_datetime(since))
    if parse_datetime(until):
        query = query.where(FacilityReservation.starts_at <= parse_datetime(until))
    rows = (await db_session.execute(query.order_by(FacilityReservation.starts_at))).scalars().all()
    return await _bookings_read(db_session, list(rows))


async def list_bookings(
    db_session: AsyncSession,
    current_user: AnyUser,
    facility_uuid: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> List[FacilityBooking]:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await require_org_member(db_session, current_user, facility.org_id)
    return await _list(db_session, FacilityReservation.facility_id == facility.id, since=since, until=until)


async def list_org_bookings(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    since: Optional[str] = None,
    until: Optional[str] = None,
    include_cancelled: bool = False,
) -> List[FacilityBooking]:
    await require_org_member(db_session, current_user, org_id)
    return await _list(
        db_session, FacilityReservation.org_id == org_id,
        since=since, until=until, include_cancelled=include_cancelled,
    )


# ---------------------------------------------------------------------------
# Direct hall bookings (events, exams, meetings…)
# ---------------------------------------------------------------------------


def _validate_manual(facility: Facility, data: dict) -> Window:
    title = (data.get("title") or "").strip()
    if not title:
        raise bad_request("Title is required")
    if len(title) > 200:
        raise bad_request("Title is too long (max 200 characters)")
    data["title"] = title
    if not data.get("start") or not data.get("end"):
        raise bad_request("Start and end are required")
    begin, finish = parse_datetime(data["start"]), parse_datetime(data["end"])
    if begin is None or finish is None:
        raise bad_request("Start and end must be ISO dates or date-times")
    # A date-only end is inclusive (same-day allowed); a timed end must be later.
    timed_end = len(str(data["end"]).strip()) > 10
    if finish < begin or (timed_end and finish == begin):
        raise bad_request("A booking must end after it starts")
    window = session_window(data["start"], data["end"])
    assert window is not None
    if window[1] - window[0] > MAX_BOOKING:
        raise bad_request("A single booking cannot be longer than 31 days")
    attendees = data.get("attendees")
    if attendees is not None:
        if attendees < 0:
            raise bad_request("Attendees cannot be negative")
        if facility.capacity and attendees > facility.capacity:
            raise bad_request(f"{facility.name} seats {facility.capacity}; {attendees} attendees will not fit")
    return window


def _assert_bookable(facility: Facility, kind: str) -> None:
    # Maintenance blocks may be placed on any room.
    if kind == ReservationKind.MAINTENANCE.value:
        return
    if facility.status != FacilityStatus.ACTIVE.value or not facility.is_bookable:
        raise bad_request(f"{facility.name} is not available for booking")


async def _manual_or_404(db_session: AsyncSession, booking_uuid: str) -> FacilityReservation:
    row = await get_by_uuid_or_404(
        db_session, FacilityReservation, FacilityReservation.reservation_uuid, booking_uuid, "Booking"
    )
    if row.source != ReservationSource.MANUAL.value:
        raise bad_request("Session bookings are changed from the session's schedule")
    return row


async def create_reservation(
    db_session: AsyncSession, current_user: AnyUser, facility_uuid: str, payload: FacilityReservationCreate
) -> FacilityBooking:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    actor_id = await authorize_admin(db_session, current_user, facility.org_id, "configuration", "update", WHAT)
    data = payload.model_dump()
    kind = ReservationKind(data["kind"]).value
    _assert_bookable(facility, kind)
    window = _validate_manual(facility, data)
    reasons = await find_conflicts(db_session, facility, window)
    if reasons and not payload.allow_conflict:
        raise conflict_error(reasons)
    reservation = FacilityReservation(
        org_id=facility.org_id,
        facility_id=facility.id,
        source=ReservationSource.MANUAL.value,
        starts_at=window[0],
        ends_at=window[1],
        status=ReservationStatus.APPROVED.value,
        conflict_override=bool(reasons),
        title=data["title"],
        kind=kind,
        attendees=data.get("attendees"),
        notes=data.get("notes"),
        created_by_id=actor_id,
        reservation_uuid=f"reservation_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(reservation)
    await _flush_or_conflict(db_session, facility.name)
    await db_session.commit()
    await db_session.refresh(reservation)
    return (await _bookings_read(db_session, [reservation]))[0]


async def update_reservation(
    db_session: AsyncSession, current_user: AnyUser, booking_uuid: str, payload: FacilityReservationUpdate
) -> FacilityBooking:
    reservation = await _manual_or_404(db_session, booking_uuid)
    facility = await db_session.get(Facility, reservation.facility_id)
    await authorize_admin(db_session, current_user, reservation.org_id, "configuration", "update", WHAT)
    if reservation.status != ReservationStatus.APPROVED.value:
        raise bad_request("A cancelled booking cannot be changed")
    update = payload.model_dump(exclude_unset=True)
    allow_conflict = bool(update.pop("allow_conflict", False))
    moved = False
    target_uuid = update.pop("facility_uuid", None)
    if target_uuid and target_uuid != facility.facility_uuid:  # type: ignore[union-attr]
        facility = await get_facility_by_uuid(db_session, target_uuid)
        if facility.org_id != reservation.org_id:
            raise bad_request("Facility belongs to a different organization")
        _assert_bookable(facility, update.get("kind") or reservation.kind)
        moved = True
    data = {
        "title": reservation.title,
        "kind": reservation.kind,
        "start": format_minute(reservation.starts_at),
        "end": format_minute(reservation.ends_at),
        "attendees": reservation.attendees,
        "notes": reservation.notes,
        **update,
    }
    data["kind"] = ReservationKind(data["kind"]).value
    if "kind" in update:
        _assert_bookable(facility, data["kind"])  # type: ignore[arg-type]
    window = _validate_manual(facility, data)  # type: ignore[arg-type]
    if moved or window != (reservation.starts_at, reservation.ends_at):
        reasons = await find_conflicts(db_session, facility, window, reservation.id)  # type: ignore[arg-type]
        if reasons and not allow_conflict:
            raise conflict_error(reasons)
        reservation.facility_id = facility.id  # type: ignore[union-attr]
        reservation.starts_at, reservation.ends_at = window
        reservation.conflict_override = bool(reasons)
    for key in ("title", "kind", "attendees", "notes"):
        setattr(reservation, key, data[key])
    reservation.update_date = now()
    db_session.add(reservation)
    await _flush_or_conflict(db_session, facility.name)  # type: ignore[union-attr]
    await db_session.commit()
    await db_session.refresh(reservation)
    return (await _bookings_read(db_session, [reservation]))[0]


async def cancel_reservation(db_session: AsyncSession, current_user: AnyUser, booking_uuid: str) -> FacilityBooking:
    reservation = await _manual_or_404(db_session, booking_uuid)
    await authorize_admin(db_session, current_user, reservation.org_id, "configuration", "update", WHAT)
    reservation.status = ReservationStatus.CANCELLED.value
    reservation.update_date = now()
    db_session.add(reservation)
    await db_session.commit()
    await db_session.refresh(reservation)
    return (await _bookings_read(db_session, [reservation]))[0]


# ---------------------------------------------------------------------------
# Install (startup + migration): backfill, then the no-overlap constraint
# ---------------------------------------------------------------------------


def backfill_reservations(connection) -> int:
    """Mirror existing sessions into reservations when the table is still empty.

    Overlaps that already exist are kept but flagged ``conflict_override``
    (first booking wins), so the exclusion constraint can be added afterwards.
    """
    with Session(bind=connection) as db:
        if db.exec(select(FacilityReservation.id).limit(1)).first() is not None:
            return 0
        candidates = []
        course_rows = db.exec(
            select(CourseScheduleSession, CourseAcademicProfile)
            .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
        ).all()
        for session, profile in course_rows:
            facility_id = session.facility_id or profile.facility_id
            window = session_window(session.start_date, session.end_date)
            if facility_id and window:
                candidates.append((facility_id, window, session.org_id, ReservationSource.COURSE_SESSION, session.id))
        offering_rows = db.exec(
            select(OfferingSession, CourseOffering)
            .join(CourseOffering, CourseOffering.id == OfferingSession.offering_id)  # type: ignore[arg-type]
            .where(or_(CourseOffering.status.is_(None), CourseOffering.status != OfferingStatus.CANCELLED))  # type: ignore[union-attr]
        ).all()
        for session, offering in offering_rows:
            facility_id = session.facility_id or offering.facility_id
            window = session_window(session.start_datetime, session.end_datetime)
            if facility_id and window:
                candidates.append((facility_id, window, session.org_id, ReservationSource.OFFERING_SESSION, session.id))

        candidates.sort(key=lambda c: (c[0], c[1][0]))
        taken: Dict[int, List[Window]] = {}
        stamp = now()
        for facility_id, window, org_id, source, session_id in candidates:
            clash = any(overlaps(window, other) for other in taken.get(facility_id, []))
            if not clash:
                taken.setdefault(facility_id, []).append(window)
            column = "course_session_id" if source == ReservationSource.COURSE_SESSION else "offering_session_id"
            db.add(FacilityReservation(
                org_id=org_id,
                facility_id=facility_id,
                source=source.value,
                starts_at=window[0],
                ends_at=window[1],
                status=ReservationStatus.APPROVED.value,
                conflict_override=clash,
                kind=ReservationKind.SESSION.value,
                reservation_uuid=f"reservation_{uuid4()}",
                creation_date=stamp,
                update_date=stamp,
                **{column: session_id},
            ))
        db.flush()
        return len(candidates)


def ensure_no_overlap_constraint(connection) -> bool:
    """Add the PostgreSQL exclusion constraint (needs the btree_gist extension)."""
    if connection.dialect.name != "postgresql":
        return False
    exists = connection.execute(
        text("SELECT 1 FROM pg_constraint WHERE conname = :name"), {"name": NO_OVERLAP_CONSTRAINT}
    ).first()
    if exists:
        return True
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    connection.execute(text(
        f"ALTER TABLE facilityreservation ADD CONSTRAINT {NO_OVERLAP_CONSTRAINT} "
        "EXCLUDE USING gist (facility_id WITH =, tsrange(starts_at, ends_at, '[)') WITH &&) "
        "WHERE (status = 'approved' AND NOT conflict_override)"
    ))
    return True


def install_reservations(connection) -> None:
    created = backfill_reservations(connection)
    if created:
        logging.info("Facility reservations: mirrored %s existing sessions", created)
    try:
        with connection.begin_nested():
            ensure_no_overlap_constraint(connection)
    except Exception:
        logging.warning(
            "Facility reservations: could not add the no-overlap constraint "
            "(is the btree_gist extension available?); conflicts are still checked by the API",
            exc_info=True,
        )
