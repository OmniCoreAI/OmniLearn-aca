from typing import List
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException, Request
from sqlmodel import select
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
from src.security.org_auth import require_org_membership
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic.authors import (
    build_creator_author,
    ensure_coordinator_authorship,
    get_resource_authors,
    get_user_author,
)
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
    return ProgramRead(**program.model_dump(), authors=authors, coordinator=coordinator)


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
    await assert_program_code_unique(db_session, org_id, program_object.code)
    coordinator_id = await resolve_coordinator(
        db_session, org_id, program_object.coordinator_uuid
    )

    program = Program.model_validate(program_object, update={"org_id": org_id})
    program.org_id = org_id
    program.coordinator_id = coordinator_id
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

    return await _to_read(db_session, program)


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

    statement = (
        select(Program)
        .where(Program.org_id == org_id)
        .order_by(Program.creation_date.desc())  # type: ignore
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
        await assert_program_code_unique(
            db_session, program.org_id, update_data["code"], exclude_id=program.id
        )

    new_coordinator_id = None
    coordinator_changed = "coordinator_uuid" in update_data
    if coordinator_changed:
        coordinator_uuid = update_data.pop("coordinator_uuid")
        new_coordinator_id = await resolve_coordinator(
            db_session, program.org_id, coordinator_uuid
        )
        program.coordinator_id = new_coordinator_id

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
