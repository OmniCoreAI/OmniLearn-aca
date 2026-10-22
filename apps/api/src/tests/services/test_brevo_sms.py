"""Tests for src/services/sms/brevo.py (Brevo transactional SMS)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx

from src.services.sms.brevo import BREVO_SMS_URL, send_sms


def _config(key="k", sender="ACA"):
    return SimpleNamespace(sms_config=SimpleNamespace(brevo_api_key=key, sms_sender=sender))


def _patched(response=None, error=None, key="k"):
    post = AsyncMock(side_effect=error) if error else AsyncMock(return_value=response)
    return (
        patch("src.services.sms.brevo.get_omnilearn_config", return_value=_config(key=key)),
        patch.object(httpx.AsyncClient, "post", post),
        post,
    )


async def test_send_sms_posts_brevo_payload():
    cfg, client, post = _patched(httpx.Response(201, json={"messageId": 1}))
    with cfg, client:
        assert await send_sms("+201001234567", "Code 123456") is True
    assert BREVO_SMS_URL == "https://api.brevo.com/v3/transactionalSMS/sms"
    assert post.call_args.args[0] == BREVO_SMS_URL
    assert post.call_args.kwargs["headers"]["api-key"] == "k"
    assert post.call_args.kwargs["json"] == {
        "sender": "ACA",
        "recipient": "201001234567",
        "content": "Code 123456",
        "type": "transactional",
        "tag": "otp",
        "unicodeEnabled": False,
    }


async def test_send_sms_enables_unicode_for_arabic():
    cfg, client, post = _patched(httpx.Response(201, json={"messageId": 1}))
    with cfg, client:
        assert await send_sms("+201001234567", "رمزك 123456") is True
    assert post.call_args.kwargs["json"]["unicodeEnabled"] is True


async def test_send_sms_without_key_sends_nothing():
    cfg, client, post = _patched(httpx.Response(201), key=None)
    with cfg, client:
        assert await send_sms("+201001234567", "Code 123456") is False
    post.assert_not_called()


async def test_send_sms_failure_returns_false():
    cfg, client, _ = _patched(httpx.Response(402, json={"message": "Not enough credits"}))
    with cfg, client:
        assert await send_sms("+201001234567", "Code 123456") is False
    cfg, client, _ = _patched(error=httpx.ConnectError("down"))
    with cfg, client:
        assert await send_sms("+201001234567", "Code 123456") is False
