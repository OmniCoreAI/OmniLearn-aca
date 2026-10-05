"""Communication: email / SMS templates, per-resource overrides and delivery log.

A **NotificationTemplate** is an admin-written message for one catalog event
(``services/notifications/catalog.py``) and channel, in one language, using
``{{variable}}`` placeholders. The org's default template for an event wins
over the built-in message; a **NotificationTemplateOverride** lets a course or
training program use its own template for an event. Every send is recorded in
**NotificationLog** (``dedupe_key`` prevents duplicates, e.g. reminders).
"""
from enum import Enum
from typing import Dict, List, Optional

from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.db.administration.lookups import ConfigStatus, status_column


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"


class NotificationLanguage(str, Enum):
    EN = "en"
    AR = "ar"


class NotificationLogStatus(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------


class NotificationTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    channel: str = Field(sa_column=Column(String(8), nullable=False, index=True))
    event_key: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    name: str
    subject: Optional[str] = None
    body: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    language: str = Field(default="en", sa_column=Column(String(8), nullable=False, default="en"))
    # The org-wide default for (event, channel, language).
    is_default_for_event: bool = False
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    created_by_user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    template_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class NotificationTemplateCreate(SQLModel):
    channel: NotificationChannel
    event_key: str
    name: str
    subject: Optional[str] = None
    body: str
    language: NotificationLanguage = NotificationLanguage.EN
    is_default_for_event: bool = False
    status: ConfigStatus = ConfigStatus.ACTIVE


class NotificationTemplateUpdate(SQLModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    language: Optional[NotificationLanguage] = None
    is_default_for_event: Optional[bool] = None
    status: Optional[ConfigStatus] = None


class NotificationTemplateRead(SQLModel):
    id: int
    template_uuid: str
    channel: str
    event_key: str
    event_label: Optional[str] = None
    name: str
    subject: Optional[str] = None
    body: str
    language: str
    is_default_for_event: bool
    status: ConfigStatus
    override_count: int = 0
    creation_date: str
    update_date: str


class NotificationTemplateOverride(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint(
            "resource_type", "resource_uuid", "event_key", "channel", name="uq_notification_override_target"
        ),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # course | training_program
    resource_type: str = Field(index=True)
    resource_uuid: str = Field(index=True)
    event_key: str
    channel: str
    template_id: int = Field(
        sa_column=Column(Integer, ForeignKey("notificationtemplate.id", ondelete="CASCADE"), index=True)
    )
    override_uuid: str = Field(default="", index=True)
    creation_date: str = ""


class NotificationOverrideSet(SQLModel):
    resource_type: str
    resource_uuid: str
    event_key: str
    channel: NotificationChannel
    template_uuid: str


class NotificationOverrideRead(SQLModel):
    override_uuid: str
    resource_type: str
    resource_uuid: str
    event_key: str
    channel: str
    template_uuid: str
    template_name: str


# ---------------------------------------------------------------------------
# Delivery log
# ---------------------------------------------------------------------------


class NotificationLog(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_notificationlog_dedupe"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    channel: str = Field(sa_column=Column(String(8), nullable=False))
    event_key: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    template_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("notificationtemplate.id", ondelete="SET NULL"), nullable=True),
    )
    user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    recipient: str = ""
    subject: Optional[str] = None
    status: str = Field(default="queued", sa_column=Column(String(16), nullable=False, default="queued", index=True))
    error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    attempts: int = 0
    dedupe_key: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))
    resource_type: Optional[str] = None
    resource_uuid: Optional[str] = None
    log_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    sent_at: Optional[str] = None


class NotificationLogRead(SQLModel):
    log_uuid: str
    channel: str
    event_key: str
    event_label: Optional[str] = None
    template_name: Optional[str] = None
    recipient: str
    subject: Optional[str] = None
    status: str
    error: Optional[str] = None
    attempts: int = 0
    resource_type: Optional[str] = None
    resource_uuid: Optional[str] = None
    creation_date: str
    sent_at: Optional[str] = None


class NotificationLogPage(SQLModel):
    items: List[NotificationLogRead] = []
    total: int = 0
    page: int = 1
    limit: int = 50
    counts: Dict[str, int] = {}


# ---------------------------------------------------------------------------
# Catalog / preview
# ---------------------------------------------------------------------------


class CatalogVariable(SQLModel):
    name: str
    description: str
    sample: str


class CatalogEvent(SQLModel):
    key: str
    label: str
    label_ar: str
    description: str
    variables: List[CatalogVariable] = []
    # Security emails cannot be switched off.
    required: bool = False
    # A hard-coded platform email exists (used when no template is defined).
    builtin_email: bool = False
    default_channels: Dict[str, bool] = {}
    # Active custom templates per channel (filled per org).
    custom_templates: Dict[str, int] = {}


class NotificationPreviewRequest(SQLModel):
    channel: NotificationChannel
    event_key: str
    subject: Optional[str] = None
    body: str
    language: NotificationLanguage = NotificationLanguage.EN


class NotificationPreviewRead(SQLModel):
    subject: Optional[str] = None
    html: Optional[str] = None
    text: Optional[str] = None
    sms_segments: int = 0
    unknown_variables: List[str] = []


class NotificationTestSend(SQLModel):
    # Defaults to the caller's own email / phone.
    to: Optional[str] = None
