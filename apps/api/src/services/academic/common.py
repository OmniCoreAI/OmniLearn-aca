"""Shared helpers for the academic core (calendar, catalog, curricula, offerings).

Org-level master data (academic years, terms, catalog courses, offerings
without a cohort) is managed by organization admins/maintainers; everyone in
the organization can read it. Program-scoped data (curricula, cohort
offerings) delegates to the owning Program's RBAC via ``check_resource_access``.
"""
import re
from datetime import datetime
from typing import Optional, Type, TypeVar

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import require_org_admin, require_org_membership

T = TypeVar("T")

Principal = PublicUser | AnonymousUser | APITokenUser


def now() -> str:
    return str(datetime.now())


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


async def require_academic_member(current_user: Principal, org_id: int, db_session: AsyncSession) -> None:
    await require_org_membership(resolve_acting_user_id(current_user), org_id, db_session)


async def require_academic_manager(current_user: Principal, org_id: int, db_session: AsyncSession) -> None:
    await require_org_admin(resolve_acting_user_id(current_user), org_id, db_session)


async def get_by_uuid_or_404(
    db_session: AsyncSession, model: Type[T], field, value: Optional[str], label: str
) -> T:
    if not value:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    obj = (await db_session.execute(select(model).where(field == value))).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


async def get_by_id(db_session: AsyncSession, model: Type[T], obj_id: Optional[int]) -> Optional[T]:
    if obj_id is None:
        return None
    return await db_session.get(model, obj_id)


async def get_user_by_uuid_or_400(db_session: AsyncSession, user_uuid: str) -> User:
    user = (await db_session.execute(select(User).where(User.user_uuid == user_uuid))).scalars().first()
    if not user:
        raise bad_request("User not found")
    return user


# ---------------------------------------------------------------------------
# Code generation / validation (codes are system-generated or validated so two
# administrators cannot invent conflicting conventions).
# ---------------------------------------------------------------------------

CODE_RE = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)*$")
ACADEMIC_YEAR_CODE_RE = re.compile(r"^(\d{4})/(\d{4})$")
CURRICULUM_VERSION_RE = re.compile(r"^\d{4}\.\d{1,3}$")
PROGRAM_DEGREE_PREFIX = {"diploma": "DIP", "masters": "MSC", "phd": "PHD"}


def normalize_code(raw: Optional[str], label: str, max_len: int = 32) -> str:
    code = (raw or "").strip().upper().replace(" ", "-").replace("_", "-")
    if not code or len(code) > max_len or not CODE_RE.match(code):
        raise bad_request(
            f"{label} code must use letters, digits and single dashes (e.g. AI-501), max {max_len} chars"
        )
    return code


def validate_academic_year_code(code: str) -> tuple[int, int]:
    match = ACADEMIC_YEAR_CODE_RE.match((code or "").strip())
    if not match:
        raise bad_request("Academic year code must look like '2026/2027'")
    first, second = int(match.group(1)), int(match.group(2))
    if second != first + 1:
        raise bad_request("Academic year must span two consecutive years (e.g. 2026/2027)")
    return first, second


def validate_curriculum_version(version: str) -> str:
    version = (version or "").strip()
    if not CURRICULUM_VERSION_RE.match(version):
        raise bad_request("Curriculum version must look like '2026.1'")
    return version


def validate_date_range(start: Optional[str], end: Optional[str], label: str = "Start date") -> None:
    if start and end and start > end:
        raise bad_request(f"{label} must be before end date")


def program_code_hint(program_level: Optional[str], field: str) -> str:
    """Suggested program code in the recommended ``[DEGREE]-[FIELD]`` form."""
    level = getattr(program_level, "value", program_level) or ""
    prefix = PROGRAM_DEGREE_PREFIX.get(str(level).lower(), "PG")
    return normalize_code(f"{prefix}-{field}", "Program")
