"""Router tests for src/routers/auth_otp.py (one-time-code sign-in, SMS reset, phone verification)."""

import re
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import fakeredis
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlmodel import select

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, User
from src.routers import auth_otp
from src.routers.auth_otp import decode_phone_token, issue_phone_token
from src.security.auth import authenticate_user, get_current_user
from src.security.security import security_hash_password

PHONE = "+201001234567"


@pytest.fixture
def app(db):
    app = FastAPI()
    app.include_router(auth_otp.router, prefix="/api/v1/auth/otp")
    app.dependency_overrides[get_db_session] = lambda: db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def outbox():
    """Captures sent emails/SMS instead of sending them; Redis is a fake."""
    sent = {"email": MagicMock(return_value=True), "sms": AsyncMock(return_value=True)}
    with patch("src.services.otp.store.get_redis_client", return_value=fakeredis.FakeRedis()), \
         patch("src.routers.auth_otp.send_email", sent["email"]), \
         patch("src.routers.auth_otp.send_sms", sent["sms"]):
        yield sent


def _code_from(mock) -> str:
    call = mock.call_args
    text = " ".join(str(a) for a in [*call.args, *call.kwargs.values()])
    # In an email the code is an element's whole text (colours like #000000
    # are digits too); in an SMS it's the only 6-digit number.
    match = re.search(r">\s*(\d{6})\s*<", text) or re.search(r"\b(\d{6})\b", text)
    return match.group(1)


