import html
import logging
from typing import Optional
from urllib.parse import quote

from pydantic import EmailStr
from src.db.organizations import OrganizationRead
from src.db.users import UserRead
from src.services.email.translations import normalize_language, t
from src.services.email.utils import send_email
from config.config import get_omnilearn_config

logger = logging.getLogger(__name__)


# The academy's name per language: the logo's alt text, the header when no
# logo URL is set, and the line closing every email.
ACADEMY_NAME = {
    "ar": "الأكاديمية الوطنية لمكافحة الفساد",
    "en": "Anti-Corruption Academy",
    "fr": "Académie de lutte contre la corruption",
}
ACADEMY_FOOTER = {
    "ar": "الأكاديمية الوطنية لمكافحة الفساد · هيئة الرقابة الإدارية",
    "en": "Anti-Corruption Academy · Administrative Control Authority",
    "fr": "Académie de lutte contre la corruption · Autorité de contrôle administratif",
}

_FONT = "Cairo, 'Segoe UI', Tahoma, Arial, sans-serif"

# Shared email styles: the academy's look (white card, gold top edge, navy
# and gold). Codes and button labels stay plain text, readable unstyled.
STYLES = {
    "body": f"margin: 0; padding: 0; background-color: #faf8f2; font-family: {_FONT};",
    "wrapper": "padding: 48px 24px;",
    "container": "max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ece6d3; border-top: 4px solid #d4af37;",
    "header": "padding: 40px 48px 0 48px; text-align: center;",
    "logo": "height: 64px; width: auto; border: 0;",
    "brand": f"margin: 0; font-size: 18px; font-weight: 800; color: #1b2b4b; font-family: {_FONT};",
    "content": "padding: 28px 48px 40px 48px; text-align: center;",
    "h1": f"margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #1b2b4b; line-height: 1.4; font-family: {_FONT};",
    "p": f"margin: 0 0 20px 0; font-size: 14px; color: #5b6577; font-weight: 500; line-height: 1.8; font-family: {_FONT};",
    "button": f"display: inline-block; padding: 14px 32px; background-color: #1b2b4b; color: #d4af37; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700; line-height: 1; font-family: {_FONT};",
    "link_text": "margin: 24px 0 0 0; font-size: 11px; color: #a0937a; word-break: break-all; font-weight: 500; line-height: 1.6;",
    "divider": "margin: 0 0 20px 0; border: none; border-top: 1px solid #f1ecdd;",
    "footer": "padding: 0 48px 32px 48px; text-align: center;",
    "footer_text": f"margin: 0 0 8px 0; font-size: 12px; color: #a0937a; font-weight: 500; line-height: 1.7; font-family: {_FONT};",
    "code": "display: inline-block; padding: 14px 28px; background-color: #1b2b4b; border-radius: 10px; font-size: 28px; font-weight: 800; letter-spacing: 0.18em; color: #d4af37; font-family: monospace;",
}


def _email_layout(title: str, body_content: str, footer_note: str = "", lang: str = "en") -> str:
    """Wrap content in the academy's email layout. `lang` is the language the
    content is in; like the translations (t), "en-US" means en and an
    unsupported language means English."""
    code = normalize_language(lang)
    if code not in ACADEMY_NAME:
        code = "en"
    name = ACADEMY_NAME[code]
    footer_line = ACADEMY_FOOTER[code]
    direction = "rtl" if code == "ar" else "ltr"

    logo_url = get_omnilearn_config().mailing_config.email_logo_url
    if logo_url:
        # Both dimensions: Outlook ignores CSS sizes (logo.png is 250x239).
        header = (
            f'<img src="{html.escape(logo_url, quote=True)}" alt="{html.escape(name)}" '
            f'width="67" height="64" style="{STYLES["logo"]}" />'
        )
    else:
        header = f'<p style="{STYLES["brand"]}">{html.escape(name)}</p>'

    note_html = f'<p style="{STYLES["footer_text"]}">{footer_note}</p>' if footer_note else ""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{html.escape(title)}</title></head>
<body style="{STYLES['body']}">
    <div style="{STYLES['wrapper']}">
        <div style="{STYLES['container']}">
            <div style="{STYLES['header']}">
                {header}
            </div>
            <div style="{STYLES['content']}">
                {body_content}
            </div>
            <div style="{STYLES['footer']}">
                <hr style="{STYLES['divider']}" />
                {note_html}
                <p style="{STYLES['footer_text']}" dir="{direction}">{footer_line}</p>
            </div>
        </div>
    </div>
