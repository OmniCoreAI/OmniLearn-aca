"""Sign-up with an SMS-verified phone (create_user + phone_token)."""

from contextlib import ExitStack
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException

from src.db.users import UserCreate
from src.services.otp.phone_token import issue_phone_token
from src.services.users.users import create_user

PHONE = "+201001234567"


def _signup(username: str, phone_token=None) -> UserCreate:
    return UserCreate(
        username=username,
        first_name="New",
        last_name="User",
        email=f"{username}@test.com",
        password="Password123!",
        phone_token=phone_token,
    )


@pytest.fixture
def quiet_signup():
    """The side effects create_user has besides saving (emails, usage, analytics)."""
    # patch() picks AsyncMock for async functions by itself.
    plain = [
        "src.services.users.users.check_limits_with_usage",
        "src.services.users.users.increase_feature_usage",
        "src.services.users.users.send_account_creation_email",
    ]
    with ExitStack() as stack:
        for target in plain:
            stack.enter_context(patch(target))
        stack.enter_context(patch(
            "src.services.users.users.validate_password_complexity",
            return_value=Mock(is_valid=True),
        ))
        stack.enter_context(patch("src.services.users.users.get_deployment_mode", return_value="oss"))
        for target in [
            "src.services.users.users.track",
            "src.services.users.users.dispatch_webhooks",
            "src.services.users.email_verification.send_verification_email",
            "src.services.users.users.authorization_verify_based_on_roles_and_authorship",
        ]:
            stack.enter_context(patch(target, new_callable=AsyncMock))
        yield


async def test_valid_phone_token_sets_verified_phone(quiet_signup, mock_request, db, admin_user, org):
    created = await create_user(mock_request, db, admin_user, _signup("p1", issue_phone_token(PHONE)), org.id)
    assert created.phone == PHONE
    assert created.phone_verified is True


async def test_phone_already_used_is_409(quiet_signup, mock_request, db, admin_user, org):
    token = issue_phone_token(PHONE)
    await create_user(mock_request, db, admin_user, _signup("p1", token), org.id)
    with pytest.raises(HTTPException) as exc:
        await create_user(mock_request, db, admin_user, _signup("p2", token), org.id)
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "PHONE_IN_USE"


async def test_invalid_phone_token_is_400(quiet_signup, mock_request, db, admin_user, org):
    with pytest.raises(HTTPException) as exc:
        await create_user(mock_request, db, admin_user, _signup("p3", "garbage"), org.id)
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "INVALID_PHONE_TOKEN"


async def test_signup_without_phone_token_is_unchanged(quiet_signup, mock_request, db, admin_user, org):
    created = await create_user(mock_request, db, admin_user, _signup("p4"), org.id)
    assert created.phone is None
    assert created.phone_verified is False


async def test_verified_signup_takes_the_number_from_an_unverified_holder(
    quiet_signup, mock_request, db, admin_user, org
):
    # Phones copied from old free-text data are unverified; whoever proves
    # the number by SMS gets it, instead of a 409 they can't get past.
    from sqlmodel import select
    from src.db.users import User

    holder = await create_user(mock_request, db, admin_user, _signup("old1"), org.id)
    row = (await db.execute(select(User).where(User.id == holder.id))).scalars().one()
    row.phone, row.phone_verified = PHONE, False
    db.add(row)
    await db.commit()

    created = await create_user(mock_request, db, admin_user, _signup("new1", issue_phone_token(PHONE)), org.id)
    assert created.phone == PHONE and created.phone_verified is True
    await db.refresh(row)
    assert row.phone is None
