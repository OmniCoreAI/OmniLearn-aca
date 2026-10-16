"""Zoom cloud recordings attached to lectures.

``recording.completed`` (or a host's manual sync) stores the Zoom-hosted share
link, its passcode (encrypted) and the list of files with their Zoom player
links. Files are not downloaded or re-hosted: viewers watch on Zoom's player,
which keeps Zoom's own sharing and passcode rules in force. Students see a
lecture's recordings only after a host publishes them, and only while
enrolled (registered or completed).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.integrations.zoom import (
    OnlineMeeting,
    OnlineMeetingRecording,
    RecordingFileRead,
    RecordingsRead,
    RecordingStatus,
)
from src.services.integrations.zoom import errors
from src.services.integrations.zoom.lectures import (
    RECORDING_ENROLLMENT,
    can_host,
    is_enrolled,
    lecture_for_meeting,
    person_id,
    require_host,
)
from src.services.webhooks.crypto import decrypt_secret, encrypt_secret

# Recording types not worth listing to students (Zoom's raw extras).
HIDDEN_FILE_TYPES = {"TIMELINE", "CC", "CSV", "SUMMARY"}


async def store_recordings(db: AsyncSession, meeting: OnlineMeeting, payload: dict[str, Any]) -> None:
    """Apply a Zoom recording object (webhook ``object`` or GET recordings body)."""
    files = payload.get("recording_files") or []
    if payload.get("share_url"):
        meeting.recording_share_url = payload["share_url"]
    passcode = payload.get("recording_play_passcode") or payload.get("password")
    if passcode:
        meeting.recording_password_encrypted = encrypt_secret(str(passcode))
    stamp = str(datetime.now())
    for f in files:
        file_id = str(f.get("id") or "")
        if not file_id:
            continue
        row = (
            await db.execute(
                select(OnlineMeetingRecording).where(
                    OnlineMeetingRecording.meeting_id == meeting.id,
                    OnlineMeetingRecording.zoom_file_id == file_id,
                )
            )
        ).scalars().first() or OnlineMeetingRecording(
            meeting_id=meeting.id, org_id=meeting.org_id, zoom_file_id=file_id, creation_date=stamp
        )
        row.recording_type = f.get("recording_type")
        row.file_type = f.get("file_type")
        row.file_size = int(f["file_size"]) if f.get("file_size") is not None else None
        row.play_url = f.get("play_url")
        row.recording_start = f.get("recording_start")
        row.recording_end = f.get("recording_end")
        row.status = f.get("status")
        db.add(row)
    if files:
        meeting.recording_status = RecordingStatus.AVAILABLE.value
    meeting.update_date = stamp
    db.add(meeting)


async def get_recordings(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> RecordingsRead:
    meeting = (
        await db.execute(select(OnlineMeeting).where(OnlineMeeting.meeting_uuid == meeting_uuid))
    ).scalars().first()
    if not meeting:
        raise errors.meeting_not_found()
    lecture = await lecture_for_meeting(db, meeting)
    if not lecture:
        raise errors.meeting_not_found()
    host = await can_host(request, db, current_user, lecture)
    if not host:
        user_id = person_id(current_user)
        if not user_id or not await is_enrolled(db, user_id, lecture, RECORDING_ENROLLMENT):
            raise errors.not_enrolled()
        if not meeting.recordings_published:
            raise errors.forbidden("The instructor has not shared this recording yet.")
    return await build_recordings(db, meeting, include_all=host)


async def build_recordings(db: AsyncSession, meeting: OnlineMeeting, include_all: bool) -> RecordingsRead:
    rows = (
        await db.execute(
            select(OnlineMeetingRecording)
            .where(OnlineMeetingRecording.meeting_id == meeting.id)
            .order_by(OnlineMeetingRecording.recording_start)  # type: ignore[arg-type]
        )
    ).scalars().all()
    password = None
    if meeting.recording_password_encrypted:
        try:
            password = decrypt_secret(meeting.recording_password_encrypted)
        except Exception:
            password = None
    return RecordingsRead(
        meeting_uuid=meeting.meeting_uuid,
        recording_status=meeting.recording_status,
        published=meeting.recordings_published,
        share_url=meeting.recording_share_url,
        password=password,
        files=[
            RecordingFileRead(
                recording_type=r.recording_type,
                file_type=r.file_type,
                file_size=r.file_size,
                play_url=r.play_url,
                recording_start=r.recording_start,
                recording_end=r.recording_end,
            )
            for r in rows
            if include_all or (r.file_type or "").upper() not in HIDDEN_FILE_TYPES
        ],
    )


async def sync_recordings(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> RecordingsRead:
    from src.services.integrations.zoom.service import rate_limit, require_client

    meeting = (
        await db.execute(select(OnlineMeeting).where(OnlineMeeting.meeting_uuid == meeting_uuid))
    ).scalars().first()
    if not meeting:
        raise errors.meeting_not_found()
    lecture = await lecture_for_meeting(db, meeting)
    if not lecture:
        raise errors.meeting_not_found()
    await require_host(request, db, current_user, lecture)
    rate_limit(f"zoom_recording_sync:{meeting.id}", 10, 300)
    client = await require_client(db, meeting.org_id)
    body = await client.get_recordings(meeting.zoom_uuid or meeting.zoom_meeting_id)
    if body:
        await store_recordings(db, meeting, body)
    meeting.last_synced_at = str(datetime.now())
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return await build_recordings(db, meeting, include_all=True)

