"""The account a password sign-in names: by email, or by a confirmed phone number."""

from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import User
from src.services.phone import normalize_phone


async def resolve_login_user(db_session: AsyncSession, identifier: str) -> Optional[User]:
    """
    The user `identifier` names, or None. With an "@" it's an email (exact
    match, as before); otherwise a mobile number (Egypt assumed without a
    "+code"), matched only against a phone confirmed by SMS — an unconfirmed
    or unknown number names nobody, like an unknown email.
    """
    value = (identifier or "").strip()
    if "@" in value:
        statement = select(User).where(User.email == value)
    else:
        phone = normalize_phone(value, "EG")
        if not phone:
            return None
        statement = select(User).where(User.phone == phone, User.phone_verified == True)  # noqa: E712
    return (await db_session.execute(statement)).scalars().first()
