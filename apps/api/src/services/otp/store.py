"""
One-time codes for sign-in, password reset and phone verification, kept in
Redis. A code is 6 digits, stored only as a SHA-256 hash, valid CODE_TTL
seconds, single use, and gone after MAX_ATTEMPTS wrong guesses. Sending is
throttled per address/number (COOLDOWN between codes, HOURLY_CAP an hour)
and per client IP (IP_HOURLY_CAP requests an hour).

Callers pass identifiers already normalised: a lower-cased email or an
E.164 phone number.
"""

import hashlib
import hmac
import secrets
from typing import Literal, Optional

from fastapi import HTTPException

from src.core.redis import get_redis_client

Purpose = Literal["login", "reset", "verify_phone"]
Channel = Literal["email", "sms"]

CODE_TTL = 600
COOLDOWN = 60
MAX_ATTEMPTS = 5
HOURLY_CAP = 5
IP_HOURLY_CAP = 20
_HOUR = 3600


def _redis():
    r = get_redis_client()
    if r is None:
        raise HTTPException(status_code=503, detail="Verification codes are unavailable right now")
    return r


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _code_key(purpose: str, channel: str, identifier: str) -> str:
    return f"otp:{purpose}:{channel}:{identifier}"


def _count_within_hour(r, key: str) -> int:
    count = r.incr(key)
    if count == 1:
        r.expire(key, _HOUR)
    return count


def issue_code(purpose: Purpose, channel: Channel, identifier: str) -> Optional[str]:
    """A new code for `identifier` (replacing any earlier one), or None while
    the resend cooldown runs or the hourly cap is reached."""
    r = _redis()
    cooldown_key = f"otp_cd:{purpose}:{channel}:{identifier}"
    # SET NX doubles as the cooldown check: it fails while the last one lives.
    if not r.set(cooldown_key, 1, ex=COOLDOWN, nx=True):
        return None
    if _count_within_hour(r, f"otp_hr:{channel}:{identifier}") > HOURLY_CAP:
        return None

    code = f"{secrets.randbelow(10**6):06d}"
    key = _code_key(purpose, channel, identifier)
    r.delete(key)
    r.hset(key, mapping={"code_hash": _hash(code), "attempts": 0})
    r.expire(key, CODE_TTL)
    return code


def verify_code(purpose: Purpose, channel: Channel, identifier: str, code: str) -> bool:
    """True once for the right code; the code is then used up. Wrong guesses
    count, and the code is dropped at MAX_ATTEMPTS."""
    r = _redis()
    key = _code_key(purpose, channel, identifier)
    stored = r.hget(key, "code_hash")
    if stored is None:
        return False
    if hmac.compare_digest(stored.decode(), _hash(code.strip())):
        r.delete(key)
        return True
    if r.hincrby(key, "attempts", 1) >= MAX_ATTEMPTS:
        r.delete(key)
    return False


def allow_ip(ip: str) -> bool:
    """False once `ip` has asked for IP_HOURLY_CAP codes within the hour."""
    return _count_within_hour(_redis(), f"otp_ip:{ip}") <= IP_HOURLY_CAP
