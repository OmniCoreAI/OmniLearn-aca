"""Zoom attendance: participant segments → LMS students.

Segments arrive from ``meeting.participant_joined/left`` webhooks and can be
re-pulled from Zoom (past meeting participants) by a host. A participant is
tied to an LMS user only by:

1. ``customer_key`` — signed by the LMS when it issued that user's join
   signature (``signature.customer_key``), so it can't be forged; or
2. the Zoom-verified email of a signed-in Zoom user, when it belongs to an LMS
   user who is a host or enrolled in the lecture.

Display names are never used for matching: anyone can type any name.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.integrations.zoom import AttendanceRead, AttendanceRow, OnlineMeeting, OnlineMeetingAttendance
from src.db.users import User
from src.services.integrations.zoom import errors
from src.services.integrations.zoom.lectures import (
    Lecture,
    enrolled_count,
    is_enrolled,
    lecture_for_meeting,
    require_host,
)
from src.services.integrations.zoom.signature import user_id_from_customer_key

logger = logging.getLogger(__name__)


def _parse_zoom_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _seconds(join: Optional[str], leave: Optional[str]) -> int:
    start, end = _parse_zoom_time(join), _parse_zoom_time(leave)
    if not start or not end or end < start:
        return 0
    return int((end - start).total_seconds())


def _participant_ref(p: dict[str, Any]) -> str:
    # ``user_id`` is Zoom's per-meeting participant id, present in both the
    # webhook and the past-participants report.
    return str(p.get("user_id") or p.get("participant_user_id") or p.get("participant_uuid") or p.get("id") or "")


async def match_user(
    db: AsyncSession, meeting: OnlineMeeting, lecture: Optional[Lecture], participant: dict[str, Any]
) -> tuple[Optional[int], str]:
    key_user = user_id_from_customer_key(participant.get("customer_key"), meeting.meeting_uuid)
    if key_user:
        return key_user, "customer_key"
    email = (participant.get("email") or participant.get("user_email") or "").strip().lower()
    if email and lecture is not None:
        user = (
            await db.execute(select(User).where(func.lower(User.email) == email))
        ).scalars().first()
        if user and user.id and (user.id in lecture.teacher_ids or await is_enrolled(db, user.id, lecture)):
            return user.id, "email"
    return None, "none"


async def record_join(
    db: AsyncSession, meeting: OnlineMeeting, participant: dict[str, Any], lecture: Optional[Lecture] = None
) -> Optional[OnlineMeetingAttendance]:
    ref = _participant_ref(participant)
    join_time = participant.get("join_time")
    if not ref or not join_time:
        return None
    segment_key = f"{ref}@{join_time}"
    row = (
        await db.execute(
            select(OnlineMeetingAttendance).where(
                OnlineMeetingAttendance.meeting_id == meeting.id,
                OnlineMeetingAttendance.segment_key == segment_key,
            )
        )
    ).scalars().first()
    if lecture is None:
        lecture = await lecture_for_meeting(db, meeting)
    user_id, method = await match_user(db, meeting, lecture, participant)
    stamp = str(datetime.now())
    if row is None:
        row = OnlineMeetingAttendance(
            meeting_id=meeting.id,
            org_id=meeting.org_id,
            segment_key=segment_key,
            join_time=join_time,
            creation_date=stamp,
        )
    # Never downgrade an existing reliable match (reports lack customer_key).
    if user_id and (row.user_id is None or method == "customer_key"):
        row.user_id = user_id
        row.match_method = method
    row.zoom_participant_uuid = participant.get("participant_uuid") or row.zoom_participant_uuid
    row.zoom_user_id = str(participant.get("id") or "") or row.zoom_user_id
    row.name = (participant.get("user_name") or participant.get("name") or row.name or "")[:200] or None
    row.email = (participant.get("email") or participant.get("user_email") or row.email or None)
    if participant.get("leave_time"):
        row.leave_time = participant["leave_time"]
        row.duration_seconds = int(participant.get("duration") or 0) or _seconds(row.join_time, row.leave_time)
    row.update_date = stamp
    db.add(row)
    return row


async def record_leave(db: AsyncSession, meeting: OnlineMeeting, participant: dict[str, Any]) -> None:
    ref = _participant_ref(participant)
    leave_time = participant.get("leave_time")
    if not ref or not leave_time:
        return
    if participant.get("join_time"):
        row = await record_join(db, meeting, participant)
        if row:
            return
    # Close the participant's latest open segment.
    rows = (
        await db.execute(
            select(OnlineMeetingAttendance).where(
                OnlineMeetingAttendance.meeting_id == meeting.id,
                OnlineMeetingAttendance.segment_key.startswith(f"{ref}@"),  # type: ignore[attr-defined]
                OnlineMeetingAttendance.leave_time.is_(None),  # type: ignore[union-attr]
            )
        )
    ).scalars().all()
    if not rows:
        return
    row = max(rows, key=lambda r: r.join_time or "")
    row.leave_time = leave_time
    row.duration_seconds = _seconds(row.join_time, leave_time)
    row.update_date = str(datetime.now())
    db.add(row)


async def _host_meeting(request: Request, db: AsyncSession, current_user, meeting_uuid: str):
    meeting = (
        await db.execute(select(OnlineMeeting).where(OnlineMeeting.meeting_uuid == meeting_uuid))
    ).scalars().first()
    if not meeting:
        raise errors.meeting_not_found()
    lecture = await lecture_for_meeting(db, meeting)
    if not lecture:
        raise errors.meeting_not_found()
    await require_host(request, db, current_user, lecture)
    return meeting, lecture


async def get_attendance(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> AttendanceRead:
    meeting, lecture = await _host_meeting(request, db, current_user, meeting_uuid)
    return await build_attendance(db, meeting, lecture)


async def build_attendance(db: AsyncSession, meeting: OnlineMeeting, lecture: Lecture) -> AttendanceRead:
    segments = (
        await db.execute(
            select(OnlineMeetingAttendance).where(OnlineMeetingAttendance.meeting_id == meeting.id)
        )
    ).scalars().all()
    groups: dict[str, list[OnlineMeetingAttendance]] = defaultdict(list)
    for s in segments:
        key = f"user:{s.user_id}" if s.user_id else f"anon:{(s.email or '').lower() or s.segment_key.split('@')[0]}"
        groups[key].append(s)

    user_ids = [s.user_id for s in segments if s.user_id]
    users = {
        u.id: u
        for u in (
            await db.execute(select(User).where(User.id.in_(user_ids or [-1])))  # type: ignore[union-attr]
        ).scalars().all()
    }
    rows: list[AttendanceRow] = []
    unmatched = 0
    attended_ids: set[int] = set()
    for key, segs in groups.items():
        first = segs[0]
        user = users.get(first.user_id) if first.user_id else None
        if user and user.id not in lecture.teacher_ids:
            attended_ids.add(user.id)
        if not user:
            unmatched += 1
        joins = [s.join_time for s in segs if s.join_time]
        leaves = [s.leave_time for s in segs if s.leave_time]
        rows.append(
            AttendanceRow(
                user_uuid=user.user_uuid if user else None,
                name=(" ".join(p for p in (user.first_name, user.last_name) if p) or user.username) if user else first.name,
                email=str(user.email) if user else first.email,
                match_method=first.match_method if user else "none",
                segments=len(segs),
                first_join=min(joins) if joins else None,
                last_leave=max(leaves) if leaves else None,
                duration_seconds=sum(s.duration_seconds for s in segs),
            )
        )
    rows.sort(key=lambda r: (r.user_uuid is None, -(r.duration_seconds or 0)))
    return AttendanceRead(
        meeting_uuid=meeting.meeting_uuid,
        rows=rows,
        unmatched=unmatched,
        enrolled=await enrolled_count(db, lecture),
        attended=len(attended_ids),
    )


async def sync_attendance(request: Request, db: AsyncSession, current_user, meeting_uuid: str) -> AttendanceRead:
    """Pull the participants of the meeting's last instance from Zoom."""
    from src.services.integrations.zoom.service import rate_limit, require_client

    meeting, lecture = await _host_meeting(request, db, current_user, meeting_uuid)
    rate_limit(f"zoom_attendance_sync:{meeting.id}", 10, 300)
    if not meeting.zoom_uuid and not meeting.zoom_meeting_id:
        return await build_attendance(db, meeting, lecture)
    client = await require_client(db, meeting.org_id)
    participants = await client.get_past_participants(meeting.zoom_uuid or meeting.zoom_meeting_id)
    for p in participants:
        await record_join(db, meeting, p, lecture)
    meeting.last_synced_at = str(datetime.now())
    db.add(meeting)
    await db.commit()
    return await build_attendance(db, meeting, lecture)
