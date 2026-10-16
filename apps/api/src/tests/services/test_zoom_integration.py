"""Zoom online meetings: OAuth, tokens, meetings, permissions, SDK signatures,
webhooks, attendance and recordings. Zoom is mocked with httpx.MockTransport."""
import hashlib
import hmac
import json
import time
from datetime import datetime
from unittest.mock import patch

import httpx
import jwt
import pytest
from fastapi import HTTPException
from sqlmodel import select

from config.config import ZoomConfig
from src.security.rbac.nav_items import (
    DEFAULT_VISIBILITY_BY_ROLE_UUID,
    NAV_ITEM_IDS,
    ROLE_UUID_ACADEMY_ADMIN,
    ROLE_UUID_INSTRUCTOR,
    ROLE_UUID_ORG_COORDINATOR,
    ROLE_UUID_TRAINEE,
)
from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.integrations.zoom import (
    MeetingSettingsInput,
    OnlineMeeting,
    OnlineMeetingAttendance,
    OnlineMeetingCreate,
    OnlineMeetingUpdate,
    RecurrenceInput,
    ZoomConnection,
)
from src.db.trail_runs import TrailRun
from src.db.trails import Trail
from src.db.users import APITokenUser, PublicUser, User
from src.db.user_organizations import UserOrganization
from src.services.integrations.zoom import attendance, client as zoom_client, recordings, service, webhooks
from src.services.integrations.zoom.errors import ZoomError
from src.services.integrations.zoom.signature import (
    customer_key,
    meeting_sdk_signature,
    user_id_from_customer_key,
)
from src.services.webhooks.crypto import decrypt_secret, encrypt_secret

CFG = ZoomConfig(
    client_id="client-id",
    client_secret="client-secret",
    redirect_uri="https://lms.test/dash/administration/zoom/callback",
    webhook_secret_token="whsecret",
)
ZOOM_ID = "81234567890"


# ---------------------------------------------------------------------------
# Fake Zoom
# ---------------------------------------------------------------------------


class FakeZoom:
    """Records requests and answers like the Zoom OAuth + REST APIs."""

    def __init__(self):
        self.calls: list[tuple[str, str, dict]] = []
        self.meeting_status = "waiting"
        self.meeting_exists = True
        self.fail_with: tuple[int, dict] | None = None
        self.refresh_ok = True
        self.token_counter = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = {}
        if request.content:
            try:
                body = json.loads(request.content)
            except ValueError:
                body = dict(httpx.QueryParams(request.content.decode()))
        self.calls.append((request.method, request.url.path, body))
        path = request.url.path
        if path == "/oauth/token":
            if body.get("grant_type") == "refresh_token" and not self.refresh_ok:
                return httpx.Response(400, json={"reason": "Invalid Token!", "error": "invalid_grant"})
            self.token_counter += 1
            return httpx.Response(200, json={
                "access_token": f"access-{self.token_counter}",
                "refresh_token": f"refresh-{self.token_counter}",
                "expires_in": 3600,
                "scope": "meeting:write:meeting user:read:zak",
            })
        if path == "/oauth/revoke":
            return httpx.Response(200, json={"status": "success"})
        if self.fail_with:
            status, payload = self.fail_with
            return httpx.Response(status, json=payload, headers={"Retry-After": "7"} if status == 429 else {})
        if path == "/v2/users/me":
            return httpx.Response(200, json={
                "id": "zoomuser1", "account_id": "acct1", "email": "host@academy.test",
                "display_name": "Academy Host",
            })
        if path == "/v2/users/me/token":
            return httpx.Response(200, json={"token": "zak-token"})
        if path == "/v2/users/me/meetings" and request.method == "POST":
            return httpx.Response(201, json={
                "id": int(ZOOM_ID), "uuid": "abc==", "join_url": f"https://zoom.us/j/{ZOOM_ID}?pwd=x",
                "start_url": "https://zoom.us/s/start", "password": body.get("password") or "Zp4ss",
                "host_email": "host@academy.test",
            })
        if path.startswith("/v2/meetings/") and path.endswith("/recordings"):
            return httpx.Response(200, json=RECORDING_OBJECT)
        if path == f"/v2/meetings/{ZOOM_ID}":
            if not self.meeting_exists:
                return httpx.Response(404, json={"code": 3001, "message": "Meeting does not exist"})
            if request.method == "GET":
                return httpx.Response(200, json={
                    "id": int(ZOOM_ID), "uuid": "abc==", "status": self.meeting_status, "topic": "Live topic",
                    "duration": 45, "timezone": "Africa/Cairo", "start_time": "2030-01-05T08:00:00Z",
                    "join_url": f"https://zoom.us/j/{ZOOM_ID}?pwd=x", "start_url": "https://zoom.us/s/fresh",
                })
            return httpx.Response(204)
        if path.startswith("/v2/past_meetings/"):
            return httpx.Response(200, json={"participants": [
                {"id": "", "user_id": "16778240", "name": "Typed Name", "user_email": "student@test.com",
                 "join_time": "2030-01-05T08:01:00Z", "leave_time": "2030-01-05T08:41:00Z", "duration": 2400},
                {"id": "", "user_id": "16778241", "name": "Student Name", "user_email": "",
                 "join_time": "2030-01-05T08:02:00Z", "leave_time": "2030-01-05T08:10:00Z", "duration": 480},
            ]})
        return httpx.Response(404, json={"code": 404, "message": f"unexpected {request.method} {path}"})


