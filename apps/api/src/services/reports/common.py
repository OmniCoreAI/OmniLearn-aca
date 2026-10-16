"""Shared helpers for the reports: date ranges, monthly buckets, rounding."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.rbac.constants import ACADEMY_ADMIN_ROLE_IDS
from src.security.superadmin import is_user_superadmin

DEFAULT_MONTHS = 12


class ReportRange(BaseModel):
    date_from: str
    date_to: str
    previous_from: str
    previous_to: str
    months: list[str]


@dataclass
class Range:
    start: date
    end: date

    @property
    def prev(self) -> "Range":
        """What to compare with.

        Ranges starting on the 1st compare with the same dates N months earlier
        (N = months the range touches): whole months with the previous whole
        months, "this month so far" with last month to the same day, the last
        12 months with the 12 before. Any other range compares with the same
        number of days just before it.
        """
        if self.start.day == 1:
            n = (self.end.year - self.start.year) * 12 + self.end.month - self.start.month + 1
            month_end = (self.end + timedelta(days=1)).day == 1
            start = _shift_months(self.start, -n)
            end = _shift_months(self.end, -n, to_month_end=month_end)
            return Range(start, min(end, self.start - timedelta(days=1)))
        prev_end = self.start - timedelta(days=1)
        length = (self.end - self.start).days + 1
        return Range(prev_end - timedelta(days=length - 1), prev_end)

    def months(self) -> list[str]:
        out: list[str] = []
        y, m = self.start.year, self.start.month
        while (y, m) <= (self.end.year, self.end.month):
            out.append(f"{y}-{m:02d}")
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        return out

    def contains(self, value: Optional[date]) -> bool:
        return value is not None and self.start <= value <= self.end

    def to_read(self) -> ReportRange:
        p = self.prev
        return ReportRange(
            date_from=self.start.isoformat(),
            date_to=self.end.isoformat(),
            previous_from=p.start.isoformat(),
            previous_to=p.end.isoformat(),
            months=self.months(),
        )


def _shift_months(value: date, months: int, to_month_end: bool = False) -> date:
    """Move a date by whole months, clamping the day (31 Mar - 1 month = 28/29 Feb)."""
    y, m = value.year, value.month + months
    while m <= 0:
        y, m = y - 1, m + 12
    while m > 12:
        y, m = y + 1, m - 12
    last = (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)).day
    return date(y, m, last if to_month_end else min(value.day, last))


def _parse_day(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")


def resolve_range(date_from: Optional[str], date_to: Optional[str], today: Optional[date] = None) -> Range:
    """Inclusive range; defaults to the last 12 months ending today."""
    today = today or date.today()
    end = _parse_day(date_to, "date_to") if date_to else today
    if date_from:
        start = _parse_day(date_from, "date_from")
    else:
        y, m = end.year, end.month - (DEFAULT_MONTHS - 1)
        while m <= 0:
            y, m = y - 1, m + 12
        start = date(y, m, 1)
    if start > end:
        raise HTTPException(status_code=400, detail="date_from must be on or before date_to")
    return Range(start, end)


def to_day(value: Optional[str]) -> Optional[date]:
    """Parse the app's stored stamps ('2026-10-06', '2026-10-06 12:00:00.1', ISO with T/Z)."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None


def month_of(value: Optional[date]) -> Optional[str]:
    return f"{value.year}-{value.month:02d}" if value else None


def money(value: float) -> float:
    return round(float(value or 0) + 0.0, 2)


def pct(part: float, whole: float) -> float:
    return round(part * 100 / whole, 1) if whole else 0.0


async def org_or_404(db_session: AsyncSession, org_id: int) -> Organization:
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def authorize_reports(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
) -> int:
    """Academy-wide reports are for superadmins and the academy's admins."""
    if isinstance(current_user, (AnonymousUser, APITokenUser)) or not getattr(current_user, "id", None):
        raise HTTPException(status_code=401, detail="Authentication required")
    if await is_user_superadmin(current_user.id, db_session):
        return current_user.id
    membership = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == current_user.id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    if not membership or membership.role_id not in ACADEMY_ADMIN_ROLE_IDS:
        raise HTTPException(status_code=403, detail="Only academy admins can view reports")
    return current_user.id
