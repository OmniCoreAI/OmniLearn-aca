"""Configuration lookups — admin-managed reusable categories.

Facility types, equipment, add-on categories, entity types, location types and
course categories share one table (``ConfigLookup``) keyed by ``kind``. Each org
gets a small set of seeded defaults the first time a kind is listed; the seed is
recorded in ``AdminSetting['lookup_seed']`` so defaults an admin deletes are
never re-created.
"""
from typing import Callable, Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.lookups import (
    ConfigLookup,
    ConfigLookupCreate,
    ConfigLookupOption,
    ConfigLookupRead,
    ConfigLookupUpdate,
    ConfigStatus,
    LookupKind,
    LookupReorderItem,
)
from src.db.administration.settings import AdminSetting
from src.services.administration.authz import AnyUser, authorize_admin, require_org_member
from src.services.administration.common import (
    bad_request,
    conflict,
    get_by_uuid_or_404,
    get_org_or_404,
    make_code,
    now,
)

WHAT = "manage configuration"

# (name, name_ar) seeded per kind. Codes are derived from the English name.
DEFAULT_LOOKUPS: Dict[str, List[Tuple[str, str]]] = {
    LookupKind.FACILITY_TYPE.value: [
        ("Training room", "قاعة تدريب"),
        ("Lecture hall", "قاعة محاضرات"),
        ("Computer lab", "معمل حاسب"),
        ("Meeting room", "قاعة اجتماعات"),
        ("Conference room", "قاعة مؤتمرات"),
        ("Other facility", "مرفق آخر"),
    ],
    LookupKind.EQUIPMENT.value: [
        ("Projector", "بروجكتور"),
        ("Whiteboard", "سبورة"),
        ("Sound system", "نظام صوت"),
        ("Air conditioning", "تكييف"),
        ("Interactive board", "سبورة تفاعلية"),
        ("Laptop", "لابتوب"),
        ("Camera", "كاميرا"),
        ("Microphone", "ميكروفون"),
    ],
    LookupKind.ADDON_CATEGORY.value: [
        ("Meals", "وجبات"),
        ("Materials", "مواد تدريبية"),
        ("Transportation", "مواصلات"),
        ("Accommodation", "إقامة"),
        ("Certificates", "شهادات"),
        ("Equipment rental", "تأجير معدات"),
        ("Support services", "خدمات دعم"),
    ],
    LookupKind.ENTITY_TYPE.value: [
        ("Ministry", "وزارة"),
        ("Government entity", "جهة حكومية"),
        ("University", "جامعة"),
        ("Company", "شركة"),
        ("NGO", "منظمة غير حكومية"),
        ("Training partner", "شريك تدريب"),
        ("Private organization", "جهة خاصة"),
    ],
    LookupKind.LOCATION_TYPE.value: [
        ("Building", "مبنى"),
        ("Branch", "فرع"),
        ("Campus", "حرم"),
        ("Training center", "مركز تدريب"),
    ],
    LookupKind.COURSE_CATEGORY.value: [],
}

# kind -> callables returning a SELECT count of rows referencing a lookup id.
# Later modules (facilities, add-ons, entities, …) register their usages so a
# lookup in use cannot be deleted out from under them.
LookupUsage = Callable[[int], object]
LOOKUP_USAGE: Dict[str, List[LookupUsage]] = {}


def register_lookup_usage(kind: LookupKind, usage: LookupUsage) -> None:
    LOOKUP_USAGE.setdefault(kind.value, []).append(usage)


def _validate_kind(kind: str) -> str:
    try:
        return LookupKind(kind).value
    except ValueError:
        raise bad_request(f"Unknown lookup kind: {kind}")


async def _usage_count(db_session: AsyncSession, lookup: ConfigLookup) -> int:
    total = 0
    for usage in LOOKUP_USAGE.get(lookup.kind, []):
        total += int((await db_session.execute(usage(lookup.id))).scalar() or 0)
    return total


async def _to_read(db_session: AsyncSession, lookup: ConfigLookup) -> ConfigLookupRead:
    parent_uuid = None
    if lookup.parent_id:
        parent = await db_session.get(ConfigLookup, lookup.parent_id)
        parent_uuid = parent.lookup_uuid if parent else None
    return ConfigLookupRead(
        **lookup.model_dump(),
        parent_uuid=parent_uuid,
        usage_count=await _usage_count(db_session, lookup),
    )


