"""Audience assignment — who a course / training program is assigned to.

An **AudienceAssignment** says "resource R is assigned to audience A". The
audience can be a user, a user group, a whole entity, a position (optionally
within one entity) or a cohort. Assignments are *materialized* into the
existing access mechanism (``UserGroup`` + ``UserGroupResource``) by
``services/administration/audience.py``:

- user group / cohort / entity → their group is linked to the resource;
- position / user → collected into one system group per resource.

``mode = available`` does not grant access: it makes the resource assignable by
that entity's coordinator, who then assigns it to groups/positions/members.
"""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel


class AudienceResourceType(str, Enum):
    COURSE = "course"
    TRAINING_PROGRAM = "training_program"


class AudienceType(str, Enum):
    USER = "user"
    USERGROUP = "usergroup"
    ENTITY = "entity"
    POSITION = "position"
    COHORT = "cohort"


class AudienceMode(str, Enum):
    ASSIGNED = "assigned"
    AVAILABLE = "available"


class AudienceAssignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    resource_type: str = Field(index=True)
    resource_uuid: str = Field(index=True)
    audience_type: str = Field(index=True)
    audience_id: int = Field(index=True)
    # Scopes a position to one entity; also marks coordinator-made assignments.
    entity_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("entity.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    mode: AudienceMode = Field(
        default=AudienceMode.ASSIGNED,
        sa_column=Column(String(16), nullable=False, default="assigned", server_default="assigned"),
    )
    auto_enroll: bool = False
    due_date: Optional[str] = None
    notify: bool = True
    created_by_user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    assignment_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class AudienceAssignmentCreate(SQLModel):
    resource_type: AudienceResourceType
    resource_uuid: str
    audience_type: AudienceType
    audience_uuid: str
    # Required for coordinators; for positions it limits to that entity.
    entity_uuid: Optional[str] = None
    mode: AudienceMode = AudienceMode.ASSIGNED
    auto_enroll: bool = False
    due_date: Optional[str] = None
    notify: bool = True


class AudienceAssignmentRead(SQLModel):
    assignment_uuid: str
    resource_type: str
    resource_uuid: str
    resource_name: Optional[str] = None
    audience_type: str
    audience_uuid: Optional[str] = None
    audience_name: Optional[str] = None
    entity_uuid: Optional[str] = None
    entity_name: Optional[str] = None
    mode: AudienceMode
    auto_enroll: bool = False
    due_date: Optional[str] = None
    notify: bool = True
    member_count: int = 0
    creation_date: str


class LegacyGroupLink(SQLModel):
    usergroup_uuid: str
    name: str
    group_type: str = "general"


class ResourceAudienceRead(SQLModel):
    resource_type: str
    resource_uuid: str
    resource_name: Optional[str] = None
    published: bool = True
    assignments: List[AudienceAssignmentRead] = []
    # Groups linked to the resource outside of audience assignments.
    other_groups: List[LegacyGroupLink] = []
    # Everyone who currently gets access through assignments.
    covered_users: int = 0


class AudienceOption(SQLModel):
    audience_type: str
    audience_uuid: str
    name: str
    detail: Optional[str] = None
    entity_uuid: Optional[str] = None


class AvailableResourceRead(SQLModel):
    """A course/program the academy made available to an entity."""

    resource_type: str
    resource_uuid: str
    resource_name: Optional[str] = None
    published: bool = True
    available_since: str
    assignments: List[AudienceAssignmentRead] = []


class AudienceSyncResult(SQLModel):
    newly_covered_user_ids: List[int] = []
    covered_users: int = 0
