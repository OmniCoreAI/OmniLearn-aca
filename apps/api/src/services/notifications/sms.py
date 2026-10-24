"""SMS providers: ``log`` (development), a generic ``http`` gateway, ``twilio``.

Configuration comes only from environment variables (``config.SMSConfig``).
The HTTP gateway URL goes through the SSRF guard like outgoing webhooks.
"""
import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from config.config import SMSConfig, get_omnilearn_config

logger = logging.getLogger(__name__)

_PHONE_CLEAN_RE = re.compile(r"[\s\-().]")


@dataclass
class SMSResult:
    ok: bool
    error: Optional[str] = None
    skipped: bool = False


def get_sms_config() -> SMSConfig:
    return get_omnilearn_config().sms_config


def normalize_phone(raw: Optional[str], default_country_code: str = "20") -> Optional[str]:
    """E.164-ish normalization (Egypt default: 01xxxxxxxxx → +201xxxxxxxxx)."""
    if not raw:
        return None
    phone = _PHONE_CLEAN_RE.sub("", str(raw))
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if not phone.startswith("+"):
        if phone.startswith("0"):
            phone = f"+{default_country_code}{phone[1:]}"
        else:
            phone = f"+{phone}"
    digits = phone[1:]
    if not digits.isdigit() or not 8 <= len(digits) <= 15:
        return None
    return phone


def _fill(template: str, values: dict, json_escape: bool) -> str:
    def repl(match: re.Match) -> str:
        value = str(values.get(match.group(1), ""))
        return json.dumps(value)[1:-1] if json_escape else value

    return re.sub(r"\{\{\s*(to|message|sender)\s*\}\}", repl, template)


async def _send_http(cfg: SMSConfig, to: str, message: str) -> SMSResult:
    from src.services.utils.ssrf_guard import (
        SSRFBlockedError,
        assert_connected_peer_allowed,
        resolve_and_validate_url,
    )

    if not cfg.http_url:
        return SMSResult(ok=False, error="OMNILEARN_SMS_HTTP_URL is not set")
    try:
        validated_ips = await asyncio.to_thread(resolve_and_validate_url, cfg.http_url)
    except SSRFBlockedError as exc:
        return SMSResult(ok=False, error=f"SMS gateway URL blocked: {exc}")
    values = {"to": to, "message": message, "sender": cfg.sender or ""}
    is_json = "json" in (cfg.http_content_type or "").lower()
    body = _fill(cfg.http_body_template, values, json_escape=is_json)
    headers = {"Content-Type": cfg.http_content_type, **cfg.http_headers}
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        resp = await client.request(cfg.http_method or "POST", cfg.http_url, content=body.encode("utf-8"), headers=headers)
    try:
        assert_connected_peer_allowed(resp, validated_ips)
    except SSRFBlockedError as exc:
        return SMSResult(ok=False, error=f"SMS gateway URL blocked: {exc}")
    if 200 <= resp.status_code < 300:
        return SMSResult(ok=True)
    return SMSResult(ok=False, error=f"Gateway responded {resp.status_code}: {resp.text[:200]}")


async def _send_twilio(cfg: SMSConfig, to: str, message: str) -> SMSResult:
    if not (cfg.twilio_account_sid and cfg.twilio_auth_token and (cfg.twilio_from or cfg.sender)):
        return SMSResult(ok=False, error="Twilio is not fully configured")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{cfg.twilio_account_sid}/Messages.json"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            data={"From": cfg.twilio_from or cfg.sender, "To": to, "Body": message},
            auth=(cfg.twilio_account_sid, cfg.twilio_auth_token),
        )
    if 200 <= resp.status_code < 300:
        return SMSResult(ok=True)
    return SMSResult(ok=False, error=f"Twilio responded {resp.status_code}: {resp.text[:200]}")


async def send_sms(to: str, message: str, cfg: Optional[SMSConfig] = None) -> SMSResult:
    cfg = cfg or get_sms_config()
    if cfg.provider == "disabled":
        return SMSResult(ok=False, skipped=True, error="SMS is not configured")
    if cfg.provider == "log":
        logger.info("SMS (log driver) to %s: %s", to, message)
        return SMSResult(ok=True)
    try:
        if cfg.provider == "http":
            return await _send_http(cfg, to, message)
        if cfg.provider == "twilio":
            return await _send_twilio(cfg, to, message)
    except httpx.HTTPError as exc:
        return SMSResult(ok=False, error=f"SMS request failed: {exc}")
    return SMSResult(ok=False, skipped=True, error=f"Unknown SMS provider {cfg.provider}")
