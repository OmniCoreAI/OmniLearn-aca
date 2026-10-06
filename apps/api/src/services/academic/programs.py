from typing import List, Optional
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.users import PublicUser, AnonymousUser, APITokenUser
from src.db.organizations import Organization
from src.db.academic.programs import (
    Program,
    ProgramCreate,
    ProgramRead,
    ProgramUpdate,
)
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin, require_org_membership
from src.db.academic.cohorts import Cohort
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipStatusEnum
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import (
    build_creator_author,
    ensure_coordinator_authorship,
    get_resource_authors,
    get_user_author,
)
from src.services.academic.common import normalize_code
from src.services.notifications.assignments import slug, staff_assigned
from src.services.academic.validation import (
    assert_program_code_unique,
    assert_status_transition,
    resolve_coordinator,
    validate_program_payload,
    PROGRAM_STATUS_TRANSITIONS,
)


async def _get_program_or_404(db_session: AsyncSession, program_uuid: str) -> Program:
    statement = select(Program).where(Program.program_uuid == program_uuid)
    program = (await db_session.execute(statement)).scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


async def _to_read(db_session: AsyncSession, program: Program) -> ProgramRead:
    """Assemble a ProgramRead with authors + embedded coordinator projection."""
    authors = await get_resource_authors(db_session, program.program_uuid)
    coordinator = await get_user_author(db_session, program.coordinator_id)
    scale_uuid = None
    if program.grade_scale_id:
        from src.db.academic.grading import GradeScale

        scale = await db_session.get(GradeScale, program.grade_scale_id)
        scale_uuid = scale.grade_scale_uuid if scale else None
    return ProgramRead(
        **program.model_dump(), authors=authors, coordinator=coordinator, grade_scale_uuid=scale_uuid
    )


async def _resolve_grade_scale(db_session: AsyncSession, org_id: int, grade_scale_uuid: Optional[str]) -> Optional[int]:
    """Empty string / None -> org default (stored as NULL)."""
    if not grade_scale_uuid:
        return None
    from src.db.academic.grading import GradeScale

    scale = (
        await db_session.execute(select(GradeScale).where(GradeScale.grade_scale_uuid == grade_scale_uuid))
    ).scalars().first()
    if not scale or scale.org_id != org_id:
        raise HTTPException(status_code=400, detail="Grade scale not found")
    return scale.id


