"""User-facing Zoom errors.

Each carries a short, stable ``code`` (the web app translates it) and a plain
message. Technical details — Zoom's own error text, status codes — go to the
server log only, never to the browser.
"""
from typing import Optional

from fastapi import HTTPException


class ZoomError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, headers: Optional[dict] = None):
        super().__init__(status_code=status_code, detail={"code": code, "message": message}, headers=headers)
        self.code = code


def not_configured() -> ZoomError:
    return ZoomError(503, "zoom_not_configured", "Zoom is not set up on this server yet.")


def not_connected() -> ZoomError:
    return ZoomError(409, "zoom_not_connected", "Zoom is not connected. An administrator must connect a Zoom account first.")


def reauth_required() -> ZoomError:
    return ZoomError(
        409, "zoom_reauth_required",
        "The Zoom connection has expired or was revoked. An administrator must reconnect Zoom.",
    )


def oauth_failed(message: str = "Zoom sign-in failed. Please try connecting again.") -> ZoomError:
    return ZoomError(400, "zoom_oauth_failed", message)


def rate_limited(retry_after: int) -> ZoomError:
    return ZoomError(
        429, "zoom_rate_limited", "Zoom is receiving too many requests. Please try again shortly.",
        headers={"Retry-After": str(max(1, retry_after))},
    )


def local_rate_limited(retry_after: int) -> ZoomError:
    return ZoomError(
        429, "rate_limited", "Too many requests. Please wait a moment and try again.",
        headers={"Retry-After": str(max(1, retry_after))},
    )


def timeout() -> ZoomError:
    return ZoomError(504, "zoom_timeout", "Zoom did not respond in time. Please try again.")


def unavailable() -> ZoomError:
    return ZoomError(502, "zoom_unavailable", "Zoom could not complete the request. Please try again later.")


def meeting_gone() -> ZoomError:
    return ZoomError(
        410, "zoom_meeting_gone",
        "This meeting no longer exists in Zoom. It was probably deleted there.",
    )


def rejected(message: str) -> ZoomError:
    """Zoom refused the request (invalid value, plan limit…). The message is
    Zoom's, which is safe to show and usually actionable ("Invalid passcode")."""
    return ZoomError(400, "zoom_rejected", message)


def forbidden(message: str = "You are not allowed to do this.") -> ZoomError:
    return ZoomError(403, "forbidden", message)


def not_enrolled() -> ZoomError:
    return ZoomError(403, "not_enrolled", "You are not enrolled in this class.")


def meeting_not_found() -> ZoomError:
    return ZoomError(404, "meeting_not_found", "Online meeting not found.")


def lecture_not_found() -> ZoomError:
    return ZoomError(404, "lecture_not_found", "Lecture not found.")


def invalid(message: str) -> ZoomError:
    return ZoomError(400, "invalid", message)


def already_exists() -> ZoomError:
    return ZoomError(409, "meeting_exists", "This lecture already has an online meeting.")


def canceled() -> ZoomError:
    return ZoomError(409, "meeting_canceled", "This meeting was canceled.")
