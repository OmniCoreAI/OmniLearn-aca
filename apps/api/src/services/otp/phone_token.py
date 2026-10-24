"""
Proof that a phone number was confirmed by SMS code (routers/auth_otp.py's
/verify-phone), carried to sign-up (services/users/users.py). A short-lived
JWT with its own audience, so it can't pass as a sign-in token and sign-in
tokens can't pass as it.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from src.security.security import ALGORITHM, SECRET_KEY

PHONE_TOKEN_AUDIENCE = "phone-verification"
PHONE_TOKEN_TTL = timedelta(minutes=30)


def issue_phone_token(phone_e164: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": phone_e164, "aud": PHONE_TOKEN_AUDIENCE, "iat": now, "exp": now + PHONE_TOKEN_TTL},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_phone_token(token: str) -> Optional[str]:
    """The E.164 number the token vouches for, or None if invalid or expired."""
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience=PHONE_TOKEN_AUDIENCE)
    except jwt.PyJWTError:
        return None
    phone = claims.get("sub")
    return phone if isinstance(phone, str) and phone.startswith("+") else None
