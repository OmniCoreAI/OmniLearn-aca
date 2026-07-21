from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.cms_news import (
    CMSNewsCreate,
    CMSNewsListResponse,
    CMSNewsRead,
    CMSNewsUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.cms import news as news_service

router = APIRouter()


@router.get(
    "/org/{org_slug}/news",
    response_model=CMSNewsListResponse,
    summary="List published news for an organization",
    description="Public list of published news items (latest first). Body is omitted.",
)
async def api_list_public_news(
    request: Request,
    org_slug: str,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsListResponse:
    return await news_service.list_public_news(
        request, org_slug, page, limit, current_user, db_session
    )


@router.get(
    "/org/{org_slug}/news/{slug}",
    response_model=CMSNewsRead,
    summary="Get a published news article by slug",
)
async def api_get_public_news(
    request: Request,
    org_slug: str,
    slug: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.get_public_news_by_slug(
        request, org_slug, slug, current_user, db_session
    )


@router.get(
    "/admin/{org_id}/news",
    response_model=CMSNewsListResponse,
    summary="List all news for an organization (admin)",
)
async def api_list_admin_news(
    request: Request,
    org_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsListResponse:
    return await news_service.list_admin_news(
        request, org_id, page, limit, current_user, db_session
    )


@router.get(
    "/admin/{org_id}/news/{news_uuid}",
    response_model=CMSNewsRead,
    summary="Get a news article by UUID (admin)",
)
async def api_get_admin_news(
    request: Request,
    org_id: int,
    news_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.get_admin_news(
        request, org_id, news_uuid, current_user, db_session
    )


@router.post(
    "/admin/{org_id}/news",
    response_model=CMSNewsRead,
    summary="Create a news article",
)
async def api_create_news(
    request: Request,
    org_id: int,
    payload: CMSNewsCreate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.create_news(
        request, org_id, payload, current_user, db_session
    )


@router.put(
    "/admin/{org_id}/news/{news_uuid}",
    response_model=CMSNewsRead,
    summary="Update a news article",
)
async def api_update_news(
    request: Request,
    org_id: int,
    news_uuid: str,
    payload: CMSNewsUpdate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.update_news(
        request, org_id, news_uuid, payload, current_user, db_session
    )


@router.post(
    "/admin/{org_id}/news/{news_uuid}/cover",
    response_model=CMSNewsRead,
    summary="Upload a news cover image",
)
async def api_upload_news_cover(
    request: Request,
    org_id: int,
    news_uuid: str,
    cover_file: UploadFile = File(...),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.upload_news_cover(
        request, org_id, news_uuid, cover_file, current_user, db_session
    )


@router.post(
    "/admin/{org_id}/news/{news_uuid}/images",
    response_model=CMSNewsRead,
    summary="Upload an image attachment to a news article",
)
async def api_upload_news_image(
    request: Request,
    org_id: int,
    news_uuid: str,
    image_file: UploadFile = File(...),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.upload_news_image(
        request, org_id, news_uuid, image_file, current_user, db_session
    )


@router.post(
    "/admin/{org_id}/news/{news_uuid}/videos",
    response_model=CMSNewsRead,
    summary="Upload a video attachment to a news article",
)
async def api_upload_news_video(
    request: Request,
    org_id: int,
    news_uuid: str,
    video_file: UploadFile = File(...),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.upload_news_video(
        request, org_id, news_uuid, video_file, current_user, db_session
    )


@router.delete(
    "/admin/{org_id}/news/{news_uuid}/images/{media_id}",
    response_model=CMSNewsRead,
    summary="Remove an image attachment from a news article",
)
async def api_delete_news_image(
    request: Request,
    org_id: int,
    news_uuid: str,
    media_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.delete_news_image(
        request, org_id, news_uuid, media_id, current_user, db_session
    )


@router.delete(
    "/admin/{org_id}/news/{news_uuid}/videos/{media_id}",
    response_model=CMSNewsRead,
    summary="Remove a video attachment from a news article",
)
async def api_delete_news_video(
    request: Request,
    org_id: int,
    news_uuid: str,
    media_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CMSNewsRead:
    return await news_service.delete_news_video(
        request, org_id, news_uuid, media_id, current_user, db_session
    )


@router.delete(
    "/admin/{org_id}/news/{news_uuid}",
    summary="Delete a news article",
)
async def api_delete_news(
    request: Request,
    org_id: int,
    news_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    return await news_service.delete_news(
        request, org_id, news_uuid, current_user, db_session
    )
