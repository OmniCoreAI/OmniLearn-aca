"""Add-ons: catalog, attachments to learning targets, participant selections.

Pricing (per unit): ``unit_price = price_override ?? catalog price``. With a
tax rate ``r``: exclusive → ``total = unit_price × q × (1 + r)``; inclusive →
``total = unit_price × q`` and the tax is the embedded part. Selections store
a snapshot, so later catalog changes never rewrite what a participant chose.
"""
from datetime import date
from typing import List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.cohorts import Cohort
from src.db.academic.course_profiles import CourseAddOn
from src.db.academic.offerings import CourseOffering
from src.db.academic.training_programs import TrainingProgram
from src.db.administration.addons import (
    AddOn,
    AddOnAttachment,
    AddOnAttachmentCreate,
    AddOnAttachmentRead,
    AddOnAttachmentUpdate,
    AddOnCreate,
    AddOnOption,
    AddOnRead,
    AddOnSelection,
    AddOnSelectionRead,
    AddOnSelectionStatus,
    AddOnTargetType,
    AddOnUpdate,
    MySelectionUpdate,
    SelectionReport,
    TargetAddOnItem,
    TargetAddOnsRead,
)
from src.db.administration.lookups import ConfigLookup, ConfigLookupOption, ConfigStatus, LookupKind
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.security.rbac import AccessAction, check_resource_access
from src.services.academic.authors import get_user_author
from src.services.administration.authz import (
    AnyUser,
    authorize_admin,
    require_org_member,
    require_user_id,
)
from src.services.administration.common import bad_request, conflict, get_by_uuid_or_404, get_org_or_404, make_code, now
from src.services.administration.lookups import register_lookup_usage, resolve_lookup_id
from src.services.administration.overview import register_overview_counter
from src.services.utils.upload_content import upload_file

WHAT = "manage add-ons"

register_lookup_usage(
    LookupKind.ADDON_CATEGORY,
    lambda lookup_id: select(func.count(AddOn.id)).where(AddOn.category_id == lookup_id),
)
register_overview_counter("addons", lambda org_id: select(func.count(AddOn.id)).where(AddOn.org_id == org_id))


# ---------------------------------------------------------------------------
# Pricing helpers
# ---------------------------------------------------------------------------


def line_amounts(unit_price: float, quantity: int, tax_rate: Optional[float], tax_inclusive: bool) -> Tuple[float, float]:
    """Return ``(tax_amount, total)`` for ``quantity`` units, rounded to cents."""
    subtotal = float(unit_price) * int(quantity)
    rate = float(tax_rate or 0) / 100.0
    if not rate:
        return 0.0, round(subtotal, 2)
    if tax_inclusive:
        tax = subtotal - subtotal / (1 + rate)
        return round(tax, 2), round(subtotal, 2)
    tax = subtotal * rate
    return round(tax, 2), round(subtotal + tax, 2)


def _validate_addon(data: dict) -> None:
    if data.get("price") is not None and data["price"] < 0:
        raise bad_request("Price cannot be negative")
    if data.get("tax_rate") is not None and not 0 <= data["tax_rate"] <= 100:
        raise bad_request("Tax rate must be between 0 and 100")
    if data.get("stock") is not None and data["stock"] < 0:
        raise bad_request("Stock cannot be negative")
    for field in ("available_from", "available_until"):
        if data.get(field):
            try:
                date.fromisoformat(data[field])
            except ValueError:
                raise bad_request("Availability dates must use YYYY-MM-DD")
    if data.get("available_from") and data.get("available_until") and data["available_until"] < data["available_from"]:
        raise bad_request("The availability window must end after it starts")


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


async def _category_option(db_session: AsyncSession, category_id: Optional[int]) -> Optional[ConfigLookupOption]:
    if not category_id:
        return None
    lookup = await db_session.get(ConfigLookup, category_id)
    if not lookup:
        return None
    return ConfigLookupOption(
        id=lookup.id, lookup_uuid=lookup.lookup_uuid, kind=lookup.kind, name=lookup.name, code=lookup.code, color=lookup.color
    )


async def _selected_quantity(db_session: AsyncSession, addon_id: int) -> int:
    return int(
        (
            await db_session.execute(
                select(func.coalesce(func.sum(AddOnSelection.quantity), 0)).where(
                    AddOnSelection.addon_id == addon_id,
                    AddOnSelection.status == AddOnSelectionStatus.SELECTED.value,
                )
            )
        ).scalar()
        or 0
    )


