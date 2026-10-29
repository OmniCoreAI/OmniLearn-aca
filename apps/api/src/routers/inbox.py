from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.notification_inbox import NotificationInbox, NotificationRead
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.notifications.inbox import list_inbox, mark_all_read, mark_read

router = APIRouter()


@router.get("/org/{org_id}", response_model=NotificationInbox, summary="My latest notifications and unread count")
async def api_inbox(
    org_id: int,
    limit: int = Query(default=30, ge=1, le=100),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationInbox:
    return await list_inbox(db_session, current_user, org_id, limit)


@router.put("/{notification_uuid}/read", response_model=NotificationRead, summary="Mark one notification as read")
async def api_mark_read(
    notification_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationRead:
    return await mark_read(db_session, current_user, notification_uuid)


@router.put("/org/{org_id}/read-all", summary="Mark all my notifications as read")
async def api_mark_all_read(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    return {"updated": await mark_all_read(db_session, current_user, org_id)}
