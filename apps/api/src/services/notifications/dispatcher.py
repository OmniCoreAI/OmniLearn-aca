"""Send catalog events by email / SMS using the org's templates.

Template lookup order for (event, channel):

1. an override on the resource (course, or the training program it belongs to);
2. the org's default template for the event in the recipient's language
   (then in the other language);
3. the built-in message — for events that already had a hard-coded platform
   email (password reset, invitation…) that original email is sent unchanged.

``notify`` records every message in ``NotificationLog`` (a ``dedupe_key``
makes reminders idempotent) and delivers in the background with retries,
like webhooks. ``send_event_email`` is the synchronous variant used by the
existing security emails so their behaviour (and errors) stay the same.
"""
import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.notifications import (
    NotificationLog,
    NotificationLogStatus,
    NotificationTemplate,
    NotificationTemplateOverride,
)
from src.db.administration.lookups import ConfigStatus
from src.db.organizations import Organization
from src.db.users import User
from src.services.notifications.catalog import EventDef, get_event
from src.services.notifications.render import (
    html_to_text,
    render_text,
    sanitize_html,
    wrap_email,
)
from src.services.notifications.settings import NotificationSettings, load_notification_settings

logger = logging.getLogger(__name__)

Resource = Tuple[str, str]  # (resource_type, resource_uuid)

MAX_ATTEMPTS = 3
BACKOFF_DELAYS = [1, 4, 16]
_background_tasks: set = set()


# ---------------------------------------------------------------------------
# Transports (patched in tests)
# ---------------------------------------------------------------------------


def _default_email_transport(to: str, subject: str, html: str, sender_name: Optional[str]) -> Any:
    from src.services.email.utils import send_email

    return send_email(to=to, subject=subject, body=html, sender_name=sender_name)


async def _default_sms_transport(to: str, text: str):
    from src.services.notifications.sms import send_sms

    return await send_sms(to, text)


email_transport: Callable[..., Any] = _default_email_transport
sms_transport: Callable[..., Any] = _default_sms_transport


def _testing() -> bool:
    return os.environ.get("TESTING") == "true"


def _deliveries_disabled() -> bool:
    """Tests never reach real providers unless they patch a transport."""
    return _testing() and email_transport is _default_email_transport and sms_transport is _default_sms_transport


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> str:
    return str(datetime.now())


def _lang(value: Optional[str]) -> str:
    return "ar" if (value or "").lower().startswith("ar") else "en"


async def org_language(db_session: AsyncSession, org_id: int, settings: Optional[NotificationSettings] = None) -> str:
    if settings and settings.default_language:
        return settings.default_language
    from src.db.organization_config import OrganizationConfig
    from src.services.orgs.orgs import get_org_default_language

    config = (
        await db_session.execute(select(OrganizationConfig).where(OrganizationConfig.org_id == org_id))
    ).scalars().first()
    return _lang(get_org_default_language(config))


def channel_enabled(settings: NotificationSettings, event: EventDef, channel: str) -> bool:
    if event.required and channel == "email":
        return True
    configured = settings.events.get(event.key)
    if configured is not None:
        return bool(getattr(configured, channel, False))
    return bool(event.default_channels.get(channel, False))


async def _course_program_uuid(db_session: AsyncSession, course_uuid: str) -> Optional[str]:
    from src.db.academic.links import TrainingProgramCourse
    from src.db.academic.training_programs import TrainingProgram
    from src.db.courses.courses import Course

    return (
        await db_session.execute(
            select(TrainingProgram.trainingprogram_uuid)
            .join(TrainingProgramCourse, TrainingProgramCourse.training_program_id == TrainingProgram.id)  # type: ignore[arg-type]
            .join(Course, Course.id == TrainingProgramCourse.course_id)  # type: ignore[arg-type]
            .where(Course.course_uuid == course_uuid)
        )
    ).scalars().first()


