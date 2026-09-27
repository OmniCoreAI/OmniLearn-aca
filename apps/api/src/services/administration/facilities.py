"""Locations & facilities service, plus facility booking / conflict helpers.

Other modules attach a facility by uuid through ``resolve_facility_id`` and
embed it with ``facility_ref``. Schedule sessions call ``check_session_booking``
before saving: it rejects (409) overlaps with other sessions in the same room
and blackout periods, unless the caller explicitly allows the conflict.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlmodel import and_, func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, OfferingSession
from src.db.administration.facilities import (
    Facility,
    FacilityBooking,
    FacilityCreate,
    FacilityEquipmentRead,
    FacilityOption,
    FacilityRead,
    FacilityRef,
    FacilityStatus,
    FacilityUpdate,
    Location,
    LocationCreate,
    LocationRead,
    LocationUpdate,
)
from src.db.administration.lookups import ConfigLookup, ConfigLookupOption, LookupKind
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.services.administration.authz import AnyUser, authorize_admin, require_org_member
from src.services.administration.common import (
    bad_request,
    get_by_uuid_or_404,
    get_org_or_404,
    make_code,
    now,
)
from src.services.administration.lookups import register_lookup_usage, resolve_lookup_id
from src.services.administration.overview import register_overview_counter
from src.services.instructors.validation import validate_availability
from src.services.utils.upload_content import upload_file

WHAT = "manage facilities"


# ---------------------------------------------------------------------------
# Registrations (lookup usage + overview counters)
# ---------------------------------------------------------------------------

register_lookup_usage(
    LookupKind.FACILITY_TYPE,
    lambda lookup_id: select(func.count(Facility.id)).where(Facility.facility_type_id == lookup_id),
)
register_lookup_usage(
    LookupKind.LOCATION_TYPE,
    lambda lookup_id: select(func.count(Location.id)).where(Location.location_type_id == lookup_id),
)
register_overview_counter(
    "facilities", lambda org_id: select(func.count(Facility.id)).where(Facility.org_id == org_id)
)
register_overview_counter(
    "locations", lambda org_id: select(func.count(Location.id)).where(Location.org_id == org_id)
)


async def _lookup_option(db_session: AsyncSession, lookup_id: Optional[int]) -> Optional[ConfigLookupOption]:
    if not lookup_id:
        return None
    lookup = await db_session.get(ConfigLookup, lookup_id)
    if not lookup:
        return None
    return ConfigLookupOption(
        id=lookup.id,
        lookup_uuid=lookup.lookup_uuid,
        kind=lookup.kind,
        name=lookup.name,
        code=lookup.code,
        color=lookup.color,
    )


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------


async def _location_read(db_session: AsyncSession, location: Location) -> LocationRead:
    parent = await db_session.get(Location, location.parent_id) if location.parent_id else None
    facility_count = (
        await db_session.execute(select(func.count(Facility.id)).where(Facility.location_id == location.id))
    ).scalar() or 0
    return LocationRead(
        **location.model_dump(),
        location_type=await _lookup_option(db_session, location.location_type_id),
        parent_uuid=parent.location_uuid if parent else None,
        parent_name=parent.name if parent else None,
        facility_count=int(facility_count),
    )


async def _resolve_location_id(
    db_session: AsyncSession, org_id: int, location_uuid: Optional[str]
) -> Optional[int]:
    if not location_uuid:
        return None
    location = await get_by_uuid_or_404(db_session, Location, Location.location_uuid, location_uuid, "Location")
    if location.org_id != org_id:
        raise bad_request("Location belongs to a different organization")
    return location.id


async def list_locations(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[LocationRead]:
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    rows = (
        await db_session.execute(select(Location).where(Location.org_id == org_id).order_by(Location.name))
    ).scalars().all()
    return [await _location_read(db_session, r) for r in rows]


async def create_location(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: LocationCreate
) -> LocationRead:
    await authorize_admin(db_session, current_user, org_id, "configuration", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    data = payload.model_dump(exclude={"location_type_uuid", "parent_uuid", "code", "name"})
    location = Location(
        **data,
        name=name,
        code=make_code(payload.code, name),
        org_id=org_id,
        location_type_id=await resolve_lookup_id(db_session, org_id, LookupKind.LOCATION_TYPE, payload.location_type_uuid),
        parent_id=await _resolve_location_id(db_session, org_id, payload.parent_uuid),
        location_uuid=f"location_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)
    return await _location_read(db_session, location)


async def update_location(
    db_session: AsyncSession, current_user: AnyUser, location_uuid: str, payload: LocationUpdate
) -> LocationRead:
    location = await get_by_uuid_or_404(db_session, Location, Location.location_uuid, location_uuid, "Location")
    await authorize_admin(db_session, current_user, location.org_id, "configuration", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    if "location_type_uuid" in data:
        location.location_type_id = await resolve_lookup_id(
            db_session, location.org_id, LookupKind.LOCATION_TYPE, data.pop("location_type_uuid")
        )
    if "parent_uuid" in data:
        parent_id = await _resolve_location_id(db_session, location.org_id, data.pop("parent_uuid"))
        if parent_id == location.id:
            raise bad_request("A location cannot be its own parent")
        location.parent_id = parent_id
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise bad_request("Name is required")
    if "code" in data:
        data["code"] = make_code(data["code"], data.get("name") or location.name)
    for key, value in data.items():
        setattr(location, key, value)
    location.update_date = now()
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)
    return await _location_read(db_session, location)


async def delete_location(db_session: AsyncSession, current_user: AnyUser, location_uuid: str) -> str:
    location = await get_by_uuid_or_404(db_session, Location, Location.location_uuid, location_uuid, "Location")
    await authorize_admin(db_session, current_user, location.org_id, "configuration", "delete", WHAT)
    # Facilities keep existing (location_id -> NULL via FK rule).
    await db_session.delete(location)
    await db_session.commit()
    return "Location deleted"


# ---------------------------------------------------------------------------
# Facilities
# ---------------------------------------------------------------------------


def _validate_facility(data: dict) -> None:
    for field in ("capacity", "hourly_cost", "daily_cost"):
        if data.get(field) is not None and data[field] < 0:
            raise bad_request(f"{field.replace('_', ' ').capitalize()} cannot be negative")
    availability = data.get("availability")
    if availability is not None:
        validate_availability({"slots": (availability or {}).get("slots") or []})
        for blackout in (availability or {}).get("blackout_dates") or []:
            start, end = str(blackout.get("start") or ""), str(blackout.get("end") or blackout.get("start") or "")
            try:
                if datetime.fromisoformat(end) < datetime.fromisoformat(start):
                    raise bad_request("A blackout period must end after it starts")
            except ValueError:
                raise bad_request("Blackout dates must use YYYY-MM-DD")


async def _equipment_to_ids(db_session: AsyncSession, org_id: int, items) -> list:
    result = []
    seen = set()
    for item in items or []:
        lookup_id = await resolve_lookup_id(db_session, org_id, LookupKind.EQUIPMENT, item.lookup_uuid)
        if lookup_id in seen:
            continue
        seen.add(lookup_id)
        result.append({"lookup_id": lookup_id, "quantity": max(1, int(item.quantity or 1))})
    return result


async def _equipment_read(db_session: AsyncSession, equipment: Optional[list]) -> List[FacilityEquipmentRead]:
    out = []
    for item in equipment or []:
        lookup = await db_session.get(ConfigLookup, item.get("lookup_id"))
        if lookup:  # equipment deleted from the catalog is silently dropped
            out.append(FacilityEquipmentRead(lookup_uuid=lookup.lookup_uuid, name=lookup.name, quantity=item.get("quantity", 1)))
    return out


async def _facility_read(db_session: AsyncSession, facility: Facility) -> FacilityRead:
    location = await db_session.get(Location, facility.location_id) if facility.location_id else None
    bookings = await list_bookings_internal(db_session, facility, datetime.now(), None)
    data = facility.model_dump(exclude={"equipment"})
    return FacilityRead(
        **data,
        facility_type=await _lookup_option(db_session, facility.facility_type_id),
        location_uuid=location.location_uuid if location else None,
        location_name=location.name if location else None,
        equipment=await _equipment_read(db_session, facility.equipment),
        upcoming_bookings=len(bookings),
    )


async def get_facility_by_uuid(db_session: AsyncSession, facility_uuid: str) -> Facility:
    return await get_by_uuid_or_404(db_session, Facility, Facility.facility_uuid, facility_uuid, "Facility")


async def list_facilities(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[FacilityRead]:
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    rows = (
        await db_session.execute(select(Facility).where(Facility.org_id == org_id).order_by(Facility.name))
    ).scalars().all()
    return [await _facility_read(db_session, r) for r in rows]


async def list_facility_options(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[FacilityOption]:
    """Bookable, active facilities for pickers — any org member, no costs."""
    await require_org_member(db_session, current_user, org_id)
    rows = (
        await db_session.execute(
            select(Facility, Location, ConfigLookup)
            .join(Location, Location.id == Facility.location_id, isouter=True)  # type: ignore[arg-type]
            .join(ConfigLookup, ConfigLookup.id == Facility.facility_type_id, isouter=True)  # type: ignore[arg-type]
            .where(
                Facility.org_id == org_id,
                Facility.status == FacilityStatus.ACTIVE.value,
                Facility.is_bookable == True,  # noqa: E712
            )
            .order_by(Facility.name)
        )
    ).all()
    return [
        FacilityOption(
            facility_uuid=f.facility_uuid,
            name=f.name,
            code=f.code,
            capacity=f.capacity,
            facility_type_name=lookup.name if lookup else None,
            location_name=location.name if location else None,
        )
        for f, location, lookup in rows
    ]


async def get_facility(db_session: AsyncSession, current_user: AnyUser, facility_uuid: str) -> FacilityRead:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await authorize_admin(db_session, current_user, facility.org_id, "configuration", "read", WHAT)
    return await _facility_read(db_session, facility)


async def create_facility(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: FacilityCreate
) -> FacilityRead:
    await authorize_admin(db_session, current_user, org_id, "configuration", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    data = payload.model_dump(exclude={"facility_type_uuid", "location_uuid", "equipment", "code", "name"})
    _validate_facility(data)
    facility = Facility(
        **data,
        name=name,
        code=make_code(payload.code, name),
        org_id=org_id,
        facility_type_id=await resolve_lookup_id(db_session, org_id, LookupKind.FACILITY_TYPE, payload.facility_type_uuid),
        location_id=await _resolve_location_id(db_session, org_id, payload.location_uuid),
        equipment=await _equipment_to_ids(db_session, org_id, payload.equipment),
        facility_uuid=f"facility_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(facility)
    await db_session.commit()
    await db_session.refresh(facility)
    return await _facility_read(db_session, facility)


async def update_facility(
    db_session: AsyncSession, current_user: AnyUser, facility_uuid: str, payload: FacilityUpdate
) -> FacilityRead:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await authorize_admin(db_session, current_user, facility.org_id, "configuration", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    _validate_facility(data)
    if "facility_type_uuid" in data:
        facility.facility_type_id = await resolve_lookup_id(
            db_session, facility.org_id, LookupKind.FACILITY_TYPE, data.pop("facility_type_uuid")
        )
    if "location_uuid" in data:
        facility.location_id = await _resolve_location_id(db_session, facility.org_id, data.pop("location_uuid"))
    if "equipment" in data:
        data.pop("equipment")
        facility.equipment = await _equipment_to_ids(db_session, facility.org_id, payload.equipment)
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise bad_request("Name is required")
    if "code" in data:
        data["code"] = make_code(data["code"], data.get("name") or facility.name)
    for key, value in data.items():
        setattr(facility, key, value)
    facility.update_date = now()
    db_session.add(facility)
    await db_session.commit()
    await db_session.refresh(facility)
    return await _facility_read(db_session, facility)


async def upload_facility_image(
    db_session: AsyncSession, current_user: AnyUser, facility_uuid: str, image: UploadFile
) -> FacilityRead:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await authorize_admin(db_session, current_user, facility.org_id, "configuration", "update", WHAT)
    org = await db_session.get(Organization, facility.org_id)
    facility.image = await upload_file(
        file=image,
        directory=f"facilities/{facility.facility_uuid}/images",
        type_of_dir="orgs",
        uuid=org.org_uuid if org else "",
        allowed_types=["image"],
        filename_prefix="facility",
    )
    facility.update_date = now()
    db_session.add(facility)
    await db_session.commit()
    await db_session.refresh(facility)
    return await _facility_read(db_session, facility)


async def delete_facility(db_session: AsyncSession, current_user: AnyUser, facility_uuid: str) -> str:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await authorize_admin(db_session, current_user, facility.org_id, "configuration", "delete", WHAT)
    # Courses/sessions keep existing; their facility_id becomes NULL (FK rule).
    await db_session.delete(facility)
    await db_session.commit()
    return "Facility deleted"


# ---------------------------------------------------------------------------
# Attaching facilities from other modules
# ---------------------------------------------------------------------------


async def resolve_facility_id(
    db_session: AsyncSession, org_id: int, facility_uuid: Optional[str]
) -> Optional[int]:
    """Map a payload ``facility_uuid`` to an id ("" / None clears it).

    Only active, bookable facilities of the same org can be newly attached.
    """
    if not facility_uuid:
        return None
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    if facility.org_id != org_id:
        raise bad_request("Facility belongs to a different organization")
    if facility.status != FacilityStatus.ACTIVE.value or not facility.is_bookable:
        raise bad_request(f"{facility.name} is not available for booking")
    return facility.id


async def facility_ref(db_session: AsyncSession, facility_id: Optional[int]) -> Optional[FacilityRef]:
    if not facility_id:
        return None
    facility = await db_session.get(Facility, facility_id)
    if not facility:
        return None
    location = await db_session.get(Location, facility.location_id) if facility.location_id else None
    return FacilityRef(
        facility_uuid=facility.facility_uuid,
        name=facility.name,
        capacity=facility.capacity,
        location_name=location.name if location else None,
    )


# ---------------------------------------------------------------------------
# Bookings & conflicts
# ---------------------------------------------------------------------------


def _parse(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=None)


def session_window(start: Optional[str], end: Optional[str]) -> Optional[Tuple[datetime, datetime]]:
    """Occupied time range of a session. Date-only values cover whole days."""
    begin = _parse(start)
    if begin is None:
        return None
    start_is_date = len(str(start).strip()) <= 10
    finish = _parse(end)
    if finish is None:
        finish = begin + (timedelta(days=1) if start_is_date else timedelta(hours=1))
    elif len(str(end).strip()) <= 10:
        finish = finish + timedelta(days=1)  # an end *date* is inclusive
    if finish <= begin:
        finish = begin + timedelta(hours=1)
    return begin, finish


def _overlaps(a: Tuple[datetime, datetime], b: Tuple[datetime, datetime]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


async def _facility_sessions(db_session: AsyncSession, facility_id: int) -> List[Tuple[FacilityBooking, Optional[Tuple[datetime, datetime]], Tuple[str, int]]]:
    """Every session occupying the facility, directly or via its parent default."""
    out = []
    course_rows = (
        await db_session.execute(
            select(CourseScheduleSession, CourseAcademicProfile, Course)
            .join(CourseAcademicProfile, CourseAcademicProfile.id == CourseScheduleSession.profile_id)  # type: ignore[arg-type]
            .join(Course, Course.id == CourseAcademicProfile.course_id)  # type: ignore[arg-type]
            .where(
                or_(
                    CourseScheduleSession.facility_id == facility_id,
                    and_(
                        CourseScheduleSession.facility_id.is_(None),  # type: ignore[union-attr]
                        CourseAcademicProfile.facility_id == facility_id,
                    ),
                )
            )
        )
    ).all()
    for session, _profile, course in course_rows:
        booking = FacilityBooking(
            source="course_session",
            session_uuid=session.session_uuid,
            title=session.title,
            start=session.start_date,
            end=session.end_date,
            parent_name=course.name,
            parent_uuid=course.course_uuid,
            inherited=session.facility_id is None,
        )
        out.append((booking, session_window(session.start_date, session.end_date), ("course_session", session.id)))

    offering_rows = (
        await db_session.execute(
            select(OfferingSession, CourseOffering)
            .join(CourseOffering, CourseOffering.id == OfferingSession.offering_id)  # type: ignore[arg-type]
            .where(
                or_(
                    OfferingSession.facility_id == facility_id,
                    and_(
                        OfferingSession.facility_id.is_(None),  # type: ignore[union-attr]
                        CourseOffering.facility_id == facility_id,
                    ),
                )
            )
        )
    ).all()
    for session, offering in offering_rows:
        booking = FacilityBooking(
            source="offering_session",
            session_uuid=session.session_uuid,
            title=session.title or session.session_type,
            start=session.start_datetime,
            end=session.end_datetime,
            parent_name=offering.code,
            parent_uuid=offering.offering_uuid,
            inherited=session.facility_id is None,
        )
        out.append((booking, session_window(session.start_datetime, session.end_datetime), ("offering_session", session.id)))
    return out


async def list_bookings_internal(
    db_session: AsyncSession, facility: Facility, since: Optional[datetime], until: Optional[datetime]
) -> List[FacilityBooking]:
    bookings = []
    for booking, window, _ in await _facility_sessions(db_session, facility.id):
        if window is None:
            continue
        if since and window[1] < since:
            continue
        if until and window[0] > until:
            continue
        bookings.append((window[0], booking))
    return [b for _, b in sorted(bookings, key=lambda item: item[0])]


async def list_bookings(
    db_session: AsyncSession,
    current_user: AnyUser,
    facility_uuid: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> List[FacilityBooking]:
    facility = await get_facility_by_uuid(db_session, facility_uuid)
    await require_org_member(db_session, current_user, facility.org_id)
    return await list_bookings_internal(db_session, facility, _parse(since), _parse(until))


async def find_conflicts(
    db_session: AsyncSession,
    facility_id: int,
    start: Optional[str],
    end: Optional[str],
    exclude: Optional[Tuple[str, int]] = None,
) -> List[str]:
    """Human-readable reasons this time range cannot use the facility."""
    window = session_window(start, end)
    if window is None:
        return []
    facility = await db_session.get(Facility, facility_id)
    if not facility:
        return []
    reasons = []
    for blackout in (facility.availability or {}).get("blackout_dates") or []:
        blackout_window = session_window(blackout.get("start"), blackout.get("end") or blackout.get("start"))
        if blackout_window and _overlaps(window, blackout_window):
            reason = blackout.get("reason") or "unavailable"
            reasons.append(f"{facility.name} is blocked ({reason}) {blackout.get('start')}")
    for booking, other, key in await _facility_sessions(db_session, facility_id):
        if exclude and key == exclude:
            continue
        if other and _overlaps(window, other):
            label = " — ".join(part for part in (booking.parent_name, booking.title) if part)
            reasons.append(f"{facility.name} is already booked by {label} ({booking.start})")
    return reasons


async def check_session_booking(
    db_session: AsyncSession,
    facility_id: Optional[int],
    start: Optional[str],
    end: Optional[str],
    exclude: Optional[Tuple[str, int]] = None,
    allow_conflict: bool = False,
) -> None:
    """Raise 409 when the session would double-book its (effective) facility."""
    if not facility_id or allow_conflict:
        return
    reasons = await find_conflicts(db_session, facility_id, start, end, exclude)
    if reasons:
        raise HTTPException(
            status_code=409,
            detail="Facility conflict: " + "; ".join(reasons[:3])
            + " (save again with allow_conflict to book anyway)",
        )
