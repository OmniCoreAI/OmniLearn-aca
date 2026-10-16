"""Meeting SDK signatures and participant keys.

The Meeting SDK join signature is an HS256 JWT signed with the SDK secret on
the server (``appKey`` = SDK/Client ID; ``mn`` and ``role`` must match the join
call). It is short-lived and generated only after the LMS has checked that the
caller may join (role 0) or host (role 1).

``customer_key`` is passed to ``join()`` and echoed back by Zoom in participant
webhooks and reports. It carries the LMS user id plus an HMAC so a student can
not claim another student's attendance by editing the join call: only keys we
signed are trusted when matching participants to LMS users.
"""
import hashlib
import hmac
import re
import time
from typing import Optional

import jwt

from config.config import ZoomConfig, get_omnilearn_config

SIGNATURE_TTL_SECONDS = 2 * 60 * 60  # Zoom accepts 30 min – 48 h
CUSTOMER_KEY_RE = re.compile(r"^u(\d{1,15})\.([0-9a-f]{16})$")  # ≤ 36 chars (Zoom limit)


def meeting_sdk_signature(cfg: ZoomConfig, meeting_number: str, role: int, now: Optional[int] = None) -> str:
    if role not in (0, 1):
        raise ValueError("role must be 0 (attendee) or 1 (host)")
    iat = (now if now is not None else int(time.time())) - 30  # tolerate clock skew
    exp = iat + SIGNATURE_TTL_SECONDS
    payload = {
        "appKey": cfg.meeting_sdk_key,
        "mn": str(meeting_number),
        "role": role,
        "iat": iat,
        "exp": exp,
        "tokenExp": exp,
    }
    return jwt.encode(payload, cfg.meeting_sdk_secret, algorithm="HS256")


def _key_secret() -> bytes:
    return get_omnilearn_config().security_config.auth_jwt_secret_key.encode()


def _mac(user_id: int, meeting_uuid: str) -> str:
    msg = f"zoom-participant:{meeting_uuid}:{user_id}".encode()
    return hmac.new(_key_secret(), msg, hashlib.sha256).hexdigest()[:16]


def customer_key(user_id: int, meeting_uuid: str) -> str:
    return f"u{user_id}.{_mac(user_id, meeting_uuid)}"


def user_id_from_customer_key(value: Optional[str], meeting_uuid: str) -> Optional[int]:
    """The LMS user id when the key is one we signed for this meeting."""
    if not value:
        return None
    match = CUSTOMER_KEY_RE.match(value.strip())
    if not match:
        return None
    user_id = int(match.group(1))
    if hmac.compare_digest(match.group(2), _mac(user_id, meeting_uuid)):
        return user_id
    return None
