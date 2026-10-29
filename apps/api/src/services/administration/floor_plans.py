"""Floor plans — the drawn layout of a building (a Location).

The plan is stored as JSON on ``Location.floor_plan``. Every bookable room in
it (``kind == "room"``) is backed by a Facility at that location: saving the
plan creates the facilities for new rooms and pushes name, capacity, status,
type, room number, equipment and floor onto existing ones, all in one commit.

Reading hydrates the rooms from their facilities, so edits made on the
Facilities page show up on the plan. A room whose facility was deleted or moved
to another location drops off the plan. Removing a room from the plan never
deletes its facility.
"""
from typing import Optional
from uuid import uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.facilities import (
    Facility,
    FacilityEquipmentInput,
    FacilityStatus,
    FloorPlanRead,
    FloorPlanSave,
    Location,
)
from src.db.administration.lookups import ConfigLookup, LookupKind
from src.services.administration.authz import AnyUser, authorize_admin, require_org_member
from src.services.administration.common import bad_request, get_by_uuid_or_404, make_code, now
from src.services.administration.facilities import WHAT, _equipment_to_ids
from src.services.administration.lookups import resolve_lookup_id

MAX_FLOORS = 60
MAX_ITEMS_PER_FLOOR = 400
ROOM_KINDS = {"room", "reception", "lobby"}
# Facility fields copied onto a plan room when it is read.
_STATUSES = {s.value for s in FacilityStatus}