async def _resolve_parent(
    db_session: AsyncSession, org_id: int, kind: str, parent_uuid: Optional[str]
) -> Optional[int]:
    if not parent_uuid:
        return None
    parent = await get_by_uuid_or_404(
        db_session, ConfigLookup, ConfigLookup.lookup_uuid, parent_uuid, "Parent"
    )
    if parent.org_id != org_id or parent.kind != kind:
        raise bad_request("Parent must be a lookup of the same kind in this organization")
    return parent.id


async def _ensure_code_free(
    db_session: AsyncSession, org_id: int, kind: str, code: str, exclude_id: Optional[int] = None
) -> None:
    stmt = select(ConfigLookup).where(
        ConfigLookup.org_id == org_id, ConfigLookup.kind == kind, ConfigLookup.code == code
    )
    existing = (await db_session.execute(stmt)).scalars().first()
    if existing and existing.id != exclude_id:
        raise conflict(f"A {kind.replace('_', ' ')} with code {code} already exists")


async def ensure_default_lookups(db_session: AsyncSession, org_id: int, kind: str) -> None:
    """Seed a kind's defaults once per org (idempotent)."""
    marker = (
        await db_session.execute(
            select(AdminSetting).where(
                AdminSetting.org_id == org_id, AdminSetting.key == "lookup_seed"
            )
        )
    ).scalars().first()
    seeded = list((marker.value or {}).get("kinds", [])) if marker else []
    if kind in seeded:
        return
    for index, (name, name_ar) in enumerate(DEFAULT_LOOKUPS.get(kind, [])):
        code = make_code(None, name)
        exists = (
            await db_session.execute(
                select(ConfigLookup.id).where(
                    ConfigLookup.org_id == org_id,
                    ConfigLookup.kind == kind,
                    ConfigLookup.code == code,
                )
            )
        ).first()
        if exists:
            continue
        db_session.add(
            ConfigLookup(
                org_id=org_id,
                kind=kind,
                name=name,
                code=code,
                sort_order=index,
                status=ConfigStatus.ACTIVE,
                is_system=True,
                extra={"name_ar": name_ar},
                lookup_uuid=f"lookup_{uuid4()}",
                creation_date=now(),
                update_date=now(),
            )
        )
    seeded.append(kind)
    if marker:
        marker.value = {**(marker.value or {}), "kinds": seeded}
        marker.update_date = now()
        db_session.add(marker)
    else:
        db_session.add(
            AdminSetting(
                org_id=org_id,
                key="lookup_seed",
                value={"kinds": seeded},
                creation_date=now(),
                update_date=now(),
            )
        )
    await db_session.commit()


async def list_lookups(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    kind: Optional[str] = None,
) -> List[ConfigLookupRead]:
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    kinds = [_validate_kind(kind)] if kind else [k.value for k in LookupKind]
    for k in kinds:
        await ensure_default_lookups(db_session, org_id, k)
    rows = (
        await db_session.execute(
            select(ConfigLookup)
            .where(ConfigLookup.org_id == org_id, ConfigLookup.kind.in_(kinds))  # type: ignore[attr-defined]
            .order_by(ConfigLookup.kind, ConfigLookup.sort_order, ConfigLookup.name)
        )
    ).scalars().all()
    return [await _to_read(db_session, r) for r in rows]


async def list_lookup_options(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, kind: str
) -> List[ConfigLookupOption]:
    """Active entries of a kind for pickers — any org member."""
    await require_org_member(db_session, current_user, org_id)
    kind = _validate_kind(kind)
    await ensure_default_lookups(db_session, org_id, kind)
    rows = (
        await db_session.execute(
            select(ConfigLookup)
            .where(
                ConfigLookup.org_id == org_id,
                ConfigLookup.kind == kind,
                ConfigLookup.status == ConfigStatus.ACTIVE,
            )
            .order_by(ConfigLookup.sort_order, ConfigLookup.name)
        )
    ).scalars().all()
    return [
        ConfigLookupOption(
            id=r.id, lookup_uuid=r.lookup_uuid, kind=r.kind, name=r.name, code=r.code, color=r.color
        )
        for r in rows
    ]


