from fastapi import APIRouter, Body, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import settings as svc

router = APIRouter()


@router.get("/org/{org_id}/{key}", summary="Get an administration setting (defaults filled in)")
async def api_get_setting(
    org_id: int,
    key: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    return await svc.get_setting(db_session, current_user, org_id, key)


@router.put("/org/{org_id}/{key}", summary="Replace an administration setting")
async def api_put_setting(
    org_id: int,
    key: str,
    value: dict = Body(...),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    return await svc.put_setting(db_session, current_user, org_id, key, value)
