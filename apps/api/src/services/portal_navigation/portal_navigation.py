from datetime import datetime
from typing import Dict, List, Tuple

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.portal_navigation import PortalRoleNavConfig
from src.security.rbac.nav_items import (
    DEFAULT_VISIBILITY_BY_ROLE_UUID,
    NAV_ITEM_IDS,
    NAV_ITEMS,
    SYSTEM_ROLE_UUIDS,
)


async def get_nav_registry_and_visibility(
    db_session: AsyncSession,
) -> Tuple[List[dict], Dict[str, List[str]]]:
    """Return the item registry and the effective visibility map (defaults
    merged with any persisted overrides) for every known system role."""
    items = [{"id": item.id, "section": item.section} for item in NAV_ITEMS]

    visibility: Dict[str, List[str]] = {
        role_uuid: list(DEFAULT_VISIBILITY_BY_ROLE_UUID[role_uuid])
        for role_uuid in SYSTEM_ROLE_UUIDS
    }

    result = await db_session.execute(
        select(PortalRoleNavConfig).where(
            PortalRoleNavConfig.role_uuid.in_(SYSTEM_ROLE_UUIDS)  # type: ignore[attr-defined]
        )
    )
    for row in result.scalars().all():
        visibility[row.role_uuid] = list(row.visible_items or [])

    return items, visibility


async def set_nav_visibility(
    db_session: AsyncSession,
    role_uuid: str,
    item_ids: List[str],
    updated_by_user_id: int,
) -> PortalRoleNavConfig:
    if role_uuid not in SYSTEM_ROLE_UUIDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown system role_uuid: {role_uuid}",
        )

    unknown_items = [item_id for item_id in item_ids if item_id not in NAV_ITEM_IDS]
    if unknown_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown nav item id(s): {unknown_items}",
        )

    # De-dupe while preserving order.
    deduped_item_ids = list(dict.fromkeys(item_ids))

    existing = (
        await db_session.execute(
            select(PortalRoleNavConfig).where(PortalRoleNavConfig.role_uuid == role_uuid)
        )
    ).scalars().first()

    if existing:
        existing.visible_items = deduped_item_ids
        existing.updated_by_user_id = updated_by_user_id
        existing.update_date = str(datetime.now())
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)
        return existing

    new_row = PortalRoleNavConfig(
        role_uuid=role_uuid,
        visible_items=deduped_item_ids,
        updated_by_user_id=updated_by_user_id,
        update_date=str(datetime.now()),
    )
    db_session.add(new_row)
    await db_session.commit()
    await db_session.refresh(new_row)
    return new_row
