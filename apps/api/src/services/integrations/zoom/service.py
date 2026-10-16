"""ZoomService: the organization's Zoom connection and lecture meetings.

Every Zoom call in the LMS goes through this module (via ``ZoomClient``):

    connect / complete_connect / disconnect
    create_meeting / update_meeting / cancel_meeting / get_meeting
    refresh_meeting (status) / start_meeting / join_token (SDK signature)
    list_course_meetings / list_my_meetings

Attendance and recordings live in ``attendance.py`` and ``recordings.py``;
webhooks in ``webhooks.py``. Meetings are addressed by our own
``meeting_uuid`` or by the lecture's ``session_uuid`` — Zoom meeting ids sent
by a browser are never trusted.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Any, List, Optional
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.academic.offerings import CourseOffering, OfferingSession
from src.db.courses.courses import Course
from src.db.integrations.zoom import (
    JoinTokenRead,
    MeetingSettingsInput,
    OnlineMeeting,
    OnlineMeetingCreate,
    OnlineMeetingRead,
    OnlineMeetingStatus,
    OnlineMeetingUpdate,
    RecurrenceInput,
    StartMeetingRead,
    ZoomAuthorizeRead,
    ZoomConnection,
    ZoomConnectionRead,
    ZoomConnectionStatus,
)
from src.db.users import User
from src.security.org_auth import is_org_admin, require_org_admin, require_org_membership
from src.services.integrations.zoom import errors
from src.services.integrations.zoom.client import (
    ZoomClient,
    authorize_url,
    build_state,
    exchange_code,
    get_zoom_config,
    revoke_token,
    store_tokens,
    verify_state,
)
from src.services.integrations.zoom.lectures import (
    Lecture,
    can_host,
    is_enrolled,
    lecture_for_meeting,
    person_id,
    require_host,
    resolve_lecture,
)
from src.services.integrations.zoom.signature import customer_key, meeting_sdk_signature
from src.services.security.rate_limiting import check_rate_limit
from src.services.webhooks.crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

PASSWORD_RE = re.compile(r"^[A-Za-z0-9@\-_*]{1,10}$")
EMAIL_RE = re.compile(r"^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$")
LOCAL_DT_FORMAT = "%Y-%m-%dT%H:%M:%S"
MAX_DURATION = 24 * 60
RECORDING_MODES = ("none", "local", "cloud")


def now() -> str:
    return str(datetime.now())


def rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Redis-backed limit; skipped (with a log line) when Redis is down."""
    try:
        allowed, _count, retry_after = check_rate_limit(key, max_attempts, window_seconds)
    except Exception:
        logger.debug("Zoom rate limit unavailable for %s", key, exc_info=True)
        return
    if not allowed:
        raise errors.local_rate_limited(retry_after)


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------


async def get_connection(db: AsyncSession, org_id: int) -> Optional[ZoomConnection]:
    return (
        await db.execute(select(ZoomConnection).where(ZoomConnection.org_id == org_id))
    ).scalars().first()


async def require_client(db: AsyncSession, org_id: int) -> ZoomClient:
    cfg = get_zoom_config()
    if not cfg.oauth_configured:
        raise errors.not_configured()
    connection = await get_connection(db, org_id)
    if not connection:
        raise errors.not_connected()
    if connection.status == ZoomConnectionStatus.REAUTH_REQUIRED.value:
        raise errors.reauth_required()
    return ZoomClient(db, connection, cfg)


async def connection_status(db: AsyncSession, org_id: int, current_user) -> ZoomConnectionRead:
    user_id = person_id(current_user)
    if not user_id:
        raise errors.forbidden()
    await require_org_membership(user_id, org_id, db)
    cfg = get_zoom_config()
    connection = await get_connection(db, org_id)
    read = ZoomConnectionRead(
        configured=cfg.oauth_configured,
        sdk_configured=cfg.sdk_configured,
        webhooks_configured=bool(cfg.webhook_secret_token),
        connected=bool(connection) and connection.status == ZoomConnectionStatus.ACTIVE.value,
        status=connection.status if connection else None,
    )
    # Account details are for administrators only.
    if connection and await is_org_admin(user_id, org_id, db):
        read.zoom_email = connection.zoom_email
        read.zoom_display_name = connection.zoom_display_name
        read.zoom_account_id = connection.zoom_account_id
        read.scopes = connection.scopes
        read.last_error = connection.last_error
        read.connected_at = connection.creation_date
    return read


