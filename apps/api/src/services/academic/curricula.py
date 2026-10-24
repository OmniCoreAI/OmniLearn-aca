"""Versioned program curricula (program-scoped; RBAC delegates to the Program)."""
from typing import List
from uuid import uuid4

from fastapi import Request
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.catalog import AcademicCourse
from src.db.academic.cohorts import Cohort
from src.db.academic.curricula import (
    Curriculum,
    CurriculumClone,
    CurriculumCreate,
    CurriculumItem,
    CurriculumItemCreate,
    CurriculumItemRead,
    CurriculumItemUpdate,
    CurriculumRead,
    CurriculumRequirement,
    CurriculumStatus,
    CurriculumUpdate,
)
from src.db.academic.programs import Program
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.common import (
    Principal,
    bad_request,
    conflict,
    get_by_uuid_or_404,
    now,
    validate_curriculum_version,
)
from src.services.academic.validation import assert_status_transition

CURRICULUM_STATUS_TRANSITIONS = {
    CurriculumStatus.DRAFT: {CurriculumStatus.ACTIVE, CurriculumStatus.RETIRED},
    CurriculumStatus.ACTIVE: {CurriculumStatus.RETIRED},
    CurriculumStatus.RETIRED: set(),
}


async def _program(db_session: AsyncSession, program_id: int) -> Program:
    program = await db_session.get(Program, program_id)
    assert program is not None
    return program


async def _check(request, db_session, current_user, program: Program, action: AccessAction) -> None:
    context = AccessContext.DASHBOARD if action == AccessAction.READ else AccessContext.PUBLIC_VIEW
    await check_resource_access(request, db_session, current_user, program.program_uuid, action, context=context)


async def _cohort_count(db_session: AsyncSession, curriculum: Curriculum) -> int:
    return int(
        (
            await db_session.execute(
                select(func.count()).select_from(Cohort).where(Cohort.curriculum_id == curriculum.id)
            )
        ).scalar()
        or 0
    )


async def to_read(db_session: AsyncSession, curriculum: Curriculum) -> CurriculumRead:
    rows = (
        await db_session.execute(
            select(CurriculumItem, AcademicCourse)
            .join(AcademicCourse, AcademicCourse.id == CurriculumItem.academic_course_id)  # type: ignore
            .where(CurriculumItem.curriculum_id == curriculum.id)
            .order_by(CurriculumItem.year_no, CurriculumItem.term_no, CurriculumItem.order)  # type: ignore
        )
    ).all()
    items = [
        CurriculumItemRead(
            **item.model_dump(),
            academic_course_uuid=course.academic_course_uuid,
            course_code=course.code,
            course_name=course.name,
            credits=course.credits or 0,
            course_type=getattr(course.course_type, "value", course.course_type) or "core",
        )
        for item, course in rows
    ]
    required = sum(i.credits for i in items if i.requirement == CurriculumRequirement.REQUIRED)
    elective = sum(i.credits for i in items if i.requirement == CurriculumRequirement.ELECTIVE)
    return CurriculumRead(
        **curriculum.model_dump(),
        items=items,
        total_credits=required + elective,
        required_credits=required,
        elective_credits=elective,
        cohort_count=await _cohort_count(db_session, curriculum),
    )


async def _assert_editable(db_session: AsyncSession, curriculum: Curriculum) -> None:
    """Structure is frozen once a cohort follows the version (history stays intact)."""
    if curriculum.status == CurriculumStatus.RETIRED:
        raise conflict("A retired curriculum cannot be edited")
    if await _cohort_count(db_session, curriculum):
        raise conflict("Cohorts follow this curriculum version; clone it to a new version to make changes")


async def list_program_curricula(
    request: Request, program_uuid: str, current_user: Principal, db_session: AsyncSession
) -> List[CurriculumRead]:
    program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
    await _check(request, db_session, current_user, program, AccessAction.READ)
    rows = (
        await db_session.execute(
            select(Curriculum).where(Curriculum.program_id == program.id).order_by(Curriculum.version.desc())  # type: ignore
        )
    ).scalars().all()
    return [await to_read(db_session, c) for c in rows]


async def _assert_version_unique(db_session: AsyncSession, program_id: int, version: str, exclude_id=None) -> None:
    existing = (
        await db_session.execute(
            select(Curriculum).where(Curriculum.program_id == program_id, Curriculum.version == version)
        )
    ).scalars().first()
    if existing and existing.id != exclude_id:
        raise conflict(f"Curriculum version {version} already exists for this program")


