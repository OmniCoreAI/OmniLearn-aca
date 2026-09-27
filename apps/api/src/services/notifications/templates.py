"""Template management (Administration → Communication)."""
from typing import List, Optional
from uuid import uuid4

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.lookups import ConfigStatus
from src.db.administration.notifications import (
    CatalogEvent,
    CatalogVariable,
    NotificationLog,
    NotificationLogPage,
    NotificationLogRead,
    NotificationOverrideRead,
    NotificationOverrideSet,
    NotificationPreviewRead,
    NotificationPreviewRequest,
    NotificationTemplate,
    NotificationTemplateCreate,
    NotificationTemplateOverride,
    NotificationTemplateRead,
    NotificationTemplateUpdate,
    NotificationTestSend,
)
from src.db.users import User
from src.services.administration.authz import AnyUser, authorize_admin
from src.services.administration.common import bad_request, get_by_uuid_or_404, get_org_or_404, now
from src.services.administration.overview import register_overview_counter
from src.services.notifications import dispatcher
from src.services.notifications.catalog import EVENTS, get_event, sample_variables
from src.services.notifications.render import sanitize_html, sms_segments, unknown_variables

WHAT = "manage communication"
MAX_BODY = 100_000

register_overview_counter(
    "notification_templates",
    lambda org_id: select(func.count(NotificationTemplate.id)).where(NotificationTemplate.org_id == org_id),
)


def _event_or_400(event_key: str):
    event = get_event(event_key)
    if event is None:
        raise bad_request(f"Unknown event: {event_key}")
    return event


async def _read(db_session: AsyncSession, template: NotificationTemplate) -> NotificationTemplateRead:
    event = get_event(template.event_key)
    overrides = (
        await db_session.execute(
            select(func.count(NotificationTemplateOverride.id)).where(
                NotificationTemplateOverride.template_id == template.id
            )
        )
    ).scalar() or 0
    return NotificationTemplateRead(
        **template.model_dump(exclude={"org_id", "created_by_user_id"}),
        event_label=event.label if event else None,
        override_count=int(overrides),
    )


def _clean(channel: str, subject: Optional[str], body: str) -> tuple[Optional[str], str]:
    if len(body or "") > MAX_BODY:
        raise bad_request("The message is too long")
    if channel == "sms":
        return None, (body or "").strip()
    subject = " ".join((subject or "").split())
    if not subject:
        raise bad_request("An email needs a subject")
    return subject[:250], sanitize_html(body)


async def _clear_other_defaults(db_session: AsyncSession, template: NotificationTemplate) -> None:
    others = (
        await db_session.execute(
            select(NotificationTemplate).where(
                NotificationTemplate.org_id == template.org_id,
                NotificationTemplate.event_key == template.event_key,
                NotificationTemplate.channel == template.channel,
                NotificationTemplate.language == template.language,
                NotificationTemplate.is_default_for_event == True,  # noqa: E712
                NotificationTemplate.id != template.id,
            )
        )
    ).scalars().all()
    for other in others:
        other.is_default_for_event = False
        other.update_date = now()
        db_session.add(other)


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


async def get_catalog(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[CatalogEvent]:
    await authorize_admin(db_session, current_user, org_id, "communications", "read", WHAT)
    rows = (
        await db_session.execute(
            select(NotificationTemplate.event_key, NotificationTemplate.channel, func.count(NotificationTemplate.id))
            .where(
                NotificationTemplate.org_id == org_id,
                NotificationTemplate.status == ConfigStatus.ACTIVE.value,
                NotificationTemplate.is_default_for_event == True,  # noqa: E712
            )
            .group_by(NotificationTemplate.event_key, NotificationTemplate.channel)
        )
    ).all()
    custom: dict = {}
    for event_key, channel, count in rows:
        custom.setdefault(event_key, {})[channel] = int(count)
    return [
        CatalogEvent(
            key=e.key,
            label=e.label,
            label_ar=e.label_ar,
            description=e.description,
            variables=[CatalogVariable(name=v.name, description=v.description, sample=v.sample) for v in e.variables],
            required=e.required,
            builtin_email=e.builtin_email,
            default_channels=e.default_channels,
            custom_templates=custom.get(e.key, {}),
        )
        for e in EVENTS
    ]


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------


async def list_templates(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    channel: Optional[str] = None,
    event_key: Optional[str] = None,
) -> List[NotificationTemplateRead]:
    await authorize_admin(db_session, current_user, org_id, "communications", "read", WHAT)
    stmt = select(NotificationTemplate).where(NotificationTemplate.org_id == org_id)
    if channel:
        stmt = stmt.where(NotificationTemplate.channel == channel)
    if event_key:
        stmt = stmt.where(NotificationTemplate.event_key == event_key)
    rows = (
        await db_session.execute(stmt.order_by(NotificationTemplate.event_key, NotificationTemplate.name))
    ).scalars().all()
    return [await _read(db_session, r) for r in rows]


async def get_template_by_uuid(db_session: AsyncSession, template_uuid: str) -> NotificationTemplate:
    return await get_by_uuid_or_404(
        db_session, NotificationTemplate, NotificationTemplate.template_uuid, template_uuid, "Template"
    )


async def get_template(db_session: AsyncSession, current_user: AnyUser, template_uuid: str) -> NotificationTemplateRead:
    template = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, template.org_id, "communications", "read", WHAT)
    return await _read(db_session, template)


