"""
SMS through Brevo's transactional SMS API (OMNILEARN_BREVO_API_KEY /
OMNILEARN_SMS_SENDER). Like send_email, a failure never raises: it's logged
and reported as False, so the caller decides what the user sees.
"""

import logging

import httpx

from config.config import get_omnilearn_config

logger = logging.getLogger(__name__)

BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms"
_TIMEOUT = 10


async def send_sms(to_e164: str, content: str, tag: str = "otp") -> bool:
    """Sends `content` to an E.164 number; True once Brevo accepted it."""
    sms = get_omnilearn_config().otp_sms_config
    if not sms.brevo_api_key or not sms.sms_sender:
        logger.warning("SMS not sent: OMNILEARN_BREVO_API_KEY / OMNILEARN_SMS_SENDER not set")
        return False

    payload = {
        "sender": sms.sms_sender,
        # Brevo wants the number with its country code, without the "+".
        "recipient": to_e164.lstrip("+"),
        "content": content,
        "type": "transactional",
        "tag": tag,
        # Non-Latin text (Arabic) must be sent as Unicode.
        "unicodeEnabled": not content.isascii(),
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                BREVO_SMS_URL,
                headers={"api-key": sms.brevo_api_key, "accept": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as e:
        logger.error("Brevo SMS request failed: %s", e)
        return False

    if response.status_code != 201:
        logger.error("Brevo SMS rejected (%s): %s", response.status_code, response.text[:300])
        return False
    return True
