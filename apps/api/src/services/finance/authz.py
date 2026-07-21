"""Authorization for the local academy finance ledger."""
from typing import Literal

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
from src.security.rbac.rbac import _load_applicable_roles
from src.security.superadmin import is_user_superadmin

Action = Literal["create", "read", "update", "delete"]


def _bad(detail: str, code: int = 400) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


async def authorize_finance_management(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    action: Action,
) -> int:
    if isinstance(current_user, (AnonymousUser, APITokenUser)):
        raise _bad("Authentication required to manage finance", 401)

    user_id = current_user.id
    if not user_id:
        raise _bad("Authentication required to manage finance", 401)

    if await is_user_superadmin(user_id, db_session):
        return user_id

    membership = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    if not membership:
        raise _bad("You are not a member of this organization", 403)

    if membership.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return user_id

    roles = await _load_applicable_roles(db_session, user_id, org_id)
    for role in roles:
        rights = role.rights
        if not rights:
            continue
        for bucket_name in ("payments", "instructors"):
            bucket = (
                rights.get(bucket_name)
                if isinstance(rights, dict)
                else getattr(rights, bucket_name, None)
            )
            if not bucket:
                continue
            if isinstance(bucket, dict):
                granted = bucket.get(f"action_{action}", False)
            else:
                granted = getattr(bucket, f"action_{action}", False)
            if granted:
                return user_id

    raise _bad("You don't have permission to manage finance", 403)
