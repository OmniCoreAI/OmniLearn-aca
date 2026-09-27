from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.audience import (
    AudienceAssignmentCreate,
    AudienceAssignmentRead,
    AudienceOption,
    AudienceResourceType,
    AudienceSyncResult,
    ResourceAudienceRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import audience as svc

router = APIRouter()


@router.post("/", response_model=AudienceAssignmentRead, summary="Assign a course / program to an audience")
async def api_create_assignment(
    payload: AudienceAssignmentCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AudienceAssignmentRead:
    return await svc.create_assignment(db_session, current_user, payload)


@router.delete("/{assignment_uuid}", summary="Remove an audience assignment")
async def api_delete_assignment(
    assignment_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_assignment(db_session, current_user, assignment_uuid)


@router.get(
    "/resource/{resource_type}/{resource_uuid}",
    response_model=ResourceAudienceRead,
    summary="Who a course / program is assigned to",
)
async def api_resource_audience(
    resource_type: AudienceResourceType,
    resource_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ResourceAudienceRead:
    return await svc.get_resource_audience(db_session, current_user, resource_type.value, resource_uuid)


@router.post(
    "/resource/{resource_type}/{resource_uuid}/sync",
    response_model=AudienceSyncResult,
    summary="Re-apply a resource's audience assignments",
)
async def api_resync_resource(
    resource_type: AudienceResourceType,
    resource_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AudienceSyncResult:
    return await svc.resync_resource(db_session, current_user, resource_type.value, resource_uuid)


@router.get("/org/{org_id}/options", response_model=List[AudienceOption], summary="Search audiences")
async def api_audience_options(
    org_id: int,
    q: Optional[str] = None,
    entity_uuid: Optional[str] = None,
    limit: int = 30,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[AudienceOption]:
    return await svc.audience_options(db_session, current_user, org_id, q, entity_uuid, limit)
