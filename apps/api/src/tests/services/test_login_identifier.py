"""Tests for src/services/users/login_identifier.py (password sign-in by email or confirmed phone)."""

from datetime import datetime
from unittest.mock import patch

import pytest

from src.db.users import User
from src.security.auth import _DUMMY_PASSWORD_HASH, authenticate_user
from src.security.security import security_hash_password
from src.services.users.login_identifier import resolve_login_user


async def _user(db, n: str, **fields) -> User:
    now = str(datetime.now())
    user = User(
        username=f"user{n}",
        first_name="Login",
        last_name="User",
        email=fields.pop("email", f"{n}@test.com"),
        password=security_hash_password("Secret!123"),
        user_uuid=f"user_{n}",
        email_verified=True,
        creation_date=now,
        update_date=now,
        **fields,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def users(db):
    return {
        "a": await _user(db, "a", phone="+201001234567", phone_verified=True),
        "b": await _user(db, "b", phone="+447911123456", phone_verified=True),
        "c": await _user(db, "c", phone="+201112223334", phone_verified=False),
    }


@pytest.mark.parametrize(
    "typed", ["+201001234567", "01001234567", "010 0123 4567", "010-0123-4567", "+20 100 123 4567"]
)
async def test_confirmed_egyptian_number_in_any_format(db, users, typed):
    assert (await resolve_login_user(db, typed)).email == "a@test.com"


async def test_confirmed_number_from_another_country(db, users):
    assert (await resolve_login_user(db, "+44 7911 123456")).id == users["b"].id


async def test_email_still_matches(db, users):
    assert (await resolve_login_user(db, "a@test.com")).id == users["a"].id


@pytest.mark.parametrize("typed", ["+201112223334", "+201009999999", "not-a-number", "", "a@nowhere.test"])
async def test_no_account(db, users, typed):
    assert await resolve_login_user(db, typed) is None


async def test_unconfirmed_phone_runs_the_dummy_verify(db, users, mock_request):
    with patch("src.security.auth.security_verify_password", return_value=False) as verify:
        assert await authenticate_user(mock_request, "+201112223334", "x", db) is False
    assert verify.call_args.args[1] == _DUMMY_PASSWORD_HASH