async def _addon_read(db_session: AsyncSession, addon: AddOn) -> AddOnRead:
    attachments = (
        await db_session.execute(select(func.count(AddOnAttachment.id)).where(AddOnAttachment.addon_id == addon.id))
    ).scalar() or 0
    return AddOnRead(
        **addon.model_dump(),
        category=await _category_option(db_session, addon.category_id),
        attachment_count=int(attachments),
        selected_quantity=await _selected_quantity(db_session, addon.id),
    )


async def get_addon_by_uuid(db_session: AsyncSession, addon_uuid: str) -> AddOn:
    return await get_by_uuid_or_404(db_session, AddOn, AddOn.addon_uuid, addon_uuid, "Add-on")


async def list_addons(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[AddOnRead]:
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    rows = (await db_session.execute(select(AddOn).where(AddOn.org_id == org_id).order_by(AddOn.name))).scalars().all()
    return [await _addon_read(db_session, r) for r in rows]


async def list_addon_options(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[AddOnOption]:
    await require_org_member(db_session, current_user, org_id)
    rows = (
        await db_session.execute(
            select(AddOn, ConfigLookup)
            .join(ConfigLookup, ConfigLookup.id == AddOn.category_id, isouter=True)  # type: ignore[arg-type]
            .where(AddOn.org_id == org_id, AddOn.status == ConfigStatus.ACTIVE.value)
            .order_by(AddOn.name)
        )
    ).all()
    return [
        AddOnOption(
            addon_uuid=a.addon_uuid,
            name=a.name,
            price=a.price,
            currency=a.currency,
            unit=a.unit,
            category_name=c.name if c else None,
        )
        for a, c in rows
    ]


async def create_addon(db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: AddOnCreate) -> AddOnRead:
    await authorize_admin(db_session, current_user, org_id, "configuration", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    data = payload.model_dump(exclude={"category_uuid", "name", "code"})
    _validate_addon(data)
    addon = AddOn(
        **data,
        name=name,
        code=make_code(payload.code, name),
        org_id=org_id,
        category_id=await resolve_lookup_id(db_session, org_id, LookupKind.ADDON_CATEGORY, payload.category_uuid),
        addon_uuid=f"addon_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(addon)
    await db_session.commit()
    await db_session.refresh(addon)
    return await _addon_read(db_session, addon)


async def update_addon(db_session: AsyncSession, current_user: AnyUser, addon_uuid: str, payload: AddOnUpdate) -> AddOnRead:
    addon = await get_addon_by_uuid(db_session, addon_uuid)
    await authorize_admin(db_session, current_user, addon.org_id, "configuration", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    _validate_addon({**addon.model_dump(), **data})
    if "category_uuid" in data:
        addon.category_id = await resolve_lookup_id(
            db_session, addon.org_id, LookupKind.ADDON_CATEGORY, data.pop("category_uuid")
        )
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise bad_request("Name is required")
    if "code" in data:
        data["code"] = make_code(data["code"], data.get("name") or addon.name)
    for key, value in data.items():
        setattr(addon, key, value)
    addon.update_date = now()
    db_session.add(addon)
    await db_session.commit()
    await db_session.refresh(addon)
    return await _addon_read(db_session, addon)


async def upload_addon_image(db_session: AsyncSession, current_user: AnyUser, addon_uuid: str, image: UploadFile) -> AddOnRead:
    addon = await get_addon_by_uuid(db_session, addon_uuid)
    await authorize_admin(db_session, current_user, addon.org_id, "configuration", "update", WHAT)
    org = await db_session.get(Organization, addon.org_id)
    addon.image = await upload_file(
        file=image,
        directory=f"addons/{addon.addon_uuid}/images",
        type_of_dir="orgs",
        uuid=org.org_uuid if org else "",
        allowed_types=["image"],
        filename_prefix="addon",
    )
    addon.update_date = now()
    db_session.add(addon)
    await db_session.commit()
    await db_session.refresh(addon)
    return await _addon_read(db_session, addon)


async def delete_addon(db_session: AsyncSession, current_user: AnyUser, addon_uuid: str) -> str:
    addon = await get_addon_by_uuid(db_session, addon_uuid)
    await authorize_admin(db_session, current_user, addon.org_id, "configuration", "delete", WHAT)
    if await _selected_quantity(db_session, addon.id):
        raise conflict("Participants have selected this add-on — deactivate it instead of deleting it")
    await db_session.delete(addon)
    await db_session.commit()
    return "Add-on deleted"


# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------


async def resolve_target(db_session: AsyncSession, target_type: str, target_uuid: str) -> Tuple[int, str]:
    """``(org_id, display name)`` of an add-on target; 404 if it does not exist."""
    try:
        kind = AddOnTargetType(target_type)
    except ValueError:
        raise bad_request(f"Unknown add-on target: {target_type}")
    model, field, label = {
        AddOnTargetType.COURSE: (Course, Course.course_uuid, "Course"),
        AddOnTargetType.TRAINING_PROGRAM: (TrainingProgram, TrainingProgram.trainingprogram_uuid, "Training program"),
        AddOnTargetType.COHORT: (Cohort, Cohort.cohort_uuid, "Cohort"),
        AddOnTargetType.OFFERING: (CourseOffering, CourseOffering.offering_uuid, "Offering"),
    }[kind]
    obj = await get_by_uuid_or_404(db_session, model, field, target_uuid, label)
    name = getattr(obj, "name", None) or getattr(obj, "code", None) or target_uuid
    return obj.org_id, name


async def _require_target_access(
    request: Request, db_session: AsyncSession, current_user: AnyUser, target_type: str, target_uuid: str, org_id: int
) -> int:
    """A participant must be able to open the target to see / pick its add-ons."""
    user_id = require_user_id(current_user, "select add-ons")
    if target_type in (AddOnTargetType.COURSE.value, AddOnTargetType.TRAINING_PROGRAM.value):
        await check_resource_access(request, db_session, current_user, target_uuid, AccessAction.READ)
    else:
        await require_org_member(db_session, current_user, org_id)
    return user_id


def _available(addon: AddOn, remaining: Optional[int]) -> bool:
    if addon.status != ConfigStatus.ACTIVE.value:
        return False
    today = date.today().isoformat()
    if addon.available_from and today < addon.available_from:
        return False
    if addon.available_until and today > addon.available_until:
        return False
    return remaining is None or remaining > 0


async def _attachment_read(db_session: AsyncSession, attachment: AddOnAttachment, addon: AddOn) -> AddOnAttachmentRead:
    unit_price = attachment.price_override if attachment.price_override is not None else addon.price
    _, unit_with_tax = line_amounts(unit_price, 1, addon.tax_rate, addon.tax_inclusive)
    remaining = None
    if addon.stock is not None:
        remaining = max(0, addon.stock - await _selected_quantity(db_session, addon.id))
    category = await _category_option(db_session, addon.category_id)
    return AddOnAttachmentRead(
        attachment_uuid=attachment.attachment_uuid,
        target_type=attachment.target_type,
        target_uuid=attachment.target_uuid,
        addon_uuid=addon.addon_uuid,
        name=addon.name,
        description=addon.description,
        category_name=category.name if category else None,
        image=addon.image,
        unit=addon.unit,
        currency=addon.currency,
        catalog_price=addon.price,
        price_override=attachment.price_override,
        unit_price=unit_price,
        tax_rate=addon.tax_rate,
        tax_inclusive=addon.tax_inclusive,
        unit_price_with_tax=unit_with_tax,
        is_required=attachment.is_required,
        is_selectable=attachment.is_selectable,
        max_quantity=attachment.max_quantity,
        sort_order=attachment.sort_order,
        status=attachment.status,
        available=attachment.status == ConfigStatus.ACTIVE.value and _available(addon, remaining),
        remaining_stock=remaining,
    )


async def _target_attachments(db_session: AsyncSession, target_type: str, target_uuid: str):
    return (
        await db_session.execute(
            select(AddOnAttachment, AddOn)
            .join(AddOn, AddOn.id == AddOnAttachment.addon_id)  # type: ignore[arg-type]
            .where(AddOnAttachment.target_type == target_type, AddOnAttachment.target_uuid == target_uuid)
            .order_by(AddOnAttachment.sort_order, AddOn.name)
        )
    ).all()


# ---------------------------------------------------------------------------
# Attachments (managers)
# ---------------------------------------------------------------------------


async def list_attachments(
    db_session: AsyncSession, current_user: AnyUser, target_type: str, target_uuid: str
) -> List[AddOnAttachmentRead]:
    org_id, _ = await resolve_target(db_session, target_type, target_uuid)
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    return [await _attachment_read(db_session, a, addon) for a, addon in await _target_attachments(db_session, target_type, target_uuid)]


def _validate_attachment(data: dict) -> None:
    if data.get("price_override") is not None and data["price_override"] < 0:
        raise bad_request("Price cannot be negative")
    if data.get("max_quantity") is not None and data["max_quantity"] < 1:
        raise bad_request("Maximum quantity must be at least 1")


async def create_attachment(db_session: AsyncSession, current_user: AnyUser, payload: AddOnAttachmentCreate) -> AddOnAttachmentRead:
    target_type = payload.target_type.value if hasattr(payload.target_type, "value") else payload.target_type
    org_id, _ = await resolve_target(db_session, target_type, payload.target_uuid)
    await authorize_admin(db_session, current_user, org_id, "configuration", "create", WHAT)
    addon = await get_addon_by_uuid(db_session, payload.addon_uuid)
    if addon.org_id != org_id:
        raise bad_request("Add-on belongs to a different organization")
    _validate_attachment(payload.model_dump())
    existing = (
        await db_session.execute(
            select(AddOnAttachment).where(
                AddOnAttachment.addon_id == addon.id,
                AddOnAttachment.target_type == target_type,
                AddOnAttachment.target_uuid == payload.target_uuid,
            )
        )
    ).scalars().first()
    if existing:
        raise conflict(f"{addon.name} is already attached")
    attachment = AddOnAttachment(
        org_id=org_id,
        addon_id=addon.id,
        target_type=target_type,
        target_uuid=payload.target_uuid,
        price_override=payload.price_override,
        is_required=payload.is_required,
        is_selectable=payload.is_selectable,
        max_quantity=payload.max_quantity,
        sort_order=payload.sort_order,
        attachment_uuid=f"addonattachment_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(attachment)
    await db_session.commit()
    await db_session.refresh(attachment)
    return await _attachment_read(db_session, attachment, addon)


async def _get_attachment(db_session: AsyncSession, attachment_uuid: str) -> AddOnAttachment:
    return await get_by_uuid_or_404(
        db_session, AddOnAttachment, AddOnAttachment.attachment_uuid, attachment_uuid, "Add-on attachment"
    )


async def update_attachment(
    db_session: AsyncSession, current_user: AnyUser, attachment_uuid: str, payload: AddOnAttachmentUpdate
) -> AddOnAttachmentRead:
    attachment = await _get_attachment(db_session, attachment_uuid)
    await authorize_admin(db_session, current_user, attachment.org_id, "configuration", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    _validate_attachment(data)
    for key, value in data.items():
        setattr(attachment, key, value)
    attachment.update_date = now()
    db_session.add(attachment)
    await db_session.commit()
    await db_session.refresh(attachment)
    return await _attachment_read(db_session, attachment, await db_session.get(AddOn, attachment.addon_id))


async def delete_attachment(db_session: AsyncSession, current_user: AnyUser, attachment_uuid: str) -> str:
    attachment = await _get_attachment(db_session, attachment_uuid)
    await authorize_admin(db_session, current_user, attachment.org_id, "configuration", "delete", WHAT)
    # Recorded selections keep their snapshot (attachment_id -> NULL).
    await db_session.delete(attachment)
    await db_session.commit()
    return "Add-on detached"


# ---------------------------------------------------------------------------
# Participant view + selection
# ---------------------------------------------------------------------------


async def _my_selections(db_session: AsyncSession, user_id: int, target_type: str, target_uuid: str) -> dict:
    rows = (
        await db_session.execute(
            select(AddOnSelection).where(
                AddOnSelection.user_id == user_id,
                AddOnSelection.target_type == target_type,
                AddOnSelection.target_uuid == target_uuid,
            )
        )
    ).scalars().all()
    return {row.attachment_id: row for row in rows}


async def _target_view(
    db_session: AsyncSession, user_id: int, target_type: str, target_uuid: str
) -> TargetAddOnsRead:
    selections = await _my_selections(db_session, user_id, target_type, target_uuid)
    items: List[TargetAddOnItem] = []
    total = 0.0
    currency = None
    for attachment, addon in await _target_attachments(db_session, target_type, target_uuid):
        if attachment.status != ConfigStatus.ACTIVE.value:
            continue
        if not (attachment.is_selectable or attachment.is_required):
            continue
        read = await _attachment_read(db_session, attachment, addon)
        selection = selections.get(attachment.id)
        quantity = selection.quantity if selection and selection.status == AddOnSelectionStatus.SELECTED.value else 0
        line_total = selection.total if quantity else 0.0
        if not read.available and not quantity:
            continue
        total += line_total
        currency = currency or addon.currency
        items.append(TargetAddOnItem(attachment=read, selected_quantity=quantity, line_total=line_total))
    return TargetAddOnsRead(
        target_type=target_type, target_uuid=target_uuid, items=items, total=round(total, 2), currency=currency
    )


async def get_target_addons(
    request: Request, db_session: AsyncSession, current_user: AnyUser, target_type: str, target_uuid: str
) -> TargetAddOnsRead:
    org_id, _ = await resolve_target(db_session, target_type, target_uuid)
    user_id = await _require_target_access(request, db_session, current_user, target_type, target_uuid, org_id)
    return await _target_view(db_session, user_id, target_type, target_uuid)


async def set_my_selection(
    request: Request,
    db_session: AsyncSession,
    current_user: AnyUser,
    target_type: str,
    target_uuid: str,
    payload: MySelectionUpdate,
) -> TargetAddOnsRead:
    org_id, _ = await resolve_target(db_session, target_type, target_uuid)
    user_id = await _require_target_access(request, db_session, current_user, target_type, target_uuid, org_id)
    rows = {a.attachment_uuid: (a, addon) for a, addon in await _target_attachments(db_session, target_type, target_uuid)}
    selections = await _my_selections(db_session, user_id, target_type, target_uuid)
    requested = {item.attachment_uuid: item.quantity for item in payload.items}

    for attachment_uuid, quantity in requested.items():
        if attachment_uuid not in rows:
            raise bad_request("This add-on is not offered here")
        attachment, addon = rows[attachment_uuid]
        if quantity < 0 or quantity > attachment.max_quantity:
            raise bad_request(f"{addon.name}: quantity must be between 0 and {attachment.max_quantity}")
        if not attachment.is_selectable and not attachment.is_required:
            raise bad_request(f"{addon.name} cannot be selected")
        if attachment.is_required and quantity == 0:
            raise bad_request(f"{addon.name} is required")

    # Required add-ons are always included (quantity 1 unless chosen otherwise).
    for attachment_uuid, (attachment, _addon) in rows.items():
        if attachment.is_required and attachment.status == ConfigStatus.ACTIVE.value:
            requested.setdefault(attachment_uuid, 1)

    for attachment_uuid, quantity in requested.items():
        attachment, addon = rows[attachment_uuid]
        selection = selections.get(attachment.id)
        current_qty = selection.quantity if selection and selection.status == AddOnSelectionStatus.SELECTED.value else 0
        if quantity == current_qty and (quantity == 0 or selection is not None):
            continue
        if quantity > current_qty:
            read = await _attachment_read(db_session, attachment, addon)
            if attachment.status != ConfigStatus.ACTIVE.value or not _available(addon, None):
                raise bad_request(f"{addon.name} is not available")
            if read.remaining_stock is not None and quantity - current_qty > read.remaining_stock:
                raise conflict(f"{addon.name}: only {read.remaining_stock} left")
        unit_price = attachment.price_override if attachment.price_override is not None else addon.price
        tax_amount, total = line_amounts(unit_price, quantity, addon.tax_rate, addon.tax_inclusive)
        if selection is None:
            if quantity == 0:
                continue
            selection = AddOnSelection(
                org_id=org_id,
                attachment_id=attachment.id,
                addon_id=addon.id,
                user_id=user_id,
                target_type=target_type,
                target_uuid=target_uuid,
                selection_uuid=f"addonselection_{uuid4()}",
                creation_date=now(),
            )
        selection.addon_name = addon.name
        selection.quantity = quantity
        selection.unit_price = unit_price
        selection.tax_rate = addon.tax_rate
        selection.tax_amount = tax_amount if quantity else 0.0
        selection.total = total if quantity else 0.0
        selection.currency = addon.currency
        selection.status = AddOnSelectionStatus.SELECTED.value if quantity else AddOnSelectionStatus.CANCELLED.value
        selection.update_date = now()
        db_session.add(selection)
    await db_session.commit()
    return await _target_view(db_session, user_id, target_type, target_uuid)


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


async def list_selections(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    target_uuid: Optional[str] = None,
    addon_uuid: Optional[str] = None,
    include_cancelled: bool = False,
) -> SelectionReport:
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    stmt = select(AddOnSelection).where(AddOnSelection.org_id == org_id)
    if target_uuid:
        stmt = stmt.where(AddOnSelection.target_uuid == target_uuid)
    if addon_uuid:
        addon = await get_addon_by_uuid(db_session, addon_uuid)
        stmt = stmt.where(AddOnSelection.addon_id == addon.id)
    if not include_cancelled:
        stmt = stmt.where(AddOnSelection.status == AddOnSelectionStatus.SELECTED.value)
    rows = (await db_session.execute(stmt.order_by(AddOnSelection.creation_date.desc()))).scalars().all()  # type: ignore[attr-defined]

    names: dict = {}
    out: List[AddOnSelectionRead] = []
    for row in rows:
        key = (row.target_type, row.target_uuid)
        if key not in names:
            try:
                names[key] = (await resolve_target(db_session, row.target_type, row.target_uuid))[1]
            except HTTPException:
                names[key] = None
        attachment = await db_session.get(AddOnAttachment, row.attachment_id) if row.attachment_id else None
        addon = await db_session.get(AddOn, row.addon_id) if row.addon_id else None
        out.append(
            AddOnSelectionRead(
                **row.model_dump(),
                attachment_uuid=attachment.attachment_uuid if attachment else None,
                addon_uuid=addon.addon_uuid if addon else None,
                target_name=names[key],
                user=await get_user_author(db_session, row.user_id),
            )
        )
    selected = [s for s in out if s.status == AddOnSelectionStatus.SELECTED]
    return SelectionReport(
        selections=out,
        total_quantity=sum(s.quantity for s in selected),
        total_amount=round(sum(s.total for s in selected), 2),
    )


# ---------------------------------------------------------------------------
# Legacy ``CourseAcademicProfile.add_ons`` JSON
# ---------------------------------------------------------------------------


async def course_addons_as_legacy(db_session: AsyncSession, course_uuid: str) -> List[CourseAddOn]:
    """The course's attachments in the old ``[{name, price}]`` shape (read compat)."""
    return [
        CourseAddOn(name=addon.name, price=a.price_override if a.price_override is not None else addon.price)
        for a, addon in await _target_attachments(db_session, AddOnTargetType.COURSE.value, course_uuid)
        if a.status == ConfigStatus.ACTIVE.value
    ]


async def sync_legacy_course_addons(
    db_session: AsyncSession, org_id: int, course_uuid: str, add_ons: List[dict]
) -> None:
    """Map an old-style ``add_ons`` list onto the catalog + course attachments.

    Each entry reuses (by case-insensitive name) or creates a catalog add-on and
    becomes an attachment; attachments missing from the list are removed —
    the old field had replace semantics. Does not commit.
    """
    wanted: dict = {}
    for entry in add_ons or []:
        name = (entry.get("name") or "").strip()
        if name:
            wanted[name.lower()] = (name, entry.get("price"))
    existing = await _target_attachments(db_session, AddOnTargetType.COURSE.value, course_uuid)
    for attachment, addon in existing:
        if addon.name.lower() not in wanted:
            await db_session.delete(attachment)
    attached = {addon.name.lower(): attachment for attachment, addon in existing}
    for key, (name, price) in wanted.items():
        addon = (
            await db_session.execute(
                select(AddOn).where(AddOn.org_id == org_id, func.lower(AddOn.name) == key)
            )
        ).scalars().first()
        if not addon:
            addon = AddOn(
                org_id=org_id,
                name=name,
                code=make_code(None, name),
                price=float(price or 0),
                addon_uuid=f"addon_{uuid4()}",
                creation_date=now(),
                update_date=now(),
            )
            db_session.add(addon)
            await db_session.flush()
        override = None if price is None or float(price) == addon.price else float(price)
        attachment = attached.get(key)
        if attachment:
            attachment.price_override = override
            attachment.update_date = now()
            db_session.add(attachment)
        else:
            db_session.add(
                AddOnAttachment(
                    org_id=org_id,
                    addon_id=addon.id,
                    target_type=AddOnTargetType.COURSE.value,
                    target_uuid=course_uuid,
                    price_override=override,
                    is_selectable=True,
                    attachment_uuid=f"addonattachment_{uuid4()}",
                    creation_date=now(),
                    update_date=now(),
                )
            )

