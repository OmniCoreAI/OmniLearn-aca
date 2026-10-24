from typing import Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.security.superadmin import require_superadmin
from src.services.portal_navigation.portal_navigation import (
    get_nav_registry_and_visibility,
    set_nav_visibility,
)

router = APIRouter()


class PortalNavigationRead(BaseModel):
    items: List[dict]
    visibility: Dict[str, List[str]]


class PortalNavigationUpdate(BaseModel):
    item_ids: List[str]


@router.get(
    "",
    response_model=PortalNavigationRead,
    summary="Get portal navigation registry + visibility",
    description=(
        "Returns the full dashboard sidebar item registry and the current "
        "per-system-role visibility map. Available to any authenticated "
        "user — it's menu structure, not sensitive data."
    ),
)
async def api_get_portal_navigation(
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> PortalNavigationRead:
    items, visibility = await get_nav_registry_and_visibility(db_session)
    return PortalNavigationRead(items=items, visibility=visibility)


@router.put(
    "/{role_uuid}",
    summary="Set portal navigation visibility for a system role",
    description=(
        "Superadmin-only. Replaces the visible sidebar item list for one of "
        "the 4 seeded system roles (role_global_admin, role_global_maintainer, "
        "role_global_instructor, role_global_user)."
    ),
    responses={
        400: {"description": "Unknown role_uuid or item id"},
        403: {"description": "Superadmin access required"},
    },
)
async def api_set_portal_navigation(
    role_uuid: str,
    payload: PortalNavigationUpdate,
    current_user=Depends(require_superadmin),
    db_session: AsyncSession = Depends(get_db_session),
):
    row = await set_nav_visibility(db_session, role_uuid, payload.item_ids, current_user.id)
    return {
        "role_uuid": row.role_uuid,
        "visible_items": row.visible_items,
        "update_date": row.update_date,
    }