async def resolve_template(
    db_session: AsyncSession,
    org_id: int,
    event_key: str,
    channel: str,
    language: str,
    resource: Optional[Resource] = None,
) -> Optional[NotificationTemplate]:
    active = ConfigStatus.ACTIVE.value
    if resource:
        targets = [resource]
        if resource[0] == "course":
            tp_uuid = await _course_program_uuid(db_session, resource[1])
            if tp_uuid:
                targets.append(("training_program", tp_uuid))
        for resource_type, resource_uuid in targets:
            template = (
                await db_session.execute(
                    select(NotificationTemplate)
                    .join(NotificationTemplateOverride, NotificationTemplateOverride.template_id == NotificationTemplate.id)  # type: ignore[arg-type]
                    .where(
                        NotificationTemplateOverride.resource_type == resource_type,
                        NotificationTemplateOverride.resource_uuid == resource_uuid,
                        NotificationTemplateOverride.event_key == event_key,
                        NotificationTemplateOverride.channel == channel,
                        NotificationTemplate.status == active,
                    )
                )
            ).scalars().first()
            if template is not None:
                return template
    defaults = (
        await db_session.execute(
            select(NotificationTemplate).where(
                NotificationTemplate.org_id == org_id,
                NotificationTemplate.event_key == event_key,
                NotificationTemplate.channel == channel,
                NotificationTemplate.is_default_for_event == True,  # noqa: E712
                NotificationTemplate.status == active,
            )
        )
    ).scalars().all()
    for template in defaults:
        if template.language == language:
            return template
    return defaults[0] if defaults else None


@dataclass
class Rendered:
    subject: Optional[str]
    html: Optional[str]
    text: str


def render_message(
    event: EventDef,
    channel: str,
    language: str,
    template: Optional[NotificationTemplate],
    variables: Dict[str, Any],
) -> Rendered:
    builtin = event.builtin.get(language) or event.builtin["en"]
    if channel == "sms":
        body = template.body if template else builtin.sms
        return Rendered(subject=None, html=None, text=render_text(body, variables, escape=False).strip())
    subject_t = (template.subject if template else builtin.subject) or event.label
    body_t = sanitize_html(template.body) if template else builtin.body
    subject = " ".join(render_text(subject_t, variables, escape=False).split())[:250]
    inner = render_text(body_t, variables, escape=True)
    return Rendered(subject=subject, html=wrap_email(inner, language), text=html_to_text(inner))


def user_variables(user: Optional[User]) -> Dict[str, str]:
    if user is None:
        return {}
    first = user.first_name or ""
    last = user.last_name or ""
    return {
        "user_first_name": first or user.username,
        "user_last_name": last,
        "user_full_name": f"{first} {last}".strip() or user.username,
        "user_email": user.email or "",
    }


def user_phone(user: Optional[User]) -> Optional[str]:
    from src.services.notifications.sms import normalize_phone

    meta = (user.extra_metadata or {}) if user else {}
    return normalize_phone(meta.get("phone") if isinstance(meta, dict) else None)


async def org_variables(db_session: AsyncSession, org_id: int) -> Dict[str, str]:
    org = await db_session.get(Organization, org_id)
    if org is None:
        return {}
    from config.config import get_omnilearn_config

    hosting = get_omnilearn_config().hosting_config
    domain = (hosting.frontend_domain or hosting.domain or "").strip().rstrip("/")
    scheme = "https" if hosting.ssl else "http"
    platform_url = domain if "://" in domain else (f"{scheme}://{domain}" if domain else "")
    return {"org_name": org.name, "platform_url": platform_url}


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------


def _new_log(
    org_id: int,
    event_key: str,
    channel: str,
    recipient: str,
    *,
    template: Optional[NotificationTemplate] = None,
    user_id: Optional[int] = None,
    subject: Optional[str] = None,
    status: str = NotificationLogStatus.QUEUED.value,
    error: Optional[str] = None,
    dedupe_key: Optional[str] = None,
    resource: Optional[Resource] = None,
) -> NotificationLog:
    return NotificationLog(
        org_id=org_id,
        channel=channel,
        event_key=event_key,
        template_id=template.id if template else None,
        user_id=user_id,
        recipient=recipient,
        subject=subject,
        status=status,
        error=error,
        dedupe_key=dedupe_key,
        resource_type=resource[0] if resource else None,
        resource_uuid=resource[1] if resource else None,
        log_uuid=f"notificationlog_{uuid4()}",
        creation_date=_now(),
        sent_at=_now() if status == NotificationLogStatus.SENT.value else None,
    )


