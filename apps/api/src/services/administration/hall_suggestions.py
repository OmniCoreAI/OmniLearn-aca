"""Smart hall suggestions: which rooms are free for a slot, and when a room is free.

``suggest_rooms`` lists rooms with no conflict for a time range, filtered by
hard requirements (seats, equipment, location) and ranked by soft ones:

* capacity fit (40) — the tightest room that seats everyone, so big halls stay
  available for big groups;
* proximity (25, when a reference room is given) — the same room, the same
  building, or a sibling building of the course's usual room;
* day load (20) — rooms with fewer bookings that day, spreading usage;
* equipment (15, when requested) — all requested equipment is present.

``exclude`` names the booking — or session uuid — being edited, so it does
not block its own slot.

The score is the share of the available points, 0–100.

``free_slots`` lists the next free windows of a room for a given duration,
inside its opening hours (08:00–20:00 when it has none), optionally ordered by
closeness to a preferred start.

Both are open to any org member (session editors pick rooms) and never
include costs.
"""
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Set

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.facilities import (
    Facility,
    FacilityReservation,
    FacilityStatus,
    FreeSlot,
    Location,
    ReservationStatus,
    RoomSuggestion,
    SuggestionReason,
)
from src.db.administration.lookups import ConfigLookup
from src.services.administration.authz import AnyUser, require_org_member
from src.services.administration.common import bad_request
from src.services.administration.facilities import get_facility_by_uuid
from src.services.administration.reservations import (
    WEEKDAY_KEYS,
    Window,
    availability_reasons,
    format_minute,
    parse_datetime,
    resolve_exclude,
    session_window,
)

DEFAULT_OPENING = (time(8, 0), time(20, 0))
STEP = timedelta(minutes=15)
BUSY_DAY = 4  # bookings in a day from which a room counts as busy
MAX_SUGGESTIONS = 20


def _approved_between(start: datetime, end: datetime, exclude_id: Optional[int]):
    conditions = [
        FacilityReservation.status == ReservationStatus.APPROVED.value,
        FacilityReservation.starts_at < end,
        FacilityReservation.ends_at > start,
    ]
    if exclude_id:
        conditions.append(FacilityReservation.id != exclude_id)
    return conditions


# ---------------------------------------------------------------------------
# Rooms for a time range
# ---------------------------------------------------------------------------


