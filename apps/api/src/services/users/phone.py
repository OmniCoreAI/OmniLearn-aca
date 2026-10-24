"""Saving a phone number proven by SMS code onto an account.

Shared by registration and by signed-in users adding a phone, so both apply
the same rules.
"""

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import User
from src.services.otp.phone_token import decode_phone_token


async def claim_verified_phone(db_session: AsyncSession, user: User, phone_token: str) -> None:
    """Makes the token's number `user`'s verified phone. Does not commit."""
    phone = decode_phone_token(phone_token)
    if not phone:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_PHONE_TOKEN", "message": "Verify your phone number again"},
        )
    holder = (await db_session.execute(select(User).where(User.phone == phone))).scalars().first()
    if holder and holder.phone_verified:
        raise HTTPException(
            status_code=409,
            detail={"code": "PHONE_IN_USE", "message": "This phone number is already used by another account"},
        )
    if holder:
        # Unverified (copied from old free-text data): whoever proves the
        # number by SMS gets it. Flushed now so the unique index never
        # sees both accounts holding it.
        holder.phone = None
        db_session.add(holder)
        await db_session.flush()
    user.phone = phone
    user.phone_verified = True
