"""Zoom online meetings: the org's Zoom connection and lecture meetings.

``ZoomConnection`` is the organization's link to one Zoom user (OAuth tokens
encrypted at rest). An ``OnlineMeeting`` belongs to exactly one existing
lecture — a course class session or a postgraduate offering session — so the
course, roster, instructor and title stay where they already live and are
never copied here. Attendance segments and recording files hang off the
meeting and are filled by Zoom webhooks (or a manual sync).

Zoom meeting ids exceed 32 bits, so they are stored as strings.
"""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class ZoomConnectionStatus(str, Enum):
    ACTIVE = "active"
    # The refresh token stopped working (revoked in Zoom, app removed…).
    REAUTH_REQUIRED = "reauth_required"


class ZoomConnection(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("org_id", name="uq_zoomconnection_org"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    zoom_user_id: str = ""
    zoom_account_id: str = Field(default="", index=True)
    zoom_email: Optional[str] = None
    zoom_display_name: Optional[str] = None
    # Fernet-encrypted (src.services.webhooks.crypto); never returned by the API.
    access_token_encrypted: str = ""
    refresh_token_encrypted: str = ""
    token_expires_at: int = 0  # unix seconds
    scopes: Optional[str] = None
    status: str = Field(default=ZoomConnectionStatus.ACTIVE.value)
    last_error: Optional[str] = None
    connected_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    connection_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class OnlineMeetingStatus(str, Enum):
    UPCOMING = "upcoming"
    LIVE = "live"
    ENDED = "ended"
    CANCELED = "canceled"
    # Zoom rejected a change or the meeting vanished on Zoom's side.
    ERROR = "error"


class RecordingStatus(str, Enum):
    NONE = "none"
    RECORDING = "recording"
    PROCESSING = "processing"
    AVAILABLE = "available"


class OnlineMeeting(SQLModel, table=True):
    __table_args__ = (
        Index("ix_onlinemeeting_zoom_meeting_id", "zoom_meeting_id"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # Exactly one lecture: a course class session or an offering session.
    course_session_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("courseschedulesession.id", ondelete="CASCADE"), nullable=True, unique=True
        ),
    )
    offering_session_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("offeringsession.id", ondelete="CASCADE"), nullable=True, unique=True
        ),
    )
    connection_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("zoomconnection.id", ondelete="SET NULL"), nullable=True),
    )
    zoom_meeting_id: str = ""
    zoom_uuid: Optional[str] = None
    topic: str = ""
    agenda: Optional[str] = None
    # Local wall-clock start ("YYYY-MM-DDTHH:MM:SS") in ``timezone``.
    start_time: str = ""
    duration: int = 60  # minutes
    timezone: str = "UTC"
    # 2 = scheduled, 8 = recurring with fixed time (Zoom meeting types).
    meeting_type: int = 2
    recurrence: Optional[dict] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    # The Zoom meeting settings we asked for (waiting room, video, recording…).
    settings: Optional[dict] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    join_url: str = ""
    # Meeting passcode, Fernet-encrypted. start_url is never stored: it embeds
    # a short-lived host token, so it is fetched fresh when a host starts.
    password_encrypted: Optional[str] = None
    host_email: Optional[str] = None
    status: str = Field(default=OnlineMeetingStatus.UPCOMING.value)
    status_detail: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    recording_status: str = Field(default=RecordingStatus.NONE.value)
    recording_share_url: Optional[str] = None
    recording_password_encrypted: Optional[str] = None
    # Recordings are shown to enrolled students only after the host publishes them.
    recordings_published: bool = False
    created_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    meeting_uuid: str = Field(default="", index=True)
    last_synced_at: Optional[str] = None
    creation_date: str = ""
    update_date: str = ""


