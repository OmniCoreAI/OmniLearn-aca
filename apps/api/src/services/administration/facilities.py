"""Locations & facilities service.

Other modules attach a facility by uuid through ``resolve_facility_id`` and
embed it with ``facility_ref``. Bookings and conflict checks live in
``reservations``.
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import UploadFile
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.facilities import (
    Facility,
    FacilityCreate,
    FacilityEquipmentRead,
    FacilityOption,
    FacilityRead,
    FacilityRef,
    FacilityReservation,
    FacilityStatus,
    FacilityUpdate,
    Location,
    LocationCreate,
    LocationRead,
    LocationUpdate,
    ReservationStatus,
)
from src.db.administration.lookups import ConfigLookup, ConfigLookupOption, LookupKind
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
    upcoming = (
        await db_session.execute(
            select(func.count(FacilityReservation.id)).where(
                FacilityReservation.facility_id == facility.id,
                FacilityReservation.status == ReservationStatus.APPROVED.value,
                FacilityReservation.ends_at >= datetime.now(),
            )
        )
    ).scalar() or 0
    data = facility.model_dump(exclude={"equipment"})
    return FacilityRead(
        **data,
        facility_type=await _lookup_option(db_session, facility.facility_type_id),
        location_uuid=location.location_uuid if location else None,
        location_name=location.name if location else None,
        equipment=await _equipment_read(db_session, facility.equipment),
        upcoming_bookings=upcoming,
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
    # Courses/sessions keep existing; their facility_id becomes NULL (FK rule)
    # and the room's reservations go with it.
    for reservation in (
        await db_session.execute(select(FacilityReservation).where(FacilityReservation.facility_id == facility.id))
    ).scalars().all():
        await db_session.delete(reservation)
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
