"""``AdminSetting["notifications"]``: which events go out on which channel."""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator
from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.administration.settings import load_setting, register_setting


class EventChannels(BaseModel):
    email: bool = True
    sms: bool = False


class NotificationSettings(BaseModel):
    # Missing events use the catalog defaults.
    events: Dict[str, EventChannels] = {}
    reminders_enabled: bool = True
    # Hours before a session starts / an assignment is due.
    session_reminder_hours: List[int] = [24]
    exam_reminder_hours: List[int] = [48]
    # None → the organization's default language.
    default_language: Optional[Literal["en", "ar"]] = None
    sender_name: Optional[str] = Field(default=None, max_length=80)

    @field_validator("session_reminder_hours", "exam_reminder_hours")
    @classmethod
    def _hours(cls, value: List[int]) -> List[int]:
        cleaned = sorted({int(v) for v in value if 1 <= int(v) <= 24 * 30}, reverse=True)
        return cleaned[:5]


register_setting("notifications", NotificationSettings)


async def load_notification_settings(db_session: AsyncSession, org_id: int) -> NotificationSettings:
    return await load_setting(db_session, org_id, "notifications")  # type: ignore[return-value]
