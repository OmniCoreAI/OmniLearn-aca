from typing import List, Optional
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser, APITokenUser
from src.db.organizations import Organization
from src.db.courses.courses import Course
from src.db.academic.training_programs import (
    TrainingProgram,
    TrainingProgramCreate,
    TrainingProgramRead,
    TrainingProgramUpdate,
)
from src.db.academic.links import TrainingProgramCourse, TrainingProgramCourseRead
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import require_org_membership
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import (
    build_creator_author,
    ensure_coordinator_authorship,
    get_resource_authors,
    get_user_author,
)
from src.services.academic.course_profiles import get_profile_read_for_course
from src.services.academic.validation import (
    assert_trainingprogram_code_unique,
    resolve_coordinator,
    validate_training_program_payload,
)


async def _get_tp_or_404(db_session: AsyncSession, tp_uuid: str) -> TrainingProgram:
    statement = select(TrainingProgram).where(
        TrainingProgram.trainingprogram_uuid == tp_uuid
    )
    tp = (await db_session.execute(statement)).scalars().first()
    if not tp:
        raise HTTPException(status_code=404, detail="Training program not found")
    return tp


async def _to_read(db_session: AsyncSession, tp: TrainingProgram) -> TrainingProgramRead:
    """Assemble a TrainingProgramRead with authors + embedded coordinator."""
    authors = await get_resource_authors(db_session, tp.trainingprogram_uuid)
    coordinator = await get_user_author(db_session, tp.coordinator_id)
    return TrainingProgramRead(**tp.model_dump(), authors=authors, coordinator=coordinator)


