import re
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile, status
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.cms_news import (
    CMSNews,
    CMSNewsCreate,
    CMSNewsImageOut,
    CMSNewsListItem,
    CMSNewsListResponse,
    CMSNewsRead,
    CMSNewsUpdate,
    CMSNewsVideoOut,
)
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.services.orgs.orgs import rbac_check
from src.services.utils.upload_content import upload_file


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _date_created_string(iso: str | None = None) -> str:
    d = datetime.now(timezone.utc) if not iso else datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return d.strftime("%d/%m/%Y")


def _slugify(value: str) -> str:
    """URL slug; keeps Arabic/Unicode letters (academy content is often Arabic)."""
    value = unicodedata.normalize("NFC", value or "").strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "-", value).strip("-")
    return value or f"news-{uuid4().hex[:8]}"


def _next_media_id(items: list) -> int:
    ids = [int(i.get("id", 0)) for i in items if isinstance(i, dict)]
    return (max(ids) + 1) if ids else 1


def _media_content_path(org_uuid: str, news_uuid: str, kind: str, filename: str) -> str:
    return f"content/orgs/{org_uuid}/cms/news/{news_uuid}/{kind}/{filename}"


def _resolve_stored_media_path(
    stored: str,
    org_uuid: str,
    news_uuid: str,
    kind: str,
) -> str:
    """Return a content-relative path; accept legacy filename-only DB values."""
    value = (stored or "").strip()
    if not value:
        return ""
    if value.startswith("content/") or value.startswith("http://") or value.startswith("https://"):
        return value
    if org_uuid and news_uuid:
        return _media_content_path(org_uuid, news_uuid, kind, value)
    return value


def _map_images(raw: list | None, org_uuid: str, news_uuid: str) -> list[CMSNewsImageOut]:
    out: list[CMSNewsImageOut] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        file_name = str(item.get("file") or item.get("url") or "")
        url = _resolve_stored_media_path(file_name, org_uuid, news_uuid, "images")
        out.append(
            CMSNewsImageOut(
                id=int(item.get("id") or 0),
                imageName=str(item.get("name") or file_name.split("/")[-1] or "image"),
                imageURL=url,
                dateCreatedString=str(
                    item.get("date_created_string")
                    or _date_created_string(item.get("date_created"))
                ),
            )
        )
    return out


def _map_videos(raw: list | None, org_uuid: str, news_uuid: str) -> list[CMSNewsVideoOut]:
    out: list[CMSNewsVideoOut] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        file_name = str(item.get("file") or item.get("url") or "")
        url = _resolve_stored_media_path(file_name, org_uuid, news_uuid, "videos")
        out.append(
            CMSNewsVideoOut(
                id=int(item.get("id") or 0),
                videoName=str(item.get("name") or file_name.split("/")[-1] or "video"),
                videoURL=url,
                dateCreatedString=str(
                    item.get("date_created_string")
                    or _date_created_string(item.get("date_created"))
                ),
            )
        )
    return out


def _to_read(row: CMSNews, org_uuid: str = "") -> CMSNewsRead:
    return CMSNewsRead(
        id=row.id,  # type: ignore[arg-type]
        org_id=row.org_id,
        org_uuid=org_uuid,
        news_uuid=row.news_uuid,
        title=row.title,
        slug=row.slug,
        excerpt=row.excerpt or "",
        body=row.body or "",
        cover_image=_resolve_stored_media_path(
            row.cover_image or "", org_uuid, row.news_uuid, "covers"
        ),
        images=_map_images(row.images, org_uuid, row.news_uuid),
        videos=_map_videos(row.videos, org_uuid, row.news_uuid),
        published=bool(row.published),
        published_at=row.published_at,
        created_by=row.created_by,
        creation_date=row.creation_date or "",
        update_date=row.update_date or "",
    )


def _to_list_item(row: CMSNews, org_uuid: str = "") -> CMSNewsListItem:
    return CMSNewsListItem(
        id=row.id,  # type: ignore[arg-type]
        org_id=row.org_id,
        org_uuid=org_uuid,
        news_uuid=row.news_uuid,
        title=row.title,
        slug=row.slug,
        excerpt=row.excerpt or "",
        cover_image=_resolve_stored_media_path(
            row.cover_image or "", org_uuid, row.news_uuid, "covers"
        ),
        images=_map_images(row.images, org_uuid, row.news_uuid),
        videos=_map_videos(row.videos, org_uuid, row.news_uuid),
        published=bool(row.published),
        published_at=row.published_at,
        creation_date=row.creation_date or "",
        update_date=row.update_date or "",
    )


