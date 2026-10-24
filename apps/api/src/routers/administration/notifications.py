from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.notifications import (
    CatalogEvent,
    NotificationLogPage,
    NotificationLogRead,
    NotificationOverrideRead,
    NotificationOverrideSet,
    NotificationPreviewRead,
    NotificationPreviewRequest,
    NotificationTemplateCreate,
    NotificationTemplateRead,
    NotificationTemplateUpdate,
    NotificationTestSend,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.notifications import events as notification_events
from src.services.notifications import templates as svc

router = APIRouter()
# "course_assigned" notifications for audience assignments.
notification_events.register()


@router.get("/catalog/org/{org_id}", response_model=List[CatalogEvent], summary="Notification events and variables")
async def api_catalog(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CatalogEvent]:
    return await svc.get_catalog(db_session, current_user, org_id)


@router.get("/templates/org/{org_id}", response_model=List[NotificationTemplateRead], summary="List templates")
async def api_list_templates(
    org_id: int,
    channel: Optional[str] = None,
    event_key: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[NotificationTemplateRead]:
    return await svc.list_templates(db_session, current_user, org_id, channel, event_key)


@router.post("/templates", response_model=NotificationTemplateRead, summary="Create a template")
async def api_create_template(
    payload: NotificationTemplateCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationTemplateRead:
    return await svc.create_template(db_session, current_user, org_id, payload)


@router.get("/templates/{template_uuid}", response_model=NotificationTemplateRead, summary="Get a template")
async def api_get_template(
    template_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationTemplateRead:
    return await svc.get_template(db_session, current_user, template_uuid)


@router.put("/templates/{template_uuid}", response_model=NotificationTemplateRead, summary="Update a template")
async def api_update_template(
    template_uuid: str,
    payload: NotificationTemplateUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationTemplateRead:
    return await svc.update_template(db_session, current_user, template_uuid, payload)


@router.post("/templates/{template_uuid}/duplicate", response_model=NotificationTemplateRead, summary="Duplicate a template")
async def api_duplicate_template(
    template_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationTemplateRead:
    return await svc.duplicate_template(db_session, current_user, template_uuid)


@router.post("/templates/{template_uuid}/test", response_model=NotificationLogRead, summary="Send a test message")
async def api_test_template(
    template_uuid: str,
    payload: NotificationTestSend,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationLogRead:
    return await svc.send_test(db_session, current_user, template_uuid, payload)


@router.delete("/templates/{template_uuid}", summary="Delete a template")
async def api_delete_template(
    template_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_template(db_session, current_user, template_uuid)


@router.post("/preview/org/{org_id}", response_model=NotificationPreviewRead, summary="Render a draft with sample data")
async def api_preview(
    org_id: int,
    payload: NotificationPreviewRequest,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationPreviewRead:
    return await svc.preview(db_session, current_user, org_id, payload)


@router.get(
    "/overrides/{resource_type}/{resource_uuid}",
    response_model=List[NotificationOverrideRead],
    summary="Templates a course / program uses instead of the defaults",
)
async def api_list_overrides(
    resource_type: str,
    resource_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[NotificationOverrideRead]:
    return await svc.list_overrides(db_session, current_user, resource_type, resource_uuid)


@router.put("/overrides", response_model=NotificationOverrideRead, summary="Use a template for a course / program")
async def api_set_override(
    payload: NotificationOverrideSet,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationOverrideRead:
    return await svc.set_override(db_session, current_user, payload)


@router.delete("/overrides/{override_uuid}", summary="Remove an override")
async def api_delete_override(
    override_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_override(db_session, current_user, override_uuid)


@router.get("/log/org/{org_id}", response_model=NotificationLogPage, summary="Delivery log")
async def api_log(
    org_id: int,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    event_key: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> NotificationLogPage:
    return await svc.list_log(db_session, current_user, org_id, channel, status, event_key, q, page, limit)
