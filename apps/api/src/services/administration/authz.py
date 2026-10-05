"""Authorization for the Administration & Configuration layer.

Configuration records (facilities, add-ons, lookups, templates, entities, …) are
org-level *management* data, not published content. Access is granted to
superadmins, academy admins, and any role carrying the requested rights bucket
(``configuration`` / ``entities`` / ``communications`` / ``instructors``).

Pickers used while building courses (room, add-on, instructor dropdowns) only
need org membership — see ``require_org_member`` — and must return names and
capacities, never costs or rates.
"""
from typing import Literal, Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.rbac.constants import ACADEMY_ADMIN_ROLE_IDS
from src.security.rbac.rbac import _load_applicable_roles
from src.security.superadmin import is_user_superadmin

Action = Literal["create", "read", "update", "delete"]
Bucket = Literal["configuration", "entities", "communications", "instructors"]

AnyUser = PublicUser | AnonymousUser | APITokenUser


def _deny(detail: str, code: int = 403) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def require_user_id(current_user: AnyUser, what: str) -> int:
    if isinstance(current_user, (AnonymousUser, APITokenUser)):
        raise _deny(f"Authentication required to {what}", 401)
    user_id = getattr(current_user, "id", None)
    if not user_id:
        raise _deny(f"Authentication required to {what}", 401)
    return user_id


async def get_membership(
    db_session: AsyncSession, user_id: int, org_id: int
) -> Optional[UserOrganization]:
    return (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()


def _bucket_grants(rights, bucket: str, action: str) -> bool:
    if not rights:
        return False
    data = rights.get(bucket) if isinstance(rights, dict) else getattr(rights, bucket, None)
    if not data:
        return False
    if isinstance(data, dict):
        return bool(data.get(f"action_{action}", False))
    return bool(getattr(data, f"action_{action}", False))


async def has_admin_permission(
    db_session: AsyncSession,
    user_id: int,
    org_id: int,
    bucket: Bucket,
    action: Action,
) -> bool:
    """Non-raising check: superadmin, academy admin, or a role granting ``bucket``."""
    if await is_user_superadmin(user_id, db_session):
        return True
    membership = await get_membership(db_session, user_id, org_id)
    if not membership:
        return False
    if membership.role_id in ACADEMY_ADMIN_ROLE_IDS:
        return True
    roles = await _load_applicable_roles(db_session, user_id, org_id)
    return any(_bucket_grants(role.rights, bucket, action) for role in roles)


async def authorize_admin(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    bucket: Bucket,
    action: Action,
    what: str = "manage configuration",
) -> int:
    """Ensure the caller may perform ``action`` on ``bucket`` data in ``org_id``.

    Returns the acting user's id; raises 401/403 otherwise.
    """
    user_id = require_user_id(current_user, what)
    if await is_user_superadmin(user_id, db_session):
        return user_id
    if not await get_membership(db_session, user_id, org_id):
        raise _deny("You are not a member of this organization")
    if await has_admin_permission(db_session, user_id, org_id, bucket, action):
        return user_id
    raise _deny(f"You don't have permission to {what}")


async def require_org_member(
    db_session: AsyncSession, current_user: AnyUser, org_id: int
) -> int:
    """Any signed-in member of the org (used by option/picker endpoints)."""
    user_id = require_user_id(current_user, "access this organization")
    if await is_user_superadmin(user_id, db_session):
        return user_id
    if not await get_membership(db_session, user_id, org_id):
        raise _deny("You are not a member of this organization")
    return user_id