def _num(value, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _rect(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    return {
        "x": max(0, round(_num(raw.get("x")))),
        "y": max(0, round(_num(raw.get("y")))),
        "w": max(8, round(_num(raw.get("w"), 120))),
        "h": max(8, round(_num(raw.get("h"), 100))),
    }


def _clean_plan(plan: dict) -> dict:
    """Validate the shape and keep only the keys the editor understands."""
    if not isinstance(plan, dict):
        raise bad_request("The floor plan must be an object")
    floors = plan.get("floors")
    if not isinstance(floors, list) or not floors:
        raise bad_request("A floor plan needs at least one floor")
    if len(floors) > MAX_FLOORS:
        raise bad_request(f"A building can have at most {MAX_FLOORS} floors")
    out_floors = []
    seen_floor_ids = set()
    for index, floor in enumerate(floors):
        if not isinstance(floor, dict):
            raise bad_request("Each floor must be an object")
        floor_id = str(floor.get("id") or f"floor-{index + 1}")[:64]
        if floor_id in seen_floor_ids:
            raise bad_request("Two floors share the same id")
        seen_floor_ids.add(floor_id)
        name = str(floor.get("name") or "").strip()[:60]
        if not name:
            raise bad_request("Every floor needs a name")
        rooms = floor.get("rooms") or []
        fixtures = floor.get("fixtures") or []
        if not isinstance(rooms, list) or not isinstance(fixtures, list):
            raise bad_request("Rooms and fixtures must be lists")
        if len(rooms) + len(fixtures) > MAX_ITEMS_PER_FLOOR:
            raise bad_request(f"A floor can hold at most {MAX_ITEMS_PER_FLOOR} items")
        canvas = floor.get("canvas") if isinstance(floor.get("canvas"), dict) else {}
        out_rooms = []
        for room in rooms:
            if not isinstance(room, dict):
                raise bad_request("Each room must be an object")
            kind = room.get("kind") if room.get("kind") in ROOM_KINDS else "room"
            room_name = str(room.get("name") or "").strip()[:120]
            if not room_name:
                raise bad_request(f"A room on {name} has no name")
            capacity = room.get("capacity")
            if capacity in ("", None):
                capacity = None
            else:
                capacity = int(_num(capacity, -1))
                if capacity < 0:
                    raise bad_request(f"{room_name}: capacity cannot be negative")
            doors = [
                {
                    "side": d.get("side") if d.get("side") in ("top", "bottom", "left", "right") else "bottom",
                    "pos": min(0.95, max(0.05, _num(d.get("pos"), 0.5))),
                }
                for d in (room.get("doors") or [])
                if isinstance(d, dict)
            ][:8]
            status = room.get("status") if room.get("status") in _STATUSES else FacilityStatus.ACTIVE.value
            equipment = [str(e) for e in (room.get("equipment") or []) if isinstance(e, str)][:40]
            out_rooms.append(
                {
                    "id": str(room.get("id") or uuid4().hex[:8])[:64],
                    "facility_uuid": room.get("facility_uuid") or None,
                    "kind": kind,
                    "name": room_name,
                    "capacity": capacity,
                    "status": status,
                    "room_number": (str(room.get("room_number") or "").strip()[:40] or None),
                    "facility_type_uuid": room.get("facility_type_uuid") or None,
                    "equipment": equipment,
                    "note": str(room.get("note") or "")[:500],
                    "rect": _rect(room.get("rect")),
                    "doors": doors,
                }
            )
        out_fixtures = [
            {
                "id": str(fx.get("id") or uuid4().hex[:8])[:64],
                "type": str(fx.get("type") or "label")[:20],
                "rect": _rect(fx.get("rect")),
                **({"label": str(fx.get("label"))[:80]} if fx.get("label") else {}),
            }
            for fx in fixtures
            if isinstance(fx, dict)
        ]
        out_floors.append(
            {
                "id": floor_id,
                "name": name,
                "canvas": {
                    "w": min(4000, max(200, round(_num(canvas.get("w"), 800)))),
                    "h": min(4000, max(160, round(_num(canvas.get("h"), 500)))),
                },
                "rooms": out_rooms,
                "fixtures": out_fixtures,
            }
        )
    appearance = plan.get("appearance") if isinstance(plan.get("appearance"), dict) else {}
    return {
        "appearance": {
            "radius": min(20, max(0, round(_num(appearance.get("radius"), 8)))),
            "wallWidth": min(12, max(2, round(_num(appearance.get("wallWidth"), 6)))),
            "showChips": bool(appearance.get("showChips", True)),
            "showCapacity": bool(appearance.get("showCapacity", True)),
            "grid": int(appearance.get("grid")) if appearance.get("grid") in (10, 20, 25, 40) else 20,
        },
        "floors": out_floors,
    }


async def _hydrate(db_session: AsyncSession, location: Location) -> Optional[dict]:
    """Overlay each room's facility data; drop rooms whose facility is gone."""
    plan = location.floor_plan
    if not plan:
        return None
    uuids = {
        r.get("facility_uuid")
        for f in plan.get("floors") or []
        for r in f.get("rooms") or []
        if r.get("facility_uuid")
    }
    facilities = {}
    lookups = {}
    if uuids:
        rows = (
            await db_session.execute(select(Facility).where(Facility.facility_uuid.in_(uuids)))  # type: ignore[attr-defined]
        ).scalars().all()
        facilities = {f.facility_uuid: f for f in rows if f.location_id == location.id}
        lookup_ids = {
            item.get("lookup_id") for f in facilities.values() for item in (f.equipment or [])
        } | {f.facility_type_id for f in facilities.values() if f.facility_type_id}
        if lookup_ids:
            lookups = {
                lk.id: lk
                for lk in (
                    await db_session.execute(select(ConfigLookup).where(ConfigLookup.id.in_(lookup_ids)))  # type: ignore[union-attr]
                ).scalars().all()
            }
    floors = []
    for floor in plan.get("floors") or []:
        rooms = []
        for room in floor.get("rooms") or []:
            uuid = room.get("facility_uuid")
            if uuid:
                facility = facilities.get(uuid)
                if not facility:
                    continue
                equipment = [lookups[i["lookup_id"]] for i in facility.equipment or [] if i.get("lookup_id") in lookups]
                facility_type = lookups.get(facility.facility_type_id) if facility.facility_type_id else None
                room = {
                    **room,
                    "name": facility.name,
                    "capacity": facility.capacity,
                    "status": facility.status,
                    "room_number": facility.room_number,
                    "facility_type_uuid": facility_type.lookup_uuid if facility_type else None,
                    "equipment": [lk.lookup_uuid for lk in equipment],
                    "facilities": [lk.name for lk in equipment],
                }
            rooms.append(room)
        floors.append({**floor, "rooms": rooms})
    return {**plan, "floors": floors}


async def _location(db_session: AsyncSession, location_uuid: str) -> Location:
    return await get_by_uuid_or_404(db_session, Location, Location.location_uuid, location_uuid, "Location")


async def get_floor_plan(db_session: AsyncSession, current_user: AnyUser, location_uuid: str) -> FloorPlanRead:
    """Any org member may read a plan: room pickers show it, and it holds no costs."""
    location = await _location(db_session, location_uuid)
    await require_org_member(db_session, current_user, location.org_id)
    return FloorPlanRead(location_uuid=location.location_uuid, plan=await _hydrate(db_session, location))


async def save_floor_plan(
    db_session: AsyncSession, current_user: AnyUser, location_uuid: str, payload: FloorPlanSave
) -> FloorPlanRead:
    location = await _location(db_session, location_uuid)
    await authorize_admin(db_session, current_user, location.org_id, "configuration", "update", WHAT)
    plan = _clean_plan(payload.plan)
    org_id = location.org_id

    linked = [r["facility_uuid"] for f in plan["floors"] for r in f["rooms"] if r["facility_uuid"]]
    if len(linked) != len(set(linked)):
        raise bad_request("The same facility is placed twice on the plan")
    existing = {}
    if linked:
        rows = (
            await db_session.execute(select(Facility).where(Facility.facility_uuid.in_(linked)))  # type: ignore[attr-defined]
        ).scalars().all()
        existing = {f.facility_uuid: f for f in rows if f.org_id == org_id}

    created = updated = 0
    stamp = now()
    for floor in plan["floors"]:
        for room in floor["rooms"]:
            if room["kind"] != "room":
                room["facility_uuid"] = None
                continue
            fields = {
                "name": room["name"],
                "capacity": room["capacity"],
                "status": FacilityStatus(room["status"]),
                "room_number": room["room_number"],
                "floor": floor["name"],
                "location_id": location.id,
                "facility_type_id": await resolve_lookup_id(
                    db_session, org_id, LookupKind.FACILITY_TYPE, room["facility_type_uuid"]
                ),
                "equipment": await _equipment_to_ids(
                    db_session, org_id, [FacilityEquipmentInput(lookup_uuid=u) for u in room["equipment"]]
                ),
            }
            facility = existing.get(room["facility_uuid"]) if room["facility_uuid"] else None
            if facility:
                changed = any(getattr(facility, k) != v for k, v in fields.items())
                if changed:
                    for key, value in fields.items():
                        setattr(facility, key, value)
                    facility.update_date = stamp
                    db_session.add(facility)
                    updated += 1
            else:
                facility = Facility(
                    **fields,
                    org_id=org_id,
                    code=make_code(None, room["name"]),
                    facility_uuid=f"facility_{uuid4()}",
                    creation_date=stamp,
                    update_date=stamp,
                )
                db_session.add(facility)
                room["facility_uuid"] = facility.facility_uuid
                created += 1
            # The facility row is the source of truth; keep the plan lean.
            for key in ("capacity", "status", "room_number", "facility_type_uuid", "equipment"):
                room.pop(key, None)

    location.floor_plan = plan
    location.update_date = stamp
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)
    return FloorPlanRead(
        location_uuid=location.location_uuid,
        plan=await _hydrate(db_session, location),
        created=created,
        updated=updated,
    )
