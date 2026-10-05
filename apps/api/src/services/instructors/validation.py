"""Validation + effective-rate resolution for the Instructor module.

Rate precedence: the category defines the default rate (optionally per delivery
language) and an individual instructor may **override** it — e.g. category
"Senior Instructor" at 500 EGP/h, instructor override 650 EGP/h → 650. The
resolution order is:

1. Instructor's own ``hourly_rate`` (explicit override)
2. Category's language-specific rate (matching the chosen delivery language)
3. Category's base ``hourly_rate``

Work logs snapshot the applied rate, so changing precedence or rates never
rewrites historical amounts.
"""
import re
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.instructors.instructors import (
    Instructor,
    InstructorCategory,
    InstructorCategoryLanguageRate,
)


def _bad(detail: str, code: int = 400) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def validate_category_payload(data: dict) -> None:
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if len(name) < 2 or len(name) > 255:
            raise _bad("Category name must be between 2 and 255 characters")
    if data.get("hourly_rate") is not None and data["hourly_rate"] < 0:
        raise _bad("Hourly rate cannot be negative")
    for lr in data.get("language_rates") or []:
        language = (lr.get("language") if isinstance(lr, dict) else getattr(lr, "language", None)) or ""
        rate = lr.get("hourly_rate") if isinstance(lr, dict) else getattr(lr, "hourly_rate", None)
        if not language.strip():
            raise _bad("Each language rate needs a language label")
        if rate is None or rate < 0:
            raise _bad("Each language rate must be a non-negative number")


WEEKDAYS = ("sat", "sun", "mon", "tue", "wed", "thu", "fri")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def validate_availability(availability) -> None:
    """``{"slots": [{"day", "start", "end"}], "notes"}`` with HH:MM times."""
    if availability is None:
        return
    if not isinstance(availability, dict):
        raise _bad("Availability must be an object")
    slots = availability.get("slots") or []
    if not isinstance(slots, list) or len(slots) > 50:
        raise _bad("Availability slots must be a list (max 50)")
    for slot in slots:
        if not isinstance(slot, dict) or slot.get("day") not in WEEKDAYS:
            raise _bad(f"Each availability slot needs a day ({', '.join(WEEKDAYS)})")
        start, end = str(slot.get("start") or ""), str(slot.get("end") or "")
        if not _TIME_RE.match(start) or not _TIME_RE.match(end):
            raise _bad("Availability times must use HH:MM")
        if end <= start:
            raise _bad("An availability slot must end after it starts")


def validate_instructor_payload(data: dict) -> None:
    if data.get("hourly_rate") is not None and data["hourly_rate"] < 0:
        raise _bad("Hourly rate cannot be negative")
    langs = data.get("languages")
    if langs is not None and not isinstance(langs, list):
        raise _bad("Languages must be a list of labels")
    specs = data.get("specializations")
    if specs is not None and (not isinstance(specs, list) or any(not isinstance(x, str) for x in specs)):
        raise _bad("Specializations must be a list of labels")
    validate_availability(data.get("availability"))


def validate_worklog_payload(data: dict) -> None:
    if "hours" in data and data["hours"] is not None and data["hours"] <= 0:
        raise _bad("Hours must be greater than zero")


async def resolve_effective_rate(
    db_session: AsyncSession,
    instructor: Instructor,
    language: Optional[str],
) -> Tuple[float, str, Optional[str]]:
    """Return ``(rate, source, currency)`` for an instructor + delivery language.

    ``source`` is one of ``instructor``, ``category_language`` or ``category_base``.
    Raises 400 when no rate can be resolved.
    """
    category: Optional[InstructorCategory] = None
    if instructor.category_id is not None:
        category = (
            await db_session.execute(
                select(InstructorCategory).where(InstructorCategory.id == instructor.category_id)
            )
        ).scalars().first()
    currency = category.currency if category is not None else None

    # 1. Instructor-level override.
    if instructor.hourly_rate is not None:
        return instructor.hourly_rate, "instructor", currency

    if category is not None:
        # 2. Language-specific rate (case-insensitive label match).
        if language:
            rows = (
                await db_session.execute(
                    select(InstructorCategoryLanguageRate).where(
                        InstructorCategoryLanguageRate.category_id == category.id
                    )
                )
            ).scalars().all()
            for row in rows:
                if row.language.strip().lower() == language.strip().lower():
                    return row.hourly_rate, "category_language", category.currency

        # 3. Category base rate.
        if category.hourly_rate is not None:
            return category.hourly_rate, "category_base", category.currency

    raise _bad(
        "No rate configured for this instructor. Set a category rate "
        "(optionally per language) or an instructor hourly rate."
    )