async def _user(db, **fields) -> User:
    now = str(datetime.now())
    user = User(
        username=fields.pop("username", "otpuser"),
        first_name="Otp",
        last_name="User",
        email=fields.pop("email", "otp@test.com"),
        password=security_hash_password("Old!Passw0rd"),
        user_uuid=fields.pop("user_uuid", "user_otp"),
        email_verified=True,
        creation_date=now,
        update_date=now,
        **fields,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def test_request_unknown_account_is_neutral(client, outbox):
    r = await client.post("/api/v1/auth/otp/request", json={
        "channel": "email", "identifier": "nobody@test.com", "purpose": "login",
    })
    assert r.status_code == 200 and r.json() == {"ok": True}
    outbox["email"].assert_not_called()


async def test_email_login_flow(client, outbox, db):
    await _user(db)
    r = await client.post("/api/v1/auth/otp/request", json={
        "channel": "email", "identifier": "OTP@Test.com", "purpose": "login",
    })
    assert r.json() == {"ok": True}
    code = _code_from(outbox["email"])

    body = {"channel": "email", "identifier": "otp@test.com", "code": code}
    r = await client.post("/api/v1/auth/otp/login", json=body)
    assert r.status_code == 200
    assert r.json()["tokens"]["access_token"]
    assert r.json()["user"]["email"] == "otp@test.com"
    assert "OL_access" in r.headers.get("set-cookie", "")

    r = await client.post("/api/v1/auth/otp/login", json=body)
    assert r.status_code == 401 and r.json()["detail"]["code"] == "INVALID_CODE"


async def test_sms_login_requires_verified_phone(client, outbox, db):
    user = await _user(db, phone=PHONE, phone_verified=False)
    req = {"channel": "sms", "identifier": "01001234567", "region": "EG", "purpose": "login"}
    assert (await client.post("/api/v1/auth/otp/request", json=req)).json() == {"ok": True}
    outbox["sms"].assert_not_called()

    user.phone_verified = True
    db.add(user)
    await db.commit()
    await client.post("/api/v1/auth/otp/request", json=req)
    assert outbox["sms"].call_args.args[0] == PHONE

    r = await client.post("/api/v1/auth/otp/login", json={
        "channel": "sms", "identifier": "0100 123 4567", "region": "EG", "code": _code_from(outbox["sms"]),
    })
    assert r.status_code == 200


async def test_login_locked_account_returns_423(client, outbox, db):
    until = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await _user(db, locked_until=until)
    await client.post("/api/v1/auth/otp/request", json={
        "channel": "email", "identifier": "otp@test.com", "purpose": "login",
    })
    r = await client.post("/api/v1/auth/otp/login", json={
        "channel": "email", "identifier": "otp@test.com", "code": _code_from(outbox["email"]),
    })
    assert r.status_code == 423 and r.json()["detail"]["code"] == "ACCOUNT_LOCKED"


async def test_sms_reset_changes_password(client, outbox, db):
    await _user(db, phone=PHONE, phone_verified=True)
    await client.post("/api/v1/auth/otp/request", json={
        "channel": "sms", "identifier": PHONE, "purpose": "reset",
    })
    r = await client.post("/api/v1/auth/otp/reset", json={
        "channel": "sms", "identifier": PHONE, "code": _code_from(outbox["sms"]),
        "new_password": "N3w!Passw0rd",
    })
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert await authenticate_user(MagicMock(), "otp@test.com", "N3w!Passw0rd", db)


async def test_reset_weak_password_rejected_before_code_check(client, outbox, db):
    r = await client.post("/api/v1/auth/otp/reset", json={
        "channel": "email", "identifier": "otp@test.com", "code": "000000", "new_password": "weak",
    })
    assert r.status_code == 400 and r.json()["detail"]["code"] == "WEAK_PASSWORD"


async def test_reset_with_wrong_code(client, outbox, db):
    await _user(db)
    r = await client.post("/api/v1/auth/otp/reset", json={
        "channel": "email", "identifier": "otp@test.com", "code": "000000", "new_password": "N3w!Passw0rd",
    })
    assert r.status_code == 400 and r.json()["detail"]["code"] == "INVALID_CODE"


async def test_verify_phone_issues_token(client, outbox):
    r = await client.post("/api/v1/auth/otp/verify-phone/request", json={"phone": "01001234567", "region": "EG"})
    assert r.json() == {"ok": True}
    r = await client.post("/api/v1/auth/otp/verify-phone", json={
        "phone": "01001234567", "region": "EG", "code": _code_from(outbox["sms"]),
    })
    assert r.status_code == 200 and r.json()["phone"] == PHONE
    assert decode_phone_token(r.json()["phone_token"]) == PHONE
    assert decode_phone_token("not-a-token") is None
    # A sign-in token for the same "sub" isn't a phone token.
    from src.security.auth import create_access_token
    assert decode_phone_token(create_access_token(data={"sub": PHONE})) is None


async def test_invalid_phone_rejected(client, outbox):
    r = await client.post("/api/v1/auth/otp/verify-phone/request", json={"phone": "12345", "region": "EG"})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "INVALID_PHONE"


async def test_ip_cap_returns_429(client, outbox):
    with patch("src.routers.auth_otp.allow_ip", return_value=False):
        r = await client.post("/api/v1/auth/otp/request", json={
            "channel": "email", "identifier": "otp@test.com", "purpose": "login",
        })
    assert r.status_code == 429 and r.json()["detail"]["code"] == "RATE_LIMITED"


async def test_brevo_failure_still_neutral(client, outbox, db):
    await _user(db, phone=PHONE, phone_verified=True)
    outbox["sms"].return_value = False
    r = await client.post("/api/v1/auth/otp/request", json={
        "channel": "sms", "identifier": PHONE, "purpose": "login",
    })
    assert r.status_code == 200 and r.json() == {"ok": True}


async def test_sms_message_is_in_the_requested_language(client, outbox, db):
    await _user(db, phone=PHONE, phone_verified=True)
    await client.post("/api/v1/auth/otp/request", json={
        "channel": "sms", "identifier": PHONE, "purpose": "login", "language": "ar",
    })
    text = outbox["sms"].call_args.args[1]
    assert text.startswith("رمز التحقق") and len(text) <= 70
    users = (await db.execute(select(User))).scalars().all()
    assert len(users) == 1


async def test_delivery_runs_after_the_response(client, outbox, db):
    # Sending inline would make known accounts answer measurably slower than
    # unknown ones (enumeration by timing), and block the event loop on SMTP.
    from fastapi import BackgroundTasks

    await _user(db)
    scheduled = []
    real_add = BackgroundTasks.add_task

    def spy(self, func, *args, **kwargs):
        scheduled.append(func.__name__)
        return real_add(self, func, *args, **kwargs)

    with patch.object(BackgroundTasks, "add_task", spy):
        await client.post("/api/v1/auth/otp/request", json={
            "channel": "email", "identifier": "otp@test.com", "purpose": "login",
        })
    assert scheduled == ["_deliver"]
    outbox["email"].assert_called_once()


async def test_failed_sms_can_be_requested_again_at_once(client, outbox, db):
    await _user(db, phone=PHONE, phone_verified=True)
    req = {"channel": "sms", "identifier": PHONE, "purpose": "login"}
    outbox["sms"].return_value = False
    await client.post("/api/v1/auth/otp/request", json=req)
    outbox["sms"].return_value = True
    await client.post("/api/v1/auth/otp/request", json=req)
    assert outbox["sms"].call_count == 2


def _sms_config(budget=100, countries=None):
    from types import SimpleNamespace
    return SimpleNamespace(otp_sms_config=SimpleNamespace(
        brevo_api_key="k", sms_sender="ACA",
        sms_hourly_budget=budget, sms_allowed_countries=countries or [],
    ))


async def test_verify_phone_respects_country_allowlist(client, outbox):
    with patch("src.routers.auth_otp.get_omnilearn_config", return_value=_sms_config(countries=["EG"])):
        r = await client.post("/api/v1/auth/otp/verify-phone/request", json={"phone": "+33612345678"})
        assert r.status_code == 400 and r.json()["detail"]["code"] == "COUNTRY_NOT_SUPPORTED"
        r = await client.post("/api/v1/auth/otp/verify-phone/request", json={"phone": PHONE})
        assert r.status_code == 200
    outbox["sms"].assert_called_once()


async def test_global_sms_budget_stops_sending(client, outbox, db):
    with patch("src.routers.auth_otp.get_omnilearn_config", return_value=_sms_config(budget=1)):
        await client.post("/api/v1/auth/otp/verify-phone/request", json={"phone": PHONE})
        r = await client.post("/api/v1/auth/otp/verify-phone/request", json={"phone": "+201001234568"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "SMS_LIMIT"
    assert outbox["sms"].call_count == 1


# --- Adding a verified phone to the signed-in account ---------------------------


@pytest.fixture
async def client_as(app):
    """client_as(user) -> a client whose requests are made as `user`."""
    clients = []

    def make(user):
        app.dependency_overrides[get_current_user] = lambda: user
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        return c

    yield make
    for c in clients:
        await c.aclose()


async def test_attach_phone_sets_verified_phone(client_as, db):
    user = await _user(db)
    r = await client_as(user).post("/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)})
    assert r.status_code == 200
    assert r.json()["phone"] == PHONE and r.json()["phone_verified"] is True


async def test_attach_phone_replaces_unverified_phone_on_file(client_as, db):
    user = await _user(db, phone="+201000000000", phone_verified=False)
    r = await client_as(user).post("/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)})
    assert r.status_code == 200 and r.json()["phone"] == PHONE


async def test_attach_phone_when_already_verified_is_409(client_as, db):
    user = await _user(db, phone="+201000000000", phone_verified=True)
    r = await client_as(user).post("/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PHONE_ALREADY_VERIFIED"


async def test_attach_phone_verified_elsewhere_is_409(client_as, db):
    await _user(db, username="other", email="o@test.com", user_uuid="user_o", phone=PHONE, phone_verified=True)
    user = await _user(db)
    r = await client_as(user).post("/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PHONE_IN_USE"


async def test_attach_phone_takes_number_from_unverified_holder(client_as, db):
    holder = await _user(db, username="other", email="o@test.com", user_uuid="user_o", phone=PHONE, phone_verified=False)
    user = await _user(db)
    r = await client_as(user).post("/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)})
    assert r.status_code == 200
    await db.refresh(holder)
    assert holder.phone is None


async def test_attach_phone_invalid_or_expired_token_is_400(client_as, db):
    user = await _user(db)
    r = await client_as(user).post("/api/v1/auth/otp/phone", json={"phone_token": "not-a-token"})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "INVALID_PHONE_TOKEN"


async def test_attach_phone_anonymous_is_401(client_as):
    r = await client_as(AnonymousUser()).post("/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)})
    assert r.status_code == 401


async def test_attach_phone_api_token_is_401(client_as, db):
    # An API token's id is the token's: it must never pick a user by that id.
    from src.db.users import APITokenUser

    user = await _user(db)
    r = await client_as(APITokenUser(id=user.id, org_id=1)).post(
        "/api/v1/auth/otp/phone", json={"phone_token": issue_phone_token(PHONE)}
    )
    assert r.status_code == 401
    await db.refresh(user)
    assert user.phone is None
