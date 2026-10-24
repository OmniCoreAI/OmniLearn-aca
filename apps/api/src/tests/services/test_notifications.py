"""Communication: safe rendering, template lookup, delivery log, SMS drivers, reminders."""
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException
from sqlmodel import select

from config.config import SMSConfig
from src.db.academic.course_profiles import CourseAcademicProfile, CourseScheduleSession
from src.db.administration.audience import AudienceAssignmentCreate
from src.db.administration.notifications import (
    NotificationLog,
    NotificationOverrideSet,
    NotificationPreviewRequest,
    NotificationTemplateCreate,
    NotificationTemplateUpdate,
)
from src.db.trail_runs import TrailRun
from src.db.trails import Trail
from src.db.users import User
from src.services.administration import audience as aud_svc
from src.services.administration.settings import put_setting
from src.services.notifications import dispatcher, events, reminders, sms
from src.services.notifications import templates as tpl_svc
from src.services.notifications.render import (
    render_text,
    sanitize_html,
    sms_segments,
    unknown_variables,
)


class Outbox:
    def __init__(self):
        self.emails = []
        self.sms = []

    def email(self, to, subject, html, sender_name):
        self.emails.append({"to": to, "subject": subject, "html": html, "sender": sender_name})
        return {"id": "ok"}

    async def text(self, to, text):
        self.sms.append({"to": to, "text": text})
        return sms.SMSResult(ok=True)


@pytest.fixture
def outbox(monkeypatch):
    box = Outbox()
    monkeypatch.setattr(dispatcher, "email_transport", box.email)
    monkeypatch.setattr(dispatcher, "sms_transport", box.text)
    return box


async def _template(db, admin_user, org, **extra):
    data = dict(
        channel="email",
        event_key="course_assigned",
        name="Assigned (EN)",
        subject="New: {{course_name}}",
        body="<p>Hi {{user_first_name}}, open <a href='{{course_url}}'>{{course_name}}</a></p>",
        language="en",
        is_default_for_event=True,
    )
    data.update(extra)
    return await tpl_svc.create_template(db, admin_user, org.id, NotificationTemplateCreate(**data))


async def _logs(db, event_key=None):
    stmt = select(NotificationLog)
    if event_key:
        stmt = stmt.where(NotificationLog.event_key == event_key)
    return (await db.execute(stmt.order_by(NotificationLog.id))).scalars().all()


class TestRender:
    def test_values_are_escaped_and_nothing_is_evaluated(self):
        body = "<p>{{user_first_name}} {{ 7*7 }} {% if x %}{{__class__}}</p>"
        out = render_text(body, {"user_first_name": "<script>alert(1)</script>"}, escape=True)
        assert "<script>" not in out
        assert "&lt;script&gt;alert(1)&lt;/script&gt;" in out
        assert "{{ 7*7 }}" in out and "49" not in out
        assert "{% if x %}" in out
        # SMS / subjects are plain text.
        assert render_text("Hi {{name}}", {"name": "<b>"}, escape=False) == "Hi <b>"

    def test_sanitize_keeps_placeholders_and_drops_active_content(self):
        dirty = (
            '<p onclick="x()">Hi</p><script>alert(1)</script><img src="javascript:alert(1)" onerror="x()">'
            '<a href="{{course_url}}" target="_blank">Go</a><a href="javascript:evil()">bad</a>'
            '<iframe src="https://evil"></iframe><span style="background:url(javascript:x)">s</span><custom>kept text</custom>'
        )
        clean = sanitize_html(dirty)
        for bad in ("onclick", "<script", "onerror", "javascript:", "<iframe", "url("):
            assert bad not in clean
        assert 'href="{{course_url}}"' in clean and 'rel="noopener noreferrer"' in clean
        assert "kept text" in clean and "<custom>" not in clean

    def test_unknown_variables_and_sms_segments(self):
        assert unknown_variables(["{{course_name}} {{nope}}", "{{user_email}}"], ["course_name", "user_email"]) == ["nope"]
        assert sms_segments("a" * 160) == 1 and sms_segments("a" * 161) == 2
        assert sms_segments("م" * 70) == 1 and sms_segments("م" * 71) == 2

    def test_phone_normalization(self):
        assert sms.normalize_phone("010 1234 5678") == "+201012345678"
        assert sms.normalize_phone("00201012345678") == "+201012345678"
        assert sms.normalize_phone("abc") is None


