from typing import List, Optional

from fastapi import APIRouter, Depends, Request, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.addons import (
    AddOnAttachmentCreate,
    AddOnAttachmentRead,
    AddOnAttachmentUpdate,
    AddOnCreate,
    AddOnOption,
    AddOnRead,
    AddOnUpdate,
    MySelectionUpdate,
    SelectionReport,
    TargetAddOnsRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import addons as svc

router = APIRouter()


# ----------------------------- Catalog -----------------------------


@router.post("/", response_model=AddOnRead, summary="Create an add-on")
async def api_create_addon(
    payload: AddOnCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AddOnRead:
    return await svc.create_addon(db_session, current_user, org_id, payload)


@router.get("/org/{org_id}", response_model=List[AddOnRead], summary="List add-ons")
async def api_list_addons(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[AddOnRead]:
    return await svc.list_addons(db_session, current_user, org_id)


@router.get("/org/{org_id}/options", response_model=List[AddOnOption], summary="Active add-ons for pickers")
async def api_addon_options(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[AddOnOption]:
    return await svc.list_addon_options(db_session, current_user, org_id)


@router.get("/org/{org_id}/selections", response_model=SelectionReport, summary="Participant add-on selections")
async def api_addon_selections(
    org_id: int,
    target_uuid: Optional[str] = None,
    addon_uuid: Optional[str] = None,
    include_cancelled: bool = False,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> SelectionReport:
    return await svc.list_selections(db_session, current_user, org_id, target_uuid, addon_uuid, include_cancelled)


# ----------------------------- Attachments -----------------------------


@router.post("/attachments", response_model=AddOnAttachmentRead, summary="Attach an add-on to a course / program / cohort / offering")
async def api_create_attachment(
    payload: AddOnAttachmentCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AddOnAttachmentRead:
    return await svc.create_attachment(db_session, current_user, payload)


@router.put("/attachments/{attachment_uuid}", response_model=AddOnAttachmentRead, summary="Update an attachment")
async def api_update_attachment(
    attachment_uuid: str,
    payload: AddOnAttachmentUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AddOnAttachmentRead:
    return await svc.update_attachment(db_session, current_user, attachment_uuid, payload)


@router.delete("/attachments/{attachment_uuid}", summary="Detach an add-on")
async def api_delete_attachment(
    attachment_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_attachment(db_session, current_user, attachment_uuid)


@router.get(
    "/targets/{target_type}/{target_uuid}/attachments",
    response_model=List[AddOnAttachmentRead],
    summary="Add-ons attached to a target (managers)",
)
async def api_list_attachments(
    target_type: str,
    target_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[AddOnAttachmentRead]:
    return await svc.list_attachments(db_session, current_user, target_type, target_uuid)


# ----------------------------- Participants -----------------------------


@router.get(
    "/targets/{target_type}/{target_uuid}",
    response_model=TargetAddOnsRead,
    summary="Add-ons a participant can choose, with their current selection",
)
async def api_target_addons(
    request: Request,
    target_type: str,
    target_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> TargetAddOnsRead:
    return await svc.get_target_addons(request, db_session, current_user, target_type, target_uuid)


@router.put(
    "/targets/{target_type}/{target_uuid}/my-selection",
    response_model=TargetAddOnsRead,
    summary="Record the participant's add-on choices (recorded only; no payment)",
)
async def api_set_my_selection(
    request: Request,
    target_type: str,
    target_uuid: str,
    payload: MySelectionUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> TargetAddOnsRead:
    return await svc.set_my_selection(request, db_session, current_user, target_type, target_uuid, payload)


# ----------------------------- Single add-on -----------------------------


@router.put("/{addon_uuid}", response_model=AddOnRead, summary="Update an add-on")
async def api_update_addon(
    addon_uuid: str,
    payload: AddOnUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AddOnRead:
    return await svc.update_addon(db_session, current_user, addon_uuid, payload)


@router.put("/{addon_uuid}/image", response_model=AddOnRead, summary="Upload an add-on image")
async def api_upload_addon_image(
    addon_uuid: str,
    image: UploadFile,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> AddOnRead:
    return await svc.upload_addon_image(db_session, current_user, addon_uuid, image)


@router.delete("/{addon_uuid}", summary="Delete an add-on (only when never selected)")
async def api_delete_addon(
    addon_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_addon(db_session, current_user, addon_uuid)
