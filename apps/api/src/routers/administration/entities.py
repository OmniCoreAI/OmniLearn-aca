from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.audience import AvailableResourceRead
from src.db.administration.entities import (
    CoordinatorAssign,
    EntityCreate,
    EntityGroupCreate,
    EntityGroupRead,
    EntityGroupUpdate,
    EntityMemberCreate,
    EntityMemberPage,
    EntityMemberRead,
    EntityMemberUpdate,
    EntityOption,
    EntityRead,
    EntityUpdate,
    GroupMembersUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import audience as audience_svc
from src.services.administration import entities as svc

router = APIRouter()


# --- Entities ---------------------------------------------------------------


@router.post("/", response_model=EntityRead, summary="Create an entity (الجهة)")
async def api_create_entity(
    payload: EntityCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityRead:
    return await svc.create_entity(db_session, current_user, org_id, payload)


@router.get("/org/{org_id}", response_model=List[EntityRead], summary="List entities")
async def api_list_entities(
    org_id: int,
    q: Optional[str] = None,
    status: Optional[str] = None,
    entity_type_uuid: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[EntityRead]:
    return await svc.list_entities(db_session, current_user, org_id, q, status, entity_type_uuid)


@router.get("/org/{org_id}/options", response_model=List[EntityOption], summary="Active entities for pickers")
async def api_entity_options(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[EntityOption]:
    return await svc.entity_options(db_session, current_user, org_id)


@router.get("/org/{org_id}/mine", response_model=List[EntityRead], summary="Entities I coordinate")
async def api_my_entities(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[EntityRead]:
    return await svc.list_my_entities(db_session, current_user, org_id)


@router.get("/{entity_uuid}", response_model=EntityRead, summary="Get an entity")
async def api_get_entity(
    entity_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityRead:
    return await svc.get_entity(db_session, current_user, entity_uuid)


@router.put("/{entity_uuid}", response_model=EntityRead, summary="Update an entity")
async def api_update_entity(
    entity_uuid: str,
    payload: EntityUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityRead:
    return await svc.update_entity(db_session, current_user, entity_uuid, payload)


@router.put("/{entity_uuid}/logo", response_model=EntityRead, summary="Upload an entity logo")
async def api_entity_logo(
    entity_uuid: str,
    logo: UploadFile,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityRead:
    return await svc.upload_entity_logo(db_session, current_user, entity_uuid, logo)


@router.delete("/{entity_uuid}", summary="Delete an entity")
async def api_delete_entity(
    entity_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_entity(db_session, current_user, entity_uuid)


# --- Members ----------------------------------------------------------------


@router.get("/{entity_uuid}/members", response_model=EntityMemberPage, summary="List entity members")
async def api_list_members(
    entity_uuid: str,
    q: Optional[str] = None,
    status: Optional[str] = None,
    position_uuid: Optional[str] = None,
    group_uuid: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityMemberPage:
    return await svc.list_members(
        db_session, current_user, entity_uuid, q, status, position_uuid, group_uuid, page, limit
    )


@router.post("/{entity_uuid}/members", response_model=EntityMemberRead, summary="Add a member")
async def api_add_member(
    entity_uuid: str,
    payload: EntityMemberCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityMemberRead:
    return await svc.add_member(db_session, current_user, entity_uuid, payload)


@router.put("/{entity_uuid}/members/{member_uuid}", response_model=EntityMemberRead, summary="Update a member")
async def api_update_member(
    entity_uuid: str,
    member_uuid: str,
    payload: EntityMemberUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityMemberRead:
    return await svc.update_member(db_session, current_user, entity_uuid, member_uuid, payload)


@router.delete("/{entity_uuid}/members/{member_uuid}", summary="Remove a member")
async def api_remove_member(
    entity_uuid: str,
    member_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.remove_member(db_session, current_user, entity_uuid, member_uuid)


# --- Coordinators -----------------------------------------------------------


@router.post("/{entity_uuid}/coordinators", response_model=EntityMemberRead, summary="Make someone a coordinator")
async def api_assign_coordinator(
    entity_uuid: str,
    payload: CoordinatorAssign,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityMemberRead:
    return await svc.assign_coordinator(db_session, current_user, entity_uuid, payload)


@router.delete(
    "/{entity_uuid}/coordinators/{member_uuid}",
    response_model=EntityMemberRead,
    summary="Stop someone being a coordinator",
)
async def api_remove_coordinator(
    entity_uuid: str,
    member_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityMemberRead:
    return await svc.remove_coordinator(db_session, current_user, entity_uuid, member_uuid)


# --- Groups -----------------------------------------------------------------


@router.get("/{entity_uuid}/groups", response_model=List[EntityGroupRead], summary="List the entity's groups")
async def api_list_groups(
    entity_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[EntityGroupRead]:
    return await svc.list_entity_groups(db_session, current_user, entity_uuid)


@router.post("/{entity_uuid}/groups", response_model=EntityGroupRead, summary="Create a group in the entity")
async def api_create_group(
    entity_uuid: str,
    payload: EntityGroupCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityGroupRead:
    return await svc.create_entity_group(db_session, current_user, entity_uuid, payload)


@router.put("/{entity_uuid}/groups/{usergroup_uuid}", response_model=EntityGroupRead, summary="Update a group")
async def api_update_group(
    entity_uuid: str,
    usergroup_uuid: str,
    payload: EntityGroupUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityGroupRead:
    return await svc.update_entity_group(db_session, current_user, entity_uuid, usergroup_uuid, payload)


@router.put(
    "/{entity_uuid}/groups/{usergroup_uuid}/members",
    response_model=EntityGroupRead,
    summary="Replace a group's members",
)
async def api_set_group_members(
    entity_uuid: str,
    usergroup_uuid: str,
    payload: GroupMembersUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> EntityGroupRead:
    return await svc.set_entity_group_members(
        db_session, current_user, entity_uuid, usergroup_uuid, payload.member_uuids
    )


@router.delete("/{entity_uuid}/groups/{usergroup_uuid}", summary="Delete a group")
async def api_delete_group(
    entity_uuid: str,
    usergroup_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_entity_group(db_session, current_user, entity_uuid, usergroup_uuid)


# --- Learning ---------------------------------------------------------------


@router.get(
    "/{entity_uuid}/learning",
    response_model=List[AvailableResourceRead],
    summary="Courses / programs available to or assigned within the entity",
)
async def api_entity_learning(
    entity_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[AvailableResourceRead]:
    return await audience_svc.list_entity_learning(db_session, current_user, entity_uuid)
