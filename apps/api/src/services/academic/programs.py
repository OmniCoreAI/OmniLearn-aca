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
from src.services.academic.authors import build_creator_author, get_resource_authors


async def _get_program_or_404(db_session: AsyncSession, program_uuid: str) -> Program:
    statement = select(Program).where(Program.program_uuid == program_uuid)
    program = (await db_session.execute(statement)).scalars().first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


async def create_program(
    request: Request,
    org_id: int,
    program_object: ProgramCreate,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> ProgramRead:
    program = Program.model_validate(program_object, update={"org_id": org_id})

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

    program.org_id = org_id
    program.program_uuid = f"program_{uuid4()}"
    program.creation_date = str(datetime.now())
    program.update_date = str(datetime.now())

    author = build_creator_author(program.program_uuid, resolve_acting_user_id(current_user))

    try:
        db_session.add(program)
        await db_session.flush()
        await db_session.refresh(program)
        db_session.add(author)
        await db_session.commit()
        await db_session.refresh(program)
    except Exception:
        await db_session.rollback()
        raise

    authors = await get_resource_authors(db_session, program.program_uuid)
    return ProgramRead(**program.model_dump(), authors=authors)


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

    authors = await get_resource_authors(db_session, program.program_uuid)
    return ProgramRead(**program.model_dump(), authors=authors)


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

    result: List[ProgramRead] = []
    for program in programs:
        authors = await get_resource_authors(db_session, program.program_uuid)
        result.append(ProgramRead(**program.model_dump(), authors=authors))
    return result


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
    for key, value in update_data.items():
        setattr(program, key, value)
    program.update_date = str(datetime.now())

    db_session.add(program)
    await db_session.commit()
    await db_session.refresh(program)

    authors = await get_resource_authors(db_session, program.program_uuid)
    return ProgramRead(**program.model_dump(), authors=authors)


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
