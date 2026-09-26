from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.auth import get_current_user, resolve_acting_user_id
from src.security.org_auth import require_org_membership
from src.services.calendar.events import get_calendar_events

router = APIRouter()


def _parse_day(value: Optional[str], fallback: date) -> datetime:
    if not value:
        return datetime.combine(fallback, datetime.min.time())
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}")


@router.get(
    "/events",
    summary="Calendar events for the current user",
    description=(
        "Lectures, class sessions, exams, assignment deadlines, academic-term milestones, "
        "training programs and admission appointments between `start` and `end`, filtered by "
        "the caller's role: org admins/coordinators see everything, instructors see what they "
        "teach, learners see what they are enrolled in. Defaults to the current month."
    ),
)
async def api_calendar_events(
    org_id: int,
    start: Optional[str] = Query(default=None, description="ISO date/datetime, inclusive"),
    end: Optional[str] = Query(default=None, description="ISO date/datetime, exclusive"),
    current_user: PublicUser | AnonymousUser | APITokenUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = resolve_acting_user_id(current_user)
    await require_org_membership(user_id, org_id, db_session)

    today = date.today()
    month_start = today.replace(day=1)
    range_start = _parse_day(start, month_start)
    range_end = _parse_day(end, (month_start + timedelta(days=32)).replace(day=1))
    return await get_calendar_events(org_id, user_id, db_session, range_start, range_end)