class OnlineMeetingAttendance(SQLModel, table=True):
    """One join → leave segment of a participant (people can rejoin)."""

    __table_args__ = (
        UniqueConstraint("meeting_id", "segment_key", name="uq_onlinemeetingattendance_segment"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(
        sa_column=Column(Integer, ForeignKey("onlinemeeting.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    # The LMS user, when the participant could be identified reliably.
    user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    # customer_key (signed by us at join) | email (Zoom-verified) | none
    match_method: str = "none"
    zoom_participant_uuid: Optional[str] = None
    zoom_user_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    # "<participant>@<join_time>": webhooks and report syncs land on the same row.
    segment_key: str = ""
    join_time: Optional[str] = None
    leave_time: Optional[str] = None
    duration_seconds: int = 0
    creation_date: str = ""
    update_date: str = ""


class OnlineMeetingRecording(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("meeting_id", "zoom_file_id", name="uq_onlinemeetingrecording_file"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(
        sa_column=Column(Integer, ForeignKey("onlinemeeting.id", ondelete="CASCADE"), index=True)
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    zoom_file_id: str = ""
    recording_type: Optional[str] = None  # shared_screen_with_speaker_view, audio_only…
    file_type: Optional[str] = None  # MP4, M4A, TRANSCRIPT…
    file_size: Optional[int] = None
    # Zoom-hosted player page (honours the recording passcode and Zoom's sharing rules).
    play_url: Optional[str] = None
    recording_start: Optional[str] = None
    recording_end: Optional[str] = None
    status: Optional[str] = None
    creation_date: str = ""


# ------------------------------- DTOs --------------------------------------


class ZoomConnectionRead(SQLModel):
    configured: bool
    sdk_configured: bool
    webhooks_configured: bool
    connected: bool
    status: Optional[str] = None
    zoom_email: Optional[str] = None
    zoom_display_name: Optional[str] = None
    zoom_account_id: Optional[str] = None
    scopes: Optional[str] = None
    last_error: Optional[str] = None
    connected_at: Optional[str] = None
    # Shown to admins so they can paste it into the Zoom app.
    webhook_path: str = "/api/v1/integrations/zoom/webhook"


class ZoomAuthorizeRead(SQLModel):
    authorize_url: str


class ZoomOAuthCallback(SQLModel):
    code: str
    state: str


class RecurrenceInput(SQLModel):
    # 1 daily, 2 weekly, 3 monthly
    type: int
    repeat_interval: int = 1
    # Weekly: "1,3" (1 = Sunday … 7 = Saturday)
    weekly_days: Optional[str] = None
    # Monthly on a day of the month
    monthly_day: Optional[int] = None
    end_times: Optional[int] = None
    end_date_time: Optional[str] = None


class MeetingSettingsInput(SQLModel):
    waiting_room: bool = True
    join_before_host: bool = False
    host_video: bool = True
    participant_video: bool = False
    mute_upon_entry: bool = True
    # none | local | cloud
    auto_recording: str = "none"
    # Only signed-in Zoom users may join (off: students join from the LMS as guests).
    meeting_authentication: bool = False
    # Comma-separated emails of Zoom users in the same account.
    alternative_hosts: Optional[str] = None
    allow_multiple_devices: bool = False


class OnlineMeetingCreate(SQLModel):
    topic: Optional[str] = None  # defaults to the lecture title
    agenda: Optional[str] = None
    start_time: Optional[str] = None  # defaults to the lecture start
    duration: Optional[int] = None  # minutes; defaults to the lecture length
    timezone: str = "UTC"
    password: Optional[str] = None  # generated by Zoom when empty
    recurrence: Optional[RecurrenceInput] = None
    settings: MeetingSettingsInput = MeetingSettingsInput()


class OnlineMeetingUpdate(SQLModel):
    topic: Optional[str] = None
    agenda: Optional[str] = None
    start_time: Optional[str] = None
    duration: Optional[int] = None
    timezone: Optional[str] = None
    password: Optional[str] = None
    recurrence: Optional[RecurrenceInput] = None
    clear_recurrence: bool = False
    settings: Optional[MeetingSettingsInput] = None
    recordings_published: Optional[bool] = None


class LectureRef(SQLModel):
    kind: str  # course_session | offering_session
    session_uuid: str
    title: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    course_uuid: Optional[str] = None
    course_name: Optional[str] = None
    offering_uuid: Optional[str] = None
    offering_code: Optional[str] = None


class OnlineMeetingRead(SQLModel):
    meeting_uuid: str
    lecture: LectureRef
    topic: str
    agenda: Optional[str] = None
    start_time: str
    duration: int
    timezone: str
    meeting_type: int
    recurrence: Optional[dict] = None
    status: str
    status_detail: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    recording_status: str
    recordings_published: bool = False
    # What the caller may do; host-only fields are omitted for attendees.
    viewer_is_host: bool = False
    viewer_can_join: bool = False
    join_url: Optional[str] = None
    zoom_meeting_id: Optional[str] = None
    password: Optional[str] = None
    settings: Optional[dict] = None
    host_email: Optional[str] = None
    last_synced_at: Optional[str] = None
    creation_date: str = ""
    update_date: str = ""


class StartMeetingRead(SQLModel):
    start_url: str


class JoinTokenRead(SQLModel):
    """Everything the embedded Meeting SDK needs to join (or start, for hosts)."""

    sdk_key: str
    sdk_version: str
    signature: str
    meeting_number: str
    password: str = ""
    role: int  # 0 attendee, 1 host
    user_name: str
    user_email: Optional[str] = None
    customer_key: str
    zak: Optional[str] = None
    # Fallback when embedding fails (attendees get the join link only).
    join_url: Optional[str] = None


class AttendanceRow(SQLModel):
    user_uuid: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    match_method: str
    segments: int
    first_join: Optional[str] = None
    last_leave: Optional[str] = None
    duration_seconds: int


class AttendanceRead(SQLModel):
    meeting_uuid: str
    rows: List[AttendanceRow] = []
    unmatched: int = 0
    enrolled: int = 0
    attended: int = 0


class RecordingFileRead(SQLModel):
    recording_type: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    play_url: Optional[str] = None
    recording_start: Optional[str] = None
    recording_end: Optional[str] = None


class RecordingsRead(SQLModel):
    meeting_uuid: str
    recording_status: str
    published: bool
    share_url: Optional[str] = None
    password: Optional[str] = None
    files: List[RecordingFileRead] = []