async def suggest_rooms(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    start: str,
    end: Optional[str] = None,
    attendees: Optional[int] = None,
    equipment_uuids: Optional[List[str]] = None,
    location_uuid: Optional[str] = None,
    near_facility_uuid: Optional[str] = None,
    exclude_booking_uuid: Optional[str] = None,
    limit: int = 5,
) -> List[RoomSuggestion]:
    await require_org_member(db_session, current_user, org_id)
    window = session_window(start, end)
    if window is None:
        raise bad_request("A valid start date/time is required")
    if attendees is not None and attendees < 0:
        raise bad_request("Attendees cannot be negative")
    limit = max(1, min(limit, MAX_SUGGESTIONS))
    exclude_id = await resolve_exclude(db_session, org_id, exclude_booking_uuid)

    facilities = (
        await db_session.execute(
            select(Facility).where(
                Facility.org_id == org_id,
                Facility.status == FacilityStatus.ACTIVE.value,
                Facility.is_bookable == True,  # noqa: E712
            )
        )
    ).scalars().all()
    busy: Set[int] = set(
        (
            await db_session.execute(
                select(FacilityReservation.facility_id).where(
                    FacilityReservation.org_id == org_id, *_approved_between(*window, exclude_id)
                )
            )
        ).scalars().all()
    )
    day_start = datetime.combine(window[0].date(), time.min)
    day_load: Dict[int, int] = dict(
        (
            await db_session.execute(
                select(FacilityReservation.facility_id, func.count(FacilityReservation.id))
                .where(FacilityReservation.org_id == org_id, *_approved_between(day_start, day_start + timedelta(days=1), exclude_id))
                .group_by(FacilityReservation.facility_id)
            )
        ).all()
    )

    locations = {
        loc.id: loc
        for loc in (await db_session.execute(select(Location).where(Location.org_id == org_id))).scalars().all()
    }
    allowed_locations: Optional[Set[int]] = None
    if location_uuid:
        root = next((loc for loc in locations.values() if loc.location_uuid == location_uuid), None)
        if root is None:
            raise bad_request("Unknown location")
        allowed_locations = _descendants(locations, root.id)

    wanted: Dict[int, str] = {}
    if equipment_uuids:
        rows = (
            await db_session.execute(
                select(ConfigLookup).where(ConfigLookup.org_id == org_id, ConfigLookup.lookup_uuid.in_(equipment_uuids))  # type: ignore[attr-defined]
            )
        ).scalars().all()
        wanted = {row.id: row.name for row in rows}

    near: Optional[Facility] = None
    if near_facility_uuid:
        near = next((f for f in facilities if f.facility_uuid == near_facility_uuid), None) or (
            await get_facility_by_uuid(db_session, near_facility_uuid)
        )
        if near.org_id != org_id:
            near = None

    type_names = await _type_names(db_session, [f.facility_type_id for f in facilities if f.facility_type_id])
    suggestions = []
    for facility in facilities:
        if facility.id in busy or availability_reasons(facility, window):
            continue
        if attendees and facility.capacity is not None and facility.capacity < attendees:
            continue
        have = {item.get("lookup_id") for item in facility.equipment or []}
        if any(lookup_id not in have for lookup_id in wanted):
            continue
        if allowed_locations is not None and facility.location_id not in allowed_locations:
            continue
        points, available, reasons = _score(facility, attendees, near, locations, wanted, day_load.get(facility.id, 0))
        location = locations.get(facility.location_id) if facility.location_id else None
        suggestions.append(RoomSuggestion(
            facility_uuid=facility.facility_uuid,
            name=facility.name,
            code=facility.code,
            capacity=facility.capacity,
            facility_type_name=type_names.get(facility.facility_type_id) if facility.facility_type_id else None,
            location_uuid=location.location_uuid if location else None,
            location_name=location.name if location else None,
            score=round(100 * points / available),
            reasons=reasons,
        ))
    # Best score first; among equals the smaller room, then by name.
    suggestions.sort(key=lambda s: (-s.score, s.capacity if s.capacity is not None else 10**9, s.name))
    return suggestions[:limit]


def _descendants(locations: Dict[int, Location], root_id: int) -> Set[int]:
    found = {root_id}
    changed = True
    while changed:
        changed = False
        for loc in locations.values():
            if loc.parent_id in found and loc.id not in found:
                found.add(loc.id)
                changed = True
    return found


async def _type_names(db_session: AsyncSession, ids: List[int]) -> Dict[int, str]:
    if not ids:
        return {}
    rows = (await db_session.execute(select(ConfigLookup).where(ConfigLookup.id.in_(set(ids))))).scalars().all()  # type: ignore[union-attr]
    return {row.id: row.name for row in rows}


def _score(
    facility: Facility,
    attendees: Optional[int],
    near: Optional[Facility],
    locations: Dict[int, Location],
    wanted: Dict[int, str],
    load: int,
):
    points, available = 0.0, 0
    reasons: List[SuggestionReason] = []

    available += 40
    if attendees and facility.capacity:
        ratio = attendees / facility.capacity
        points += 40 * ratio
        code = "fits" if ratio >= 0.6 else "roomy"
        reasons.append(SuggestionReason(code=code, params={"capacity": facility.capacity, "attendees": attendees}))
    elif facility.capacity:
        points += 20
        reasons.append(SuggestionReason(code="seats", params={"capacity": facility.capacity}))
    else:
        points += 10
        reasons.append(SuggestionReason(code="capacity_unknown"))

    if near is not None:
        available += 25
        here = locations.get(facility.location_id) if facility.location_id else None
        there = locations.get(near.location_id) if near.location_id else None
        if facility.id == near.id:
            points += 25
            reasons.append(SuggestionReason(code="same_room"))
        elif here and there and here.id == there.id:
            points += 20
            reasons.append(SuggestionReason(code="same_location", params={"location": here.name}))
        elif here and there and here.parent_id and here.parent_id == there.parent_id:
            points += 10
            parent = locations.get(here.parent_id)
            reasons.append(SuggestionReason(code="nearby", params={"location": parent.name if parent else here.name}))

    if wanted:
        available += 15
        points += 15
        reasons.append(SuggestionReason(code="equipment", params={"items": sorted(wanted.values())}))

    available += 20
    points += 20 * (1 - min(load, BUSY_DAY * 2) / (BUSY_DAY * 2))
    if load == 0:
        reasons.append(SuggestionReason(code="quiet_day"))
    elif load >= BUSY_DAY:
        reasons.append(SuggestionReason(code="busy_day", params={"count": load}))
    return points, available, reasons


