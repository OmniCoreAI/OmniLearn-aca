"""Instructor Category service — CRUD plus the editable per-language rate table.

Categories (and their language rates) are managed by superadmins / org admins /
holders of the ``instructors`` right, enforced via ``authorize_instructor_management``.
"""
from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.instructors.instructors import (
    Instructor,
    InstructorCategory,
    InstructorCategoryCreate,
    InstructorCategoryLanguageRate,
    InstructorCategoryLanguageRateRead,
    InstructorCategoryRead,
    InstructorCategoryUpdate,
)
from src.db.organizations import Organization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.instructors.authz import authorize_instructor_management
from src.services.instructors.validation import validate_category_payload


async def _get_category_or_404(db_session: AsyncSession, category_uuid: str) -> InstructorCategory:
    category = (
        await db_session.execute(
            select(InstructorCategory).where(InstructorCategory.category_uuid == category_uuid)
        )
    ).scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Instructor category not found")
    return category


async def _to_read(db_session: AsyncSession, category: InstructorCategory) -> InstructorCategoryRead:
    rate_rows = (
        await db_session.execute(
            select(InstructorCategoryLanguageRate)
            .where(InstructorCategoryLanguageRate.category_id == category.id)
            .order_by(InstructorCategoryLanguageRate.language.asc())  # type: ignore
        )
    ).scalars().all()
    language_rates = [
        InstructorCategoryLanguageRateRead(id=r.id, language=r.language, hourly_rate=r.hourly_rate)
        for r in rate_rows
    ]
    instructor_count = (
        await db_session.execute(
            select(func.count(Instructor.id)).where(Instructor.category_id == category.id)
        )
    ).scalar() or 0
    return InstructorCategoryRead(
        **category.model_dump(),
        language_rates=language_rates,
        instructor_count=int(instructor_count),
    )


async def _replace_language_rates(
    db_session: AsyncSession, category: InstructorCategory, rates
) -> None:
    """Fully replace a category's language-rate rows with ``rates`` (idempotent)."""
    existing = (
        await db_session.execute(
            select(InstructorCategoryLanguageRate).where(
                InstructorCategoryLanguageRate.category_id == category.id
            )
        )
    ).scalars().all()
    for row in existing:
        await db_session.delete(row)

    seen: set[str] = set()
    for lr in rates or []:
        language = (lr.language if hasattr(lr, "language") else lr["language"]).strip()
        rate = lr.hourly_rate if hasattr(lr, "hourly_rate") else lr["hourly_rate"]
        key = language.lower()
        if key in seen:
            continue  # dedupe by language label
        seen.add(key)
        db_session.add(
            InstructorCategoryLanguageRate(
                category_id=category.id,
                org_id=category.org_id,
                language=language,
                hourly_rate=rate,
            )
        )


async def create_category(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    payload: InstructorCategoryCreate,
) -> InstructorCategoryRead:
    await authorize_instructor_management(db_session, current_user, org_id, "create")

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    validate_category_payload(payload.model_dump())

    category = InstructorCategory(
        name=payload.name,
        description=payload.description,
        hourly_rate=payload.hourly_rate,
        currency=payload.currency,
        org_id=org_id,
        category_uuid=f"instructorcategory_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db_session.add(category)
    await db_session.flush()
    await db_session.refresh(category)
    await _replace_language_rates(db_session, category, payload.language_rates)
    await db_session.commit()
    await db_session.refresh(category)
    return await _to_read(db_session, category)


async def list_categories(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
) -> List[InstructorCategoryRead]:
    await authorize_instructor_management(db_session, current_user, org_id, "read")
    categories = (
        await db_session.execute(
            select(InstructorCategory)
            .where(InstructorCategory.org_id == org_id)
            .order_by(InstructorCategory.name.asc())  # type: ignore
        )
    ).scalars().all()
    return [await _to_read(db_session, c) for c in categories]


async def get_category(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    category_uuid: str,
) -> InstructorCategoryRead:
    category = await _get_category_or_404(db_session, category_uuid)
    await authorize_instructor_management(db_session, current_user, category.org_id, "read")
    return await _to_read(db_session, category)


async def update_category(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    category_uuid: str,
    payload: InstructorCategoryUpdate,
) -> InstructorCategoryRead:
    category = await _get_category_or_404(db_session, category_uuid)
    await authorize_instructor_management(db_session, current_user, category.org_id, "update")

    data = payload.model_dump(exclude_unset=True)
    validate_category_payload({**category.model_dump(), **data})

    language_rates = data.pop("language_rates", None)
    for key, value in data.items():
        setattr(category, key, value)
    category.update_date = str(datetime.now())
    db_session.add(category)

    if language_rates is not None:
        await _replace_language_rates(db_session, category, payload.language_rates)

    await db_session.commit()
    await db_session.refresh(category)
    return await _to_read(db_session, category)


async def delete_category(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    category_uuid: str,
) -> str:
    category = await _get_category_or_404(db_session, category_uuid)
    await authorize_instructor_management(db_session, current_user, category.org_id, "delete")
    # Instructors keep their profile; category_id is set NULL by the FK rule.
    await db_session.delete(category)
    await db_session.commit()
    return "Instructor category deleted"