RECORDING_OBJECT = {
    "id": int(ZOOM_ID),
    "share_url": "https://zoom.us/rec/share/xyz",
    "recording_play_passcode": "playpass",
    "recording_files": [
        {"id": "file1", "recording_type": "shared_screen_with_speaker_view", "file_type": "MP4",
         "file_size": 1000, "play_url": "https://zoom.us/rec/play/1", "status": "completed",
         "recording_start": "2030-01-05T08:00:00Z", "recording_end": "2030-01-05T08:45:00Z"},
        {"id": "file2", "recording_type": "timeline", "file_type": "TIMELINE", "status": "completed"},
    ],
}


@pytest.fixture
def fake_zoom():
    fake = FakeZoom()
    with patch.object(zoom_client, "_transport", httpx.MockTransport(fake.handler)), \
         patch.object(zoom_client, "get_zoom_config", return_value=CFG), \
         patch.object(service, "get_zoom_config", return_value=CFG), \
         patch.object(webhooks, "get_zoom_config", return_value=CFG), \
         patch.object(zoom_client, "get_redis_client", return_value=None), \
         patch.object(service, "check_rate_limit", side_effect=RuntimeError("no redis")):
        yield fake


@pytest.fixture
def course_rbac():
    """Course RBAC: only the org admin (user 1) may edit courses."""
    async def fake_check(request, db, user, resource_uuid, action, *a, **kw):
        if getattr(user, "id", None) != 1:
            raise HTTPException(status_code=403, detail="denied")
    with patch("src.services.integrations.zoom.lectures.check_resource_access", side_effect=fake_check):
        yield


