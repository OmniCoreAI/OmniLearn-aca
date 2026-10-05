from typing import Dict

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration.overview import get_overview

router = APIRouter()


@router.get("/overview/{org_id}", summary="Counts of configured entities for the admin landing page")
async def api_overview(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> Dict[str, int]:
    return await get_overview(db_session, current_user, org_id)
