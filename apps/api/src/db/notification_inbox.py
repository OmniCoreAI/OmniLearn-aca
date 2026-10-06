"""In-app notifications (the bell): one row per recipient.

The text is rendered by the web app from ``type`` + ``payload`` in the viewer's
language; ``title`` / ``body`` keep an English fallback.
"""
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    __tablename__ = "notification"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True, nullable=False))
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True, nullable=False))
    # Catalog event key, e.g. teaching_assigned / coordination_assigned / course_assigned.
    type: str
    title: str
    body: Optional[str] = None
    # Path inside the academy site, e.g. /dash/postgraduate/teaching/offerings/…
    link: Optional[str] = None
    payload: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    read_at: Optional[str] = None
    notification_uuid: str = Field(default="", index=True)
    creation_date: str = ""


class NotificationRead(SQLModel):
    notification_uuid: str
    type: str
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    payload: Optional[dict] = None
    read_at: Optional[str] = None
    creation_date: str


class NotificationInbox(SQLModel):
    items: List[NotificationRead] = []
    unread: int = 0
