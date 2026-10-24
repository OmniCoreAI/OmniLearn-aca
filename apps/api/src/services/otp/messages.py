"""The one-time-code emails and SMS, in Arabic (default), English and French."""

import html
from typing import Literal

from src.services.users.emails import STYLES, _email_layout

Language = Literal["ar", "en", "fr"]

# Arabic SMS stay within one Unicode SMS (70 characters).
_SMS = {
    "ar": "رمز التحقق: {code}. صالح 10 دقائق. لا تشاركه مع أحد.",
    "en": "Your verification code is {code}. Valid for 10 minutes. Don't share it.",
    "fr": "Votre code de vérification : {code}. Valable 10 minutes. Ne le partagez pas.",
}

_EMAIL = {
    "ar": {
        "dir": "rtl",
        "subject": {"login": "رمز تسجيل الدخول", "reset": "رمز إعادة تعيين كلمة المرور"},
        "body": "استخدم هذا الرمز خلال 10 دقائق. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة.",
    },
    "en": {
        "dir": "ltr",
        "subject": {"login": "Your sign-in code", "reset": "Your password reset code"},
        "body": "Use this code within 10 minutes. If you didn't ask for it, you can ignore this email.",
    },
    "fr": {
        "dir": "ltr",
        "subject": {
            "login": "Votre code de connexion",
            "reset": "Votre code de réinitialisation du mot de passe",
        },
        "body": "Utilisez ce code dans les 10 minutes. Si vous ne l'avez pas demandé, ignorez cet e-mail.",
    },
}


def otp_sms(purpose: str, lang: str, code: str) -> str:
    """The SMS text; the same wording for every purpose."""
    return _SMS.get(lang, _SMS["ar"]).format(code=code)


def otp_email(purpose: str, lang: str, code: str) -> tuple[str, str]:
    """(subject, html) for a sign-in or password reset code."""
    t = _EMAIL.get(lang, _EMAIL["ar"])
    subject = t["subject"].get(purpose, t["subject"]["login"])
    body_content = f"""
        <div dir="{t['dir']}">
            <h1 style="{STYLES['h1']}">{html.escape(subject)}</h1>
            <p style="{STYLES['p']}">{html.escape(t['body'])}</p>
            <div style="margin: 28px 0;">
                <span style="{STYLES['code']}">{html.escape(code)}</span>
            </div>
        </div>
    """
    return subject, _email_layout(title=subject, body_content=body_content, lang=lang)