async def create_curriculum(
    request: Request, program_uuid: str, data: CurriculumCreate, current_user: Principal, db_session: AsyncSession
) -> CurriculumRead:
    program = await get_by_uuid_or_404(db_session, Program, Program.program_uuid, program_uuid, "Program")
    await _check(request, db_session, current_user, program, AccessAction.UPDATE)
    version = validate_curriculum_version(data.version)
    await _assert_version_unique(db_session, program.id, version)  # type: ignore[arg-type]
    curriculum = Curriculum.model_validate(
        data, update={"org_id": program.org_id, "program_id": program.id, "version": version}
    )
    curriculum.status = CurriculumStatus.DRAFT
    curriculum.name = data.name or f"{program.name} — {version}"
    curriculum.curriculum_uuid = f"curriculum_{uuid4()}"
    curriculum.creation_date = curriculum.update_date = now()
    db_session.add(curriculum)
    await db_session.commit()
    await db_session.refresh(curriculum)
    return await to_read(db_session, curriculum)


async def _get(db_session: AsyncSession, curriculum_uuid: str) -> Curriculum:
    return await get_by_uuid_or_404(
        db_session, Curriculum, Curriculum.curriculum_uuid, curriculum_uuid, "Curriculum"
    )


async def get_curriculum(
    request: Request, curriculum_uuid: str, current_user: Principal, db_session: AsyncSession
) -> CurriculumRead:
    curriculum = await _get(db_session, curriculum_uuid)
    await _check(request, db_session, current_user, await _program(db_session, curriculum.program_id), AccessAction.READ)
    return await to_read(db_session, curriculum)


async def update_curriculum(
    request: Request, curriculum_uuid: str, data: CurriculumUpdate, current_user: Principal, db_session: AsyncSession
) -> CurriculumRead:
    curriculum = await _get(db_session, curriculum_uuid)
    await _check(request, db_session, current_user, await _program(db_session, curriculum.program_id), AccessAction.UPDATE)
    update = data.model_dump(exclude_unset=True)
    if "version" in update and update["version"] and update["version"] != curriculum.version:
        await _assert_editable(db_session, curriculum)
        update["version"] = validate_curriculum_version(update["version"])
        await _assert_version_unique(db_session, curriculum.program_id, update["version"], exclude_id=curriculum.id)
    if update.get("status") is not None:
        assert_status_transition(curriculum.status, update["status"], CURRICULUM_STATUS_TRANSITIONS)
        if update["status"] == CurriculumStatus.ACTIVE:
            item_count = (
                await db_session.execute(
                    select(func.count()).select_from(CurriculumItem).where(CurriculumItem.curriculum_id == curriculum.id)
                )
            ).scalar() or 0
            if not item_count:
                raise bad_request("Add at least one course before activating the curriculum")
    for key, value in update.items():
        setattr(curriculum, key, value)
    curriculum.update_date = now()
    db_session.add(curriculum)
    await db_session.commit()
    await db_session.refresh(curriculum)
    return await to_read(db_session, curriculum)


