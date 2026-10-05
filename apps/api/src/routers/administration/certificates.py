from typing import List

from fastapi import APIRouter, Depends, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.certificates import (
    CertificateTemplateCreate,
    CertificateTemplateOption,
    CertificateTemplateRead,
    CertificateTemplateUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import certificates as svc

router = APIRouter()


@router.get("/org/{org_id}", response_model=List[CertificateTemplateRead], summary="List certificate templates")
async def api_list(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CertificateTemplateRead]:
    return await svc.list_templates(db_session, current_user, org_id)


@router.get("/org/{org_id}/options", response_model=List[CertificateTemplateOption], summary="Active templates for pickers")
async def api_options(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CertificateTemplateOption]:
    return await svc.template_options(db_session, current_user, org_id)


@router.post("/", response_model=CertificateTemplateRead, summary="Create a certificate template")
async def api_create(
    payload: CertificateTemplateCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CertificateTemplateRead:
    return await svc.create_template(db_session, current_user, org_id, payload)


@router.get("/{template_uuid}", response_model=CertificateTemplateRead, summary="Get a certificate template")
async def api_get(
    template_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CertificateTemplateRead:
    return await svc.get_template(db_session, current_user, template_uuid)


@router.put("/{template_uuid}", response_model=CertificateTemplateRead, summary="Update a certificate template")
async def api_update(
    template_uuid: str,
    payload: CertificateTemplateUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CertificateTemplateRead:
    return await svc.update_template(db_session, current_user, template_uuid, payload)


@router.post("/{template_uuid}/duplicate", response_model=CertificateTemplateRead, summary="Duplicate a template")
async def api_duplicate(
    template_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CertificateTemplateRead:
    return await svc.duplicate_template(db_session, current_user, template_uuid)


@router.put("/{template_uuid}/assets/{kind}", response_model=CertificateTemplateRead, summary="Upload a background, logo or signature")
async def api_upload_asset(
    template_uuid: str,
    kind: str,
    file: UploadFile,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CertificateTemplateRead:
    return await svc.upload_asset(db_session, current_user, template_uuid, kind, file)


@router.delete("/{template_uuid}", summary="Delete a template")
async def api_delete(
    template_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_template(db_session, current_user, template_uuid)