async def start_connect(db: AsyncSession, org_id: int, current_user) -> ZoomAuthorizeRead:
    user_id = person_id(current_user)
    if not user_id:
        raise errors.forbidden()
    await require_org_admin(user_id, org_id, db)
    cfg = get_zoom_config()
    if not cfg.oauth_configured:
        raise errors.not_configured()
    rate_limit(f"zoom_connect:{org_id}", 20, 3600)
    return ZoomAuthorizeRead(authorize_url=authorize_url(cfg, build_state(org_id, user_id)))


async def complete_connect(
    db: AsyncSession, org_id: int, current_user, code: str, state: str
) -> ZoomConnectionRead:
    user_id = person_id(current_user)
    if not user_id:
        raise errors.forbidden()
    await require_org_admin(user_id, org_id, db)
    cfg = get_zoom_config()
    if not cfg.oauth_configured:
        raise errors.not_configured()
    verify_state(state, org_id, user_id)
    if not code or len(code) > 512:
        raise errors.oauth_failed()

    token_body = await exchange_code(cfg, code)
    connection = await get_connection(db, org_id)
    previous_refresh = connection.refresh_token_encrypted if connection else None
    if not connection:
        connection = ZoomConnection(
            org_id=org_id,
            connection_uuid=f"zoomconnection_{uuid4()}",
            creation_date=now(),
        )
    store_tokens(connection, token_body)
    connection.connected_by_id = user_id
    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    client = ZoomClient(db, connection, cfg)
    me = await client.get_me()
    new_zoom_user = str(me.get("id") or "")
    if connection.zoom_user_id and new_zoom_user and connection.zoom_user_id != new_zoom_user:
        # A different Zoom user now hosts new meetings; existing meetings stay
        # with the old account in Zoom but can no longer be managed from here.
        logger.info("Zoom connection for org %s switched Zoom user", org_id)
    connection.zoom_user_id = new_zoom_user
    connection.zoom_account_id = str(me.get("account_id") or "")
    connection.zoom_email = me.get("email")
    connection.zoom_display_name = me.get("display_name") or " ".join(
        p for p in (me.get("first_name"), me.get("last_name")) if p
    ) or None
    connection.update_date = now()
    db.add(connection)
    await db.commit()
    if previous_refresh:
        # The replaced grant is no longer needed.
        try:
            await revoke_token(cfg, decrypt_secret(previous_refresh))
        except Exception:
            logger.debug("Revoking the previous Zoom grant failed", exc_info=True)
    return await connection_status(db, org_id, current_user)


async def disconnect(db: AsyncSession, org_id: int, current_user) -> str:
    user_id = person_id(current_user)
    if not user_id:
        raise errors.forbidden()
    await require_org_admin(user_id, org_id, db)
    connection = await get_connection(db, org_id)
    if not connection:
        return "Zoom is not connected"
    cfg = get_zoom_config()
    if cfg.oauth_configured and connection.refresh_token_encrypted:
        try:
            await revoke_token(cfg, decrypt_secret(connection.refresh_token_encrypted))
        except Exception:
            logger.debug("Zoom revoke on disconnect failed", exc_info=True)
    await db.delete(connection)
    await db.commit()
    return "Zoom disconnected"


# ---------------------------------------------------------------------------
# Validation + Zoom payloads
# ---------------------------------------------------------------------------


def _parse_local(value: str) -> datetime:
    raw = (value or "").strip().replace(" ", "T")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise errors.invalid("Start time is not a valid date and time.")
    return parsed


def _validate_timezone(tz: str) -> str:
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise errors.invalid("Unknown time zone.")
    return tz


