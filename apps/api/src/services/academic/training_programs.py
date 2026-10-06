from typing import List, Optional
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser, APITokenUser
from src.db.organizations import Organization
from src.db.courses.courses import Course
from src.db.academic.training_programs import (
    TrainingProgram,
    TrainingProgramCreate,
    TrainingProgramRead,
    TrainingProgramUpdate,
    CatalogCourse,
    TrainingProgramCatalogItem,
)
from src.db.academic.course_profiles import CourseAcademicProfile
from src.db.academic.links import TrainingProgramCourse, TrainingProgramCourseRead
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipStatusEnum
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin, require_org_membership
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import (
    build_creator_author,
    ensure_coordinator_authorship,
    get_resource_authors,
    get_user_author,
)
from src.services.academic.course_profiles import get_profile_read_for_course
from src.services.administration.certificates import resolve_template_id, template_uuid_for
from src.services.administration.facilities import facility_ref, resolve_facility_id
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
    return TrainingProgramRead(
        **tp.model_dump(),
        authors=authors,
        coordinator=coordinator,
        facility=await facility_ref(db_session, tp.facility_id),
        certificate_template_uuid=await template_uuid_for(db_session, tp.certificate_template_id),
    )


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
    tp.facility_id = await resolve_facility_id(db_session, org_id, tp_object.facility_uuid)
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

    statement = select(TrainingProgram).where(TrainingProgram.org_id == org_id)
    user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(user_id, org_id, db_session):
        # This is the management list: besides academy admins, people only see
        # the programs they run or teach (coordinator, creator / maintainers,
        # trainers of a linked course). Learners use the catalog instead.
        staff_of = select(ResourceAuthor.resource_uuid).where(
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        trains = (
            select(TrainingProgramCourse.training_program_id)
            .join(CourseAcademicProfile, CourseAcademicProfile.course_id == TrainingProgramCourse.course_id)  # type: ignore[arg-type]
            .where(CourseAcademicProfile.instructor_id == user_id)
        )
        statement = statement.where(
            or_(
                TrainingProgram.coordinator_id == user_id,
                TrainingProgram.trainingprogram_uuid.in_(staff_of),  # type: ignore[attr-defined]
                TrainingProgram.id.in_(trains),  # type: ignore[union-attr]
            )
        )
    statement = (
        statement.order_by(TrainingProgram.creation_date.desc())  # type: ignore
        .offset((page - 1) * limit)
        .limit(limit)
    )
    tps = (await db_session.execute(statement)).scalars().all()

    return [await _to_read(db_session, tp) for tp in tps]


async def get_training_program_catalog(
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[TrainingProgramCatalogItem]:
    """Published programs a member may join: public ones, ones not restricted to
    any audience, and ones assigned to them (via a group, entity, cohort…)."""
    user_id = resolve_acting_user_id(current_user)
    await require_org_membership(user_id, org_id, db_session)

    programs = (
        await db_session.execute(
            select(TrainingProgram)
            .where(TrainingProgram.org_id == org_id, TrainingProgram.published == True)  # noqa: E712
            .order_by(TrainingProgram.start_date.desc().nulls_last(), TrainingProgram.name)  # type: ignore[union-attr]
        )
    ).scalars().all()
    if not programs:
        return []
    uuids = [tp.trainingprogram_uuid for tp in programs]
    restricted = set(
        (
            await db_session.execute(
                select(UserGroupResource.resource_uuid).where(UserGroupResource.resource_uuid.in_(uuids))  # type: ignore[attr-defined]
            )
        ).scalars().all()
    )
    assigned = set(
        (
            await db_session.execute(
                select(UserGroupResource.resource_uuid)
                .join(UserGroup, UserGroup.id == UserGroupResource.usergroup_id)  # type: ignore[arg-type]
                .join(UserGroupUser, UserGroupUser.usergroup_id == UserGroup.id)  # type: ignore[arg-type]
                .where(
                    UserGroupResource.resource_uuid.in_(uuids),  # type: ignore[attr-defined]
                    UserGroupUser.user_id == user_id,
                    UserGroup.status != "inactive",
                )
            )
        ).scalars().all()
    )
    visible = [
        tp for tp in programs
        if tp.public or tp.trainingprogram_uuid not in restricted or tp.trainingprogram_uuid in assigned
    ]
    if not visible:
        return []

    course_rows = (
        await db_session.execute(
            select(TrainingProgramCourse.training_program_id, Course)
            .join(Course, Course.id == TrainingProgramCourse.course_id)  # type: ignore[arg-type]
            .where(
                TrainingProgramCourse.training_program_id.in_([tp.id for tp in visible]),  # type: ignore[attr-defined]
                Course.published == True,  # noqa: E712
            )
            .order_by(TrainingProgramCourse.order)
        )
    ).all()
    courses_by_program: dict[int, List[CatalogCourse]] = {}
    for program_id, course in course_rows:
        courses_by_program.setdefault(program_id, []).append(
            CatalogCourse(
                course_uuid=course.course_uuid,
                name=course.name,
                description=course.description,
                thumbnail_image=course.thumbnail_image,
            )
        )

    return [
        TrainingProgramCatalogItem(
            trainingprogram_uuid=tp.trainingprogram_uuid,
            name=tp.name,
            description=tp.description,
            about=tp.about,
            training_type=tp.training_type.value if tp.training_type else None,
            start_date=tp.start_date,
            end_date=tp.end_date,
            location=tp.location,
            capacity=tp.capacity,
            is_paid=bool(tp.is_paid),
            price=tp.price,
            currency=tp.currency,
            thumbnail_image=tp.thumbnail_image,
            assigned=tp.trainingprogram_uuid in assigned,
            courses=courses_by_program.get(tp.id, []),
        )
        for tp in visible
    ]


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

    if "facility_uuid" in update_data:
        tp.facility_id = await resolve_facility_id(db_session, tp.org_id, update_data.pop("facility_uuid"))
    if "certificate_template_uuid" in update_data:
        tp.certificate_template_id = await resolve_template_id(
            db_session, tp.org_id, update_data.pop("certificate_template_uuid")
        )

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
    from src.services.administration.audience import forget_resource

    # Drop audience links the program put on its courses before they detach.
    await forget_resource(db_session, "training_program", tp.trainingprogram_uuid)
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
    from src.services.administration.audience import sync_resource_audience

    # The program's audiences now also reach this course.
    await sync_resource_audience(db_session, "training_program", tp.trainingprogram_uuid)
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
    from src.services.administration.audience import sync_resource_audience

    await sync_resource_audience(
        db_session, "training_program", tp.trainingprogram_uuid, dropped_targets=[course_uuid]
    )
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