async def _get_org_by_id(org_id: int, db_session: AsyncSession) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _get_org_by_slug(org_slug: str, db_session: AsyncSession) -> Organization:
    org = (
        await db_session.execute(
            select(Organization).where(Organization.slug == org_slug).order_by(Organization.id)
        )
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _ensure_unique_slug(
    org_id: int,
    slug: str,
    db_session: AsyncSession,
    exclude_id: int | None = None,
) -> str:
    base = slug
    candidate = base
    n = 2
    while True:
        stmt = select(CMSNews).where(CMSNews.org_id == org_id, CMSNews.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(CMSNews.id != exclude_id)
        existing = (await db_session.execute(stmt)).scalars().first()
        if not existing:
            return candidate
        candidate = f"{base}-{n}"
        n += 1


async def list_public_news(
    request: Request,
    org_slug: str,
    page: int,
    limit: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsListResponse:
    org = await _get_org_by_slug(org_slug, db_session)
    await rbac_check(request, org.org_uuid, current_user, "read", db_session)

    page = max(1, page)
    limit = min(max(1, limit), 100)
    offset = (page - 1) * limit

    filters = [
        CMSNews.org_id == org.id,
        CMSNews.published == True,  # noqa: E712
    ]

    total = (
        await db_session.execute(select(func.count()).select_from(CMSNews).where(*filters))
    ).scalar_one()

    rows = (
        await db_session.execute(
            select(CMSNews)
            .where(*filters)
            .order_by(col(CMSNews.published_at).desc().nullslast(), col(CMSNews.id).desc())
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    return CMSNewsListResponse(
        items=[_to_list_item(r, org.org_uuid) for r in rows],
        total=int(total or 0),
        page=page,
        limit=limit,
    )


async def get_public_news_by_slug(
    request: Request,
    org_slug: str,
    slug: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    org = await _get_org_by_slug(org_slug, db_session)
    await rbac_check(request, org.org_uuid, current_user, "read", db_session)

    row = (
        await db_session.execute(
            select(CMSNews).where(
                CMSNews.org_id == org.id,
                CMSNews.slug == slug,
                CMSNews.published == True,  # noqa: E712
            )
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")
    return _to_read(row, org.org_uuid)


async def list_admin_news(
    request: Request,
    org_id: int,
    page: int,
    limit: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsListResponse:
    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    page = max(1, page)
    limit = min(max(1, limit), 100)
    offset = (page - 1) * limit

    total = (
        await db_session.execute(
            select(func.count()).select_from(CMSNews).where(CMSNews.org_id == org.id)
        )
    ).scalar_one()

    rows = (
        await db_session.execute(
            select(CMSNews)
            .where(CMSNews.org_id == org.id)
            .order_by(col(CMSNews.id).desc())
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    return CMSNewsListResponse(
        items=[_to_list_item(r, org.org_uuid) for r in rows],
        total=int(total or 0),
        page=page,
        limit=limit,
    )


async def get_admin_news(
    request: Request,
    org_id: int,
    news_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    row = (
        await db_session.execute(
            select(CMSNews).where(CMSNews.org_id == org.id, CMSNews.news_uuid == news_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")
    return _to_read(row, org.org_uuid)


async def create_news(
    request: Request,
    org_id: int,
    payload: CMSNewsCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    now = _now_iso()
    slug = await _ensure_unique_slug(
        org.id, _slugify(payload.slug or payload.title), db_session
    )
    published_at = payload.published_at
    if payload.published and not published_at:
        published_at = now

    row = CMSNews(
        org_id=org.id,
        news_uuid=str(uuid4()),
        title=payload.title.strip(),
        slug=slug,
        excerpt=payload.excerpt or "",
        body=payload.body or "",
        cover_image=payload.cover_image or "",
        images=[],
        videos=[],
        published=bool(payload.published),
        published_at=published_at,
        created_by=getattr(current_user, "id", None),
        creation_date=now,
        update_date=now,
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)


async def update_news(
    request: Request,
    org_id: int,
    news_uuid: str,
    payload: CMSNewsUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    row = (
        await db_session.execute(
            select(CMSNews).where(CMSNews.org_id == org.id, CMSNews.news_uuid == news_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")

    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        row.title = str(data["title"]).strip()
    if "excerpt" in data and data["excerpt"] is not None:
        row.excerpt = data["excerpt"]
    if "body" in data and data["body"] is not None:
        row.body = data["body"]
    if "cover_image" in data and data["cover_image"] is not None:
        row.cover_image = data["cover_image"]
    if "slug" in data and data["slug"] is not None:
        row.slug = await _ensure_unique_slug(
            org.id, _slugify(data["slug"] or row.title), db_session, exclude_id=row.id
        )
    if "published" in data and data["published"] is not None:
        row.published = bool(data["published"])
        if row.published and not row.published_at:
            row.published_at = _now_iso()
    if "published_at" in data:
        row.published_at = data["published_at"]

    row.update_date = _now_iso()
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)


async def delete_news(
    request: Request,
    org_id: int,
    news_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> dict:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    row = (
        await db_session.execute(
            select(CMSNews).where(CMSNews.org_id == org.id, CMSNews.news_uuid == news_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")

    await db_session.delete(row)
    await db_session.commit()
    return {"detail": "News deleted"}


async def upload_news_cover(
    request: Request,
    org_id: int,
    news_uuid: str,
    cover_file: UploadFile,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    row = (
        await db_session.execute(
            select(CMSNews).where(CMSNews.org_id == org.id, CMSNews.news_uuid == news_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")

    if not cover_file or not cover_file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    name_in_disk = await upload_file(
        file=cover_file,
        directory=f"cms/news/{row.news_uuid}/covers",
        type_of_dir="orgs",
        uuid=org.org_uuid,
        allowed_types=["image"],
        filename_prefix="cover",
    )
    row.cover_image = _media_content_path(
        org.org_uuid, row.news_uuid, "covers", name_in_disk
    )
    row.update_date = _now_iso()
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)


async def _get_news_for_update(
    request: Request,
    org_id: int,
    news_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> tuple[Organization, CMSNews]:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    org = await _get_org_by_id(org_id, db_session)
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)
    row = (
        await db_session.execute(
            select(CMSNews).where(CMSNews.org_id == org.id, CMSNews.news_uuid == news_uuid)
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")
    return org, row


async def upload_news_image(
    request: Request,
    org_id: int,
    news_uuid: str,
    image_file: UploadFile,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    org, row = await _get_news_for_update(
        request, org_id, news_uuid, current_user, db_session
    )
    if not image_file or not image_file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    name_in_disk = await upload_file(
        file=image_file,
        directory=f"cms/news/{row.news_uuid}/images",
        type_of_dir="orgs",
        uuid=org.org_uuid,
        allowed_types=["image"],
        filename_prefix="image",
    )
    images = list(row.images or [])
    now = _now_iso()
    images.append(
        {
            "id": _next_media_id(images),
            "name": image_file.filename,
            "file": _media_content_path(
                org.org_uuid, row.news_uuid, "images", name_in_disk
            ),
            "date_created": now,
            "date_created_string": _date_created_string(now),
        }
    )
    row.images = images
    flag_modified(row, "images")
    row.update_date = now
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)


async def upload_news_video(
    request: Request,
    org_id: int,
    news_uuid: str,
    video_file: UploadFile,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    org, row = await _get_news_for_update(
        request, org_id, news_uuid, current_user, db_session
    )
    if not video_file or not video_file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    name_in_disk = await upload_file(
        file=video_file,
        directory=f"cms/news/{row.news_uuid}/videos",
        type_of_dir="orgs",
        uuid=org.org_uuid,
        allowed_types=["video"],
        filename_prefix="video",
    )
    videos = list(row.videos or [])
    now = _now_iso()
    videos.append(
        {
            "id": _next_media_id(videos),
            "name": video_file.filename,
            "file": _media_content_path(
                org.org_uuid, row.news_uuid, "videos", name_in_disk
            ),
            "date_created": now,
            "date_created_string": _date_created_string(now),
        }
    )
    row.videos = videos
    flag_modified(row, "videos")
    row.update_date = now
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)


async def delete_news_image(
    request: Request,
    org_id: int,
    news_uuid: str,
    media_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    org, row = await _get_news_for_update(
        request, org_id, news_uuid, current_user, db_session
    )
    images = [i for i in (row.images or []) if int(i.get("id", -1)) != media_id]
    if len(images) == len(row.images or []):
        raise HTTPException(status_code=404, detail="Image not found")
    row.images = images
    flag_modified(row, "images")
    row.update_date = _now_iso()
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)


async def delete_news_video(
    request: Request,
    org_id: int,
    news_uuid: str,
    media_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> CMSNewsRead:
    org, row = await _get_news_for_update(
        request, org_id, news_uuid, current_user, db_session
    )
    videos = [v for v in (row.videos or []) if int(v.get("id", -1)) != media_id]
    if len(videos) == len(row.videos or []):
        raise HTTPException(status_code=404, detail="Video not found")
    row.videos = videos
    flag_modified(row, "videos")
    row.update_date = _now_iso()
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return _to_read(row, org.org_uuid)
