"""Add-ons — optional or required extras (Administration & Configuration).

An **AddOn** is a catalog item (lunch, notebook, training kit, transport…)
priced once. It is attached to a course, training program, cohort or course
offering through an **AddOnAttachment** (optional price override, required /
selectable flags, max quantity). Participants record their choice as an
**AddOnSelection** with a snapshot of the price and tax at selection time —
selections are recorded only (no ledger entry, no checkout).
"""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.db.administration.lookups import ConfigLookupOption, ConfigStatus, status_column
from src.db.users import UserReadAuthor


class AddOnUnit(str, Enum):
    PER_PARTICIPANT = "per_participant"
    PER_SESSION = "per_session"
    PER_ITEM = "per_item"


class AddOnTargetType(str, Enum):
    COURSE = "course"
    TRAINING_PROGRAM = "training_program"
    COHORT = "cohort"
    OFFERING = "offering"


class AddOnSelectionStatus(str, Enum):
    SELECTED = "selected"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


class AddOnBase(SQLModel):
    name: str
    code: str = ""
    description: Optional[str] = None
    price: float = 0.0
    currency: Optional[str] = None
    # Percent (e.g. 14 for 14% VAT). None = no tax.
    tax_rate: Optional[float] = None
    # True when ``price`` already includes the tax.
    tax_inclusive: bool = False
    unit: AddOnUnit = AddOnUnit.PER_PARTICIPANT
    # Optional selection window (YYYY-MM-DD) and stock (None = unlimited).
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    stock: Optional[int] = None
    status: ConfigStatus = ConfigStatus.ACTIVE


class AddOn(AddOnBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    unit: AddOnUnit = Field(
        default=AddOnUnit.PER_PARTICIPANT,
        sa_column=Column(String(32), nullable=False, default="per_participant", server_default="per_participant"),
    )
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    category_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("configlookup.id", ondelete="SET NULL"), nullable=True, index=True
        ),
    )
    image: Optional[str] = None
    addon_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class AddOnCreate(AddOnBase):
    category_uuid: Optional[str] = None


class AddOnUpdate(SQLModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    tax_inclusive: Optional[bool] = None
    unit: Optional[AddOnUnit] = None
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    stock: Optional[int] = None
    status: Optional[ConfigStatus] = None
    category_uuid: Optional[str] = None


class AddOnRead(AddOnBase):
    id: int
    org_id: int
    addon_uuid: str
    category: Optional[ConfigLookupOption] = None
    image: Optional[str] = None
    attachment_count: int = 0
    selected_quantity: int = 0
    creation_date: str
    update_date: str


class AddOnOption(SQLModel):
    addon_uuid: str
    name: str
    price: float
    currency: Optional[str] = None
    unit: AddOnUnit
    category_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Attachment (add-on ↔ course / program / cohort / offering)
# ---------------------------------------------------------------------------


class AddOnAttachment(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("addon_id", "target_type", "target_uuid", name="uq_addonattachment_addon_target"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    addon_id: int = Field(
        sa_column=Column(Integer, ForeignKey("addon.id", ondelete="CASCADE"), index=True)
    )
    target_type: str = Field(index=True)
    target_uuid: str = Field(index=True)
    price_override: Optional[float] = None
    is_required: bool = False
    is_selectable: bool = True
    max_quantity: int = 1
    sort_order: int = 0
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    attachment_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class AddOnAttachmentCreate(SQLModel):
    addon_uuid: str
    target_type: AddOnTargetType
    target_uuid: str
    price_override: Optional[float] = None
    is_required: bool = False
    is_selectable: bool = True
    max_quantity: int = 1
    sort_order: int = 0


class AddOnAttachmentUpdate(SQLModel):
    price_override: Optional[float] = None
    is_required: Optional[bool] = None
    is_selectable: Optional[bool] = None
    max_quantity: Optional[int] = None
    sort_order: Optional[int] = None
    status: Optional[ConfigStatus] = None


class AddOnAttachmentRead(SQLModel):
    attachment_uuid: str
    target_type: str
    target_uuid: str
    addon_uuid: str
    name: str
    description: Optional[str] = None
    category_name: Optional[str] = None
    image: Optional[str] = None
    unit: AddOnUnit
    currency: Optional[str] = None
    catalog_price: float
    price_override: Optional[float] = None
    unit_price: float
    tax_rate: Optional[float] = None
    tax_inclusive: bool = False
    # Price of one unit including tax.
    unit_price_with_tax: float
    is_required: bool = False
    is_selectable: bool = True
    max_quantity: int = 1
    sort_order: int = 0
    status: ConfigStatus = ConfigStatus.ACTIVE
    # False when the add-on is inactive / outside its window / out of stock.
    available: bool = True
    remaining_stock: Optional[int] = None


# ---------------------------------------------------------------------------
# Participant selections (recorded only)
# ---------------------------------------------------------------------------


class AddOnSelection(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("attachment_id", "user_id", name="uq_addonselection_attachment_user"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    attachment_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("addonattachment.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    addon_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("addon.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    )
    target_type: str = Field(index=True)
    target_uuid: str = Field(index=True)
    # Snapshots so reports survive catalog edits and deletions.
    addon_name: str = ""
    quantity: int = 1
    unit_price: float = 0.0
    tax_rate: Optional[float] = None
    tax_amount: float = 0.0
    total: float = 0.0
    currency: Optional[str] = None
    status: AddOnSelectionStatus = Field(
        default=AddOnSelectionStatus.SELECTED,
        sa_column=Column(String(32), nullable=False, default="selected", server_default="selected", index=True),
    )
    selection_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class MySelectionItem(SQLModel):
    attachment_uuid: str
    # 0 removes the selection (required add-ons cannot be removed).
    quantity: int = 1


class MySelectionUpdate(SQLModel):
    items: List[MySelectionItem] = []


class AddOnSelectionRead(SQLModel):
    selection_uuid: str
    attachment_uuid: Optional[str] = None
    addon_uuid: Optional[str] = None
    addon_name: str
    target_type: str
    target_uuid: str
    target_name: Optional[str] = None
    quantity: int
    unit_price: float
    tax_rate: Optional[float] = None
    tax_amount: float
    total: float
    currency: Optional[str] = None
    status: AddOnSelectionStatus
    user: Optional[UserReadAuthor] = None
    creation_date: str
    update_date: str


class TargetAddOnItem(SQLModel):
    attachment: AddOnAttachmentRead
    selected_quantity: int = 0
    line_total: float = 0.0


class TargetAddOnsRead(SQLModel):
    target_type: str
    target_uuid: str
    items: List[TargetAddOnItem] = []
    total: float = 0.0
    currency: Optional[str] = None


class SelectionReport(SQLModel):
    selections: List[AddOnSelectionRead] = []
    total_quantity: int = 0
    total_amount: float = 0.0
