"""Tests for src/services/phone.py."""

import pytest

from src.services.phone import normalize_phone


@pytest.mark.parametrize("raw,region,expected", [
    ("01001234567", "EG", "+201001234567"),
    ("+20 100 123 4567", None, "+201001234567"),
    ("0100-123-4567", "EG", "+201001234567"),
    ("+33 6 12 34 56 78", "EG", "+33612345678"),
    ("0223456789", "EG", None),          # Cairo landline: not a mobile
    ("12345", "EG", None),
    ("", "EG", None),
    (None, "EG", None),
])
def test_normalize_phone(raw, region, expected):
    assert normalize_phone(raw, region) == expected


def test_user_read_exposes_phone_fields():
    from src.db.users import UserRead

    fields = UserRead.model_fields
    assert "phone" in fields and "phone_verified" in fields
    assert fields["phone_verified"].default is False


def test_phone_cannot_be_set_through_signup_or_profile_update():
    # A phone only becomes the account's after SMS verification, so the
    # sign-up and profile-update bodies must not carry it.
    from src.db.users import UserCreate, UserUpdate

    assert "phone" not in UserCreate.model_fields
    assert "phone" not in UserUpdate.model_fields
    assert "phone_verified" not in UserUpdate.model_fields