class TestTemplates:
    @pytest.mark.asyncio
    async def test_crud_default_switch_and_validation(self, db, org, admin_user, regular_user):
        first = await _template(db, admin_user, org)
        assert first.is_default_for_event and first.event_label == "Training assigned"
        second = await _template(db, admin_user, org, name="Assigned v2")
        refreshed = await tpl_svc.get_template(db, admin_user, first.template_uuid)
        assert refreshed.is_default_for_event is False and second.is_default_for_event is True

        copy = await tpl_svc.duplicate_template(db, admin_user, second.template_uuid)
        assert copy.status == "inactive" and copy.is_default_for_event is False

        with pytest.raises(HTTPException) as exc:
            await _template(db, admin_user, org, subject="")
        assert exc.value.status_code == 400
        with pytest.raises(HTTPException) as exc:
            await _template(db, admin_user, org, event_key="nope")
        assert exc.value.status_code == 400
        with pytest.raises(HTTPException) as exc:
            await tpl_svc.list_templates(db, regular_user, org.id)
        assert exc.value.status_code == 403

        bad = await _template(db, admin_user, org, name="xss", body="<p>x</p><script>steal()</script>")
        assert "<script" not in bad.body

        catalog = await tpl_svc.get_catalog(db, admin_user, org.id)
        assigned = next(e for e in catalog if e.key == "course_assigned")
        assert assigned.custom_templates == {"email": 1}
        assert next(e for e in catalog if e.key == "password_reset").required is True

    @pytest.mark.asyncio
    async def test_preview_reports_unknown_variables(self, db, org, admin_user):
        result = await tpl_svc.preview(
            db, admin_user, org.id,
            NotificationPreviewRequest(channel="email", event_key="course_assigned", subject="{{course_name}}", body="<p>{{oops}} {{user_first_name}}</p>"),
        )
        assert result.subject == "Cybersecurity Fundamentals"
        assert "Mona" in result.html and result.unknown_variables == ["oops"]
        sms_preview = await tpl_svc.preview(
            db, admin_user, org.id, NotificationPreviewRequest(channel="sms", event_key="course_assigned", body="مرحبا {{user_first_name}}", language="ar"),
        )
        assert sms_preview.text == "مرحبا Mona" and sms_preview.sms_segments == 1

    @pytest.mark.asyncio
    async def test_send_test_uses_callers_email(self, db, org, admin_user, outbox):
        template = await _template(db, admin_user, org)
        log = await tpl_svc.send_test(db, admin_user, template.template_uuid, MagicMock(to=None))
        assert log.status == "sent" and log.recipient == "admin@test.com"
        assert outbox.emails[0]["subject"].startswith("[TEST] New: Cybersecurity")


class TestLookupOrder:
    @pytest.mark.asyncio
    async def test_override_then_default_then_other_language(self, db, org, admin_user, course):
        ar = await _template(db, admin_user, org, name="AR", language="ar", subject="عربي")
        found = await dispatcher.resolve_template(db, org.id, "course_assigned", "email", "en")
        assert found.template_uuid == ar.template_uuid  # only an Arabic default exists
        en = await _template(db, admin_user, org, name="EN")
        assert (await dispatcher.resolve_template(db, org.id, "course_assigned", "email", "en")).template_uuid == en.template_uuid
        special = await _template(db, admin_user, org, name="Special", is_default_for_event=False)
        await tpl_svc.set_override(
            db, admin_user,
            NotificationOverrideSet(resource_type="course", resource_uuid=course.course_uuid, event_key="course_assigned", channel="email", template_uuid=special.template_uuid),
        )
        chosen = await dispatcher.resolve_template(db, org.id, "course_assigned", "email", "en", ("course", course.course_uuid))
        assert chosen.template_uuid == special.template_uuid
        # Inactive templates are ignored.
        await tpl_svc.update_template(db, admin_user, special.template_uuid, NotificationTemplateUpdate(status="inactive"))
        chosen = await dispatcher.resolve_template(db, org.id, "course_assigned", "email", "en", ("course", course.course_uuid))
        assert chosen.template_uuid == en.template_uuid
        with pytest.raises(HTTPException):
            await tpl_svc.set_override(
                db, admin_user,
                NotificationOverrideSet(resource_type="course", resource_uuid=course.course_uuid, event_key="course_completed", channel="email", template_uuid=special.template_uuid),
            )