async def create_program(
    request: Request,
    org_id: int,
    program_object: ProgramCreate,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> ProgramRead:
    await check_resource_access(
        request, db_session, current_user, "program_x", AccessAction.CREATE
    )
    await require_org_membership(
        resolve_acting_user_id(current_user), org_id, db_session
    )

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    validate_program_payload(program_object.model_dump())
    if program_object.code:
        # Codes are normalised (upper-case, "[DEGREE]-[FIELD]" style) so the
        # whole org shares one convention.
        program_object.code = normalize_code(program_object.code, "Program")
    await assert_program_code_unique(db_session, org_id, program_object.code)
    coordinator_id = await resolve_coordinator(
        db_session, org_id, program_object.coordinator_uuid
    )

    program = Program.model_validate(program_object, update={"org_id": org_id})
    program.org_id = org_id
    program.coordinator_id = coordinator_id
    program.grade_scale_id = await _resolve_grade_scale(db_session, org_id, program_object.grade_scale_uuid)
    program.program_uuid = f"program_{uuid4()}"
    program.creation_date = str(datetime.now())
    program.update_date = str(datetime.now())

    author = build_creator_author(program.program_uuid, resolve_acting_user_id(current_user))

    try:
        db_session.add(program)
        await db_session.flush()
        await db_session.refresh(program)
        db_session.add(author)
        # Coordinator gets maintainer access so they can manage their program.
        await ensure_coordinator_authorship(db_session, program.program_uuid, coordinator_id)
        await db_session.commit()
        await db_session.refresh(program)
    except Exception:
        await db_session.rollback()
        raise

    await _notify_coordinator(db_session, program, None, current_user)
    return await _to_read(db_session, program)


async def _notify_coordinator(db_session: AsyncSession, program: Program, previous_id: Optional[int], current_user) -> None:
    if program.coordinator_id and program.coordinator_id != previous_id:
        await staff_assigned(
            db_session, program.org_id, [program.coordinator_id], "program_coordinator", program.name,
            f"/dash/postgraduate/{slug(program.program_uuid, 'program_')}",
            actor_id=resolve_acting_user_id(current_user), resource=("program", program.program_uuid),
        )
        await db_session.refresh(program)


async def get_program(
    request: Request,
    program_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ProgramRead:
    program = await _get_program_or_404(db_session, program_uuid)

    await check_resource_access(
        request,
        db_session,
        current_user,
        program.program_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    return await _to_read(db_session, program)


async def get_programs_by_org(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
) -> List[ProgramRead]:
    await require_org_membership(
        resolve_acting_user_id(current_user), org_id, db_session
    )

    statement = select(Program).where(Program.org_id == org_id)
    user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(user_id, org_id, db_session):
        # Management list: program / cohort coordinators and the program's
        # authors only. Applicants use the admissions catalog instead.
        staff_of = select(ResourceAuthor.resource_uuid).where(
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        coordinates_cohort = select(Cohort.program_id).where(Cohort.coordinator_id == user_id)
        statement = statement.where(
            or_(
                Program.coordinator_id == user_id,
                Program.program_uuid.in_(staff_of),  # type: ignore[attr-defined]
                Program.id.in_(coordinates_cohort),  # type: ignore[union-attr]
            )
        )
    statement = (
        statement.order_by(Program.creation_date.desc())  # type: ignore
        .offset((page - 1) * limit)
        .limit(limit)
    )
    programs = (await db_session.execute(statement)).scalars().all()

    return [await _to_read(db_session, program) for program in programs]


async def update_program(
    request: Request,
    program_uuid: str,
    program_object: ProgramUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ProgramRead:
    program = await _get_program_or_404(db_session, program_uuid)

    await check_resource_access(
        request, db_session, current_user, program.program_uuid, AccessAction.UPDATE
    )

    update_data = program_object.model_dump(exclude_unset=True)

    # Validate the merged view (start/end coherence, fee coherence, etc.).
    merged = {**program.model_dump(), **update_data}
    validate_program_payload(merged)

    if "status" in update_data and update_data["status"] is not None:
        assert_status_transition(
            program.status, update_data["status"], PROGRAM_STATUS_TRANSITIONS
        )

    if "code" in update_data:
        if update_data["code"]:
            update_data["code"] = normalize_code(update_data["code"], "Program")
        else:
            update_data["code"] = None
        await assert_program_code_unique(
            db_session, program.org_id, update_data["code"], exclude_id=program.id
        )

    new_coordinator_id = None
    previous_coordinator_id = program.coordinator_id
    coordinator_changed = "coordinator_uuid" in update_data
    if coordinator_changed:
        coordinator_uuid = update_data.pop("coordinator_uuid")
        new_coordinator_id = await resolve_coordinator(
            db_session, program.org_id, coordinator_uuid
        )
        program.coordinator_id = new_coordinator_id

    if "grade_scale_uuid" in update_data:
        program.grade_scale_id = await _resolve_grade_scale(
            db_session, program.org_id, update_data.pop("grade_scale_uuid")
        )

    for key, value in update_data.items():
        setattr(program, key, value)
    program.update_date = str(datetime.now())

    db_session.add(program)
    if coordinator_changed:
        await ensure_coordinator_authorship(
            db_session, program.program_uuid, new_coordinator_id
        )
    await db_session.commit()
    await db_session.refresh(program)

    await _notify_coordinator(db_session, program, previous_coordinator_id, current_user)
    return await _to_read(db_session, program)


async def delete_program(
    request: Request,
    program_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> str:
    program = await _get_program_or_404(db_session, program_uuid)

    await check_resource_access(
        request, db_session, current_user, program.program_uuid, AccessAction.DELETE
    )

    # Cohort/offering access groups are not FK-cascaded; remove them explicitly.
    from src.db.academic.cohorts import Cohort
    from src.services.academic.cohorts import assert_cohort_deletable, delete_cohort_dependents

    cohorts = (
        await db_session.execute(select(Cohort).where(Cohort.program_id == program.id))
    ).scalars().all()
    # Refuse before touching anything once official history exists.
    for cohort in cohorts:
        await assert_cohort_deletable(db_session, cohort, label="program")
    for cohort in cohorts:
        await delete_cohort_dependents(db_session, cohort)

    await db_session.delete(program)
    await db_session.commit()
    return "Program deleted"


async def update_program_image(
    request: Request,
    program_uuid: str,
    upload_file,
    kind: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ProgramRead:
    """Upload and set a program's thumbnail or banner image.

    Reuses the generic org file uploader (same storage pattern as course
    thumbnails) so no new media pipeline is introduced.
    """
    from src.services.academic.images import upload_program_image

    if kind not in ("thumbnail", "banner"):
        raise HTTPException(status_code=400, detail="Invalid image kind")

    program = await _get_program_or_404(db_session, program_uuid)
    await check_resource_access(
        request, db_session, current_user, program.program_uuid, AccessAction.UPDATE
    )

    org = (
        await db_session.execute(
            select(Organization).where(Organization.id == program.org_id)
        )
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not upload_file or not upload_file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    name_in_disk = await upload_program_image(
        upload_file, org.org_uuid, program.program_uuid, kind
    )
    if kind == "thumbnail":
        program.thumbnail_image = name_in_disk
    else:
        program.banner_image = name_in_disk
    program.update_date = str(datetime.now())

    db_session.add(program)
    await db_session.commit()
    await db_session.refresh(program)
    return await _to_read(db_session, program)
