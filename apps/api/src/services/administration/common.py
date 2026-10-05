"""Small shared helpers for the Administration & Configuration services."""
import re
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.services.academic.common import bad_request, conflict, get_by_uuid_or_404, now  # noqa: F401

_SLUG_RE = re.compile(r"[^A-Z0-9]+")


def make_code(raw: Optional[str], fallback_name: str, max_len: int = 40) -> str:
    """Normalize an admin-typed code, deriving one from the name when empty.

    Codes are stable identifiers used by imports/templates (e.g. ``TRAINING-ROOM``),
    so they are upper-cased, dash-separated and limited to ``[A-Z0-9-]``.
    """
    source = (raw or "").strip() or fallback_name
    code = _SLUG_RE.sub("-", source.upper()).strip("-")[:max_len].strip("-")
    if not code:
        raise bad_request("A code (letters or digits) is required")
    return code


async def get_org_or_404(db_session: AsyncSession, org_id: int) -> Organization:
    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org
