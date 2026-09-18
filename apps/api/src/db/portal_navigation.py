from typing import List, Optional
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class PortalRoleNavConfigBase(SQLModel):
    role_uuid: str = Field(index=True, unique=True)
    visible_items: List[str] = Field(default_factory=list, sa_column=Column(JSON))


class PortalRoleNavConfig(PortalRoleNavConfigBase, table=True):
    __tablename__ = "portal_role_nav_config"

    id: Optional[int] = Field(default=None, primary_key=True)
    updated_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    update_date: str = ""


class PortalRoleNavConfigRead(PortalRoleNavConfigBase):
    id: int
    updated_by_user_id: Optional[int] = None
    update_date: str
