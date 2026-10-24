from typing import List

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.facilities import LocationCreate, LocationRead, LocationUpdate
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import facilities as svc

router = APIRouter()


@router.post("/", response_model=LocationRead, summary="Create a location (building, branch, campus…)")
async def api_create_location(
    payload: LocationCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> LocationRead:
    return await svc.create_location(db_session, current_user, org_id, payload)


@router.get("/org/{org_id}", response_model=List[LocationRead], summary="List locations")
async def api_list_locations(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[LocationRead]:
    return await svc.list_locations(db_session, current_user, org_id)


@router.put("/{location_uuid}", response_model=LocationRead, summary="Update a location")
async def api_update_location(
    location_uuid: str,
    payload: LocationUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> LocationRead:
    return await svc.update_location(db_session, current_user, location_uuid, payload)


@router.delete("/{location_uuid}", summary="Delete a location (its facilities are kept)")
async def api_delete_location(
    location_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_location(db_session, current_user, location_uuid)