async def create_training_program(
    request: Request,
    org_id: int,
    tp_object: TrainingProgramCreate,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> TrainingProgramRead:
    tp = TrainingProgram.model_validate(tp_object, update={"org_id": org_id})

    await check_resource_access(
        request, db_session, current_user, "trainingprogram_x", AccessAction.CREATE
    )
    await require_org_membership(
        resolve_acting_user_id(current_user), org_id, db_session
    )

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    validate_training_program_payload(tp_object.model_dump())
    await assert_trainingprogram_code_unique(db_session, org_id, tp_object.code)
    coordinator_id = await resolve_coordinator(
        db_session, org_id, tp_object.coordinator_uuid
    )

    tp.org_id = org_id
    tp.coordinator_id = coordinator_id
    tp.trainingprogram_uuid = f"trainingprogram_{uuid4()}"
    tp.creation_date = str(datetime.now())
    tp.update_date = str(datetime.now())

    author = build_creator_author(
        tp.trainingprogram_uuid, resolve_acting_user_id(current_user)
    )

    try:
        db_session.add(tp)
        await db_session.flush()
        await db_session.refresh(tp)
        db_session.add(author)
        # Coordinator gets maintainer access so they can manage their program.
        await ensure_coordinator_authorship(db_session, tp.trainingprogram_uuid, coordinator_id)
        await db_session.commit()
        await db_session.refresh(tp)
    except Exception:
        await db_session.rollback()
        raise

    return await _to_read(db_session, tp)


async def get_training_program(
    request: Request,
    tp_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> TrainingProgramRead:
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        tp.trainingprogram_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )
    return await _to_read(db_session, tp)


async def get_training_programs_by_org(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
) -> List[TrainingProgramRead]:
    await require_org_membership(
        resolve_acting_user_id(current_user), org_id, db_session
    )

    statement = (
        select(TrainingProgram)
        .where(TrainingProgram.org_id == org_id)
        .order_by(TrainingProgram.creation_date.desc())  # type: ignore
        .offset((page - 1) * limit)
        .limit(limit)
    )
    tps = (await db_session.execute(statement)).scalars().all()

    return [await _to_read(db_session, tp) for tp in tps]


async def update_training_program(
    request: Request,
    tp_uuid: str,
    tp_object: TrainingProgramUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> TrainingProgramRead:
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request, db_session, current_user, tp.trainingprogram_uuid, AccessAction.UPDATE
    )

    update_data = tp_object.model_dump(exclude_unset=True)

    # Validate the merged view (fee coherence, date coherence, bounds).
    merged = {**tp.model_dump(), **update_data}
    validate_training_program_payload(merged)

    if "code" in update_data:
        await assert_trainingprogram_code_unique(
            db_session, tp.org_id, update_data["code"], exclude_id=tp.id
        )

    new_coordinator_id = None
    coordinator_changed = "coordinator_uuid" in update_data
    if coordinator_changed:
        coordinator_uuid = update_data.pop("coordinator_uuid")
        new_coordinator_id = await resolve_coordinator(
            db_session, tp.org_id, coordinator_uuid
        )
        tp.coordinator_id = new_coordinator_id

    for key, value in update_data.items():
        setattr(tp, key, value)
    tp.update_date = str(datetime.now())

    db_session.add(tp)
    if coordinator_changed:
        await ensure_coordinator_authorship(
            db_session, tp.trainingprogram_uuid, new_coordinator_id
        )
    await db_session.commit()
    await db_session.refresh(tp)

    return await _to_read(db_session, tp)


async def set_training_program_coordinator(
    request: Request,
    tp_uuid: str,
    coordinator_uuid: Optional[str],
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> TrainingProgramRead:
    """Assign (or clear, with empty string) the training program coordinator."""
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request, db_session, current_user, tp.trainingprogram_uuid, AccessAction.UPDATE
    )

    coordinator_id = await resolve_coordinator(db_session, tp.org_id, coordinator_uuid)
    tp.coordinator_id = coordinator_id
    tp.update_date = str(datetime.now())

    db_session.add(tp)
    await ensure_coordinator_authorship(db_session, tp.trainingprogram_uuid, coordinator_id)
    await db_session.commit()
    await db_session.refresh(tp)
    return await _to_read(db_session, tp)


async def delete_training_program(
    request: Request,
    tp_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request, db_session, current_user, tp.trainingprogram_uuid, AccessAction.DELETE
    )
    await db_session.delete(tp)
    await db_session.commit()
    return "Training program deleted"


# ----------------------------------------------------------------------------
# TrainingProgram <-> Course linking (reuses the existing Course implementation)
# ----------------------------------------------------------------------------


async def link_course_to_training_program(
    request: Request,
    tp_uuid: str,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    order: int = 0,
) -> str:
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request, db_session, current_user, tp.trainingprogram_uuid, AccessAction.UPDATE
    )

    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.org_id != tp.org_id:
        raise HTTPException(
            status_code=400, detail="Course belongs to a different organization"
        )

    existing = (
        await db_session.execute(
            select(TrainingProgramCourse).where(TrainingProgramCourse.course_id == course.id)
        )
    ).scalars().first()
    if existing:
        if existing.training_program_id == tp.id:
            return "Course already linked to this training program"
        raise HTTPException(
            status_code=409, detail="Course is already linked to another training program"
        )

    db_session.add(
        TrainingProgramCourse(
            training_program_id=tp.id,
            course_id=course.id,
            org_id=tp.org_id,
            order=order,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db_session.commit()
    return "Course linked to training program"


async def unlink_course_from_training_program(
    request: Request,
    tp_uuid: str,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request, db_session, current_user, tp.trainingprogram_uuid, AccessAction.UPDATE
    )

    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    link = (
        await db_session.execute(
            select(TrainingProgramCourse).where(
                TrainingProgramCourse.training_program_id == tp.id,
                TrainingProgramCourse.course_id == course.id,
            )
        )
    ).scalars().first()
    if not link:
        raise HTTPException(
            status_code=404, detail="Course is not linked to this training program"
        )

    await db_session.delete(link)
    await db_session.commit()
    return "Course unlinked from training program"


async def get_training_program_courses(
    request: Request,
    tp_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[TrainingProgramCourseRead]:
    tp = await _get_tp_or_404(db_session, tp_uuid)
    await check_resource_access(
        request,
        db_session,
        current_user,
        tp.trainingprogram_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    statement = (
        select(Course, TrainingProgramCourse)
        .join(TrainingProgramCourse, TrainingProgramCourse.course_id == Course.id)  # type: ignore
        .where(TrainingProgramCourse.training_program_id == tp.id)
        .order_by(TrainingProgramCourse.order.asc())  # type: ignore
    )
    rows = (await db_session.execute(statement)).all()

    result: List[TrainingProgramCourseRead] = []
    for course, link in rows:
        authors = await get_resource_authors(db_session, course.course_uuid)
        profile = await get_profile_read_for_course(db_session, course)
        result.append(
            TrainingProgramCourseRead(
                **course.model_dump(),
                authors=authors,
                academic_order=link.order,
                academic_profile=profile,
            )
        )
    return result