class TestSendEventEmail:
    @pytest.mark.asyncio
    async def test_builtin_email_unchanged_without_template(self, db, org, admin_user, outbox):
        fallback = MagicMock(return_value={"id": "builtin"})
        user = await db.get(User, admin_user.id)
        result = await dispatcher.send_event_email(db, org.id, "invitation", to="a@b.com", user=user, fallback=fallback)
        assert result == {"id": "builtin"} and fallback.call_count == 1 and outbox.emails == []
        assert [log.status for log in await _logs(db, "invitation")] == ["sent"]

    @pytest.mark.asyncio
    async def test_org_template_replaces_builtin(self, db, org, admin_user, outbox):
        await _template(db, admin_user, org, event_key="password_reset", subject="Code {{reset_code}}", body="<p>{{reset_code}}</p>")
        fallback = MagicMock()
        user = await db.get(User, admin_user.id)
        await dispatcher.send_event_email(db, org.id, "password_reset", to="a@b.com", user=user, fallback=fallback, variables={"reset_code": "123456"})
        fallback.assert_not_called()
        assert outbox.emails[0]["subject"] == "Code 123456" and "123456" in outbox.emails[0]["html"]

    @pytest.mark.asyncio
    async def test_disabled_event_is_skipped_but_security_emails_are_not(self, db, org, admin_user):
        await put_setting(db, admin_user, org.id, "notifications", {"events": {"invitation": {"email": False}, "password_reset": {"email": False}}})
        fallback = MagicMock(return_value=True)
        await dispatcher.send_event_email(db, org.id, "invitation", to="a@b.com", fallback=fallback)
        fallback.assert_not_called()
        await dispatcher.send_event_email(db, org.id, "password_reset", to="a@b.com", fallback=fallback)
        fallback.assert_called_once()

    @pytest.mark.asyncio
    async def test_provider_errors_still_raise_for_security_emails(self, db, org, admin_user):
        def boom():
            raise HTTPException(status_code=503, detail="down")

        with pytest.raises(HTTPException):
            await dispatcher.send_event_email(db, org.id, "password_reset", to="a@b.com", fallback=boom)
        assert [log.status for log in await _logs(db, "password_reset")] == ["failed"]


class TestNotify:
    @pytest.mark.asyncio
    async def test_logs_dedupes_and_respects_channels(self, db, org, admin_user, regular_user, course, outbox):
        await _template(db, admin_user, org)
        sent = await dispatcher.notify(db, org.id, "course_assigned", [regular_user.id], {"course_name": "Cyber"}, dedupe_prefix="x")
        assert sent == 1
        assert outbox.emails[0]["to"] == "regular@test.com" and outbox.emails[0]["subject"] == "New: Cyber"
        assert await dispatcher.notify(db, org.id, "course_assigned", [regular_user.id], {}, dedupe_prefix="x") == 0

        # course_enrolled is off by default.
        assert await dispatcher.notify(db, org.id, "course_enrolled", [regular_user.id], {}) == 0

        # SMS: enabled, but the user has no phone → skipped entry.
        await put_setting(db, admin_user, org.id, "notifications", {"events": {"course_completed": {"email": False, "sms": True}}})
        assert await dispatcher.notify(db, org.id, "course_completed", [regular_user.id], {"course_name": "Cyber"}) == 0
        assert [(log.channel, log.status) for log in await _logs(db, "course_completed")] == [("sms", "skipped")]
        user = await db.get(User, regular_user.id)
        user.extra_metadata = {"phone": "01012345678"}
        db.add(user)
        await db.commit()
        assert await dispatcher.notify(db, org.id, "course_completed", [regular_user.id], {"course_name": "Cyber"}) == 1
        assert outbox.sms[0]["to"] == "+201012345678" and "Cyber" in outbox.sms[0]["text"]

    @pytest.mark.asyncio
    async def test_failures_are_logged_not_raised(self, db, org, regular_user, monkeypatch):
        def broken(*_a, **_k):
            raise RuntimeError("smtp down")

        monkeypatch.setattr(dispatcher, "email_transport", broken)
        assert await dispatcher.notify(db, org.id, "course_assigned", [regular_user.id], {"course_name": "C"}) == 1
        log = (await _logs(db, "course_assigned"))[0]
        assert log.status == "failed" and "smtp down" in log.error and log.attempts == 3

    @pytest.mark.asyncio
    async def test_log_listing(self, db, org, admin_user, regular_user, outbox):
        await dispatcher.notify(db, org.id, "course_assigned", [regular_user.id], {"course_name": "C"})
        page = await tpl_svc.list_log(db, admin_user, org.id, channel="email")
        assert page.total == 1 and page.items[0].status == "sent" and page.counts == {"sent": 1}


