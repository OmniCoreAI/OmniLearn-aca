"""Zoom webhook receiver.

Zoom signs every request: ``x-zm-signature = "v0=" + HMAC_SHA256(secret,
"v0:{x-zm-request-timestamp}:{raw body}")``. Requests with a bad signature or a
timestamp more than five minutes off are rejected before the body is parsed.
``endpoint.url_validation`` is answered with the HMAC of ``plainToken``.

Events update the matching meeting (found by Zoom meeting id, and only when
the event's Zoom account is the one that meeting was created under):

    meeting.started / meeting.ended          → live / ended (recurring: upcoming)
    meeting.updated / meeting.deleted        → schedule fields / canceled
    meeting.participant_joined / _left       → attendance segments
    recording.started / stopped / completed  → recording status + files
    app_deauthorized                         → connection needs reconnecting

Handlers are idempotent; Zoom retries deliveries that don't get a 2xx.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.integrations.zoom import (
    OnlineMeeting,
    OnlineMeetingStatus,
    RecordingStatus,
    ZoomConnection,
    ZoomConnectionStatus,
)
from src.services.integrations.zoom import attendance, recordings
from src.services.integrations.zoom.client import get_zoom_config

logger = logging.getLogger(__name__)

MAX_SKEW_SECONDS = 300


class WebhookRejected(Exception):
    pass


def _hmac_hex(secret: str, message: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def verify_request(raw_body: bytes, timestamp: Optional[str], signature: Optional[str], secret: str,
                   now: Optional[int] = None) -> None:
    if not secret:
        raise WebhookRejected("webhook secret not configured")
    if not timestamp or not signature:
        raise WebhookRejected("missing signature headers")
    try:
        ts = int(timestamp)
    except ValueError:
        raise WebhookRejected("bad timestamp")
    # Zoom sends milliseconds on some deliveries; normalise to seconds.
    if ts > 10_000_000_000:
        ts //= 1000
    current = now if now is not None else int(time.time())
    if abs(current - ts) > MAX_SKEW_SECONDS:
        raise WebhookRejected("stale timestamp")
    expected = "v0=" + _hmac_hex(secret, f"v0:{timestamp}:{raw_body.decode('utf-8', errors='replace')}")
    if not hmac.compare_digest(expected, signature):
        raise WebhookRejected("signature mismatch")


def url_validation_response(plain_token: str, secret: str) -> dict[str, str]:
    return {"plainToken": plain_token, "encryptedToken": _hmac_hex(secret, plain_token)}


async def _find_meeting(db: AsyncSession, obj: dict[str, Any], account_id: Optional[str]) -> Optional[OnlineMeeting]:
    zoom_id = str(obj.get("id") or "")
    if not zoom_id:
        return None
    candidates = (
        await db.execute(select(OnlineMeeting).where(OnlineMeeting.zoom_meeting_id == zoom_id))
    ).scalars().all()
    for meeting in candidates:
        if not account_id or not meeting.connection_id:
            return meeting
        connection = await db.get(ZoomConnection, meeting.connection_id)
        if connection is None or not connection.zoom_account_id or connection.zoom_account_id == account_id:
            return meeting
    if candidates:
        logger.warning("Zoom webhook for meeting id with a different account ignored")
    return None


def _now() -> str:
    return str(datetime.now())


async def handle_event(db: AsyncSession, body: dict[str, Any]) -> str:
    event = str(body.get("event") or "")
    payload = body.get("payload") or {}
    obj = payload.get("object") or {}
    account_id = payload.get("account_id")

    if event == "app_deauthorized":
        await _deauthorize(db, payload)
        return "deauthorized"

    meeting = await _find_meeting(db, obj, account_id)
    if meeting is None:
        return "ignored"

    if event == "meeting.started":
        meeting.status = OnlineMeetingStatus.LIVE.value
        meeting.started_at = obj.get("start_time") or _now()
        meeting.ended_at = None
        meeting.zoom_uuid = obj.get("uuid") or meeting.zoom_uuid
    elif event == "meeting.ended":
        meeting.status = (
            OnlineMeetingStatus.UPCOMING.value if meeting.meeting_type == 8 else OnlineMeetingStatus.ENDED.value
        )
        meeting.ended_at = obj.get("end_time") or _now()
        meeting.zoom_uuid = obj.get("uuid") or meeting.zoom_uuid
    elif event == "meeting.updated":
        _apply_update(meeting, obj)
    elif event == "meeting.deleted":
        if meeting.status != OnlineMeetingStatus.CANCELED.value:
            meeting.status = OnlineMeetingStatus.CANCELED.value
            meeting.status_detail = "deleted_in_zoom"
    elif event == "meeting.participant_joined":
        participant = obj.get("participant") or {}
        await attendance.record_join(db, meeting, participant)
        if meeting.status == OnlineMeetingStatus.UPCOMING.value:
            meeting.status = OnlineMeetingStatus.LIVE.value
    elif event == "meeting.participant_left":
        await attendance.record_leave(db, meeting, obj.get("participant") or {})
    elif event == "recording.started":
        meeting.recording_status = RecordingStatus.RECORDING.value
    elif event == "recording.stopped":
        meeting.recording_status = RecordingStatus.PROCESSING.value
    elif event == "recording.completed":
        await recordings.store_recordings(db, meeting, obj)
    else:
        return "ignored"

    meeting.update_date = _now()
    db.add(meeting)
    await db.commit()
    return "ok"


def _apply_update(meeting: OnlineMeeting, obj: dict[str, Any]) -> None:
    from src.services.integrations.zoom.service import _local_start

    if obj.get("topic"):
        meeting.topic = str(obj["topic"])[:200]
    if "agenda" in obj:
        meeting.agenda = obj.get("agenda")
    if obj.get("duration"):
        meeting.duration = int(obj["duration"])
    if obj.get("timezone"):
        meeting.timezone = obj["timezone"]
    if obj.get("start_time"):
        try:
            meeting.start_time = _local_start(obj["start_time"], meeting.timezone)
        except Exception:
            logger.info("Zoom meeting.updated start_time not understood")


async def _deauthorize(db: AsyncSession, payload: dict[str, Any]) -> None:
    user_id = str(payload.get("user_id") or "")
    account_id = str(payload.get("account_id") or "")
    stmt = select(ZoomConnection)
    if user_id:
        stmt = stmt.where(ZoomConnection.zoom_user_id == user_id)
    elif account_id:
        stmt = stmt.where(ZoomConnection.zoom_account_id == account_id)
    else:
        return
    for connection in (await db.execute(stmt)).scalars().all():
        connection.status = ZoomConnectionStatus.REAUTH_REQUIRED.value
        connection.access_token_encrypted = ""
        connection.refresh_token_encrypted = ""
        connection.last_error = "The Zoom app was removed from the Zoom account"
        connection.update_date = _now()
        db.add(connection)
    await db.commit()


async def process(db: AsyncSession, raw_body: bytes, headers) -> tuple[int, dict[str, Any]]:
    """Verify and handle one delivery → (HTTP status, JSON body)."""
    secret = get_zoom_config().webhook_secret_token or ""
    try:
        verify_request(raw_body, headers.get("x-zm-request-timestamp"), headers.get("x-zm-signature"), secret)
    except WebhookRejected as exc:
        logger.warning("Zoom webhook rejected: %s", exc)
        return 401, {"detail": "invalid signature"}
    try:
        body = json.loads(raw_body or b"{}")
    except ValueError:
        return 400, {"detail": "invalid JSON"}

    if body.get("event") == "endpoint.url_validation":
        plain = str((body.get("payload") or {}).get("plainToken") or "")
        if not plain:
            return 400, {"detail": "missing plainToken"}
        return 200, url_validation_response(plain, secret)

    try:
        result = await handle_event(db, body)
    except Exception:
        # Let Zoom retry later; details stay in the log.
        logger.exception("Zoom webhook %s failed", body.get("event"))
        await db.rollback()
        return 500, {"detail": "processing failed"}
    return 200, {"status": result}