async def _already_logged(db_session: AsyncSession, dedupe_key: str) -> bool:
    return (
        await db_session.execute(select(NotificationLog.id).where(NotificationLog.dedupe_key == dedupe_key))
    ).first() is not None


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------


@dataclass
class Payload:
    log_id: int
    channel: str
    to: str
    subject: Optional[str]
    html: Optional[str]
    text: str
    sender_name: Optional[str]


async def _deliver_one(payload: Payload, sleep: bool) -> Tuple[str, Optional[str], int]:
    error: Optional[str] = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            if payload.channel == "email":
                result = email_transport(payload.to, payload.subject or "", payload.html or "", payload.sender_name)
                if asyncio.iscoroutine(result):
                    await result
                return NotificationLogStatus.SENT.value, None, attempt
            result = sms_transport(payload.to, payload.text)
            if asyncio.iscoroutine(result):
                result = await result
            if getattr(result, "ok", False):
                return NotificationLogStatus.SENT.value, None, attempt
            if getattr(result, "skipped", False):
                return NotificationLogStatus.SKIPPED.value, getattr(result, "error", None), attempt
            error = getattr(result, "error", None) or "SMS failed"
        except Exception as exc:  # provider errors are recorded, never raised
            error = str(getattr(exc, "detail", None) or exc)[:1000]
        if sleep and attempt < MAX_ATTEMPTS:
            await asyncio.sleep(BACKOFF_DELAYS[attempt - 1])
    return NotificationLogStatus.FAILED.value, error, MAX_ATTEMPTS


async def _record(db_session: AsyncSession, payload: Payload, status: str, error: Optional[str], attempts: int) -> None:
    log = await db_session.get(NotificationLog, payload.log_id)
    if log is None:
        return
    log.status = status
    log.error = error
    log.attempts = attempts
    if status == NotificationLogStatus.SENT.value:
        log.sent_at = _now()
    db_session.add(log)


async def _deliver_background(payloads: List[Payload]) -> None:
    from src.core.events.database import _async_session_factory

    for payload in payloads:
        status, error, attempts = await _deliver_one(payload, sleep=True)
        async with _async_session_factory() as session:
            await _record(session, payload, status, error, attempts)
            await session.commit()


async def deliver(db_session: AsyncSession, payloads: List[Payload]) -> None:
    if not payloads or _deliveries_disabled():
        return
    if _testing():
        # Deterministic in tests: deliver inline, no backoff.
        for payload in payloads:
            status, error, attempts = await _deliver_one(payload, sleep=False)
            await _record(db_session, payload, status, error, attempts)
        await db_session.commit()
        return
    task = asyncio.create_task(_deliver_background(payloads))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def notify(
    db_session: AsyncSession,
    org_id: int,
    event_key: str,
    user_ids: Iterable[int],
    variables: Optional[Dict[str, Any]] = None,
    *,
    resource: Optional[Resource] = None,
    dedupe_prefix: Optional[str] = None,
    channels: Iterable[str] = ("email", "sms"),
) -> int:
    """Queue ``event_key`` for each user on every enabled channel.

    Never raises: notification problems must not break the calling action.
    Returns the number of messages queued.
    """
    try:
        return await _notify(db_session, org_id, event_key, list(user_ids), variables or {}, resource, dedupe_prefix, tuple(channels))
    except Exception:
        logger.exception("notify(%s) failed for org %s", event_key, org_id)
        try:
            await db_session.rollback()
        except Exception:
            pass
        return 0


