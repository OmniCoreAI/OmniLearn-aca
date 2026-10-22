"""
One-time-code sign-in, password reset by code, and phone verification
(mounted at /auth/otp). Codes come from src/services/otp/store.py and go out
by email or SMS (Brevo).

Requests for a code always answer {"ok": true}, whether or not an account
matches, so they can't be used to find out who is registered. SMS sign-in and
reset only match phones that were verified.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.deployment_mode import get_deployment_mode
from src.core.events.database import get_db_session
from src.db.users import User, UserRead
from src.routers.auth import get_token_expiry_ms, set_auth_cookies
from src.security.auth import create_access_token, create_refresh_token
from src.services.email.utils import send_email
from src.services.otp.messages import Language, otp_email, otp_sms
from src.services.otp.phone_token import decode_phone_token, issue_phone_token  # noqa: F401
from src.services.otp.store import Channel, allow_ip, issue_code, verify_code
from src.services.phone import normalize_phone
from src.services.security.account_lockout import (
    check_account_locked,
    format_lockout_message,
    reset_failed_attempts,
    update_login_info,
)
from src.services.security.password_validation import validate_password_complexity
from src.services.security.rate_limiting import get_client_ip
from src.services.sms.brevo import send_sms
from src.services.users.password_reset import set_user_password

logger = logging.getLogger(__name__)
router = APIRouter()

_OK = {"ok": True}


class OtpRequest(BaseModel):
    channel: Channel
    identifier: str
    region: Optional[str] = None
    purpose: Literal["login", "reset"]
    language: Language = "ar"


class OtpLogin(BaseModel):
    channel: Channel
    identifier: str
    region: Optional[str] = None
    code: str


class OtpReset(OtpLogin):
    new_password: str


class PhoneCodeRequest(BaseModel):
    phone: str
    region: Optional[str] = "EG"
    language: Language = "ar"


class PhoneVerify(BaseModel):
    phone: str
    region: Optional[str] = "EG"
    code: str


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _guard_ip(request: Request) -> None:
    if not allow_ip(get_client_ip(request)):
        raise _error(429, "RATE_LIMITED", "Too many code requests. Please try again later.")


def _identifier(channel: Channel, raw: str, region: Optional[str]) -> Optional[str]:
    """Lower-cased email, or E.164 phone; None when it can't be one."""
    if channel == "email":
        value = raw.strip().lower()
        return value if "@" in value else None
    return normalize_phone(raw, region or "EG")


async def _find_user(db_session: AsyncSession, channel: Channel, identifier: str) -> Optional[User]:
    if channel == "email":
        statement = select(User).where(func.lower(User.email) == identifier)
    else:
        statement = select(User).where(User.phone == identifier, User.phone_verified == True)  # noqa: E712
    return (await db_session.execute(statement)).scalars().first()


async def _deliver(channel: Channel, user: User, purpose: str, language: str, code: str) -> None:
    """Sends the code; failures are only logged so the answer stays neutral."""
    if channel == "sms":
        if not await send_sms(user.phone, otp_sms(purpose, language, code)):
            logger.error("OTP SMS not delivered to user %s", user.user_uuid)
        return
    subject, body = otp_email(purpose, language, code)
    try:
        send_email(to=user.email, subject=subject, body=body)
    except HTTPException:
        logger.error("OTP email not delivered to user %s", user.user_uuid)


@router.post("/request", summary="Send a one-time sign-in or reset code")
async def api_request_code(
    request: Request, body: OtpRequest, db_session: AsyncSession = Depends(get_db_session)
):
    _guard_ip(request)
    identifier = _identifier(body.channel, body.identifier, body.region)
    if identifier:
        user = await _find_user(db_session, body.channel, identifier)
        if user:
            code = issue_code(body.purpose, body.channel, identifier)
            if code:
                await _deliver(body.channel, user, body.purpose, body.language, code)
    return _OK


@router.post("/login", summary="Sign in with a one-time code")
async def api_login_with_code(
    request: Request,
    response: Response,
    body: OtpLogin,
    db_session: AsyncSession = Depends(get_db_session),
):
    invalid = _error(status.HTTP_401_UNAUTHORIZED, "INVALID_CODE", "The code is wrong or has expired")
    identifier = _identifier(body.channel, body.identifier, body.region)
    if not identifier or not verify_code("login", body.channel, identifier, body.code):
        raise invalid
    user = await _find_user(db_session, body.channel, identifier)
    if not user:
        raise invalid

    # The same gates as password login (routers/auth.py).
    is_locked, remaining = check_account_locked(user)
    if is_locked and remaining:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "code": "ACCOUNT_LOCKED",
                "message": format_lockout_message(remaining),
                "retry_after": remaining,
            },
        )
    if not user.email_verified and get_deployment_mode() == "saas":
        raise _error(status.HTTP_403_FORBIDDEN, "EMAIL_NOT_VERIFIED", "Please verify your email address before logging in.")

    await reset_failed_attempts(user, db_session)
    await update_login_info(user, get_client_ip(request), db_session)

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    set_auth_cookies(response, access_token, refresh_token, request)
    return {
        "user": UserRead.model_validate(user),
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": get_token_expiry_ms(),
        },
    }


@router.post("/reset", summary="Set a new password with a one-time code")
async def api_reset_with_code(body: OtpReset, db_session: AsyncSession = Depends(get_db_session)):
    validation = validate_password_complexity(body.new_password)
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "WEAK_PASSWORD",
                "message": "Password does not meet security requirements",
                "errors": validation.errors,
                "requirements": validation.requirements,
            },
        )
    invalid = _error(400, "INVALID_CODE", "The code is wrong or has expired")
    identifier = _identifier(body.channel, body.identifier, body.region)
    if not identifier or not verify_code("reset", body.channel, identifier, body.code):
        raise invalid
    user = await _find_user(db_session, body.channel, identifier)
    if not user:
        raise invalid
    await set_user_password(db_session, user, body.new_password)
    return _OK


@router.post("/verify-phone/request", summary="Text a code to confirm a phone number")
async def api_request_phone_code(request: Request, body: PhoneCodeRequest):
    _guard_ip(request)
    phone = normalize_phone(body.phone, body.region)
    if not phone:
        raise _error(400, "INVALID_PHONE", "Enter a valid mobile number")
    code = issue_code("verify_phone", "sms", phone)
    if code and not await send_sms(phone, otp_sms("verify_phone", body.language, code)):
        logger.error("Phone verification SMS not delivered")
    return _OK


@router.post("/verify-phone", summary="Confirm a phone number with its code")
async def api_verify_phone(body: PhoneVerify):
    phone = normalize_phone(body.phone, body.region)
    if not phone:
        raise _error(400, "INVALID_PHONE", "Enter a valid mobile number")
    if not verify_code("verify_phone", "sms", phone, body.code):
        raise _error(400, "INVALID_CODE", "The code is wrong or has expired")
    return {"phone": phone, "phone_token": issue_phone_token(phone)}
