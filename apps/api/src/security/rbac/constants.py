"""
RBAC Role Constants

This module defines role ID constants used throughout the RBAC system.
Using constants instead of magic numbers improves code maintainability and clarity.

Role Hierarchy (global org roles):
    ACADEMY_ADMIN (1) - Full academy administration: programs, courses, sessions, certificates, reports
    ENTITY_COORDINATOR (2) - Manages ONE entity's members, groups and training (scoped by
        EntityMember.is_coordinator); no academy-wide admin power
    INSTRUCTOR (3) - Content delivery, sessions, attendance, and question bank
    TRAINEE (4+) - Learner access; custom roles use configurable permissions
"""

# Core role IDs - these match the database seed data
ADMIN_ROLE_ID = 1
MAINTAINER_ROLE_ID = 2
INSTRUCTOR_ROLE_ID = 3
TRAINEE_ROLE_ID = 4
# Role 2 is the Entity Coordinator (منسق الجهة).
ENTITY_COORDINATOR_ROLE_ID = MAINTAINER_ROLE_ID

# Role ID sets for common checks
ADMIN_ROLE_IDS = frozenset([ADMIN_ROLE_ID])
# Roles with academy-wide administrative power. Role 2 (historically
# "maintainer", now the Entity Coordinator) is deliberately excluded: it is
# scoped to its own entity by ``require_entity_access``.
ACADEMY_ADMIN_ROLE_IDS = frozenset([ADMIN_ROLE_ID])
# Deprecated alias kept for external/EE imports; it now means academy admins
# only. New code must use ACADEMY_ADMIN_ROLE_IDS.
ADMIN_OR_MAINTAINER_ROLE_IDS = ACADEMY_ADMIN_ROLE_IDS


def is_admin(role_id: int) -> bool:
    """Check if the role ID is an admin role."""
    return role_id == ADMIN_ROLE_ID


def is_academy_admin(role_id: int) -> bool:
    """Check if the role ID has academy-wide administrative power."""
    return role_id in ACADEMY_ADMIN_ROLE_IDS


def is_admin_or_maintainer(role_id: int) -> bool:
    """Deprecated alias of ``is_academy_admin`` (role 2 is entity-scoped now)."""
    return is_academy_admin(role_id)


def has_elevated_privileges(role_id: int) -> bool:
    """
    Check if the role has elevated privileges.

    Elevated privileges are academy-wide admin roles.
    """
    return role_id in ACADEMY_ADMIN_ROLE_IDS
