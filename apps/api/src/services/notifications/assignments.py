"""Tell staff when they are given something to teach, coordinate or edit.

Every assignment lands in the person's in-app inbox and, depending on the
academy's Communication settings, as an email / SMS (catalog events
``teaching_assigned``, ``coordination_assigned``, ``contributor_added``).
Call these after the assignment is committed; they never raise.
"""
from typing import Iterable, Optional

from sqlmodel.ext.asyncio.session import AsyncSession

from src.services.notifications import inbox
from src.services.notifications.dispatcher import Resource, notify, org_language, org_variables

# role key -> (catalog event, English label, Arabic label)
ROLES = {
    "course_instructor": ("teaching_assigned", "course instructor", "محاضر المقرر"),
    "lecturer": ("teaching_assigned", "lecturer", "محاضر"),
    "assistant": ("teaching_assigned", "teaching assistant", "معيد"),
    "session_instructor": ("teaching_assigned", "session instructor", "محاضر الجلسة"),
    "training_coordinator": ("coordination_assigned", "coordinator", "منسق"),
    "program_coordinator": ("coordination_assigned", "program coordinator", "منسق البرنامج"),
    "cohort_coordinator": ("coordination_assigned", "cohort coordinator", "منسق الدفعة"),
    "entity_coordinator": ("coordination_assigned", "entity coordinator", "منسق الجهة"),
    "contributor": ("contributor_added", "contributor", "مساهم"),
}


def slug(uuid: str, prefix: str) -> str:
    return uuid[len(prefix):] if uuid.startswith(prefix) else uuid


async def staff_assigned(
    db_session: AsyncSession,
    org_id: int,
    user_ids: Iterable[Optional[int]],
    role: str,
    item_name: str,
    path: str,
    *,
    actor_id: Optional[int] = None,
    resource: Optional[Resource] = None,
) -> None:
    """Notify each newly assigned user (never the person who made the change)."""
    recipients = [u for u in dict.fromkeys(user_ids) if u and u != actor_id]
    if not recipients or role not in ROLES:
        return
    event, label_en, label_ar = ROLES[role]
    language = await org_language(db_session, org_id)
    base = (await org_variables(db_session, org_id)).get("platform_url", "")
    await inbox.push(
        db_session, org_id, recipients, event,
        f"You are now {label_en} of {item_name}",
        link=path, payload={"role": role, "name": item_name},
    )
    await notify(
        db_session, org_id, event, recipients,
        {
            "role_label": label_ar if language == "ar" else label_en,
            "item_name": item_name,
            "item_url": f"{base}{path}" if base else "",
        },
        resource=resource,
    )
