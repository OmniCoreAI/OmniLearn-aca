"""Validation + effective-rate resolution for the Instructor module.

Rate precedence (per product decision): the **Category rate always wins**. The
category additionally carries a table of per-delivery-language rates, so the
resolution order is:

1. Category's language-specific rate (matching the chosen delivery language)
2. Category's base ``hourly_rate``
3. Instructor's own ``hourly_rate`` (final fallback when no category rate exists)
"""
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


def validate_instructor_payload(data: dict) -> None:
    if data.get("hourly_rate") is not None and data["hourly_rate"] < 0:
        raise _bad("Hourly rate cannot be negative")
    langs = data.get("languages")
    if langs is not None and not isinstance(langs, list):
        raise _bad("Languages must be a list of labels")


def validate_worklog_payload(data: dict) -> None:
    if "hours" in data and data["hours"] is not None and data["hours"] <= 0:
        raise _bad("Hours must be greater than zero")


async def resolve_effective_rate(
    db_session: AsyncSession,
    instructor: Instructor,
    language: Optional[str],
) -> Tuple[float, str, Optional[str]]:
    """Return ``(rate, source, currency)`` for an instructor + delivery language.

    ``source`` is one of ``category_language``, ``category_base`` or ``instructor``.
    Raises 400 when no rate can be resolved.
    """
    category: Optional[InstructorCategory] = None
    if instructor.category_id is not None:
        category = (
            await db_session.execute(
                select(InstructorCategory).where(InstructorCategory.id == instructor.category_id)
            )
        ).scalars().first()

    if category is not None:
        # 1. Language-specific rate (case-insensitive label match).
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

        # 2. Category base rate.
        if category.hourly_rate is not None:
            return category.hourly_rate, "category_base", category.currency

    # 3. Instructor fallback rate.
    if instructor.hourly_rate is not None:
        return instructor.hourly_rate, "instructor", None

    raise _bad(
        "No rate configured for this instructor. Set a category rate "
        "(optionally per language) or an instructor hourly rate."
    )
