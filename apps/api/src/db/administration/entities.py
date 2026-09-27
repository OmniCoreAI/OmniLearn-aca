"""Entities (الجهات), their positions and members — Administration & Configuration.

An **Entity** is an external organization the academy trains for (ministry,
university, company…). It is *not* a tenant: all entities live inside the
academy's organization and share its courses. Each entity has members
(platform users with an employee id and a **Position**), user groups
(``UserGroup.entity_id``) and optionally one or more **Entity Coordinators**
(``EntityMember.is_coordinator``, platform role 2) who manage only that entity.

Every entity owns a system "all members" user group (``members_group_id``) so
courses can be assigned to the whole entity through the existing
UserGroupResource access mechanism.
"""
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.administration.lookups import ConfigLookupOption, ConfigStatus, status_column
from src.db.users import UserReadAuthor


class CoordinatorPermissions(BaseModel):
    """What the academy lets this entity's coordinators do."""

    can_manage_members: bool = True
    can_import_users: bool = True
    can_manage_groups: bool = True
    can_assign_training: bool = True
    # Off by default: invited instructors still need academy approval.
    can_add_instructors: bool = False


COORDINATOR_CAPABILITIES = tuple(CoordinatorPermissions.model_fields.keys())


# ---------------------------------------------------------------------------
# Entity
# ---------------------------------------------------------------------------


class EntityBase(SQLModel):
    name: str
    name_ar: Optional[str] = None
    code: str = ""
    description: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    status: ConfigStatus = ConfigStatus.ACTIVE


class Entity(EntityBase, table=True):
    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_entity_org_code"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    entity_type_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("configlookup.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    # A directorate inside a ministry, a faculty inside a university, …
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("entity.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    coordinator_permissions: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    # System user group holding every active member (managed automatically).
    members_group_id: Optional[int] = Field(
        default=None,
        # use_alter: entity ↔ usergroup reference each other.
        sa_column=Column(
            Integer,
            ForeignKey("usergroup.id", ondelete="SET NULL", use_alter=True, name="fk_entity_members_group_id"),
            nullable=True,
        ),
    )
    logo: Optional[str] = None
    entity_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class EntityCreate(EntityBase):
    entity_type_uuid: Optional[str] = None
    parent_uuid: Optional[str] = None
    coordinator_permissions: Optional[CoordinatorPermissions] = None


class EntityUpdate(SQLModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    status: Optional[ConfigStatus] = None
    entity_type_uuid: Optional[str] = None
    parent_uuid: Optional[str] = None
    coordinator_permissions: Optional[CoordinatorPermissions] = None


class EntityRead(EntityBase):
    id: int
    org_id: int
    entity_uuid: str
    entity_type: Optional[ConfigLookupOption] = None
    parent_uuid: Optional[str] = None
    parent_name: Optional[str] = None
    logo: Optional[str] = None
    coordinator_permissions: CoordinatorPermissions = CoordinatorPermissions()
    members_group_uuid: Optional[str] = None
    member_count: int = 0
    group_count: int = 0
    coordinators: List[UserReadAuthor] = []
    # Set on reads for the calling coordinator (None for academy staff).
    viewer_is_coordinator: bool = False
    creation_date: str
    update_date: str


class EntityOption(SQLModel):
    entity_uuid: str
    name: str
    code: str


# ---------------------------------------------------------------------------
# Position
# ---------------------------------------------------------------------------


class Position(SQLModel, table=True):
    __tablename__ = "entityposition"
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    # NULL = shared by every entity (e.g. "Manager"); otherwise entity-specific.
    entity_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("entity.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    name: str
    code: str = ""
    description: Optional[str] = None
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    position_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class PositionCreate(SQLModel):
    name: str
    code: str = ""
    description: Optional[str] = None
    status: ConfigStatus = ConfigStatus.ACTIVE
    entity_uuid: Optional[str] = None


class PositionUpdate(SQLModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ConfigStatus] = None


class PositionRead(SQLModel):
    id: int
    position_uuid: str
    name: str
    code: str
    description: Optional[str] = None
    status: ConfigStatus
    entity_uuid: Optional[str] = None
    entity_name: Optional[str] = None
    member_count: int = 0


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------


class EntityMember(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("entity_id", "user_id", name="uq_entitymember_entity_user"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    entity_id: int = Field(
        sa_column=Column(Integer, ForeignKey("entity.id", ondelete="CASCADE"), index=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    position_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("entityposition.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    employee_id: Optional[str] = None
    is_coordinator: bool = False
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    member_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class EntityNewUser(SQLModel):
    first_name: str
    last_name: str = ""
    email: str
    phone: Optional[str] = None


class EntityMemberCreate(SQLModel):
    user_uuid: Optional[str] = None
    new_user: Optional[EntityNewUser] = None
    position_uuid: Optional[str] = None
    employee_id: Optional[str] = None
    group_uuids: List[str] = []


class EntityMemberUpdate(SQLModel):
    position_uuid: Optional[str] = None
    employee_id: Optional[str] = None
    status: Optional[ConfigStatus] = None


class EntityGroupRef(SQLModel):
    usergroup_uuid: str
    name: str


class EntityMemberRead(SQLModel):
    member_uuid: str
    user: UserReadAuthor
    email: Optional[str] = None
    position_uuid: Optional[str] = None
    position_name: Optional[str] = None
    employee_id: Optional[str] = None
    is_coordinator: bool = False
    status: ConfigStatus
    groups: List[EntityGroupRef] = []
    creation_date: str
    # One-time temporary password when the account was just created.
    temporary_password: Optional[str] = None


class EntityMemberPage(SQLModel):
    items: List[EntityMemberRead] = []
    total: int = 0
    page: int = 1
    limit: int = 50


class CoordinatorAssign(SQLModel):
    user_uuid: Optional[str] = None
    new_user: Optional[EntityNewUser] = None


class EntityGroupCreate(SQLModel):
    name: str
    description: str = ""
    # general | department
    group_type: str = "general"


class EntityGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group_type: Optional[str] = None
    status: Optional[ConfigStatus] = None


class EntityGroupRead(SQLModel):
    usergroup_uuid: str
    id: int
    name: str
    description: str = ""
    group_type: str
    status: str
    member_count: int = 0
    managed: bool = False


class GroupMembersUpdate(SQLModel):
    member_uuids: List[str] = []