class TestSMSDrivers:
    @pytest.mark.asyncio
    async def test_http_gateway_posts_json_escaped_body(self, monkeypatch):
        captured = {}

        async def fake_request(self, method, url, content=None, headers=None):
            captured.update(method=method, url=url, body=json.loads(content), headers=headers)
            return httpx.Response(200, text="ok")

        monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
        monkeypatch.setattr("src.services.utils.ssrf_guard.resolve_and_validate_url", lambda url: {"1.2.3.4"})
        monkeypatch.setattr("src.services.utils.ssrf_guard.assert_connected_peer_allowed", lambda resp, ips: None)
        cfg = SMSConfig(provider="http", sender="ACADEMY", http_url="https://sms.example.com/send", http_headers={"X-Key": "k"})
        result = await sms.send_sms("+201012345678", 'Hello "you"\nمرحبا', cfg)
        assert result.ok
        assert captured["body"] == {"to": "+201012345678", "message": 'Hello "you"\nمرحبا', "sender": "ACADEMY"}
        assert captured["headers"]["X-Key"] == "k"

    @pytest.mark.asyncio
    async def test_gateway_errors_and_disabled(self, monkeypatch):
        async def fake_request(self, method, url, content=None, headers=None):
            return httpx.Response(500, text="nope")

        monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
        monkeypatch.setattr("src.services.utils.ssrf_guard.resolve_and_validate_url", lambda url: {"1.2.3.4"})
        monkeypatch.setattr("src.services.utils.ssrf_guard.assert_connected_peer_allowed", lambda resp, ips: None)
        result = await sms.send_sms("+2010", "x", SMSConfig(provider="http", http_url="https://sms.example.com"))
        assert not result.ok and "500" in result.error
        disabled = await sms.send_sms("+2010", "x", SMSConfig())
        assert disabled.skipped
        assert (await sms.send_sms("+2010", "x", SMSConfig(provider="log"))).ok

    @pytest.mark.asyncio
    async def test_blocked_gateway_url(self):
        from src.services.utils.ssrf_guard import SSRFBlockedError

        with patch("src.services.utils.ssrf_guard.resolve_and_validate_url", side_effect=SSRFBlockedError("private")):
            result = await sms.send_sms("+2010", "x", SMSConfig(provider="http", http_url="http://127.0.0.1/x"))
        assert not result.ok and "blocked" in result.error


class TestRemindersAndEvents:
    @pytest.mark.asyncio
    async def test_session_reminder_sent_once(self, db, org, admin_user, regular_user, course, outbox):
        profile = CourseAcademicProfile(course_id=course.id, org_id=org.id, profile_uuid="profile_x")
        db.add(profile)
        await db.commit()
        start = (datetime.now() + timedelta(hours=20)).strftime("%Y-%m-%dT%H:%M")
        db.add(CourseScheduleSession(profile_id=profile.id, org_id=org.id, title="Session 1", start_date=start, location="Room A", session_uuid="session_1", update_date=""))
        trail = Trail(org_id=org.id, user_id=regular_user.id, trail_uuid="trail_1")
        db.add(trail)
        await db.commit()
        db.add(TrailRun(trail_id=trail.id, course_id=course.id, org_id=org.id, user_id=regular_user.id, creation_date="x", update_date="x"))
        await db.commit()

        assert await reminders.scan_reminders(db) == 1
        assert "Session 1" in outbox.emails[0]["subject"]
        assert await reminders.scan_reminders(db) == 0
        # Not yet within a 2-hour-only window.
        await put_setting(db, admin_user, org.id, "notifications", {"session_reminder_hours": [2]})
        assert await reminders.scan_reminders(db) == 0

    @pytest.mark.asyncio
    async def test_course_assigned_from_audience_sync(self, db, org, admin_user, regular_user, course, outbox):
        events.register()
        course.public = False
        db.add(course)
        await db.commit()
        with patch("src.services.admin.admin.track", new=AsyncMock()):
            await aud_svc.create_assignment(
                db, admin_user,
                AudienceAssignmentCreate(resource_type="course", resource_uuid=course.course_uuid, audience_type="user", audience_uuid=regular_user.user_uuid, due_date="2026-12-01"),
            )
        assert len(outbox.emails) == 1 and outbox.emails[0]["to"] == "regular@test.com"
        log = (await _logs(db, "course_assigned"))[0]
        assert log.resource_uuid == course.course_uuid and log.dedupe_key.startswith("course_assigned:course:")
