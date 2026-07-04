from typing import List
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser, APITokenUser
from src.db.organizations import Organization
from src.db.courses.courses import Course, CourseRead
from src.db.academic.training_programs import (
    TrainingProgram,
    TrainingProgramCreate,
    TrainingProgramRead,
    TrainingProgramUpdate,
)
from src.db.academic.links import TrainingProgramCourse
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import require_org_membership
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import build_creator_author, get_resource_authors


async def _get_tp_or_404(db_session: AsyncSession, tp_uuid: str) -> TrainingProgram:
    statement = select(TrainingProgram).where(
        TrainingProgram.trainingprogram_uuid == tp_uuid
    )
    tp = (await db_session.execute(statement)).scalars().first()
    if not tp:
        raise HTTPException(status_code=404, detail="Training program not found")
    return tp


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

    tp.org_id = org_id
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
        await db_session.commit()
        await db_session.refresh(tp)
    except Exception:
        await db_session.rollback()
        raise

    authors = await get_resource_authors(db_session, tp.trainingprogram_uuid)
    return TrainingProgramRead(**tp.model_dump(), authors=authors)


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
    authors = await get_resource_authors(db_session, tp.trainingprogram_uuid)
    return TrainingProgramRead(**tp.model_dump(), authors=authors)


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

    result: List[TrainingProgramRead] = []
    for tp in tps:
        authors = await get_resource_authors(db_session, tp.trainingprogram_uuid)
        result.append(TrainingProgramRead(**tp.model_dump(), authors=authors))
    return result


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
    for key, value in update_data.items():
        setattr(tp, key, value)
    tp.update_date = str(datetime.now())

    db_session.add(tp)
    await db_session.commit()
    await db_session.refresh(tp)

    authors = await get_resource_authors(db_session, tp.trainingprogram_uuid)
    return TrainingProgramRead(**tp.model_dump(), authors=authors)


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
) -> List[CourseRead]:
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
        select(Course)
        .join(TrainingProgramCourse, TrainingProgramCourse.course_id == Course.id)  # type: ignore
        .where(TrainingProgramCourse.training_program_id == tp.id)
        .order_by(TrainingProgramCourse.order.asc())  # type: ignore
    )
    courses = (await db_session.execute(statement)).scalars().all()

    result: List[CourseRead] = []
    for course in courses:
        authors = await get_resource_authors(db_session, course.course_uuid)
        result.append(CourseRead(**course.model_dump(), authors=authors))
    return result
