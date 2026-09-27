"""Bulk user import (Excel / CSV) into an entity.

An **ImportJob** is created when a file is validated; each spreadsheet line
becomes an **ImportRow** with its normalized data, status and errors. Rows are
reviewed, then committed in the background; failed rows can be downloaded.
"""
from typing import Dict, List, Optional

from sqlalchemy import JSON, Column, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel


class ImportJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    entity_id: int = Field(
        sa_column=Column(Integer, ForeignKey("entity.id", ondelete="CASCADE"), index=True)
    )
    created_by_user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    file_name: str = ""
    # validated | processing | completed | failed
    status: str = Field(default="validated", sa_column=Column(String(16), nullable=False, default="validated"))
    options: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    created_count: int = 0
    existing_count: int = 0
    failed_count: int = 0
    error: Optional[str] = None
    job_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    completed_at: Optional[str] = None


class ImportRow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(
        sa_column=Column(Integer, ForeignKey("importjob.id", ondelete="CASCADE"), index=True)
    )
    row_number: int
    data: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # valid | existing | invalid | created | linked | failed
    status: str = Field(default="valid", sa_column=Column(String(16), nullable=False, default="valid", index=True))
    errors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    user_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )


class ImportCommitOptions(SQLModel):
    # Send new accounts a "set your password" message.
    notify: bool = True
    # Extra group every imported member joins.
    group_uuid: Optional[str] = None
    # Assign a course / program (coordinators: one made available to the entity).
    resource_type: Optional[str] = None
    resource_uuid: Optional[str] = None


class ImportJobRead(SQLModel):
    job_uuid: str
    entity_uuid: str
    entity_name: str
    file_name: str
    status: str
    options: Optional[dict] = None
    total_rows: int
    valid_rows: int
    invalid_rows: int
    created_count: int
    existing_count: int
    failed_count: int
    error: Optional[str] = None
    creation_date: str
    completed_at: Optional[str] = None
    # Rows by status (review screen).
    counts: Dict[str, int] = {}


class ImportRowRead(SQLModel):
    row_number: int
    data: dict
    status: str
    errors: List[str] = []


class ImportRowPage(SQLModel):
    items: List[ImportRowRead] = []
    total: int = 0
    page: int = 1
    limit: int = 100