async def _notify(
    db_session: AsyncSession,
    org_id: int,
    event_key: str,
    user_ids: List[int],
    variables: Dict[str, Any],
    resource: Optional[Resource],
    dedupe_prefix: Optional[str],
    channels: Tuple[str, ...],
) -> int:
    event = get_event(event_key)
    if event is None or not user_ids:
        return 0
    settings = await load_notification_settings(db_session, org_id)
    enabled = [c for c in channels if channel_enabled(settings, event, c)]
    if not enabled:
        return 0
    language = await org_language(db_session, org_id, settings)
    base_vars = {**(await org_variables(db_session, org_id)), **variables}
    templates = {c: await resolve_template(db_session, org_id, event_key, c, language, resource) for c in enabled}
    payloads: List[Payload] = []
    for user_id in dict.fromkeys(user_ids):
        user = await db_session.get(User, user_id)
        if user is None:
            continue
        per_user = {**base_vars, **user_variables(user)}
        for channel in enabled:
            to = (user.email or "") if channel == "email" else (user_phone(user) or "")
            dedupe_key = f"{dedupe_prefix}:{channel}:{user_id}"[:255] if dedupe_prefix else None
            if dedupe_key and await _already_logged(db_session, dedupe_key):
                continue
            if not to:
                db_session.add(
                    _new_log(org_id, event_key, channel, "", user_id=user_id, status=NotificationLogStatus.SKIPPED.value,
                             error="No phone number" if channel == "sms" else "No email address", dedupe_key=dedupe_key, resource=resource)
                )
                continue
            message = render_message(event, channel, language, templates[channel], per_user)
            log = _new_log(org_id, event_key, channel, to, template=templates[channel], user_id=user_id,
                           subject=message.subject, dedupe_key=dedupe_key, resource=resource)
            db_session.add(log)
            try:
                # One commit per message so a duplicate only drops itself.
                await db_session.commit()
            except IntegrityError:
                # A concurrent worker logged the same dedupe key first.
                await db_session.rollback()
                continue
            payloads.append(
                Payload(log.id, channel, to, message.subject, message.html, message.text, settings.sender_name)  # type: ignore[arg-type]
            )
    await db_session.commit()
    await deliver(db_session, payloads)
    return len(payloads)


async def send_event_email(
    db_session: Optional[AsyncSession],
    org_id: Optional[int],
    event_key: str,
    *,
    to: str,
    fallback: Callable[[], Any],
    user: Optional[User] = None,
    variables: Optional[Dict[str, Any]] = None,
) -> Any:
    """For events that already had a hard-coded email.

    Sends the org's custom template when it has one, otherwise calls
    ``fallback`` (the original email) — synchronously, preserving the caller's
    return value and errors.
    """
    event = get_event(event_key)
    if db_session is None or org_id is None or event is None:
        return fallback()
    try:
        settings = await load_notification_settings(db_session, org_id)
        if not channel_enabled(settings, event, "email"):
            db_session.add(_new_log(org_id, event_key, "email", to, user_id=user.id if user else None,
                                    status=NotificationLogStatus.SKIPPED.value, error="Disabled in notification settings"))
            await db_session.commit()
            return True
        language = await org_language(db_session, org_id, settings)
        template = await resolve_template(db_session, org_id, event_key, "email", language)
        message = None
        if template is not None:
            merged = {**(await org_variables(db_session, org_id)), **user_variables(user), **(variables or {})}
            message = render_message(event, "email", language, template, merged)
    except Exception:
        logger.exception("Template lookup failed for %s; sending the built-in email", event_key)
        return fallback()

    user_id = user.id if user else None
    if message is None:
        try:
            result = fallback()
        except Exception as exc:
            await _safe_log(db_session, _new_log(org_id, event_key, "email", to, user_id=user_id,
                                                 status=NotificationLogStatus.FAILED.value, error=str(exc)[:1000]))
            raise
        await _safe_log(db_session, _new_log(org_id, event_key, "email", to, user_id=user_id,
                                             subject=event.label, status=NotificationLogStatus.SENT.value))
        return result
    try:
        result = email_transport(to, message.subject or "", message.html or "", settings.sender_name)
        if asyncio.iscoroutine(result):
            result = await result
    except Exception as exc:
        await _safe_log(db_session, _new_log(org_id, event_key, "email", to, template=template, user_id=user_id,
                                             subject=message.subject, status=NotificationLogStatus.FAILED.value, error=str(exc)[:1000]))
        raise
    await _safe_log(db_session, _new_log(org_id, event_key, "email", to, template=template, user_id=user_id,
                                         subject=message.subject, status=NotificationLogStatus.SENT.value))
    return result if result is not None else True


async def _safe_log(db_session: AsyncSession, log: NotificationLog) -> None:
    try:
        db_session.add(log)
        await db_session.commit()
    except Exception:
        logger.exception("Could not record notification log")
        try:
            await db_session.rollback()
        except Exception:
            pass
