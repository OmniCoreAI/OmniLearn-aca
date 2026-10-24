"""Tests for src/services/otp/store.py (one-time codes in Redis)."""

from unittest.mock import patch

import fakeredis
import pytest
from fastapi import HTTPException

from src.services.otp import store
from src.services.otp.store import allow_ip, issue_code, verify_code

ID = "user@test.com"


@pytest.fixture
def fake():
    r = fakeredis.FakeRedis()
    with patch("src.services.otp.store.get_redis_client", return_value=r):
        yield r


def test_settings_match_the_spec():
    assert (store.CODE_TTL, store.COOLDOWN, store.MAX_ATTEMPTS) == (600, 60, 5)
    assert (store.HOURLY_CAP, store.IP_HOURLY_CAP) == (5, 20)


def test_code_is_six_digits_and_verifies_once(fake):
    code = issue_code("login", "email", ID)
    assert len(code) == 6 and code.isdigit()
    assert verify_code("login", "email", ID, code) is True
    assert verify_code("login", "email", ID, code) is False


def test_code_is_not_stored_in_plain_text(fake):
    code = issue_code("login", "email", ID)
    stored = b"".join(v for k in fake.keys() if fake.type(k) == b"hash" for v in fake.hgetall(k).values())
    assert code.encode() not in stored


def test_wrong_code_five_times_invalidates(fake):
    code = issue_code("login", "email", ID)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert verify_code("login", "email", ID, wrong) is False
    assert verify_code("login", "email", ID, code) is False


def test_purposes_and_channels_are_separate(fake):
    code = issue_code("login", "email", ID)
    assert verify_code("reset", "email", ID, code) is False
    assert verify_code("login", "sms", ID, code) is False
    assert verify_code("login", "email", ID, code) is True


def test_cooldown_blocks_immediate_resend(fake):
    assert issue_code("login", "email", ID) is not None
    assert issue_code("login", "email", ID) is None


def test_hourly_cap(fake):
    for _ in range(5):
        assert issue_code("login", "email", ID) is not None
        for key in fake.keys("otp_cd:*"):
            fake.delete(key)
    assert issue_code("login", "email", ID) is None


def test_code_expires(fake):
    code = issue_code("login", "email", ID)
    keys = fake.keys("otp:*")
    assert keys and all(0 < fake.ttl(k) <= 600 for k in keys)
    for key in keys:
        fake.delete(key)  # what Redis does when CODE_TTL runs out
    assert verify_code("login", "email", ID, code) is False


def test_ip_cap(fake):
    assert all(allow_ip("1.2.3.4") for _ in range(20))
    assert allow_ip("1.2.3.4") is False
    assert allow_ip("5.6.7.8") is True


def test_redis_down_raises_503():
    with patch("src.services.otp.store.get_redis_client", return_value=None):
        with pytest.raises(HTTPException) as exc:
            issue_code("login", "email", ID)
    assert exc.value.status_code == 503


def test_redis_connection_error_raises_503():
    import redis as redis_lib

    broken = fakeredis.FakeRedis()
    broken.set = lambda *a, **k: (_ for _ in ()).throw(redis_lib.exceptions.ConnectionError("down"))
    with patch("src.services.otp.store.get_redis_client", return_value=broken):
        with pytest.raises(HTTPException) as exc:
            issue_code("login", "email", ID)
    assert exc.value.status_code == 503


def test_discard_lets_the_user_request_again_at_once(fake):
    assert issue_code("login", "sms", "+201001234567") is not None
    store.discard("login", "sms", "+201001234567")
    for _ in range(5):  # undelivered codes don't use up the hourly quota
        code = issue_code("login", "sms", "+201001234567")
        assert code is not None
        store.discard("login", "sms", "+201001234567")
    assert verify_code("login", "sms", "+201001234567", code) is False


def test_arabic_indic_digits_verify(fake):
    code = issue_code("login", "email", ID)
    arabic = code.translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))
    assert verify_code("login", "email", ID, arabic) is True


def test_global_sms_budget(fake):
    assert all(store.allow_sms(3) for _ in range(3))
    assert store.allow_sms(3) is False
