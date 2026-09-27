from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.entities import PositionCreate, PositionRead, PositionUpdate
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import entities as svc

router = APIRouter()


@router.post("/", response_model=PositionRead, summary="Create a position")
async def api_create_position(
    payload: PositionCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PositionRead:
    return await svc.create_position(db_session, current_user, org_id, payload)


@router.get(
    "/org/{org_id}",
    response_model=List[PositionRead],
    summary="List positions (optionally those usable in one entity)",
)
async def api_list_positions(
    org_id: int,
    entity_uuid: Optional[str] = None,
    include_shared: bool = True,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[PositionRead]:
    return await svc.list_positions(db_session, current_user, org_id, entity_uuid, include_shared)


@router.put("/{position_uuid}", response_model=PositionRead, summary="Update a position")
async def api_update_position(
    position_uuid: str,
    payload: PositionUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PositionRead:
    return await svc.update_position(db_session, current_user, position_uuid, payload)


@router.delete("/{position_uuid}", summary="Delete a position")
async def api_delete_position(
    position_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_position(db_session, current_user, position_uuid)
