"""Authorization + validation for the Instructor Management / Finance module.

These are org-level *management* records (not public/published content), so
access is granted to: superadmins, org admins/maintainers, and any role that
carries the ``instructors`` rights bucket for the requested action. This mirrors
the platform's role model without forcing instructor/category/worklog rows
through the public/usergroup resource-access rules meant for courses.
"""
from typing import Literal

from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.administration.authz import authorize_admin

Action = Literal["create", "read", "update", "delete"]


async def authorize_instructor_management(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    action: Action,
) -> int:
    """Ensure the caller may perform ``action`` on instructor-management data.

    Returns the acting user's id on success; raises 401/403 otherwise.
    """
    return await authorize_admin(
        db_session, current_user, org_id, "instructors", action, what="manage instructors"
    )