async def create_template(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: NotificationTemplateCreate
) -> NotificationTemplateRead:
    user_id = await authorize_admin(db_session, current_user, org_id, "communications", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    _event_or_400(payload.event_key)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    subject, body = _clean(payload.channel.value, payload.subject, payload.body)
    template = NotificationTemplate(
        org_id=org_id,
        channel=payload.channel.value,
        event_key=payload.event_key,
        name=name,
        subject=subject,
        body=body,
        language=payload.language.value,
        is_default_for_event=payload.is_default_for_event,
        status=payload.status,
        created_by_user_id=user_id,
        template_uuid=f"notificationtemplate_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(template)
    await db_session.flush()
    if template.is_default_for_event:
        await _clear_other_defaults(db_session, template)
    await db_session.commit()
    await db_session.refresh(template)
    return await _read(db_session, template)


async def update_template(
    db_session: AsyncSession, current_user: AnyUser, template_uuid: str, payload: NotificationTemplateUpdate
) -> NotificationTemplateRead:
    template = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, template.org_id, "communications", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise bad_request("Name is required")
        template.name = name
    if "subject" in data or "body" in data:
        template.subject, template.body = _clean(
            template.channel,
            data.get("subject", template.subject),
            data.get("body", template.body),
        )
    if data.get("language") is not None:
        template.language = data["language"].value if hasattr(data["language"], "value") else data["language"]
    if data.get("status") is not None:
        template.status = data["status"]
    if data.get("is_default_for_event") is not None:
        template.is_default_for_event = data["is_default_for_event"]
    template.update_date = now()
    db_session.add(template)
    if template.is_default_for_event:
        await _clear_other_defaults(db_session, template)
    await db_session.commit()
    await db_session.refresh(template)
    return await _read(db_session, template)


async def duplicate_template(db_session: AsyncSession, current_user: AnyUser, template_uuid: str) -> NotificationTemplateRead:
    source = await get_template_by_uuid(db_session, template_uuid)
    user_id = await authorize_admin(db_session, current_user, source.org_id, "communications", "create", WHAT)
    copy = NotificationTemplate(
        org_id=source.org_id,
        channel=source.channel,
        event_key=source.event_key,
        name=f"{source.name} (copy)"[:250],
        subject=source.subject,
        body=source.body,
        language=source.language,
        is_default_for_event=False,
        status=ConfigStatus.INACTIVE,
        created_by_user_id=user_id,
        template_uuid=f"notificationtemplate_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(copy)
    await db_session.commit()
    await db_session.refresh(copy)
    return await _read(db_session, copy)


async def delete_template(db_session: AsyncSession, current_user: AnyUser, template_uuid: str) -> str:
    template = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, template.org_id, "communications", "delete", WHAT)
    from sqlmodel import delete

    await db_session.execute(
        delete(NotificationTemplateOverride).where(NotificationTemplateOverride.template_id == template.id)
    )
    await db_session.delete(template)
    await db_session.commit()
    return "Template deleted"


# ---------------------------------------------------------------------------
# Preview / test
# ---------------------------------------------------------------------------


async def preview(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: NotificationPreviewRequest
) -> NotificationPreviewRead:
    await authorize_admin(db_session, current_user, org_id, "communications", "read", WHAT)
    event = _event_or_400(payload.event_key)
    variables = {**sample_variables(event), **(await dispatcher.org_variables(db_session, org_id))}
    channel = payload.channel.value
    draft = NotificationTemplate(
        org_id=org_id,
        channel=channel,
        event_key=event.key,
        name="preview",
        subject=payload.subject,
        body=payload.body or "",
        language=payload.language.value,
    )
    message = dispatcher.render_message(event, channel, payload.language.value, draft, variables)
    unknown = unknown_variables([payload.subject, payload.body], [v.name for v in event.variables])
    return NotificationPreviewRead(
        subject=message.subject,
        html=message.html,
        text=message.text,
        sms_segments=sms_segments(message.text) if channel == "sms" else 0,
        unknown_variables=unknown,
    )


async def send_test(
    db_session: AsyncSession, current_user: AnyUser, template_uuid: str, payload: NotificationTestSend
) -> NotificationLogRead:
    template = await get_template_by_uuid(db_session, template_uuid)
    user_id = await authorize_admin(db_session, current_user, template.org_id, "communications", "update", WHAT)
    event = _event_or_400(template.event_key)
    me = await db_session.get(User, user_id)
    if template.channel == "email":
        to = (payload.to or (me.email if me else "") or "").strip()
        if "@" not in to:
            raise bad_request("Enter an email address")
    else:
        from src.services.notifications.sms import normalize_phone

        to = normalize_phone(payload.to) or dispatcher.user_phone(me) or ""
        if not to:
            raise bad_request("Enter a phone number")
    variables = {
        **sample_variables(event),
        **(await dispatcher.org_variables(db_session, template.org_id)),
        **dispatcher.user_variables(me),
    }
    message = dispatcher.render_message(event, template.channel, template.language, template, variables)
    log = dispatcher._new_log(
        template.org_id, event.key, template.channel, to, template=template, user_id=user_id,
        subject=f"[TEST] {message.subject}" if message.subject else None,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    settings = await dispatcher.load_notification_settings(db_session, template.org_id)
    payload_ = dispatcher.Payload(log.id, template.channel, to, log.subject, message.html, message.text, settings.sender_name)  # type: ignore[arg-type]
    status, error, attempts = await dispatcher._deliver_one(payload_, sleep=False)
    await dispatcher._record(db_session, payload_, status, error, attempts)
    await db_session.commit()
    await db_session.refresh(log)
    return _log_read(log, template.name)


# ---------------------------------------------------------------------------
# Overrides (course / training program)
# ---------------------------------------------------------------------------


async def _resource_org(db_session: AsyncSession, resource_type: str, resource_uuid: str) -> int:
    from src.services.administration.audience import _resource_info

    info = await _resource_info(db_session, resource_type, resource_uuid)
    return info.org_id  # type: ignore[union-attr]


async def list_overrides(
    db_session: AsyncSession, current_user: AnyUser, resource_type: str, resource_uuid: str
) -> List[NotificationOverrideRead]:
    org_id = await _resource_org(db_session, resource_type, resource_uuid)
    await authorize_admin(db_session, current_user, org_id, "communications", "read", WHAT)
    rows = (
        await db_session.execute(
            select(NotificationTemplateOverride, NotificationTemplate)
            .join(NotificationTemplate, NotificationTemplate.id == NotificationTemplateOverride.template_id)  # type: ignore[arg-type]
            .where(
                NotificationTemplateOverride.resource_type == resource_type,
                NotificationTemplateOverride.resource_uuid == resource_uuid,
            )
        )
    ).all()
    return [
        NotificationOverrideRead(
            override_uuid=o.override_uuid,
            resource_type=o.resource_type,
            resource_uuid=o.resource_uuid,
            event_key=o.event_key,
            channel=o.channel,
            template_uuid=t.template_uuid,
            template_name=t.name,
        )
        for o, t in rows
    ]


async def set_override(
    db_session: AsyncSession, current_user: AnyUser, payload: NotificationOverrideSet
) -> NotificationOverrideRead:
    if payload.resource_type not in ("course", "training_program"):
        raise bad_request("Overrides apply to courses and training programs")
    org_id = await _resource_org(db_session, payload.resource_type, payload.resource_uuid)
    await authorize_admin(db_session, current_user, org_id, "communications", "update", WHAT)
    template = await get_template_by_uuid(db_session, payload.template_uuid)
    if template.org_id != org_id:
        raise bad_request("Template belongs to a different organization")
    if template.event_key != payload.event_key or template.channel != payload.channel.value:
        raise bad_request("The template is for a different event or channel")
    existing = (
        await db_session.execute(
            select(NotificationTemplateOverride).where(
                NotificationTemplateOverride.resource_type == payload.resource_type,
                NotificationTemplateOverride.resource_uuid == payload.resource_uuid,
                NotificationTemplateOverride.event_key == payload.event_key,
                NotificationTemplateOverride.channel == payload.channel.value,
            )
        )
    ).scalars().first()
    if existing is None:
        existing = NotificationTemplateOverride(
            org_id=org_id,
            resource_type=payload.resource_type,
            resource_uuid=payload.resource_uuid,
            event_key=payload.event_key,
            channel=payload.channel.value,
            template_id=template.id,  # type: ignore[arg-type]
            override_uuid=f"notificationoverride_{uuid4()}",
            creation_date=now(),
        )
    else:
        existing.template_id = template.id  # type: ignore[assignment]
    db_session.add(existing)
    await db_session.commit()
    return NotificationOverrideRead(
        override_uuid=existing.override_uuid,
        resource_type=existing.resource_type,
        resource_uuid=existing.resource_uuid,
        event_key=existing.event_key,
        channel=existing.channel,
        template_uuid=template.template_uuid,
        template_name=template.name,
    )


async def delete_override(db_session: AsyncSession, current_user: AnyUser, override_uuid: str) -> str:
    override = await get_by_uuid_or_404(
        db_session, NotificationTemplateOverride, NotificationTemplateOverride.override_uuid, override_uuid, "Override"
    )
    await authorize_admin(db_session, current_user, override.org_id, "communications", "delete", WHAT)
    await db_session.delete(override)
    await db_session.commit()
    return "Override removed"


# ---------------------------------------------------------------------------
# Delivery log
# ---------------------------------------------------------------------------


def _log_read(log: NotificationLog, template_name: Optional[str] = None) -> NotificationLogRead:
    event = get_event(log.event_key)
    return NotificationLogRead(
        log_uuid=log.log_uuid,
        channel=log.channel,
        event_key=log.event_key,
        event_label=event.label if event else log.event_key,
        template_name=template_name,
        recipient=log.recipient,
        subject=log.subject,
        status=log.status,
        error=log.error,
        attempts=log.attempts,
        resource_type=log.resource_type,
        resource_uuid=log.resource_uuid,
        creation_date=log.creation_date,
        sent_at=log.sent_at,
    )


async def list_log(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    event_key: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> NotificationLogPage:
    await authorize_admin(db_session, current_user, org_id, "communications", "read", WHAT)
    page = max(1, page)
    limit = max(1, min(limit, 200))
    stmt = select(NotificationLog, NotificationTemplate.name).outerjoin(
        NotificationTemplate, NotificationTemplate.id == NotificationLog.template_id  # type: ignore[arg-type]
    ).where(NotificationLog.org_id == org_id)
    if channel:
        stmt = stmt.where(NotificationLog.channel == channel)
    if status:
        stmt = stmt.where(NotificationLog.status == status)
    if event_key:
        stmt = stmt.where(NotificationLog.event_key == event_key)
    if q:
        stmt = stmt.where(NotificationLog.recipient.ilike(f"%{q.strip()}%"))  # type: ignore[attr-defined]
    total = (await db_session.execute(select(func.count()).select_from(stmt.subquery()))).scalar() or 0
    rows = (
        await db_session.execute(
            stmt.order_by(NotificationLog.id.desc()).offset((page - 1) * limit).limit(limit)  # type: ignore[union-attr]
        )
    ).all()
    counts = dict(
        (
            await db_session.execute(
                select(NotificationLog.status, func.count(NotificationLog.id))
                .where(NotificationLog.org_id == org_id)
                .group_by(NotificationLog.status)
            )
        ).all()
    )
    return NotificationLogPage(
        items=[_log_read(log, name) for log, name in rows],
        total=int(total),
        page=page,
        limit=limit,
        counts={k: int(v) for k, v in counts.items()},
    )