def _local_start(value: str, tz: str) -> str:
    """Normalize to wall-clock "YYYY-MM-DDTHH:MM:SS" in ``tz``."""
    parsed = _parse_local(value)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(ZoneInfo(tz)).replace(tzinfo=None)
    return parsed.strftime(LOCAL_DT_FORMAT)


def _lecture_duration(lecture: Lecture) -> int:
    if lecture.start and lecture.end:
        try:
            minutes = int((_parse_local(lecture.end) - _parse_local(lecture.start)).total_seconds() // 60)
            if 0 < minutes <= MAX_DURATION:
                return minutes
        except Exception:
            pass
    return 60


def _validate_password(password: Optional[str]) -> Optional[str]:
    if password is None or password == "":
        return None
    if not PASSWORD_RE.match(password):
        raise errors.invalid(
            "Passcode must be 1–10 characters: letters, numbers and @ - _ * only."
        )
    return password


def _validate_settings(settings: MeetingSettingsInput) -> dict[str, Any]:
    if settings.auto_recording not in RECORDING_MODES:
        raise errors.invalid("Recording must be none, local or cloud.")
    hosts = [h.strip() for h in (settings.alternative_hosts or "").replace(";", ",").split(",") if h.strip()]
    if any(not EMAIL_RE.match(h) for h in hosts) or len(hosts) > 10:
        raise errors.invalid("Alternative hosts must be up to 10 valid email addresses.")
    data = settings.model_dump()
    data["alternative_hosts"] = ",".join(hosts)
    return data


def _validate_recurrence(rec: Optional[RecurrenceInput]) -> Optional[dict[str, Any]]:
    if rec is None:
        return None
    limits = {1: 99, 2: 50, 3: 10}
    if rec.type not in limits:
        raise errors.invalid("Recurrence must be daily, weekly or monthly.")
    if not 1 <= rec.repeat_interval <= limits[rec.type]:
        raise errors.invalid("Repeat interval is out of range.")
    out: dict[str, Any] = {"type": rec.type, "repeat_interval": rec.repeat_interval}
    if rec.type == 2:
        days = [d.strip() for d in (rec.weekly_days or "").split(",") if d.strip()]
        if not days or any(d not in "1234567" or len(d) != 1 for d in days):
            raise errors.invalid("Pick at least one weekday for a weekly meeting.")
        out["weekly_days"] = ",".join(sorted(set(days)))
    if rec.type == 3:
        if not rec.monthly_day or not 1 <= rec.monthly_day <= 31:
            raise errors.invalid("Pick the day of the month for a monthly meeting.")
        out["monthly_day"] = rec.monthly_day
    if rec.end_times:
        if not 1 <= rec.end_times <= 60:
            raise errors.invalid("A recurring meeting can have between 1 and 60 occurrences.")
        out["end_times"] = rec.end_times
    elif rec.end_date_time:
        end = _parse_local(rec.end_date_time)
        if end.tzinfo is None:
            end = end.replace(tzinfo=ZoneInfo("UTC"))
        out["end_date_time"] = end.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        raise errors.invalid("Set when the recurring meeting ends (occurrences or end date).")
    return out


def _settings_payload(settings: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "waiting_room": settings["waiting_room"],
        "join_before_host": settings["join_before_host"],
        "host_video": settings["host_video"],
        "participant_video": settings["participant_video"],
        "mute_upon_entry": settings["mute_upon_entry"],
        "auto_recording": settings["auto_recording"],
        "meeting_authentication": settings["meeting_authentication"],
        "allow_multiple_devices": settings["allow_multiple_devices"],
        # Students join through the LMS, not by registering in Zoom.
        "approval_type": 2,
    }
    if settings.get("alternative_hosts"):
        payload["alternative_hosts"] = settings["alternative_hosts"]
        payload["alternative_hosts_email_notification"] = True
    return payload


def _zoom_payload(meeting: OnlineMeeting, password: Optional[str]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "topic": meeting.topic,
        "agenda": meeting.agenda or "",
        "type": meeting.meeting_type,
        "start_time": meeting.start_time,
        "duration": meeting.duration,
        "timezone": meeting.timezone,
        "settings": _settings_payload(meeting.settings or MeetingSettingsInput().model_dump()),
    }
    if meeting.meeting_type == 8 and meeting.recurrence:
        payload["recurrence"] = meeting.recurrence
    if password:
        payload["password"] = password
    return payload


def _validate_core(topic: str, agenda: Optional[str], duration: int) -> None:
    if not topic.strip() or len(topic) > 200:
        raise errors.invalid("Meeting title is required (up to 200 characters).")
    if agenda and len(agenda) > 2000:
        raise errors.invalid("Description can be up to 2000 characters.")
    if not 1 <= duration <= MAX_DURATION:
        raise errors.invalid("Duration must be between 1 minute and 24 hours.")


# ---------------------------------------------------------------------------
# Read models
# ---------------------------------------------------------------------------


async def _get_meeting_or_404(db: AsyncSession, meeting_uuid: str) -> OnlineMeeting:
    meeting = (
        await db.execute(select(OnlineMeeting).where(OnlineMeeting.meeting_uuid == meeting_uuid))
    ).scalars().first() if meeting_uuid else None
    if not meeting:
        raise errors.meeting_not_found()
    return meeting


async def _meeting_and_lecture(db: AsyncSession, meeting_uuid: str) -> tuple[OnlineMeeting, Lecture]:
    meeting = await _get_meeting_or_404(db, meeting_uuid)
    lecture = await lecture_for_meeting(db, meeting)
    if not lecture:
        raise errors.meeting_not_found()
    return meeting, lecture


def _password(meeting: OnlineMeeting) -> Optional[str]:
    if not meeting.password_encrypted:
        return None
    try:
        return decrypt_secret(meeting.password_encrypted)
    except Exception:
        logger.warning("Could not decrypt the passcode of meeting %s", meeting.meeting_uuid)
        return None


def to_read(meeting: OnlineMeeting, lecture: Lecture, *, host: bool, can_join: bool) -> OnlineMeetingRead:
    read = OnlineMeetingRead(
        meeting_uuid=meeting.meeting_uuid,
        lecture=lecture.ref(),
        topic=meeting.topic,
        agenda=meeting.agenda,
        start_time=meeting.start_time,
        duration=meeting.duration,
        timezone=meeting.timezone,
        meeting_type=meeting.meeting_type,
        recurrence=meeting.recurrence,
        status=meeting.status,
        status_detail=meeting.status_detail,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        recording_status=meeting.recording_status,
        recordings_published=meeting.recordings_published,
        viewer_is_host=host,
        viewer_can_join=can_join,
        creation_date=meeting.creation_date,
        update_date=meeting.update_date,
    )
    active = meeting.status not in (OnlineMeetingStatus.CANCELED.value,)
    if can_join and active:
        read.join_url = meeting.join_url
    if host:
        read.zoom_meeting_id = meeting.zoom_meeting_id
        read.password = _password(meeting)
        read.settings = meeting.settings
        read.host_email = meeting.host_email
        read.last_synced_at = meeting.last_synced_at
    return read


async def _viewer_flags(request: Request, db: AsyncSession, current_user, lecture: Lecture) -> tuple[bool, bool]:
    host = await can_host(request, db, current_user, lecture)
    if host:
        return True, True
    user_id = person_id(current_user)
    joinable = bool(user_id) and await is_enrolled(db, user_id, lecture)
    return False, joinable


# ---------------------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------------------


async def get_lecture_meeting(
    request: Request, db: AsyncSession, current_user, session_uuid: str
) -> Optional[OnlineMeetingRead]:
    lecture = await resolve_lecture(db, session_uuid)
    host, joinable = await _viewer_flags(request, db, current_user, lecture)
    if not host and not joinable:
        raise errors.forbidden()
    meeting = (await db.execute(select(OnlineMeeting).where(lecture.meeting_filter()))).scalars().first()
    if not meeting:
        return None
    return to_read(meeting, lecture, host=host, can_join=joinable)


async def get_meeting(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> OnlineMeetingRead:
    meeting, lecture = await _meeting_and_lecture(db, meeting_uuid)
    host, joinable = await _viewer_flags(request, db, current_user, lecture)
    if not host and not joinable:
        raise errors.not_enrolled()
    return to_read(meeting, lecture, host=host, can_join=joinable)


async def create_meeting(
    request: Request, db: AsyncSession, current_user, session_uuid: str, data: OnlineMeetingCreate
) -> OnlineMeetingRead:
    lecture = await resolve_lecture(db, session_uuid)
    user_id = await require_host(request, db, current_user, lecture)
    rate_limit(f"zoom_meeting_write:{user_id}", 60, 3600)

    existing = (await db.execute(select(OnlineMeeting).where(lecture.meeting_filter()))).scalars().first()
    if existing and existing.status != OnlineMeetingStatus.CANCELED.value:
        raise errors.already_exists()

    timezone = _validate_timezone(data.timezone or "UTC")
    start_source = data.start_time or lecture.start
    if not start_source:
        raise errors.invalid("Set a start time (the lecture has no date yet).")
    topic = (data.topic or lecture.title or "Online class").strip()
    duration = data.duration or _lecture_duration(lecture)
    _validate_core(topic, data.agenda, duration)
    password = _validate_password(data.password)
    settings = _validate_settings(data.settings)
    recurrence = _validate_recurrence(data.recurrence)

    client = await require_client(db, lecture.org_id)
    meeting = OnlineMeeting(org_id=lecture.org_id, meeting_uuid=f"onlinemeeting_{uuid4()}")
    if lecture.kind == "course_session":
        meeting.course_session_id = lecture.session.id
    else:
        meeting.offering_session_id = lecture.session.id
    meeting.connection_id = client.connection.id
    meeting.topic = topic
    meeting.agenda = data.agenda
    meeting.start_time = _local_start(start_source, timezone)
    meeting.duration = duration
    meeting.timezone = timezone
    meeting.meeting_type = 8 if recurrence else 2
    meeting.recurrence = recurrence
    meeting.settings = settings

    created = await client.create_meeting(_zoom_payload(meeting, password))
    meeting.zoom_meeting_id = str(created.get("id") or "")
    meeting.zoom_uuid = created.get("uuid")
    meeting.join_url = created.get("join_url") or ""
    meeting.host_email = created.get("host_email")
    zoom_password = created.get("password") or password
    meeting.password_encrypted = encrypt_secret(zoom_password) if zoom_password else None
    meeting.status = OnlineMeetingStatus.UPCOMING.value
    meeting.created_by_id = user_id
    meeting.creation_date = meeting.update_date = meeting.last_synced_at = now()
    if not meeting.zoom_meeting_id:
        raise errors.unavailable()
    if existing:
        # A canceled meeting is replaced (one meeting per lecture).
        await db.delete(existing)
        await db.flush()
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    logger.info("Zoom meeting created for lecture %s (org %s)", lecture.session_uuid, lecture.org_id)
    return to_read(meeting, lecture, host=True, can_join=True)


async def update_meeting(
    request: Request, db: AsyncSession, current_user, meeting_uuid: str, data: OnlineMeetingUpdate
) -> OnlineMeetingRead:
    meeting, lecture = await _meeting_and_lecture(db, meeting_uuid)
    user_id = await require_host(request, db, current_user, lecture)
    rate_limit(f"zoom_meeting_write:{user_id}", 60, 3600)
    if meeting.status == OnlineMeetingStatus.CANCELED.value:
        raise errors.canceled()

    fields = data.model_dump(exclude_unset=True)
    # Publishing recordings is LMS-only; everything else is mirrored to Zoom.
    if "recordings_published" in fields and fields["recordings_published"] is not None:
        meeting.recordings_published = bool(fields.pop("recordings_published"))
    else:
        fields.pop("recordings_published", None)

    zoom_changes = {k: v for k, v in fields.items() if v is not None or k == "agenda"}
    password: Optional[str] = None
    if zoom_changes:
        timezone = _validate_timezone(data.timezone or meeting.timezone)
        if data.topic is not None:
            meeting.topic = data.topic.strip()
        if "agenda" in fields:
            meeting.agenda = data.agenda
        if data.duration is not None:
            meeting.duration = data.duration
        if data.start_time is not None or data.timezone is not None:
            meeting.start_time = _local_start(data.start_time or meeting.start_time, timezone)
        meeting.timezone = timezone
        _validate_core(meeting.topic, meeting.agenda, meeting.duration)
        if data.password is not None:
            password = _validate_password(data.password)
        if data.settings is not None:
            meeting.settings = _validate_settings(data.settings)
        if data.clear_recurrence:
            meeting.recurrence = None
            meeting.meeting_type = 2
        elif data.recurrence is not None:
            meeting.recurrence = _validate_recurrence(data.recurrence)
            meeting.meeting_type = 8

        client = await require_client(db, meeting.org_id)
        try:
            await client.update_meeting(meeting.zoom_meeting_id, _zoom_payload(meeting, password))
        except errors.ZoomError as exc:
            if exc.code == "zoom_meeting_gone":
                await _mark_gone(db, meeting)
            raise
        if password:
            meeting.password_encrypted = encrypt_secret(password)
        meeting.last_synced_at = now()

    meeting.update_date = now()
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return to_read(meeting, lecture, host=True, can_join=True)


async def _mark_gone(db: AsyncSession, meeting: OnlineMeeting) -> None:
    meeting.status = OnlineMeetingStatus.ERROR.value
    meeting.status_detail = "deleted_in_zoom"
    meeting.update_date = now()
    db.add(meeting)
    await db.commit()


async def cancel_meeting(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> OnlineMeetingRead:
    meeting, lecture = await _meeting_and_lecture(db, meeting_uuid)
    user_id = await require_host(request, db, current_user, lecture)
    rate_limit(f"zoom_meeting_write:{user_id}", 60, 3600)
    if meeting.status != OnlineMeetingStatus.CANCELED.value and meeting.zoom_meeting_id:
        connection = await get_connection(db, meeting.org_id)
        if connection and connection.status == ZoomConnectionStatus.ACTIVE.value:
            client = ZoomClient(db, connection)
            existed = await client.delete_meeting(meeting.zoom_meeting_id)
            if not existed:
                logger.info("Zoom meeting %s was already deleted in Zoom", meeting.meeting_uuid)
        else:
            # Without a working connection the Zoom meeting can't be deleted;
            # cancel it here so nobody is sent to it, and say so.
            meeting.status_detail = "not_deleted_in_zoom"
    meeting.status = OnlineMeetingStatus.CANCELED.value
    meeting.update_date = now()
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return to_read(meeting, lecture, host=True, can_join=True)


def _status_from_zoom(meeting: OnlineMeeting, zoom_status: Optional[str]) -> None:
    if zoom_status == "started":
        if meeting.status != OnlineMeetingStatus.LIVE.value:
            meeting.started_at = meeting.started_at or now()
        meeting.status = OnlineMeetingStatus.LIVE.value
    elif zoom_status in ("waiting", "finished") and meeting.status == OnlineMeetingStatus.LIVE.value:
        meeting.status = (
            OnlineMeetingStatus.UPCOMING.value if meeting.meeting_type == 8 else OnlineMeetingStatus.ENDED.value
        )
        meeting.ended_at = now()


async def refresh_meeting(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> OnlineMeetingRead:
    """Re-read the meeting from Zoom (status, link, schedule) — on demand only;
    webhooks keep it current otherwise."""
    meeting, lecture = await _meeting_and_lecture(db, meeting_uuid)
    user_id = await require_host(request, db, current_user, lecture)
    rate_limit(f"zoom_meeting_sync:{user_id}", 30, 60)
    if meeting.status == OnlineMeetingStatus.CANCELED.value:
        return to_read(meeting, lecture, host=True, can_join=True)
    client = await require_client(db, meeting.org_id)
    data = await client.get_meeting(meeting.zoom_meeting_id)
    if data is None:
        await _mark_gone(db, meeting)
    else:
        _status_from_zoom(meeting, data.get("status"))
        meeting.topic = data.get("topic") or meeting.topic
        meeting.agenda = data.get("agenda", meeting.agenda)
        meeting.duration = int(data.get("duration") or meeting.duration)
        meeting.timezone = data.get("timezone") or meeting.timezone
        if data.get("start_time"):
            meeting.start_time = _local_start(data["start_time"], meeting.timezone)
        meeting.join_url = data.get("join_url") or meeting.join_url
        meeting.zoom_uuid = data.get("uuid") or meeting.zoom_uuid
        if data.get("password"):
            meeting.password_encrypted = encrypt_secret(data["password"])
        if meeting.status == OnlineMeetingStatus.ERROR.value and meeting.status_detail == "deleted_in_zoom":
            meeting.status = OnlineMeetingStatus.UPCOMING.value
            meeting.status_detail = None
        meeting.last_synced_at = now()
        meeting.update_date = now()
        db.add(meeting)
        await db.commit()
        await db.refresh(meeting)
    return to_read(meeting, lecture, host=True, can_join=True)


def _require_joinable_status(meeting: OnlineMeeting) -> None:
    if meeting.status == OnlineMeetingStatus.CANCELED.value:
        raise errors.canceled()
    if meeting.status == OnlineMeetingStatus.ERROR.value and meeting.status_detail == "deleted_in_zoom":
        raise errors.meeting_gone()


async def start_meeting(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> StartMeetingRead:
    """A fresh start_url for opening the Zoom app as host (it embeds a
    short-lived host token, so it is never stored or shown to students)."""
    meeting, lecture = await _meeting_and_lecture(db, meeting_uuid)
    user_id = await require_host(request, db, current_user, lecture)
    rate_limit(f"zoom_start:{user_id}", 30, 300)
    _require_joinable_status(meeting)
    client = await require_client(db, meeting.org_id)
    data = await client.get_meeting(meeting.zoom_meeting_id)
    if data is None:
        await _mark_gone(db, meeting)
        raise errors.meeting_gone()
    start_url = data.get("start_url")
    if not start_url:
        raise errors.unavailable()
    return StartMeetingRead(start_url=start_url)


def _display_name(user: User) -> str:
    full = " ".join(p for p in (user.first_name, user.last_name) if p).strip()
    return (full or user.username or "Participant")[:64]


async def join_token(
    request: Request, db: AsyncSession, current_user, meeting_uuid: str, as_host: bool = False
) -> JoinTokenRead:
    """Signature (and, for hosts, a ZAK) for the embedded Meeting SDK."""
    meeting, lecture = await _meeting_and_lecture(db, meeting_uuid)
    user_id = person_id(current_user)
    if not user_id:
        raise errors.forbidden()
    rate_limit(f"zoom_join_token:{user_id}", 30, 60)
    host = await can_host(request, db, current_user, lecture)
    if as_host and not host:
        raise errors.forbidden("Only the class's instructors and administrators can start this meeting.")
    if not host and not await is_enrolled(db, user_id, lecture):
        raise errors.not_enrolled()
    _require_joinable_status(meeting)

    cfg = get_zoom_config()
    if not cfg.sdk_configured:
        raise errors.not_configured()
    user = await db.get(User, user_id)
    if not user:
        raise errors.forbidden()

    role = 1 if as_host else 0
    zak = None
    if as_host:
        client = await require_client(db, meeting.org_id)
        zak = await client.get_zak()
    return JoinTokenRead(
        sdk_key=cfg.meeting_sdk_key or "",
        sdk_version=cfg.sdk_version,
        signature=meeting_sdk_signature(cfg, meeting.zoom_meeting_id, role),
        meeting_number=meeting.zoom_meeting_id,
        password=_password(meeting) or "",
        role=role,
        user_name=_display_name(user),
        user_email=str(user.email) if user.email else None,
        customer_key=customer_key(user_id, meeting.meeting_uuid),
        zak=zak,
        join_url=meeting.join_url or None,
    )


# ---------------------------------------------------------------------------
# Listings
# ---------------------------------------------------------------------------


async def _meetings_for_course(db: AsyncSession, course: Course) -> List[OnlineMeeting]:
    profile_ids = (
        await db.execute(select(CourseAcademicProfile.id).where(CourseAcademicProfile.course_id == course.id))
    ).scalars().all()
    session_ids = (
        await db.execute(
            select(CourseScheduleSession.id).where(CourseScheduleSession.profile_id.in_(list(profile_ids) or [-1]))  # type: ignore[attr-defined]
        )
    ).scalars().all()
    offering_ids = (
        await db.execute(select(CourseOffering.id).where(CourseOffering.content_course_id == course.id))
    ).scalars().all()
    offering_session_ids = (
        await db.execute(
            select(OfferingSession.id).where(OfferingSession.offering_id.in_(list(offering_ids) or [-1]))  # type: ignore[attr-defined]
        )
    ).scalars().all()
    return list(
        (
            await db.execute(
                select(OnlineMeeting).where(
                    OnlineMeeting.org_id == course.org_id,
                    (OnlineMeeting.course_session_id.in_(list(session_ids) or [-1]))  # type: ignore[union-attr]
                    | (OnlineMeeting.offering_session_id.in_(list(offering_session_ids) or [-1])),  # type: ignore[union-attr]
                )
            )
        ).scalars().all()
    )


def _sort_key(read: OnlineMeetingRead) -> tuple:
    order = {"live": 0, "upcoming": 1, "ended": 2, "error": 3, "canceled": 4}
    return (order.get(read.status, 5), read.start_time if read.status != "ended" else _invert(read.start_time))


def _invert(value: str) -> str:
    # Most recent ended meetings first.
    return "".join(chr(0x10FFFF - ord(c)) for c in value)


async def list_course_meetings(
    request: Request, db: AsyncSession, current_user, course_uuid: str
) -> List[OnlineMeetingRead]:
    course = (await db.execute(select(Course).where(Course.course_uuid == course_uuid))).scalars().first()
    if not course:
        raise errors.lecture_not_found()
    if not person_id(current_user):
        return []
    out: list[OnlineMeetingRead] = []
    for meeting in await _meetings_for_course(db, course):
        lecture = await lecture_for_meeting(db, meeting)
        if not lecture:
            continue
        host, joinable = await _viewer_flags(request, db, current_user, lecture)
        if not host and not joinable:
            continue
        if not host and meeting.status == OnlineMeetingStatus.CANCELED.value:
            # Students only see canceled classes that were due recently.
            if not _recent(meeting.start_time, days=2):
                continue
        out.append(to_read(meeting, lecture, host=host, can_join=joinable))
    return sorted(out, key=_sort_key)


def _recent(start_time: str, days: int) -> bool:
    try:
        return _parse_local(start_time) >= datetime.now() - timedelta(days=days)
    except Exception:
        return False


async def list_my_meetings(
    request: Request, db: AsyncSession, current_user, org_id: int, include_past: bool = False
) -> List[OnlineMeetingRead]:
    """Meetings the caller hosts (admins: the whole organization) or attends."""
    user_id = person_id(current_user)
    if not user_id:
        raise errors.forbidden()
    await require_org_membership(user_id, org_id, db)
    stmt = select(OnlineMeeting).where(OnlineMeeting.org_id == org_id)
    if not include_past:
        stmt = stmt.where(
            OnlineMeeting.status.in_(  # type: ignore[attr-defined]
                [OnlineMeetingStatus.UPCOMING.value, OnlineMeetingStatus.LIVE.value, OnlineMeetingStatus.ERROR.value]
            )
        )
    meetings = (await db.execute(stmt.order_by(OnlineMeeting.start_time.desc()).limit(300))).scalars().all()  # type: ignore[attr-defined]
    out: list[OnlineMeetingRead] = []
    for meeting in meetings:
        lecture = await lecture_for_meeting(db, meeting)
        if not lecture:
            continue
        host, joinable = await _viewer_flags(request, db, current_user, lecture)
        if host or joinable:
            out.append(to_read(meeting, lecture, host=host, can_join=joinable))
    return sorted(out, key=_sort_key)