</body>
</html>"""


def send_account_creation_email(
    user: UserRead,
    email: EmailStr,
    lang: str = "en",
):
    safe_username = html.escape(user.username)

    heading = t(lang, "account_creation.heading", username=safe_username)
    body_text = t(lang, "account_creation.body")
    cta = t(lang, "account_creation.cta")
    academy_link = (
        '<a href="https://university.omnilearn.io" '
        'style="color: rgba(0,0,0,0.35); text-decoration: underline;">'
        f'{t(lang, "academy_link_text")}</a>'
    )

    body_content = f"""
        <h1 style="{STYLES['h1']}">{heading}</h1>
        <p style="{STYLES['p']}">
            {body_text}
        </p>
        <a href="https://university.omnilearn.io" style="{STYLES['button']}">
            {cta}
        </a>
    """

    return send_email(
        to=email,
        subject=t(lang, "account_creation.subject", username=safe_username),
        body=_email_layout(
            title=heading,
            body_content=body_content,
            footer_note=t(lang, "account_creation.footer", academy_link=academy_link),
            lang=lang,
        ),
    )


def send_password_reset_email(
    generated_reset_code: str,
    user: UserRead,
    organization: OrganizationRead,
    email: EmailStr,
    base_url: str,
    lang: str = "en",
    reset_page_url: Optional[str] = None,
):
    """
    `reset_page_url` (OMNILEARN_PASSWORD_RESET_URL) is a reset page hosted
    elsewhere, e.g. on the main website; otherwise the LMS's own /reset.
    """
    safe_username = html.escape(user.username)
    safe_code = html.escape(generated_reset_code)
    safe_email = quote(str(email), safe='')
    safe_code_param = quote(generated_reset_code, safe='')
    reset_page = html.escape(reset_page_url) if reset_page_url else f"{base_url}/reset"
    reset_url = f"{reset_page}?email={safe_email}&amp;resetCode={safe_code_param}"

    heading = t(lang, "password_reset.heading")
    body_text = t(lang, "password_reset.body", username=safe_username)
    cta = t(lang, "password_reset.cta")

    body_content = f"""
        <h1 style="{STYLES['h1']}">{heading}</h1>
        <p style="{STYLES['p']}">
            {body_text}
        </p>
        <div style="margin: 28px 0;">
            <span style="{STYLES['code']}">{safe_code}</span>
        </div>
        <a href="{reset_url}" style="{STYLES['button']}">
            {cta}
        </a>
    """

    return send_email(
        to=email,
        subject=t(lang, "password_reset.subject"),
        body=_email_layout(
            title=heading,
            body_content=body_content,
            footer_note=t(lang, "password_reset.footer_org"),
            lang=lang,
        ),
    )


def send_password_reset_email_platform(
    generated_reset_code: str,
    user: UserRead,
    email: EmailStr,
    base_url: str,
    lang: str = "en",
):
    safe_username = html.escape(user.username)
    safe_code = html.escape(generated_reset_code)
    safe_email = quote(str(email), safe='')
    safe_code_param = quote(generated_reset_code, safe='')
    reset_url = f"{base_url}/reset-password?email={safe_email}&amp;resetCode={safe_code_param}"

    heading = t(lang, "password_reset.heading")
    body_text = t(lang, "password_reset.body", username=safe_username)
    cta = t(lang, "password_reset.cta")

    body_content = f"""
        <h1 style="{STYLES['h1']}">{heading}</h1>
        <p style="{STYLES['p']}">
            {body_text}
        </p>
        <div style="margin: 28px 0;">
            <span style="{STYLES['code']}">{safe_code}</span>
        </div>
        <a href="{reset_url}" style="{STYLES['button']}">
            {cta}
        </a>
    """

    return send_email(
        to=email,
        subject=t(lang, "password_reset.subject"),
        body=_email_layout(
            title=heading,
            body_content=body_content,
            footer_note=t(lang, "password_reset.footer_platform"),
            lang=lang,
        ),
    )


def send_invitation_email(
    email: EmailStr,
    org_name: str,
    inviter_username: str,
    signup_url: str,
    invite_code: Optional[str] = None,
    lang: str = "en",
):
    safe_org_name = html.escape(org_name)
    safe_inviter = html.escape(inviter_username)

    code_section = ""
    if invite_code:
        safe_code = html.escape(invite_code)
        code_hint = t(lang, "invitation.code_hint")
        code_section = f"""
        <div style="margin: 28px 0;">
            <span style="{STYLES['code']}">{safe_code}</span>
        </div>
        <p style="{STYLES['p']}">
            {code_hint}
        </p>"""
    else:
        code_section = f"""
        <p style="{STYLES['p']}">
            {t(lang, "invitation.no_code_hint")}
        </p>"""

    heading = t(lang, "invitation.heading")
    intro = t(lang, "invitation.intro", inviter=safe_inviter, org_name=safe_org_name)
    cta = t(lang, "invitation.cta", org_name=safe_org_name)

    body_content = f"""
        <h1 style="{STYLES['h1']}">{heading}</h1>
        <p style="{STYLES['p']}">
            {intro}
        </p>
        {code_section}
        <a href="{signup_url}" style="{STYLES['button']}">
            {cta}
        </a>
    """

    return send_email(
        to=email,
        subject=t(lang, "invitation.subject", org_name=safe_org_name),
        body=_email_layout(
            title=heading,
            body_content=body_content,
            footer_note=t(lang, "invitation.footer", inviter=safe_inviter),
            lang=lang,
        ),
    )


def send_role_changed_email(
    email: EmailStr,
    username: str,
    org_name: str,
    new_role_name: str,
    lang: str = "en",
):
    """
    Send an email notifying a user that their role has changed in an organization.
    """
    safe_username = html.escape(username)
    safe_org_name = html.escape(org_name)
    safe_role_name = html.escape(new_role_name)

    heading = t(lang, "role_changed.heading")
    body_1 = t(
        lang, "role_changed.body_1",
        username=safe_username, org_name=safe_org_name, role=safe_role_name,
    )
    body_2 = t(lang, "role_changed.body_2")

    body_content = f"""
        <h1 style="{STYLES['h1']}">{heading}</h1>
        <p style="{STYLES['p']}">
            {body_1}
        </p>
        <p style="{STYLES['p']}">
            {body_2}
        </p>
    """

    return send_email(
        to=email,
        subject=t(lang, "role_changed.subject", org_name=safe_org_name),
        body=_email_layout(
            title=heading,
            body_content=body_content,
            footer_note=t(lang, "role_changed.footer", org_name=safe_org_name),
            lang=lang,
        ),
    )


def send_email_verification_email(
    token: str,
    user: UserRead,
    organization: OrganizationRead | None,
    email: EmailStr,
    base_url: str,
    lang: str = "en",
):
    """
    Send email verification email with verification link.

    Args:
        token: Verification token
        user: User receiving the email
        organization: Organization context (can be None for no-org signups)
        email: Email address to send to
        base_url: Base URL for constructing the verification link
        lang: ISO 639-1 language code for email content (defaults to 'en')

    Returns:
        Boolean indicating if email was sent successfully
    """
    safe_username = html.escape(user.username)
    safe_token = quote(token, safe='')
    safe_user_uuid = quote(user.user_uuid, safe='')
    org_uuid = organization.org_uuid if organization else "none"
    safe_org_uuid = quote(org_uuid, safe='')
    verification_url = f"{base_url}/verify-email?token={safe_token}&amp;user={safe_user_uuid}&amp;org={safe_org_uuid}"

    heading = t(lang, "email_verification.heading")
    body_text = t(lang, "email_verification.body", username=safe_username)
    cta = t(lang, "email_verification.cta")
    copy_paste = t(lang, "email_verification.copy_paste")

    body_content = f"""
        <h1 style="{STYLES['h1']}">{heading}</h1>
        <p style="{STYLES['p']}">
            {body_text}
        </p>
        <a href="{verification_url}" style="{STYLES['button']}">
            {cta}
        </a>
        <p style="{STYLES['link_text']}">
            {copy_paste}<br />{verification_url}
        </p>
    """

    return send_email(
        to=email,
        subject=t(lang, "email_verification.subject"),
        body=_email_layout(
            title=heading,
            body_content=body_content,
            footer_note=t(lang, "email_verification.footer"),
            lang=lang,
        ),
    )