# ---------------------------------------------------------------------------
# Free windows of one room
# ---------------------------------------------------------------------------


def _subtract(intervals: List[Window], cuts: List[Window]) -> List[Window]:
    out = intervals
    for cut in cuts:
        kept = []
        for begin, finish in out:
            if cut[1] <= begin or cut[0] >= finish:
                kept.append((begin, finish))
                continue
            if begin < cut[0]:
                kept.append((begin, cut[0]))
            if cut[1] < finish:
                kept.append((cut[1], finish))
        out = kept
    return out


def _ceil_step(value: datetime) -> datetime:
    midnight = datetime.combine(value.date(), time.min)
    steps = -(-(value - midnight) // STEP)  # ceiling division
    return midnight + steps * STEP


def _floor_step(value: datetime) -> datetime:
    midnight = datetime.combine(value.date(), time.min)
    return midnight + ((value - midnight) // STEP) * STEP


def _opening(facility: Facility, day) -> List[Window]:
    slots = (facility.availability or {}).get("slots") or []
    if not slots:
        hours = [DEFAULT_OPENING]
    else:
        key = WEEKDAY_KEYS[day.weekday()]
        hours = []
        for slot in slots:
            if slot.get("day") != key:
                continue
            try:
                hours.append((time.fromisoformat(slot["start"]), time.fromisoformat(slot["end"])))
            except (KeyError, ValueError):
                continue
    return [(datetime.combine(day, a), datetime.combine(day, b)) for a, b in hours if a < b]


async def free_slots(
    db_session: AsyncSession,
    current_user: AnyUser,
    facility_uuid: str,
    start: str,
    duration_minutes: int,
    days: int = 7,
    around: Optional[str] = None,
    exclude_booking_uuid: Optional[str] = None,
    limit: int = 6,
) -> List[FreeSlot]:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await require_org_member(db_session, current_user, facility.org_id)
    begin = parse_datetime(start)
    if begin is None:
        raise bad_request("A valid start date/time is required")
    if not 15 <= duration_minutes <= 24 * 60:
        raise bad_request("Duration must be between 15 minutes and 24 hours")
    days = max(1, min(days, 31))
    limit = max(1, min(limit, MAX_SUGGESTIONS))
    duration = timedelta(minutes=duration_minutes)
    preferred = parse_datetime(around) if around else None
    exclude_id = await resolve_exclude(db_session, facility.org_id, exclude_booking_uuid)

    first_day = begin.date()
    horizon = (datetime.combine(first_day, time.min), datetime.combine(first_day + timedelta(days=days), time.min))
    # Never offer the past, nor anything before the requested start time.
    floor = max(begin, datetime.now())
    rows = (
        await db_session.execute(
            select(FacilityReservation).where(
                FacilityReservation.facility_id == facility.id, *_approved_between(*horizon, exclude_id)
            )
        )
    ).scalars().all()
    cuts: List[Window] = [(r.starts_at, r.ends_at) for r in rows]
    for blackout in (facility.availability or {}).get("blackout_dates") or []:
        window = session_window(blackout.get("start"), blackout.get("end") or blackout.get("start"))
        if window:
            cuts.append(window)

    candidates: List[datetime] = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        for gap_start, gap_end in _subtract(_opening(facility, day), cuts):
            gap_start = max(gap_start, floor)
            latest = _floor_step(gap_end - duration)
            earliest = _ceil_step(gap_start)
            if earliest > latest:
                continue
            if preferred is not None:
                wish = datetime.combine(day, preferred.time())
                candidates.append(min(max(_ceil_step(wish), earliest), latest))
            else:
                candidates.append(earliest)
    if preferred is not None:
        candidates.sort(key=lambda c: (abs(c - preferred), c))
    return [FreeSlot(start=format_minute(c), end=format_minute(c + duration)) for c in candidates[:limit]]
