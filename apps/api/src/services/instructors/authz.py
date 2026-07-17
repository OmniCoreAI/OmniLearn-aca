"""Authorization + validation for the Instructor Management / Finance module.

These are org-level *management* records (not public/published content), so
access is granted to: superadmins, org admins/maintainers, and any role that
carries the ``instructors`` rights bucket for the requested action. This mirrors
the platform's role model without forcing instructor/category/worklog rows
through the public/usergroup resource-access rules meant for courses.
"""
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


async def authorize_instructor_management(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    action: Action,
) -> int:
    """Ensure the caller may perform ``action`` on instructor-management data.

    Returns the acting user's id on success; raises 401/403 otherwise.
    """
    # API tokens and anonymous users cannot manage instructors.
    if isinstance(current_user, (AnonymousUser, APITokenUser)):
        raise _bad("Authentication required to manage instructors", 401)

    user_id = current_user.id
    if not user_id:
        raise _bad("Authentication required to manage instructors", 401)

    # Superadmin bypass.
    if await is_user_superadmin(user_id, db_session):
        return user_id

    # Must be a member of the target organization.
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

    # Org admins/maintainers may always manage.
    if membership.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return user_id

    # Otherwise, any applicable role that grants the instructors right wins.
    roles = await _load_applicable_roles(db_session, user_id, org_id)
    for role in roles:
        rights = role.rights
        if not rights:
            continue
        bucket = rights.get("instructors") if isinstance(rights, dict) else getattr(rights, "instructors", None)
        if not bucket:
            continue
        if isinstance(bucket, dict):
            granted = bucket.get(f"action_{action}", False)
        else:
            granted = getattr(bucket, f"action_{action}", False)
        if granted:
            return user_id

    raise _bad("You don't have permission to manage instructors", 403)
