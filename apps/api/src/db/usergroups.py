from enum import Enum
from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel


class UserGroupType(str, Enum):
    GENERAL = "general"
    # A department of an entity (e.g. "IT Department").
    DEPARTMENT = "department"
    # Roster group owned by a cohort / course offering.
    COHORT = "cohort"
    # Maintained automatically (entity members, audience assignment); locked.
    SYSTEM = "system"


class UserGroupBase(SQLModel):
    name: str
    description: str

class UserGroup(UserGroupBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False)
    )
    # Entity (Administration → Entities) this group belongs to, if any.
    entity_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("entity.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    group_type: str = Field(
        default=UserGroupType.GENERAL.value,
        sa_column=Column(String(16), nullable=False, default="general", server_default="general"),
    )
    # Inactive groups keep their links but no longer grant access.
    status: str = Field(
        default="active",
        sa_column=Column(String(16), nullable=False, default="active", server_default="active"),
    )
    # Identifies automatically maintained (system) groups, e.g. "entity:<uuid>".
    managed_key: Optional[str] = Field(default=None, sa_column=Column(String, nullable=True, index=True))
    usergroup_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""

class UserGroupCreate(UserGroupBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    entity_uuid: Optional[str] = None
    group_type: UserGroupType = UserGroupType.GENERAL
    status: str = "active"

class UserGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    # "" detaches the group from its entity.
    entity_uuid: Optional[str] = None
    group_type: Optional[UserGroupType] = None
    status: Optional[str] = None

class UserGroupRead(UserGroupBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    usergroup_uuid: str
    entity_id: Optional[int] = None
    entity_uuid: Optional[str] = None
    entity_name: Optional[str] = None
    group_type: str = UserGroupType.GENERAL.value
    status: str = "active"
    managed: bool = False
    # Filled by list reads (enrich_usergroups).
    member_count: int = 0
    course_count: int = 0
    creation_date: str
    update_date: str