async def create_lookup(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: ConfigLookupCreate
) -> ConfigLookupRead:
    await authorize_admin(db_session, current_user, org_id, "configuration", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    kind = _validate_kind(payload.kind)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    code = make_code(payload.code, name)
    await _ensure_code_free(db_session, org_id, kind, code)
    lookup = ConfigLookup(
        org_id=org_id,
        kind=kind,
        name=name,
        code=code,
        description=payload.description,
        color=payload.color,
        sort_order=payload.sort_order,
        status=payload.status,
        parent_id=await _resolve_parent(db_session, org_id, kind, payload.parent_uuid),
        extra=payload.extra,
        lookup_uuid=f"lookup_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(lookup)
    await db_session.commit()
    await db_session.refresh(lookup)
    return await _to_read(db_session, lookup)


async def get_lookup_by_uuid(db_session: AsyncSession, lookup_uuid: str) -> ConfigLookup:
    return await get_by_uuid_or_404(
        db_session, ConfigLookup, ConfigLookup.lookup_uuid, lookup_uuid, "Lookup"
    )


async def resolve_lookup_id(
    db_session: AsyncSession, org_id: int, kind: LookupKind, lookup_uuid: Optional[str]
) -> Optional[int]:
    """Map a lookup uuid (from a payload) to its id, enforcing org + kind."""
    if not lookup_uuid:
        return None
    lookup = await get_lookup_by_uuid(db_session, lookup_uuid)
    if lookup.org_id != org_id or lookup.kind != kind.value:
        raise bad_request(f"Invalid {kind.value.replace('_', ' ')}")
    return lookup.id


async def update_lookup(
    db_session: AsyncSession, current_user: AnyUser, lookup_uuid: str, payload: ConfigLookupUpdate
) -> ConfigLookupRead:
    lookup = await get_lookup_by_uuid(db_session, lookup_uuid)
    await authorize_admin(db_session, current_user, lookup.org_id, "configuration", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise bad_request("Name is required")
        lookup.name = name
    if "code" in data:
        code = make_code(data["code"], lookup.name)
        await _ensure_code_free(db_session, lookup.org_id, lookup.kind, code, exclude_id=lookup.id)
        lookup.code = code
    if "parent_uuid" in data:
        parent_id = await _resolve_parent(db_session, lookup.org_id, lookup.kind, data["parent_uuid"])
        if parent_id == lookup.id:
            raise bad_request("A lookup cannot be its own parent")
        lookup.parent_id = parent_id
    for field in ("description", "color", "sort_order", "status", "extra"):
        if field in data:
            setattr(lookup, field, data[field])
    lookup.update_date = now()
    db_session.add(lookup)
    await db_session.commit()
    await db_session.refresh(lookup)
    return await _to_read(db_session, lookup)


async def reorder_lookups(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    items: List[LookupReorderItem],
) -> List[ConfigLookupRead]:
    await authorize_admin(db_session, current_user, org_id, "configuration", "update", WHAT)
    touched = []
    for item in items:
        lookup = await get_lookup_by_uuid(db_session, item.lookup_uuid)
        if lookup.org_id != org_id:
            raise HTTPException(status_code=404, detail="Lookup not found")
        lookup.sort_order = item.sort_order
        lookup.update_date = now()
        db_session.add(lookup)
        touched.append(lookup)
    await db_session.commit()
    return [await _to_read(db_session, lookup) for lookup in touched]


async def delete_lookup(db_session: AsyncSession, current_user: AnyUser, lookup_uuid: str) -> str:
    lookup = await get_lookup_by_uuid(db_session, lookup_uuid)
    await authorize_admin(db_session, current_user, lookup.org_id, "configuration", "delete", WHAT)
    if await _usage_count(db_session, lookup):
        raise conflict("This entry is in use — deactivate it instead of deleting it")
    children = (
        await db_session.execute(
            select(func.count(ConfigLookup.id)).where(ConfigLookup.parent_id == lookup.id)
        )
    ).scalar() or 0
    if children:
        raise conflict("This entry has child entries — move or delete them first")
    await db_session.delete(lookup)
    await db_session.commit()
    return "Lookup deleted"
