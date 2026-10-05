"""Emit catalog events from the learning flows (enrol, complete, certificate, assign)."""
from typing import List

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.services.notifications.dispatcher import notify, org_variables


def _slug(uuid: str, prefix: str) -> str:
    return uuid[len(prefix):] if uuid.startswith(prefix) else uuid


async def course_variables(db_session: AsyncSession, course: Course) -> dict:
    base = (await org_variables(db_session, course.org_id)).get("platform_url", "")
    return {
        "course_name": course.name,
        "course_url": f"{base}/course/{_slug(course.course_uuid, 'course_')}" if base else "",
    }


async def course_enrolled(db_session: AsyncSession, course: Course, user_id: int) -> None:
    await notify(
        db_session, course.org_id, "course_enrolled", [user_id], await course_variables(db_session, course),
        resource=("course", course.course_uuid), dedupe_prefix=f"course_enrolled:{course.course_uuid}",
    )


async def course_completed(db_session: AsyncSession, course: Course, user_id: int, completion_date: str) -> None:
    await notify(
        db_session, course.org_id, "course_completed", [user_id],
        {**(await course_variables(db_session, course)), "completion_date": completion_date[:10]},
        resource=("course", course.course_uuid), dedupe_prefix=f"course_completed:{course.course_uuid}",
    )


async def certificate_issued(db_session: AsyncSession, course: Course, user_id: int, certificate_uuid: str) -> None:
    variables = await course_variables(db_session, course)
    base = (await org_variables(db_session, course.org_id)).get("platform_url", "")
    variables.update(
        certificate_id=certificate_uuid,
        certificate_url=f"{base}/certificates/{certificate_uuid}/verify" if base else "",
    )
    await notify(
        db_session, course.org_id, "certificate_issued", [user_id], variables,
        resource=("course", course.course_uuid), dedupe_prefix=f"certificate_issued:{certificate_uuid}",
    )


async def _on_audience_covered(
    db_session: AsyncSession, org_id: int, resource_type: str, resource_uuid: str, user_ids: List[int]
) -> None:
    """``course_assigned`` for users newly covered by an audience assignment."""
    from src.db.administration.audience import AudienceAssignment, AudienceMode
    from src.services.administration.audience import _resource_info

    info = await _resource_info(db_session, resource_type, resource_uuid, required=False)
    if info is None:
        return
    base = (await org_variables(db_session, org_id)).get("platform_url", "")
    if resource_type == "course":
        url = f"{base}/course/{_slug(resource_uuid, 'course_')}"
    else:
        url = f"{base}/training-programs/{_slug(resource_uuid, 'trainingprogram_')}"
    due_dates = [
        d
        for d in (
            await db_session.execute(
                select(AudienceAssignment.due_date).where(
                    AudienceAssignment.resource_type == resource_type,
                    AudienceAssignment.resource_uuid == resource_uuid,
                    AudienceAssignment.mode == AudienceMode.ASSIGNED.value,
                )
            )
        ).scalars().all()
        if d
    ]
    await notify(
        db_session, org_id, "course_assigned", user_ids,
        {"course_name": info.name, "course_url": url if base else "", "due_date": min(due_dates) if due_dates else ""},
        resource=(resource_type, resource_uuid), dedupe_prefix=f"course_assigned:{resource_type}:{resource_uuid}",
    )


def register() -> None:
    from src.services.administration.audience import register_audience_listener

    register_audience_listener(_on_audience_covered)


async def password_setup(db_session: AsyncSession, org_id: int, user_id: int) -> bool:
    """Invite an academy-created account to choose its password (reset-code flow)."""
    from urllib.parse import quote

    from src.db.organizations import Organization
    from src.db.users import User
    from src.services.users.password_reset import create_password_setup_code

    org = await db_session.get(Organization, org_id)
    user = await db_session.get(User, user_id)
    if org is None or user is None or not user.email:
        return False
    code = create_password_setup_code(user, org)
    if not code:
        return False
    base = (await org_variables(db_session, org_id)).get("platform_url", "")
    link = f"{base}/reset?email={quote(user.email, safe='')}&resetCode={code}" if base else ""
    queued = await notify(db_session, org_id, "password_setup", [user_id], {"setup_code": code, "setup_link": link})
    return queued > 0
