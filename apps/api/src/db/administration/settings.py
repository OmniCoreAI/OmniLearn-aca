"""Org-level administration settings (Administration & Configuration).

One row per ``(org_id, key)``. The value is JSON validated by the pydantic
schema registered for that key in ``services/administration/settings.py`` — the
table is never an open key/value store: unknown keys are rejected.
"""
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AdminSetting(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("org_id", "key", name="uq_adminsetting_org_key"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    key: str = Field(index=True)
    value: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    updated_by_user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    creation_date: str = ""
    update_date: str = ""
