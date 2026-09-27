"""Reusable configuration lookups (Administration & Configuration).

A **ConfigLookup** is an admin-managed, org-scoped list entry of a given
``kind`` — facility types, equipment, add-on categories, entity types,
location types and course categories all live in this one table instead of a
table per category. Each kind is whitelisted in code (``LookupKind``) so the
table cannot grow into an uncontrolled key/value store. Instructor categories
are *not* lookups: they carry rates and keep their own table.
"""
from enum import Enum
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class LookupKind(str, Enum):
    FACILITY_TYPE = "facility_type"
    EQUIPMENT = "equipment"
    ADDON_CATEGORY = "addon_category"
    ENTITY_TYPE = "entity_type"
    LOCATION_TYPE = "location_type"
    COURSE_CATEGORY = "course_category"


class ConfigStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


def status_column(default: str = "active") -> Column:
    """Plain-string status column (validated by the pydantic enum, not a PG enum)."""
    return Column(String(32), nullable=False, default=default, server_default=default, index=True)


class ConfigLookupBase(SQLModel):
    name: str
    code: str = ""
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0
    status: ConfigStatus = ConfigStatus.ACTIVE


class ConfigLookup(ConfigLookupBase, table=True):
    __table_args__ = (
        UniqueConstraint("org_id", "kind", "code", name="uq_configlookup_org_kind_code"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    kind: str = Field(index=True)
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("configlookup.id", ondelete="SET NULL"), nullable=True, index=True
        ),
    )
    # Seeded defaults are editable/deactivatable but flagged so the UI can
    # label them; they are never re-created once an admin removes them.
    is_system: bool = False
    extra: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    lookup_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class ConfigLookupCreate(ConfigLookupBase):
    kind: LookupKind
    parent_uuid: Optional[str] = None
    extra: Optional[dict] = None


class ConfigLookupUpdate(SQLModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    status: Optional[ConfigStatus] = None
    parent_uuid: Optional[str] = None
    extra: Optional[dict] = None


class ConfigLookupRead(ConfigLookupBase):
    id: int
    org_id: int
    kind: str
    lookup_uuid: str
    parent_id: Optional[int] = None
    parent_uuid: Optional[str] = None
    is_system: bool = False
    extra: Optional[dict] = None
    usage_count: int = 0
    creation_date: str
    update_date: str


class ConfigLookupOption(SQLModel):
    id: int
    lookup_uuid: str
    kind: str
    name: str
    code: str
    color: Optional[str] = None


class LookupReorderItem(SQLModel):
    lookup_uuid: str
    sort_order: int
