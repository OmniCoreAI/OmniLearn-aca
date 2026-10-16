"""Zoom online meetings.

Connection (org administrators): status, connect (OAuth), callback, disconnect.
Lecture meetings (class instructors/admins host; enrolled students join):
create / read / update / cancel, start, SDK join tokens, attendance and
recordings. ``POST /webhook`` receives Zoom's signed event notifications and is
the only unauthenticated route.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.integrations.zoom import (
    AttendanceRead,
    JoinTokenRead,
    OnlineMeetingCreate,
    OnlineMeetingRead,
    OnlineMeetingUpdate,
    RecordingsRead,
    StartMeetingRead,
    ZoomAuthorizeRead,
    ZoomConnectionRead,
    ZoomOAuthCallback,
)
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.auth import get_current_user
from src.services.integrations.zoom import attendance, recordings, service, webhooks

router = APIRouter()

Principal = PublicUser | AnonymousUser | APITokenUser


def _signed_in(current_user: Principal) -> Principal:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user


# ----------------------------- Connection ---------------------------------


@router.get("/connection", response_model=ZoomConnectionRead, summary="Zoom connection status")
async def api_connection_status(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> ZoomConnectionRead:
    return await service.connection_status(db_session, org_id, _signed_in(current_user))


@router.post("/connect", response_model=ZoomAuthorizeRead, summary="Start connecting a Zoom account (OAuth)")
async def api_connect(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> ZoomAuthorizeRead:
    return await service.start_connect(db_session, org_id, _signed_in(current_user))


@router.post("/oauth/callback", response_model=ZoomConnectionRead, summary="Finish connecting Zoom")
async def api_oauth_callback(
    org_id: int,
    payload: ZoomOAuthCallback,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> ZoomConnectionRead:
    return await service.complete_connect(
        db_session, org_id, _signed_in(current_user), payload.code, payload.state
    )


@router.delete("/connection", summary="Disconnect Zoom")
async def api_disconnect(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> str:
    return await service.disconnect(db_session, org_id, _signed_in(current_user))


# ------------------------------ Webhook -----------------------------------


@router.post("/webhook", include_in_schema=False)
async def api_webhook(request: Request, db_session: AsyncSession = Depends(get_db_session)):
    raw = await request.body()
    status_code, body = await webhooks.process(db_session, raw, request.headers)
    return JSONResponse(status_code=status_code, content=body)


# ------------------------------ Meetings ----------------------------------


@router.get(
    "/lectures/{session_uuid}/meeting",
    response_model=Optional[OnlineMeetingRead],
    summary="The online meeting of a lecture (null when none)",
)
async def api_lecture_meeting(
    request: Request,
    session_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> Optional[OnlineMeetingRead]:
    return await service.get_lecture_meeting(request, db_session, _signed_in(current_user), session_uuid)


@router.post(
    "/lectures/{session_uuid}/meeting",
    response_model=OnlineMeetingRead,
    summary="Create the lecture's Zoom meeting",
)
async def api_create_meeting(
    request: Request,
    session_uuid: str,
    payload: OnlineMeetingCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> OnlineMeetingRead:
    return await service.create_meeting(request, db_session, _signed_in(current_user), session_uuid, payload)


@router.get("/courses/{course_uuid}/meetings", response_model=List[OnlineMeetingRead],
            summary="Online meetings of a course the caller can host or join")
async def api_course_meetings(
    request: Request,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> List[OnlineMeetingRead]:
    return await service.list_course_meetings(request, db_session, _signed_in(current_user), course_uuid)


@router.get("/meetings", response_model=List[OnlineMeetingRead],
            summary="Meetings the caller hosts (admins: all) or attends")
async def api_my_meetings(
    request: Request,
    org_id: int,
    include_past: bool = Query(default=False),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> List[OnlineMeetingRead]:
    return await service.list_my_meetings(request, db_session, _signed_in(current_user), org_id, include_past)


@router.get("/meetings/{meeting_uuid}", response_model=OnlineMeetingRead, summary="Meeting details")
async def api_get_meeting(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> OnlineMeetingRead:
    return await service.get_meeting(request, db_session, _signed_in(current_user), meeting_uuid)


@router.put("/meetings/{meeting_uuid}", response_model=OnlineMeetingRead, summary="Update a meeting")
async def api_update_meeting(
    request: Request,
    meeting_uuid: str,
    payload: OnlineMeetingUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> OnlineMeetingRead:
    return await service.update_meeting(request, db_session, _signed_in(current_user), meeting_uuid, payload)


@router.delete("/meetings/{meeting_uuid}", response_model=OnlineMeetingRead, summary="Cancel a meeting")
async def api_cancel_meeting(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> OnlineMeetingRead:
    return await service.cancel_meeting(request, db_session, _signed_in(current_user), meeting_uuid)


@router.post("/meetings/{meeting_uuid}/refresh", response_model=OnlineMeetingRead,
             summary="Re-read the meeting's status and schedule from Zoom")
async def api_refresh_meeting(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> OnlineMeetingRead:
    return await service.refresh_meeting(request, db_session, _signed_in(current_user), meeting_uuid)


@router.post("/meetings/{meeting_uuid}/start", response_model=StartMeetingRead,
             summary="Host link for opening the meeting in the Zoom app")
async def api_start_meeting(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> StartMeetingRead:
    return await service.start_meeting(request, db_session, _signed_in(current_user), meeting_uuid)


@router.post("/meetings/{meeting_uuid}/join-token", response_model=JoinTokenRead,
             summary="Meeting SDK signature for joining (or hosting) inside the LMS")
async def api_join_token(
    request: Request,
    meeting_uuid: str,
    as_host: bool = Query(default=False),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> JoinTokenRead:
    return await service.join_token(request, db_session, _signed_in(current_user), meeting_uuid, as_host)


@router.get("/meetings/{meeting_uuid}/attendance", response_model=AttendanceRead, summary="Meeting attendance")
async def api_attendance(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> AttendanceRead:
    return await attendance.get_attendance(request, db_session, _signed_in(current_user), meeting_uuid)


@router.post("/meetings/{meeting_uuid}/attendance/sync", response_model=AttendanceRead,
             summary="Pull participants of the meeting's last session from Zoom")
async def api_sync_attendance(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> AttendanceRead:
    return await attendance.sync_attendance(request, db_session, _signed_in(current_user), meeting_uuid)


@router.get("/meetings/{meeting_uuid}/recordings", response_model=RecordingsRead, summary="Meeting recordings")
async def api_recordings(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> RecordingsRead:
    return await recordings.get_recordings(request, db_session, _signed_in(current_user), meeting_uuid)


@router.post("/meetings/{meeting_uuid}/recordings/sync", response_model=RecordingsRead,
             summary="Pull the meeting's cloud recordings from Zoom")
async def api_sync_recordings(
    request: Request,
    meeting_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Principal = Depends(get_current_user),
) -> RecordingsRead:
    return await recordings.sync_recordings(request, db_session, _signed_in(current_user), meeting_uuid)
