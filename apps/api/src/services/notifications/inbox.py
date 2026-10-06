"""The in-app inbox: write, list and mark notifications as read."""
import logging
from datetime import datetime
from typing import Iterable, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import func, select, update
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.notification_inbox import Notification, NotificationInbox, NotificationRead
from src.services.administration.authz import AnyUser, require_org_member, require_user_id

logger = logging.getLogger(__name__)


async def push(
    db_session: AsyncSession,
    org_id: int,
    user_ids: Iterable[int],
    type: str,
    title: str,
    *,
    body: Optional[str] = None,
    link: Optional[str] = None,
    payload: Optional[dict] = None,
) -> int:
    """Add a notification for each user. Never raises (like ``notify``)."""
    try:
        now = str(datetime.now())
        count = 0
        for user_id in dict.fromkeys(user_ids):
            db_session.add(
                Notification(
                    org_id=org_id, user_id=user_id, type=type, title=title, body=body, link=link,
                    payload=payload, notification_uuid=f"notification_{uuid4()}", creation_date=now,
                )
            )
            count += 1
        await db_session.commit()
        return count
    except Exception:
        logger.exception("inbox push(%s) failed for org %s", type, org_id)
        try:
            await db_session.rollback()
        except Exception:
            pass
        return 0


async def list_inbox(db_session: AsyncSession, current_user: AnyUser, org_id: int, limit: int = 30) -> NotificationInbox:
    user_id = await require_org_member(db_session, current_user, org_id)
    mine = (Notification.org_id == org_id) & (Notification.user_id == user_id)
    rows = (
        await db_session.execute(
            select(Notification).where(mine).order_by(Notification.id.desc()).limit(min(max(limit, 1), 100))  # type: ignore[union-attr]
        )
    ).scalars().all()
    unread = (
        await db_session.execute(select(func.count()).select_from(Notification).where(mine, Notification.read_at.is_(None)))  # type: ignore[union-attr]
    ).scalar_one()
    return NotificationInbox(items=[NotificationRead.model_validate(r, from_attributes=True) for r in rows], unread=unread)


async def mark_read(db_session: AsyncSession, current_user: AnyUser, notification_uuid: str) -> NotificationRead:
    user_id = require_user_id(current_user, "read notifications")
    row = (
        await db_session.execute(select(Notification).where(Notification.notification_uuid == notification_uuid))
    ).scalars().first()
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if row.read_at is None:
        row.read_at = str(datetime.now())
        db_session.add(row)
        await db_session.commit()
        await db_session.refresh(row)
    return NotificationRead.model_validate(row, from_attributes=True)


async def mark_all_read(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> int:
    user_id = await require_org_member(db_session, current_user, org_id)
    result = await db_session.execute(
        update(Notification)
        .where(Notification.org_id == org_id, Notification.user_id == user_id, Notification.read_at.is_(None))  # type: ignore[union-attr]
        .values(read_at=str(datetime.now()))
    )
    await db_session.commit()
    return result.rowcount or 0