async def _make_user(db, org, role, user_id, username, email):
    u = User(
        id=user_id, username=username, first_name=username.title(), last_name="Test", email=email,
        password="x", user_uuid=f"user_{username}", creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(u)
    db.add(UserOrganization(user_id=user_id, org_id=org.id, role_id=role.id,
                            creation_date=str(datetime.now()), update_date=str(datetime.now())))
    await db.commit()
    return PublicUser(id=u.id, username=u.username, first_name=u.first_name, last_name=u.last_name,
                      email=u.email, user_uuid=u.user_uuid)


@pytest.fixture
async def instructor(db, org, user_role):
    return await _make_user(db, org, user_role, 3, "teacher", "teacher@test.com")


@pytest.fixture
async def student(db, org, user_role):
    return await _make_user(db, org, user_role, 5, "student", "student@test.com")


@pytest.fixture
async def lecture(db, org, course, instructor, student):
    """A course with an instructor, an enrolled student and one class session."""
    profile = CourseAcademicProfile(
        id=1, course_id=course.id, org_id=org.id, instructor_id=instructor.id, profile_uuid="courseprofile_1"
    )
    db.add(profile)
    session = CourseScheduleSession(
        id=1, profile_id=1, org_id=org.id, title="Week 1 lecture",
        start_date="2030-01-05T10:00", end_date="2030-01-05T11:30", session_uuid="session_1",
    )
    db.add(session)
    db.add(Trail(id=1, org_id=org.id, user_id=student.id, trail_uuid="trail_1"))
    db.add(TrailRun(id=1, trail_id=1, course_id=course.id, org_id=org.id, user_id=student.id,
                    creation_date="x", update_date="x"))
    await db.commit()
    return session


@pytest.fixture
async def connection(db, org, admin_user):
    conn = ZoomConnection(
        org_id=org.id, zoom_user_id="zoomuser1", zoom_account_id="acct1", zoom_email="host@academy.test",
        access_token_encrypted=encrypt_secret("access-0"), refresh_token_encrypted=encrypt_secret("refresh-0"),
        token_expires_at=int(time.time()) + 3600, connection_uuid="zoomconnection_1",
        connected_by_id=admin_user.id, creation_date="x", update_date="x",
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn


async def _create(mock_request, db, user, **overrides):
    data = OnlineMeetingCreate(timezone="Africa/Cairo", **overrides)
    return await service.create_meeting(mock_request, db, user, "session_1", data)


# ---------------------------------------------------------------------------
# OAuth + tokens
# ---------------------------------------------------------------------------


class TestOAuth:
    async def test_connect_requires_admin(self, db, org, fake_zoom, regular_user):
        with pytest.raises(HTTPException) as exc:
            await service.start_connect(db, org.id, regular_user)
        assert exc.value.status_code == 403

    async def test_connect_and_callback(self, db, org, fake_zoom, admin_user):
        url = (await service.start_connect(db, org.id, admin_user)).authorize_url
        assert url.startswith("https://zoom.us/oauth/authorize?")
        state = httpx.URL(url).params["state"]
        read = await service.complete_connect(db, org.id, admin_user, "auth-code", state)
        assert read.connected and read.zoom_email == "host@academy.test"
        conn = await service.get_connection(db, org.id)
        # Tokens are stored encrypted, never in clear.
        assert "access-1" not in conn.access_token_encrypted
        assert decrypt_secret(conn.access_token_encrypted) == "access-1"
        assert conn.zoom_account_id == "acct1"

    async def test_callback_rejects_state_from_another_user(self, db, org, fake_zoom, admin_user):
        state = zoom_client.build_state(org.id, user_id=999)
        with pytest.raises(ZoomError) as exc:
            await service.complete_connect(db, org.id, admin_user, "auth-code", state)
        assert exc.value.code == "zoom_oauth_failed"

    async def test_callback_rejects_tampered_state(self, db, org, fake_zoom, admin_user):
        with pytest.raises(ZoomError):
            await service.complete_connect(db, org.id, admin_user, "code", "not-a-jwt")

    async def test_status_hides_account_details_from_members(self, db, org, fake_zoom, connection, regular_user):
        read = await service.connection_status(db, org.id, regular_user)
        assert read.connected and read.zoom_email is None

    async def test_disconnect_revokes_and_deletes(self, db, org, fake_zoom, connection, admin_user):
        await service.disconnect(db, org.id, admin_user)
        assert await service.get_connection(db, org.id) is None
        assert any(path == "/oauth/revoke" for _, path, _ in fake_zoom.calls)


class TestTokenRefresh:
    async def test_expired_token_is_refreshed_and_rotated(self, db, fake_zoom, connection):
        connection.token_expires_at = int(time.time()) - 10
        db.add(connection)
        await db.commit()
        token = await zoom_client.ZoomClient(db, connection, CFG).access_token()
        assert token == "access-1"
        assert decrypt_secret(connection.refresh_token_encrypted) == "refresh-1"

    async def test_rejected_refresh_marks_reauth_required(self, db, fake_zoom, connection):
        fake_zoom.refresh_ok = False
        connection.token_expires_at = 0
        db.add(connection)
        await db.commit()
        with pytest.raises(ZoomError) as exc:
            await zoom_client.ZoomClient(db, connection, CFG).access_token()
        assert exc.value.code == "zoom_reauth_required"
        assert connection.status == "reauth_required"

    async def test_401_retries_once_with_fresh_token(self, db, fake_zoom, connection):
        seen = []
        original = fake_zoom.handler

        def handler(request):
            if request.url.path == "/v2/users/me":
                seen.append(request.headers["authorization"])
                if len(seen) == 1:
                    return httpx.Response(401, json={"code": 124, "message": "Invalid access token."})
            return original(request)

        with patch.object(zoom_client, "_transport", httpx.MockTransport(handler)):
            me = await zoom_client.ZoomClient(db, connection, CFG).get_me()
        assert me["id"] == "zoomuser1"
        assert seen == ["Bearer access-0", "Bearer access-1"]


# ---------------------------------------------------------------------------
# Meetings + permissions
# ---------------------------------------------------------------------------


class TestMeetings:
    async def test_instructor_creates_meeting_from_lecture(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor
    ):
        read = await _create(
            mock_request, db, instructor, password="abc123",
            settings=MeetingSettingsInput(waiting_room=True, auto_recording="cloud"),
        )
        assert read.topic == "Week 1 lecture"  # defaults to the lecture title
        assert read.start_time == "2030-01-05T10:00:00" and read.duration == 90
        assert read.zoom_meeting_id == ZOOM_ID and read.password == "abc123" and read.viewer_is_host
        sent = next(b for m, p, b in fake_zoom.calls if p == "/v2/users/me/meetings")
        assert sent["settings"]["waiting_room"] is True and sent["settings"]["auto_recording"] == "cloud"
        assert sent["timezone"] == "Africa/Cairo" and sent["type"] == 2
        row = (await db.execute(select(OnlineMeeting))).scalars().one()
        assert row.password_encrypted and "abc123" not in row.password_encrypted

    async def test_recurring_meeting(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(
            mock_request, db, instructor, recurrence=RecurrenceInput(type=2, weekly_days="1,4", end_times=10)
        )
        assert read.meeting_type == 8
        sent = next(b for m, p, b in fake_zoom.calls if p == "/v2/users/me/meetings")
        assert sent["recurrence"] == {"type": 2, "repeat_interval": 1, "weekly_days": "1,4", "end_times": 10}

    async def test_student_cannot_create(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, student):
        with pytest.raises(ZoomError) as exc:
            await _create(mock_request, db, student)
        assert exc.value.status_code == 403

    async def test_api_token_cannot_host(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, org):
        token_user = APITokenUser(id=0, user_uuid="apitoken_x", username="api", org_id=org.id,
                                  rights={}, token_name="t", created_by_user_id=1)
        with pytest.raises(ZoomError):
            await _create(mock_request, db, token_user)

    async def test_create_without_connection(self, db, mock_request, fake_zoom, course_rbac, lecture, instructor):
        with pytest.raises(ZoomError) as exc:
            await _create(mock_request, db, instructor)
        assert exc.value.code == "zoom_not_connected"

    async def test_invalid_passcode_rejected_before_zoom(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor
    ):
        with pytest.raises(ZoomError) as exc:
            await _create(mock_request, db, instructor, password="has spaces!")
        assert exc.value.code == "invalid"
        assert not any(p == "/v2/users/me/meetings" for _, p, _ in fake_zoom.calls)

    async def test_one_meeting_per_lecture(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        await _create(mock_request, db, instructor)
        with pytest.raises(ZoomError) as exc:
            await _create(mock_request, db, instructor)
        assert exc.value.code == "meeting_exists"

    async def test_update_mirrors_to_zoom(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        updated = await service.update_meeting(
            mock_request, db, instructor, read.meeting_uuid, OnlineMeetingUpdate(topic="Moved", duration=30)
        )
        assert updated.topic == "Moved" and updated.duration == 30
        assert any(m == "PATCH" and p == f"/v2/meetings/{ZOOM_ID}" for m, p, _ in fake_zoom.calls)

    async def test_publishing_recordings_does_not_call_zoom(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor
    ):
        read = await _create(mock_request, db, instructor)
        before = len(fake_zoom.calls)
        updated = await service.update_meeting(
            mock_request, db, instructor, read.meeting_uuid, OnlineMeetingUpdate(recordings_published=True)
        )
        assert updated.recordings_published and len(fake_zoom.calls) == before

    async def test_update_when_deleted_in_zoom(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        fake_zoom.meeting_exists = False
        with pytest.raises(ZoomError) as exc:
            await service.update_meeting(mock_request, db, instructor, read.meeting_uuid, OnlineMeetingUpdate(topic="x"))
        assert exc.value.code == "zoom_meeting_gone"
        row = (await db.execute(select(OnlineMeeting))).scalars().one()
        assert row.status == "error" and row.status_detail == "deleted_in_zoom"

    async def test_cancel_deletes_in_zoom(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        canceled = await service.cancel_meeting(mock_request, db, instructor, read.meeting_uuid)
        assert canceled.status == "canceled"
        assert any(m == "DELETE" and p == f"/v2/meetings/{ZOOM_ID}" for m, p, _ in fake_zoom.calls)

    async def test_cancel_tolerates_meeting_already_gone(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor
    ):
        read = await _create(mock_request, db, instructor)
        fake_zoom.meeting_exists = False
        assert (await service.cancel_meeting(mock_request, db, instructor, read.meeting_uuid)).status == "canceled"

    async def test_recreate_after_cancel(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        await service.cancel_meeting(mock_request, db, instructor, read.meeting_uuid)
        again = await _create(mock_request, db, instructor)
        assert again.status == "upcoming" and again.meeting_uuid != read.meeting_uuid

    async def test_refresh_reads_status(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        fake_zoom.meeting_status = "started"
        refreshed = await service.refresh_meeting(mock_request, db, instructor, read.meeting_uuid)
        assert refreshed.status == "live" and refreshed.topic == "Live topic"
        assert refreshed.start_time == "2030-01-05T10:00:00"  # 08:00Z in Cairo (UTC+2)

    async def test_rate_limit_from_zoom(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        fake_zoom.fail_with = (429, {"code": 429, "message": "Too many requests"})
        with pytest.raises(ZoomError) as exc:
            await _create(mock_request, db, instructor)
        assert exc.value.status_code == 429 and exc.value.headers["Retry-After"] == "7"

    async def test_zoom_timeout_is_friendly(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        def boom(request):
            raise httpx.ReadTimeout("slow", request=request)
        with patch.object(zoom_client, "_transport", httpx.MockTransport(boom)):
            with pytest.raises(ZoomError) as exc:
                await _create(mock_request, db, instructor)
        assert exc.value.code == "zoom_timeout"

    async def test_start_url_only_for_hosts(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor, student):
        read = await _create(mock_request, db, instructor)
        assert (await service.start_meeting(mock_request, db, instructor, read.meeting_uuid)).start_url
        with pytest.raises(ZoomError):
            await service.start_meeting(mock_request, db, student, read.meeting_uuid)


class TestStudentAccess:
    async def test_enrolled_student_sees_join_info_but_no_host_fields(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor, student
    ):
        read = await _create(mock_request, db, instructor)
        seen = await service.get_meeting(mock_request, db, student, read.meeting_uuid)
        assert seen.viewer_can_join and not seen.viewer_is_host
        assert seen.join_url and seen.password is None and seen.zoom_meeting_id is None
        listed = await service.list_course_meetings(mock_request, db, student, "course_test")
        assert [m.meeting_uuid for m in listed] == [read.meeting_uuid]

    async def test_unenrolled_user_is_refused(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor, regular_user
    ):
        read = await _create(mock_request, db, instructor)
        with pytest.raises(ZoomError) as exc:
            await service.get_meeting(mock_request, db, regular_user, read.meeting_uuid)
        assert exc.value.code == "not_enrolled"
        with pytest.raises(ZoomError):
            await service.join_token(mock_request, db, regular_user, read.meeting_uuid)
        assert await service.list_course_meetings(mock_request, db, regular_user, "course_test") == []


# ---------------------------------------------------------------------------
# SDK signatures
# ---------------------------------------------------------------------------


class TestSignatures:
    def test_signature_claims(self):
        token = meeting_sdk_signature(CFG, ZOOM_ID, 0)
        claims = jwt.decode(token, "client-secret", algorithms=["HS256"])
        assert jwt.get_unverified_header(token)["alg"] == "HS256"
        assert claims["appKey"] == "client-id" and claims["mn"] == ZOOM_ID and claims["role"] == 0
        assert claims["exp"] - claims["iat"] == 7200 and claims["tokenExp"] == claims["exp"]

    def test_rejects_unknown_role(self):
        with pytest.raises(ValueError):
            meeting_sdk_signature(CFG, ZOOM_ID, 2)

    def test_customer_key_roundtrip_and_forgery(self):
        key = customer_key(5, "onlinemeeting_a")
        assert len(key) <= 36
        assert user_id_from_customer_key(key, "onlinemeeting_a") == 5
        assert user_id_from_customer_key(key, "onlinemeeting_b") is None  # other meeting
        forged = "u6." + key.split(".")[1]
        assert user_id_from_customer_key(forged, "onlinemeeting_a") is None

    async def test_student_gets_attendee_token_only(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor, student
    ):
        read = await _create(mock_request, db, instructor)
        token = await service.join_token(mock_request, db, student, read.meeting_uuid)
        assert token.role == 0 and token.zak is None and token.password == "Zp4ss"
        assert jwt.decode(token.signature, "client-secret", algorithms=["HS256"])["role"] == 0
        assert user_id_from_customer_key(token.customer_key, read.meeting_uuid) == student.id
        assert "client-secret" not in token.model_dump_json()
        with pytest.raises(ZoomError) as exc:
            await service.join_token(mock_request, db, student, read.meeting_uuid, as_host=True)
        assert exc.value.status_code == 403

    async def test_host_token_has_zak(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        token = await service.join_token(mock_request, db, instructor, read.meeting_uuid, as_host=True)
        assert token.role == 1 and token.zak == "zak-token"

    async def test_no_token_for_canceled_meeting(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor, student
    ):
        read = await _create(mock_request, db, instructor)
        await service.cancel_meeting(mock_request, db, instructor, read.meeting_uuid)
        with pytest.raises(ZoomError) as exc:
            await service.join_token(mock_request, db, student, read.meeting_uuid)
        assert exc.value.code == "meeting_canceled"


# ---------------------------------------------------------------------------
# Webhooks, attendance, recordings
# ---------------------------------------------------------------------------


def _signed(body: dict, secret: str = "whsecret", ts: int | None = None) -> tuple[bytes, dict]:
    raw = json.dumps(body).encode()
    ts = ts or int(time.time())
    sig = "v0=" + hmac.new(secret.encode(), f"v0:{ts}:{raw.decode()}".encode(), hashlib.sha256).hexdigest()
    return raw, {"x-zm-request-timestamp": str(ts), "x-zm-signature": sig}


class TestWebhooks:
    async def test_url_validation(self, db, fake_zoom):
        raw, headers = _signed({"event": "endpoint.url_validation", "payload": {"plainToken": "abc"}})
        status, body = await webhooks.process(db, raw, headers)
        expected = hmac.new(b"whsecret", b"abc", hashlib.sha256).hexdigest()
        assert status == 200 and body == {"plainToken": "abc", "encryptedToken": expected}

    async def test_bad_signature_rejected(self, db, fake_zoom):
        raw, headers = _signed({"event": "meeting.started"}, secret="wrong")
        assert (await webhooks.process(db, raw, headers))[0] == 401

    async def test_stale_timestamp_rejected(self, db, fake_zoom):
        raw, headers = _signed({"event": "meeting.started"}, ts=int(time.time()) - 3600)
        assert (await webhooks.process(db, raw, headers))[0] == 401

    async def test_lifecycle_attendance_and_recording(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor, student
    ):
        read = await _create(mock_request, db, instructor)
        obj = {"id": ZOOM_ID, "uuid": "inst1=="}
        key = customer_key(student.id, read.meeting_uuid)

        async def send(event, extra=None):
            raw, headers = _signed({"event": event, "payload": {"account_id": "acct1", "object": {**obj, **(extra or {})}}})
            return await webhooks.process(db, raw, headers)

        assert (await send("meeting.started"))[0] == 200
        assert (await service.get_meeting(mock_request, db, student, read.meeting_uuid)).status == "live"
        # Matched by our signed customer_key, even with a misleading display name.
        await send("meeting.participant_joined", {"participant": {
            "user_id": "100", "user_name": "Teacher Test", "customer_key": key, "join_time": "2030-01-05T08:00:00Z"}})
        await send("meeting.participant_left", {"participant": {
            "user_id": "100", "user_name": "Teacher Test", "customer_key": key, "leave_time": "2030-01-05T08:30:00Z"}})
        # Same display name as a real student but no key/email → stays unmatched.
        await send("meeting.participant_joined", {"participant": {
            "user_id": "101", "user_name": "Student Test", "join_time": "2030-01-05T08:05:00Z"}})
        # Duplicate delivery is idempotent.
        await send("meeting.participant_joined", {"participant": {
            "user_id": "101", "user_name": "Student Test", "join_time": "2030-01-05T08:05:00Z"}})
        await send("meeting.ended", {"end_time": "2030-01-05T09:00:00Z"})
        await send("recording.completed", RECORDING_OBJECT | obj)

        report = await attendance.get_attendance(mock_request, db, instructor, read.meeting_uuid)
        assert report.attended == 1 and report.enrolled == 1 and report.unmatched == 1
        matched = next(r for r in report.rows if r.user_uuid)
        assert matched.user_uuid == "user_student" and matched.duration_seconds == 1800
        assert matched.match_method == "customer_key"

        meeting = await service.get_meeting(mock_request, db, instructor, read.meeting_uuid)
        assert meeting.status == "ended" and meeting.recording_status == "available"

        # Students see recordings only once published, and without Zoom's raw extras.
        with pytest.raises(ZoomError):
            await recordings.get_recordings(mock_request, db, student, read.meeting_uuid)
        await service.update_meeting(mock_request, db, instructor, read.meeting_uuid,
                                     OnlineMeetingUpdate(recordings_published=True))
        recs = await recordings.get_recordings(mock_request, db, student, read.meeting_uuid)
        assert [f.file_type for f in recs.files] == ["MP4"] and recs.password == "playpass"

    async def test_event_from_other_account_ignored(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor
    ):
        await _create(mock_request, db, instructor)
        raw, headers = _signed({"event": "meeting.deleted", "payload": {"account_id": "someone-else", "object": {"id": ZOOM_ID}}})
        assert (await webhooks.process(db, raw, headers))[1] == {"status": "ignored"}

    async def test_deleted_in_zoom(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        raw, headers = _signed({"event": "meeting.deleted", "payload": {"account_id": "acct1", "object": {"id": ZOOM_ID}}})
        await webhooks.process(db, raw, headers)
        got = await service.get_meeting(mock_request, db, instructor, read.meeting_uuid)
        assert got.status == "canceled" and got.status_detail == "deleted_in_zoom"

    async def test_app_deauthorized_wipes_tokens(self, db, fake_zoom, connection):
        raw, headers = _signed({"event": "app_deauthorized", "payload": {"user_id": "zoomuser1", "account_id": "acct1"}})
        await webhooks.process(db, raw, headers)
        await db.refresh(connection)
        assert connection.status == "reauth_required" and connection.access_token_encrypted == ""


class TestSync:
    async def test_participant_sync_matches_by_verified_email_only(
        self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor
    ):
        read = await _create(mock_request, db, instructor)
        report = await attendance.sync_attendance(mock_request, db, instructor, read.meeting_uuid)
        # student@test.com (enrolled) matches; the name-only participant does not.
        assert report.attended == 1 and report.unmatched == 1
        rows = (await db.execute(select(OnlineMeetingAttendance))).scalars().all()
        assert {r.match_method for r in rows} == {"email", "none"}

    async def test_recording_sync(self, db, mock_request, fake_zoom, course_rbac, connection, lecture, instructor):
        read = await _create(mock_request, db, instructor)
        recs = await recordings.sync_recordings(mock_request, db, instructor, read.meeting_uuid)
        assert recs.share_url == "https://zoom.us/rec/share/xyz" and len(recs.files) == 2


class TestOnlineClassesSidebarItem:
    """The Online classes dashboard is a toggleable sidebar item, like the
    rest of the Classroom section: on for lecturers and admins by default,
    off for entity coordinators and trainees."""

    def test_is_a_registered_portal_item(self):
        assert "online-classes" in NAV_ITEM_IDS

    def test_default_visibility_by_role(self):
        assert "online-classes" in DEFAULT_VISIBILITY_BY_ROLE_UUID[ROLE_UUID_ACADEMY_ADMIN]
        assert "online-classes" in DEFAULT_VISIBILITY_BY_ROLE_UUID[ROLE_UUID_INSTRUCTOR]
        assert "online-classes" not in DEFAULT_VISIBILITY_BY_ROLE_UUID[ROLE_UUID_ORG_COORDINATOR]
        assert "online-classes" not in DEFAULT_VISIBILITY_BY_ROLE_UUID[ROLE_UUID_TRAINEE]
