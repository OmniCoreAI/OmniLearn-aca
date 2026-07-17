"""Instructor service — CRUD for the User-extension instructor profile."""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.instructors.instructors import (
    Instructor,
    InstructorCategory,
    InstructorCreate,
    InstructorRead,
    InstructorStatus,
    InstructorUpdate,
)
from src.db.organizations import Organization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.services.academic.authors import get_user_author
from src.services.academic.validation import resolve_org_user
from src.services.instructors.authz import authorize_instructor_management
from src.services.instructors.categories import _to_read as _category_to_read
from src.services.instructors.validation import validate_instructor_payload


async def _get_instructor_or_404(db_session: AsyncSession, instructor_uuid: str) -> Instructor:
    instructor = (
        await db_session.execute(
            select(Instructor).where(Instructor.instructor_uuid == instructor_uuid)
        )
    ).scalars().first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor


async def _resolve_category_id(
    db_session: AsyncSession, org_id: int, category_uuid: Optional[str]
) -> Optional[int]:
    if not category_uuid:
        return None
    category = (
        await db_session.execute(
            select(InstructorCategory).where(InstructorCategory.category_uuid == category_uuid)
        )
    ).scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Instructor category not found")
    if category.org_id != org_id:
        raise HTTPException(status_code=400, detail="Category belongs to a different organization")
    return category.id


async def _to_read(db_session: AsyncSession, instructor: Instructor) -> InstructorRead:
    user = await get_user_author(db_session, instructor.user_id)
    category = None
    if instructor.category_id is not None:
        cat = (
            await db_session.execute(
                select(InstructorCategory).where(InstructorCategory.id == instructor.category_id)
            )
        ).scalars().first()
        if cat:
            category = await _category_to_read(db_session, cat)
    return InstructorRead(**instructor.model_dump(), user=user, category=category)


async def create_instructor(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    payload: InstructorCreate,
) -> InstructorRead:
    await authorize_instructor_management(db_session, current_user, org_id, "create")

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    validate_instructor_payload(payload.model_dump())

    user_id = await resolve_org_user(db_session, org_id, payload.user_uuid, label="Instructor user")
    if not user_id:
        raise HTTPException(status_code=400, detail="A valid user is required for an instructor")

    # Enforce 1:1 (org, user) with a friendly error before hitting the constraint.
    existing = (
        await db_session.execute(
            select(Instructor).where(
                Instructor.org_id == org_id, Instructor.user_id == user_id
            )
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            status_code=409, detail="This user is already an instructor in this organization"
        )

    category_id = await _resolve_category_id(db_session, org_id, payload.category_uuid)

    instructor = Instructor(
        department=payload.department,
        languages=payload.languages,
        contact_info=payload.contact_info,
        hourly_rate=payload.hourly_rate,
        status=payload.status or InstructorStatus.ACTIVE,
        org_id=org_id,
        user_id=user_id,
        category_id=category_id,
        instructor_uuid=f"instructor_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        extra_metadata=payload.extra_metadata,
    )
    db_session.add(instructor)
    await db_session.commit()
    await db_session.refresh(instructor)
    return await _to_read(db_session, instructor)


async def list_instructors(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
) -> List[InstructorRead]:
    await authorize_instructor_management(db_session, current_user, org_id, "read")
    instructors = (
        await db_session.execute(
            select(Instructor)
            .where(Instructor.org_id == org_id)
            .order_by(Instructor.creation_date.desc())  # type: ignore
        )
    ).scalars().all()
    return [await _to_read(db_session, i) for i in instructors]


async def get_instructor(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    instructor_uuid: str,
) -> InstructorRead:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "read")
    return await _to_read(db_session, instructor)


async def update_instructor(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    instructor_uuid: str,
    payload: InstructorUpdate,
) -> InstructorRead:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "update")

    data = payload.model_dump(exclude_unset=True)
    validate_instructor_payload({**instructor.model_dump(), **data})

    if "category_uuid" in data:
        instructor.category_id = await _resolve_category_id(
            db_session, instructor.org_id, data.pop("category_uuid")
        )

    for key, value in data.items():
        setattr(instructor, key, value)
    instructor.update_date = str(datetime.now())

    db_session.add(instructor)
    await db_session.commit()
    await db_session.refresh(instructor)
    return await _to_read(db_session, instructor)


async def delete_instructor(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    instructor_uuid: str,
) -> str:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "delete")
    await db_session.delete(instructor)
    await db_session.commit()
    return "Instructor deleted"
