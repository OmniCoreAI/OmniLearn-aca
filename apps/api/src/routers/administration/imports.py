from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import Response
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.imports import ImportCommitOptions, ImportJobRead, ImportRowPage
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import imports as svc

router = APIRouter()
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/users/template", summary="Excel template for importing entity members")
async def api_template(
    entity_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> Response:
    content = await svc.template_workbook(db_session, current_user, entity_uuid)
    return Response(
        content=content,
        media_type=XLSX,
        headers={"Content-Disposition": 'attachment; filename="members-import-template.xlsx"'},
    )


@router.post("/users/validate", response_model=ImportJobRead, summary="Upload and validate an import file")
async def api_validate(
    entity_uuid: str,
    file: UploadFile,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ImportJobRead:
    return await svc.validate_upload(db_session, current_user, entity_uuid, file)


@router.get("/entity/{entity_uuid}", response_model=List[ImportJobRead], summary="Imports of an entity")
async def api_list_jobs(
    entity_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[ImportJobRead]:
    return await svc.list_jobs(db_session, current_user, entity_uuid)


@router.get("/{job_uuid}", response_model=ImportJobRead, summary="Import status and totals")
async def api_get_job(
    job_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ImportJobRead:
    return await svc.get_job(db_session, current_user, job_uuid)


@router.get("/{job_uuid}/rows", response_model=ImportRowPage, summary="Rows of an import (review)")
async def api_rows(
    job_uuid: str,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 100,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ImportRowPage:
    return await svc.list_rows(db_session, current_user, job_uuid, status, page, limit)


@router.post("/{job_uuid}/commit", response_model=ImportJobRead, summary="Create / link the valid rows")
async def api_commit(
    job_uuid: str,
    options: ImportCommitOptions,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> ImportJobRead:
    return await svc.commit_job(db_session, current_user, job_uuid, options)


@router.get("/{job_uuid}/failed.xlsx", summary="Download invalid / failed rows with the reason")
async def api_failed_rows(
    job_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> Response:
    name, content = await svc.failed_rows_workbook(db_session, current_user, job_uuid)
    return Response(content=content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})