async def delete_curriculum(
    request: Request, curriculum_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    curriculum = await _get(db_session, curriculum_uuid)
    await _check(request, db_session, current_user, await _program(db_session, curriculum.program_id), AccessAction.UPDATE)
    if await _cohort_count(db_session, curriculum):
        raise conflict("Cohorts follow this curriculum; retire it instead of deleting")
    await db_session.delete(curriculum)
    await db_session.commit()
    return "Curriculum deleted"


async def clone_curriculum(
    request: Request, curriculum_uuid: str, data: CurriculumClone, current_user: Principal, db_session: AsyncSession
) -> CurriculumRead:
    """Copy a version (structure only) into a new draft version for a future intake."""
    source = await _get(db_session, curriculum_uuid)
    program = await _program(db_session, source.program_id)
    await _check(request, db_session, current_user, program, AccessAction.UPDATE)
    version = validate_curriculum_version(data.version)
    await _assert_version_unique(db_session, program.id, version)  # type: ignore[arg-type]

    clone = Curriculum(
        version=version,
        name=data.name or f"{program.name} — {version}",
        description=source.description,
        status=CurriculumStatus.DRAFT,
        org_id=source.org_id,
        program_id=source.program_id,
        curriculum_uuid=f"curriculum_{uuid4()}",
        creation_date=now(),
        update_date=now(),
        extra_metadata={"cloned_from": source.curriculum_uuid},
    )
    db_session.add(clone)
    await db_session.flush()
    items = (
        await db_session.execute(select(CurriculumItem).where(CurriculumItem.curriculum_id == source.id))
    ).scalars().all()
    for item in items:
        db_session.add(
            CurriculumItem(
                **item.model_dump(exclude={"id", "curriculum_id", "curriculum_item_uuid", "creation_date", "update_date"}),
                curriculum_id=clone.id,
                curriculum_item_uuid=f"curriculumitem_{uuid4()}",
                creation_date=now(),
                update_date=now(),
            )
        )
    await db_session.commit()
    await db_session.refresh(clone)
    return await to_read(db_session, clone)


def _validate_slot(data: dict) -> None:
    if data.get("year_no") is not None and not (1 <= data["year_no"] <= 10):
        raise bad_request("Year must be between 1 and 10")
    if data.get("term_no") is not None and not (1 <= data["term_no"] <= 4):
        raise bad_request("Term must be between 1 and 4")


async def add_curriculum_item(
    request: Request, curriculum_uuid: str, data: CurriculumItemCreate, current_user: Principal, db_session: AsyncSession
) -> CurriculumRead:
    curriculum = await _get(db_session, curriculum_uuid)
    await _check(request, db_session, current_user, await _program(db_session, curriculum.program_id), AccessAction.UPDATE)
    await _assert_editable(db_session, curriculum)
    _validate_slot(data.model_dump())
    course = await get_by_uuid_or_404(
        db_session, AcademicCourse, AcademicCourse.academic_course_uuid, data.academic_course_uuid, "Course"
    )
    if course.org_id != curriculum.org_id:
        raise bad_request("Course belongs to another organization")
    duplicate = (
        await db_session.execute(
            select(CurriculumItem).where(
                CurriculumItem.curriculum_id == curriculum.id, CurriculumItem.academic_course_id == course.id
            )
        )
    ).scalars().first()
    if duplicate:
        raise conflict(f"{course.code} is already part of this curriculum")
    item = CurriculumItem.model_validate(
        data.model_dump(exclude={"academic_course_uuid"}),
        update={"curriculum_id": curriculum.id, "academic_course_id": course.id, "org_id": curriculum.org_id},
    )
    item.curriculum_item_uuid = f"curriculumitem_{uuid4()}"
    item.creation_date = item.update_date = now()
    db_session.add(item)
    curriculum.update_date = now()
    db_session.add(curriculum)
    await db_session.commit()
    return await to_read(db_session, curriculum)


async def _get_item(db_session: AsyncSession, curriculum: Curriculum, item_uuid: str) -> CurriculumItem:
    item = await get_by_uuid_or_404(
        db_session, CurriculumItem, CurriculumItem.curriculum_item_uuid, item_uuid, "Curriculum item"
    )
    if item.curriculum_id != curriculum.id:
        raise bad_request("Item does not belong to this curriculum")
    return item


async def update_curriculum_item(
    request: Request,
    curriculum_uuid: str,
    item_uuid: str,
    data: CurriculumItemUpdate,
    current_user: Principal,
    db_session: AsyncSession,
) -> CurriculumRead:
    curriculum = await _get(db_session, curriculum_uuid)
    await _check(request, db_session, current_user, await _program(db_session, curriculum.program_id), AccessAction.UPDATE)
    await _assert_editable(db_session, curriculum)
    item = await _get_item(db_session, curriculum, item_uuid)
    update = data.model_dump(exclude_unset=True)
    _validate_slot(update)
    for key, value in update.items():
        setattr(item, key, value)
    item.update_date = now()
    db_session.add(item)
    await db_session.commit()
    return await to_read(db_session, curriculum)


async def remove_curriculum_item(
    request: Request, curriculum_uuid: str, item_uuid: str, current_user: Principal, db_session: AsyncSession
) -> CurriculumRead:
    curriculum = await _get(db_session, curriculum_uuid)
    await _check(request, db_session, current_user, await _program(db_session, curriculum.program_id), AccessAction.UPDATE)
    await _assert_editable(db_session, curriculum)
    item = await _get_item(db_session, curriculum, item_uuid)
    await db_session.delete(item)
    await db_session.commit()
    return await to_read(db_session, curriculum)
