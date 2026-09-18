"""Dashboard sidebar navigation registry for the portal-visibility feature.

Mirrors the sections/items rendered by ``apps/web/components/Dashboard/Menus/DashLeftMenu.tsx``.
Keep the ``id`` values in sync with ``apps/web/lib/dash-nav-items.ts`` — they
are the shared vocabulary between the super-admin visibility toggles and the
frontend sidebar/route-guard.
"""

from typing import NamedTuple

# The 4 seeded, cross-org system roles (see src/services/setup/setup.py).
ROLE_UUID_ACADEMY_ADMIN = "role_global_admin"
ROLE_UUID_ORG_COORDINATOR = "role_global_maintainer"
ROLE_UUID_INSTRUCTOR = "role_global_instructor"
ROLE_UUID_TRAINEE = "role_global_user"

SYSTEM_ROLE_UUIDS = (
    ROLE_UUID_ACADEMY_ADMIN,
    ROLE_UUID_ORG_COORDINATOR,
    ROLE_UUID_INSTRUCTOR,
    ROLE_UUID_TRAINEE,
)


class NavItem(NamedTuple):
    id: str
    section: str  # overview | academic | teaching | manage


NAV_ITEMS: tuple[NavItem, ...] = (
    NavItem("home", "overview"),
    NavItem("postgraduate", "academic"),
    NavItem("training-programs", "academic"),
    NavItem("instructors", "academic"),
    NavItem("finance", "academic"),
    NavItem("cms-news", "academic"),
    NavItem("assignments", "teaching"),
    NavItem("library", "teaching"),
    NavItem("boards", "teaching"),
    NavItem("playgrounds", "teaching"),
    NavItem("users", "manage"),
    NavItem("payments", "manage"),
    NavItem("organization", "manage"),
    NavItem("analytics", "manage"),
)

NAV_ITEM_IDS: frozenset[str] = frozenset(item.id for item in NAV_ITEMS)

_ALL_ITEM_IDS = tuple(item.id for item in NAV_ITEMS)

# Teaching-oriented subset for the Instructor default — no finance, no
# users/org-settings, no cross-org analytics.
_INSTRUCTOR_DEFAULT_ITEM_IDS = (
    "home",
    "training-programs",
    "assignments",
    "library",
    "boards",
    "playgrounds",
)

# Default visibility per system role, used whenever no override row exists
# in `portal_role_nav_config` for that role_uuid. Academy Admin and
# Organization Coordinator default to everything, matching today's
# dashboard.action_access-gated, all-or-nothing behavior exactly (zero
# regression). Trainee defaults to nothing, matching today's reality that
# Trainees don't have dashboard.action_access and see an empty dashboard.
DEFAULT_VISIBILITY_BY_ROLE_UUID: dict[str, tuple[str, ...]] = {
    ROLE_UUID_ACADEMY_ADMIN: _ALL_ITEM_IDS,
    ROLE_UUID_ORG_COORDINATOR: _ALL_ITEM_IDS,
    ROLE_UUID_INSTRUCTOR: _INSTRUCTOR_DEFAULT_ITEM_IDS,
    ROLE_UUID_TRAINEE: (),
}
