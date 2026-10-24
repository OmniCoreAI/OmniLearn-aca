"""Tests for src/services/users/emails.py."""

from unittest.mock import patch

from src.db.organizations import OrganizationRead
from src.db.users import UserRead
from src.services.users.emails import (
    send_account_creation_email,
    send_email_verification_email,
    send_invitation_email,
    send_password_reset_email,
    send_password_reset_email_platform,
    send_role_changed_email,
)


def _user(**overrides):
    data = dict(
        id=1,
        username="user<script>",
        first_name="User",
        last_name="Test",
        email="user@test.com",
        user_uuid="user_uuid",
        email_verified=True,
        avatar_image="",
        bio="",
    )
    data.update(overrides)
    return UserRead(**data)


def _org(**overrides):
    data = dict(
        id=1,
        name="Org & Co",
        slug="org",
        email="org@test.com",
        org_uuid="org_uuid",
        creation_date="2024-01-01",
        update_date="2024-01-01",
    )
    data.update(overrides)
    return OrganizationRead(**data)


class TestEmailsService:
    def test_send_account_creation_email_escapes_username(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            result = send_account_creation_email(_user(), "user@test.com")

        assert result is True
        body = send_email.call_args.kwargs["body"]
        assert "user&lt;script&gt;" in body
        assert "Get Started" in body

    def test_send_password_reset_email_variants_encode_params(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_password_reset_email(
                "code 123",
                _user(),
                _org(),
                "user+tag@test.com",
                "https://app.test",
            )
            send_password_reset_email_platform(
                "code 123",
                _user(),
                "user+tag@test.com",
                "https://app.test",
            )

        first_body = send_email.call_args_list[0].kwargs["body"]
        second_body = send_email.call_args_list[1].kwargs["body"]
        assert "reset?email=user%2Btag%40test.com&amp;resetCode=code%20123" in first_body
        assert "reset-password?email=user%2Btag%40test.com&amp;resetCode=code%20123" in second_body

    def test_send_password_reset_email_links_to_external_reset_page(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_password_reset_email(
                "code 123",
                _user(),
                _org(),
                "user+tag@test.com",
                "https://app.test",
                reset_page_url="https://www.example.org/forgot-password",
            )
        body = send_email.call_args.kwargs["body"]
        assert (
            'href="https://www.example.org/forgot-password?email=user%2Btag%40test.com&amp;resetCode=code%20123"'
            in body
        )
        assert "https://app.test/reset" not in body

    def test_send_invitation_role_change_and_verification_email(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Org & Co",
                "owner<script>",
                "https://app.test/signup",
                invite_code="INV-123",
            )
            send_role_changed_email(
                "invitee@test.com",
                "member<script>",
                "Org & Co",
                "Admin",
            )
            send_email_verification_email(
                "token 123",
                _user(),
                _org(),
                "invitee@test.com",
                "https://app.test",
            )

        invite_body = send_email.call_args_list[0].kwargs["body"]
        role_body = send_email.call_args_list[1].kwargs["body"]
        verification_body = send_email.call_args_list[2].kwargs["body"]
        assert "INV-123" in invite_body
        assert "@owner&lt;script&gt;" in invite_body
        assert "member&lt;script&gt;" in role_body
        assert "verify-email?token=token%20123&amp;user=user_uuid&amp;org=org_uuid" in verification_body

    def test_send_invitation_email_without_invite_code(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Test Org",
                "inviter",
                "https://app.test/signup",
            )
        invite_body = send_email.call_args.kwargs["body"]
        assert "Click the button below" in invite_body

    def test_send_emails_in_french_when_lang_is_fr(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Org & Co",
                "owner",
                "https://app.test/signup",
                invite_code="INV-123",
                lang="fr",
            )
            send_password_reset_email(
                "abcd1234",
                _user(),
                _org(),
                "user@test.com",
                "https://app.test",
                lang="fr",
            )
            send_role_changed_email(
                "user@test.com",
                "member",
                "Org & Co",
                "Admin",
                lang="fr",
            )

        invite_call = send_email.call_args_list[0].kwargs
        reset_call = send_email.call_args_list[1].kwargs
        role_call = send_email.call_args_list[2].kwargs

        assert "Vous êtes invité" in invite_call["body"]
        assert "Vous êtes invité à rejoindre Org &amp; Co" == invite_call["subject"]
        assert "Réinitialisez votre mot de passe" in reset_call["body"]
        assert "Réinitialisez votre mot de passe" == reset_call["subject"]
        assert "Votre rôle a été mis à jour" in role_call["body"]

    def test_send_emails_falls_back_to_english_for_unknown_lang(self):
        with patch("src.services.users.emails.send_email", return_value=True) as send_email:
            send_invitation_email(
                "invitee@test.com",
                "Org",
                "owner",
                "https://app.test/signup",
                lang="xx",
            )
        body = send_email.call_args.kwargs["body"]
        assert "You've been invited" in body


# --- The academy's look (option C) -----------------------------------------

import pytest  # noqa: E402
from types import SimpleNamespace  # noqa: E402
from typing import Optional  # noqa: E402

from src.services.otp.messages import otp_email  # noqa: E402
from src.services.users.emails import STYLES, _email_layout  # noqa: E402


def _layout_with(logo: Optional[str], lang: str) -> str:
    config = SimpleNamespace(mailing_config=SimpleNamespace(email_logo_url=logo))
    with patch("src.services.users.emails.get_omnilearn_config", return_value=config):
        return _email_layout("T", "<p>body</p>", lang=lang)


def test_layout_shows_academy_logo_and_no_omnilearn_mark():
    html = _layout_with(logo="https://site.test/logo.png", lang="ar")
    assert '<img src="https://site.test/logo.png"' in html
    assert 'viewBox="0 0 1488 218"' not in html  # the OmniLearn wordmark


def test_layout_without_logo_setting_shows_academy_name():
    html = _layout_with(logo=None, lang="en")
    assert "<img" not in html and "Anti-Corruption Academy" in html


@pytest.mark.parametrize("lang,line", [
    ("ar", "الأكاديمية الوطنية لمكافحة الفساد · هيئة الرقابة الإدارية"),
    ("en", "Anti-Corruption Academy · Administrative Control Authority"),
    ("fr", "Académie de lutte contre la corruption · Autorité de contrôle administratif"),
    ("ar-EG", "الأكاديمية الوطنية لمكافحة الفساد · هيئة الرقابة الإدارية"),
    ("en-US", "Anti-Corruption Academy · Administrative Control Authority"),
    ("fr-FR", "Académie de lutte contre la corruption · Autorité de contrôle administratif"),
    # Unknown: English, as the LMS emails' text falls back to (translations.t).
    ("xx", "Anti-Corruption Academy · Administrative Control Authority"),
])
def test_layout_footer_follows_language(lang, line):
    assert line in _layout_with(logo=None, lang=lang)


def test_layout_uses_academy_palette():
    html = _layout_with(logo=None, lang="en")
    assert "#d4af37" in html and "#1b2b4b" in html and "#000000" not in html


def test_otp_code_is_plain_text_in_navy_and_gold():
    with patch("src.services.users.emails.get_omnilearn_config",
               return_value=SimpleNamespace(mailing_config=SimpleNamespace(email_logo_url=None))):
        _, html = otp_email("login", "ar", "482915")
    assert ">482915<" in html and 'dir="rtl"' in html
    assert "#1b2b4b" in STYLES["code"] and "#d4af37" in STYLES["code"]


def test_otp_email_in_an_unknown_language_closes_in_arabic_like_its_text():
    # The code emails fall back to Arabic text; the closing line must match.
    with patch("src.services.users.emails.get_omnilearn_config",
               return_value=SimpleNamespace(mailing_config=SimpleNamespace(email_logo_url=None))):
        _, html = otp_email("login", "xx", "482915")
    assert "الأكاديمية الوطنية لمكافحة الفساد · هيئة الرقابة الإدارية" in html


def test_logo_has_width_and_height_for_outlook():
    html = _layout_with(logo="https://site.test/logo.png", lang="ar")
    assert 'width="67"' in html and 'height="64"' in html
