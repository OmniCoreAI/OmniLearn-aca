"""Finance reporting models — refunds, course costing, payroll periods (no gateways)."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class FinanceRefundStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    recorded = "recorded"  # approved + accounted for (manual payout)


class FinanceRefund(SQLModel, table=True):
    __tablename__ = "financerefund"
    __table_args__ = ({"extend_existing": True},)

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    refund_uuid: str = Field(default="", index=True)
    # Soft link to the revenue ledger entry being refunded
    entry_uuid: str = Field(default="", index=True)
    amount: float = 0.0
    currency: str = "EGP"
    reason: str = ""
    status: str = Field(default=FinanceRefundStatus.pending.value, index=True)
    decided_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    decided_at: Optional[str] = None
    decision_note: Optional[str] = None
    created_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    creation_date: str = ""
    update_date: str = ""


class FinanceRefundCreate(SQLModel):
    entry_uuid: str
    amount: Optional[float] = None  # defaults to full entry amount
    reason: str
    currency: Optional[str] = None


class FinanceRefundDecision(SQLModel):
    status: FinanceRefundStatus  # approved | rejected | recorded
    decision_note: Optional[str] = None


class FinanceRefundRead(SQLModel):
    id: int
    org_id: int
    refund_uuid: str
    entry_uuid: str
    entry_title: Optional[str] = None
    amount: float
    currency: str
    reason: str
    status: str
    decided_by: Optional[int] = None
    decided_at: Optional[str] = None
    decision_note: Optional[str] = None
    created_by: Optional[int] = None
    creation_date: str
    update_date: str


class FinanceCourseConfig(SQLModel, table=True):
    """Per-course cost/revenue assumptions for profitability reporting."""

    __tablename__ = "financecourseconfig"
    __table_args__ = (
        UniqueConstraint("org_id", "course_uuid", name="uq_financecourseconfig_org_course"),
        {"extend_existing": True},
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    course_uuid: str = Field(default="", index=True)
    config_uuid: str = Field(default="", index=True)
    currency: str = "EGP"
    tuition_unit_amount: Optional[float] = None
    certification_unit_cost: Optional[float] = 0.0
    addons_unit_cost: Optional[float] = 0.0
    other_fixed_cost: Optional[float] = 0.0
    attendees_override: Optional[int] = None  # when set, used instead of TrailRun count
    certified_attendees_override: Optional[int] = None
    creation_date: str = ""
    update_date: str = ""


class FinanceCourseConfigUpsert(SQLModel):
    course_uuid: str
    currency: str = "EGP"
    tuition_unit_amount: Optional[float] = None
    certification_unit_cost: Optional[float] = 0.0
    addons_unit_cost: Optional[float] = 0.0
    other_fixed_cost: Optional[float] = 0.0
    attendees_override: Optional[int] = None
    certified_attendees_override: Optional[int] = None


class FinanceCourseConfigRead(SQLModel):
    id: int
    org_id: int
    course_uuid: str
    config_uuid: str
    currency: str
    tuition_unit_amount: Optional[float] = None
    certification_unit_cost: Optional[float] = None
    addons_unit_cost: Optional[float] = None
    other_fixed_cost: Optional[float] = None
    attendees_override: Optional[int] = None
    certified_attendees_override: Optional[int] = None
    creation_date: str
    update_date: str


class CourseProfitRead(SQLModel):
    org_id: int
    course_uuid: str
    course_name: Optional[str] = None
    program_uuid: Optional[str] = None
    program_name: Optional[str] = None
    program_type: Optional[str] = None  # postgraduate | training
    currency: str = "EGP"
    attendees: int = 0
    certified_attendees: int = 0
    ledger_revenue: float = 0.0
    ledger_expenses: float = 0.0
    refunds: float = 0.0
    net_revenue: float = 0.0
    instructor_cost: float = 0.0
    instructor_hours: float = 0.0
    certification_cost: float = 0.0
    addons_cost: float = 0.0
    other_fixed_cost: float = 0.0
    total_cost: float = 0.0
    net_profit: float = 0.0
    margin_pct: float = 0.0
    revenue_per_attendee: float = 0.0
    cost_per_attendee: float = 0.0
    config: Optional[FinanceCourseConfigRead] = None


class ProfitLossLine(SQLModel):
    label: str
    amount: float
    kind: str  # revenue | expense | cost | total | margin


class CategoryAmount(SQLModel):
    entry_type: str
    category: str
    total: float


class ProfitLossRead(SQLModel):
    org_id: int
    currency: str = "EGP"
    range_from: Optional[str] = None
    range_to: Optional[str] = None
    gross_revenue: float = 0.0
    refunds: float = 0.0
    net_revenue: float = 0.0
    operating_expenses: float = 0.0
    instructor_cost: float = 0.0
    total_costs: float = 0.0
    net_profit: float = 0.0
    margin_pct: float = 0.0
    lines: List[ProfitLossLine] = []
    by_category: List[CategoryAmount] = []


class PayrollInstructorLine(SQLModel):
    instructor_id: Optional[int] = None
    instructor_uuid: Optional[str] = None
    instructor_name: Optional[str] = None
    hours: float = 0.0
    amount: float = 0.0
    currency: Optional[str] = None
    courses: List[str] = []


class PayrollReportRead(SQLModel):
    org_id: int
    month: str  # YYYY-MM
    currency: str = "EGP"
    total_hours: float = 0.0
    total_pay: float = 0.0
    instructors: List[PayrollInstructorLine] = []
    closed: bool = False


class FinancePayrollPeriod(SQLModel, table=True):
    __tablename__ = "financepayrollperiod"
    __table_args__ = (
        UniqueConstraint("org_id", "month", name="uq_financepayrollperiod_org_month"),
        {"extend_existing": True},
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    month: str = Field(default="", index=True)  # YYYY-MM
    status: str = "open"  # open | closed
    total_hours: float = 0.0
    total_pay: float = 0.0
    currency: str = "EGP"
    closed_by: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    closed_at: Optional[str] = None
    creation_date: str = ""
    update_date: str = ""
