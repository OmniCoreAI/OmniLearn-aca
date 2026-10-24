from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.lookups import (
    ConfigLookupCreate,
    ConfigLookupOption,
    ConfigLookupRead,
    ConfigLookupUpdate,
    LookupReorderItem,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import lookups as svc

router = APIRouter()


@router.post("/", response_model=ConfigLookupRead, summary="Create a configuration lookup entry")
async def api_create_lookup(
    payload: ConfigLookupCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ConfigLookupRead:
    return await svc.create_lookup(db_session, current_user, org_id, payload)


@router.get("/org/{org_id}", response_model=List[ConfigLookupRead], summary="List lookups (optionally of one kind)")
async def api_list_lookups(
    org_id: int,
    kind: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[ConfigLookupRead]:
    return await svc.list_lookups(db_session, current_user, org_id, kind)


@router.get(
    "/org/{org_id}/options",
    response_model=List[ConfigLookupOption],
    summary="Active entries of a kind, for pickers (any org member)",
)
async def api_lookup_options(
    org_id: int,
    kind: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[ConfigLookupOption]:
    return await svc.list_lookup_options(db_session, current_user, org_id, kind)


@router.put("/org/{org_id}/reorder", response_model=List[ConfigLookupRead], summary="Reorder lookups")
async def api_reorder_lookups(
    org_id: int,
    items: List[LookupReorderItem],
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[ConfigLookupRead]:
    return await svc.reorder_lookups(db_session, current_user, org_id, items)


@router.put("/{lookup_uuid}", response_model=ConfigLookupRead, summary="Update a lookup entry")
async def api_update_lookup(
    lookup_uuid: str,
    payload: ConfigLookupUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ConfigLookupRead:
    return await svc.update_lookup(db_session, current_user, lookup_uuid, payload)


@router.delete("/{lookup_uuid}", summary="Delete an unused lookup entry")
async def api_delete_lookup(
    lookup_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_lookup(db_session, current_user, lookup_uuid)
