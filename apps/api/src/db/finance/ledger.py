"""Academy finance ledger — local revenue/expense entries (no Stripe required)."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class FinanceEntryType(str, Enum):
    revenue = "revenue"
    expense = "expense"


class FinanceEntryStatus(str, Enum):
    recorded = "recorded"
    pending = "pending"
    cancelled = "cancelled"


class FinanceLedgerEntry(SQLModel, table=True):
    __tablename__ = "financeledgerentry"
    __table_args__ = ({"extend_existing": True},)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True
        )
    )
    entry_uuid: str = Field(default="", index=True)
    entry_type: str = Field(default=FinanceEntryType.revenue.value, index=True)
    category: str = Field(default="other", index=True)
    title: str = ""
    amount: float = 0.0
    currency: str = "EGP"
    entry_date: str = Field(default="", index=True)  # YYYY-MM-DD
    description: Optional[str] = None
    payment_method: Optional[str] = None  # cash | bank_transfer | check | card | other
    status: str = Field(default=FinanceEntryStatus.recorded.value, index=True)
    # Optional attribution (no FK — soft links)
    offer_uuid: Optional[str] = None
    course_uuid: Optional[str] = None
    created_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    creation_date: str = ""
    update_date: str = ""


class FinanceLedgerEntryCreate(SQLModel):
    entry_type: FinanceEntryType = FinanceEntryType.revenue
    category: str = "other"
    title: str
    amount: float
    currency: str = "EGP"
    entry_date: str  # YYYY-MM-DD
    description: Optional[str] = None
    payment_method: Optional[str] = None
    status: FinanceEntryStatus = FinanceEntryStatus.recorded
    offer_uuid: Optional[str] = None
    course_uuid: Optional[str] = None


class FinanceLedgerEntryUpdate(SQLModel):
    entry_type: Optional[FinanceEntryType] = None
    category: Optional[str] = None
    title: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    entry_date: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    status: Optional[FinanceEntryStatus] = None
    offer_uuid: Optional[str] = None
    course_uuid: Optional[str] = None


class FinanceLedgerEntryRead(SQLModel):
    id: int
    org_id: int
    entry_uuid: str
    entry_type: str
    category: str
    title: str
    amount: float
    currency: str
    entry_date: str
    description: Optional[str] = None
    payment_method: Optional[str] = None
    status: str
    offer_uuid: Optional[str] = None
    course_uuid: Optional[str] = None
    created_by: Optional[int] = None
    creation_date: str
    update_date: str


class CategoryBreakdown(SQLModel):
    category: str
    entry_type: str
    total: float
    count: int


class DailyBreakdown(SQLModel):
    date: str
    revenue: float = 0.0
    expenses: float = 0.0
    net: float = 0.0


class FinanceLedgerSummaryRead(SQLModel):
    org_id: int
    currency: str = "EGP"
    range_from: Optional[str] = None
    range_to: Optional[str] = None
    total_revenue: float = 0.0
    total_expenses: float = 0.0
    instructor_cost: float = 0.0
    estimated_profit: float = 0.0
    estimated_margin: float = 0.0
    entry_count: int = 0
    revenue_count: int = 0
    expense_count: int = 0
    by_category: List[CategoryBreakdown] = []
    daily: List[DailyBreakdown] = []
