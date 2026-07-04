"""Shared validation + coordinator resolution for the Postgraduate module.

Keeps the query/mutation wrappers thin: services call these helpers to enforce
the business rules (field bounds, code uniqueness, fee coherence, academic year
format, and legal status transitions) and to turn a public ``coordinator_uuid``
into an internal ``coordinator_id`` after checking same-org membership.
"""
import re
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.cohorts import CohortStatus
from src.db.academic.programs import Program, ProgramStatus
from src.db.academic.training_programs import TrainingProgram
from src.db.user_organizations import UserOrganization
from src.db.users import User

ACADEMIC_YEAR_RE = re.compile(r"^\d{4}(/\d{4})?$")

# Allowed status transitions (self-transition always allowed for idempotency).
PROGRAM_STATUS_TRANSITIONS = {
    ProgramStatus.DRAFT: {ProgramStatus.ACTIVE, ProgramStatus.ARCHIVED},
    ProgramStatus.ACTIVE: {ProgramStatus.SUSPENDED, ProgramStatus.ARCHIVED},
    ProgramStatus.SUSPENDED: {ProgramStatus.ACTIVE, ProgramStatus.ARCHIVED},
    ProgramStatus.ARCHIVED: set(),
}
COHORT_STATUS_TRANSITIONS = {
    CohortStatus.UPCOMING: {CohortStatus.ACTIVE, CohortStatus.ARCHIVED},
    CohortStatus.ACTIVE: {CohortStatus.COMPLETED, CohortStatus.ARCHIVED},
    CohortStatus.COMPLETED: {CohortStatus.ARCHIVED},
    CohortStatus.ARCHIVED: set(),
}


def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def assert_status_transition(current, target, transitions) -> None:
    if current is None or target is None or current == target:
        return
    allowed = transitions.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Illegal status transition: {current.value} -> {target.value}",
        )


def validate_program_payload(data: dict) -> None:
    """Validate a partial program payload (create or update ``exclude_unset``)."""
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if len(name) < 2 or len(name) > 255:
            raise _bad("Program name must be between 2 and 255 characters")

    if data.get("capacity") is not None and data["capacity"] < 0:
        raise _bad("Capacity cannot be negative")

    start, end = data.get("start_date"), data.get("end_date")
    if start and end and start > end:
        raise _bad("Start date must be before end date")

    if data.get("is_paid") is True:
        price = data.get("price")
        currency = data.get("currency")
        if price is None or price <= 0:
            raise _bad("A paid program requires a positive price")
        if not currency:
            raise _bad("A paid program requires a currency")


def validate_cohort_payload(data: dict) -> None:
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if len(name) < 2 or len(name) > 255:
            raise _bad("Cohort name must be between 2 and 255 characters")

    if data.get("capacity") is not None and data["capacity"] < 0:
        raise _bad("Capacity cannot be negative")

    academic_year = data.get("academic_year")
    if academic_year and not ACADEMIC_YEAR_RE.match(academic_year):
        raise _bad("Academic year must look like '2025' or '2025/2026'")

    start, end = data.get("start_date"), data.get("end_date")
    if start and end and start > end:
        raise _bad("Start date must be before end date")


async def assert_program_code_unique(
    db_session: AsyncSession, org_id: int, code: Optional[str], exclude_id: Optional[int] = None
) -> None:
    if not code:
        return
    statement = select(Program).where(
        Program.org_id == org_id, Program.code == code
    )
    existing = (await db_session.execute(statement)).scalars().all()
    for program in existing:
        if program.id != exclude_id:
            raise HTTPException(
                status_code=409, detail=f"Program code '{code}' already exists in this organization"
            )


def validate_training_program_payload(data: dict) -> None:
    """Validate a partial training-program payload (create or update)."""
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if len(name) < 2 or len(name) > 255:
            raise _bad("Training program name must be between 2 and 255 characters")

    if data.get("capacity") is not None and data["capacity"] < 0:
        raise _bad("Capacity cannot be negative")

    start, end = data.get("start_date"), data.get("end_date")
    if start and end and start > end:
        raise _bad("Start date must be before end date")

    if data.get("is_paid") is True:
        price = data.get("price")
        currency = data.get("currency")
        if price is None or price <= 0:
            raise _bad("A paid training program requires a positive price")
        if not currency:
            raise _bad("A paid training program requires a currency")


async def assert_trainingprogram_code_unique(
    db_session: AsyncSession, org_id: int, code: Optional[str], exclude_id: Optional[int] = None
) -> None:
    if not code:
        return
    statement = select(TrainingProgram).where(
        TrainingProgram.org_id == org_id, TrainingProgram.code == code
    )
    existing = (await db_session.execute(statement)).scalars().all()
    for tp in existing:
        if tp.id != exclude_id:
            raise HTTPException(
                status_code=409,
                detail=f"Training program code '{code}' already exists in this organization",
            )


async def resolve_org_user(
    db_session: AsyncSession,
    org_id: int,
    user_uuid: Optional[str],
    label: str = "User",
) -> Optional[int]:
    """Resolve a public user_uuid to an internal id, requiring same-org membership.

    An empty string clears the reference (returns None); a missing key should be
    handled by the caller (do not touch the existing value).
    """
    if user_uuid is None or user_uuid == "":
        return None

    user = (
        await db_session.execute(select(User).where(User.user_uuid == user_uuid))
    ).scalars().first()
    if not user:
        raise _bad(f"{label} not found")

    membership = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.org_id == org_id,
            )
        )
    ).scalars().first()
    if not membership:
        raise _bad(f"{label} must be a member of the organization")

    return user.id


async def resolve_coordinator(
    db_session: AsyncSession, org_id: int, coordinator_uuid: Optional[str]
) -> Optional[int]:
    """Resolve a coordinator user_uuid to an internal id (same-org member)."""
    return await resolve_org_user(db_session, org_id, coordinator_uuid, label="Coordinator")
