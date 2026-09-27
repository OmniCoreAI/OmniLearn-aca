"""Administration overview: entity counts for the landing page checklist.

Each configuration module registers a counter here so the overview grows with
the layer without the landing page knowing every table.
"""
from typing import Callable, Dict, List, Tuple

from fastapi import HTTPException
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.instructors.instructors import Instructor, InstructorCategory
from src.db.usergroups import UserGroup
from src.services.administration.authz import (
    AnyUser,
    require_user_id,
    has_admin_permission,
)

# (key, org_id -> SELECT count(...)) in checklist order.
Counter = Callable[[int], object]
OVERVIEW_COUNTERS: List[Tuple[str, Counter]] = [
    ("instructor_categories", lambda org_id: select(func.count(InstructorCategory.id)).where(InstructorCategory.org_id == org_id)),
    ("instructors", lambda org_id: select(func.count(Instructor.id)).where(Instructor.org_id == org_id)),
    # Hand-made groups only (entity "all members" / audience groups are automatic).
    ("usergroups", lambda org_id: select(func.count(UserGroup.id)).where(UserGroup.org_id == org_id, UserGroup.group_type != "system")),
    ("courses", lambda org_id: select(func.count(Course.id)).where(Course.org_id == org_id)),
]


def register_overview_counter(key: str, counter: Counter) -> None:
    if key not in {k for k, _ in OVERVIEW_COUNTERS}:
        OVERVIEW_COUNTERS.append((key, counter))


async def get_overview(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> Dict[str, int]:
    user_id = require_user_id(current_user, "view the administration overview")
    buckets = ("configuration", "entities", "communications", "instructors")
    allowed = False
    for bucket in buckets:
        if await has_admin_permission(db_session, user_id, org_id, bucket, "read"):  # type: ignore[arg-type]
            allowed = True
            break
    if not allowed:
        raise HTTPException(status_code=403, detail="You don't have access to administration")
    counts: Dict[str, int] = {}
    for key, counter in OVERVIEW_COUNTERS:
        counts[key] = int((await db_session.execute(counter(org_id))).scalar() or 0)
    return counts
