"""Locations and facilities (rooms) — Administration & Configuration.

A **Location** is a building / branch / campus / training center. A
**Facility** is a bookable space inside a location (training room, lecture
hall, computer lab…) with a capacity, equipment, weekly availability and cost.

Facilities are attached by foreign key (``facility_id``, ON DELETE SET NULL) to
course academic profiles, course offerings, training programs and the schedule
sessions of both — a session without its own facility uses its parent's
default facility. The legacy free-text ``classroom`` / ``location`` fields stay
as a fallback.

Every booked time range lives in **FacilityReservation**: one row per schedule
session that occupies a room (kept in sync when the session is saved) plus
hall bookings made directly (events, exams, meetings…). On PostgreSQL an
exclusion constraint rejects two approved, non-overridden reservations of the
same room that overlap, so concurrent saves cannot double-book.
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from src.db.administration.lookups import ConfigLookupOption, ConfigStatus, status_column


class FacilityStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


# ---------------------------------------------------------------------------
# Location
# ---------------------------------------------------------------------------


class LocationBase(SQLModel):
    name: str
    code: str = ""
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    status: ConfigStatus = ConfigStatus.ACTIVE


class Location(LocationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    status: ConfigStatus = Field(default=ConfigStatus.ACTIVE, sa_column=status_column())
    location_type_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("configlookup.id", ondelete="SET NULL"), nullable=True),
    )
    # A branch inside a campus, a building inside a branch, …
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("location.id", ondelete="SET NULL"), nullable=True),
    )
    location_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class LocationCreate(LocationBase):
    location_type_uuid: Optional[str] = None
    parent_uuid: Optional[str] = None


class LocationUpdate(SQLModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[ConfigStatus] = None
    location_type_uuid: Optional[str] = None
    parent_uuid: Optional[str] = None


class LocationRead(LocationBase):
    id: int
    org_id: int
    location_uuid: str
    location_type: Optional[ConfigLookupOption] = None
    parent_uuid: Optional[str] = None
    parent_name: Optional[str] = None
    facility_count: int = 0
    creation_date: str
    update_date: str


# ---------------------------------------------------------------------------
# Facility
# ---------------------------------------------------------------------------


class FacilityBase(SQLModel):
    name: str
    code: str = ""
    description: Optional[str] = None
    capacity: Optional[int] = None
    floor: Optional[str] = None
    room_number: Optional[str] = None
    hourly_cost: Optional[float] = None
    daily_cost: Optional[float] = None
    currency: Optional[str] = None
    is_bookable: bool = True
    status: FacilityStatus = FacilityStatus.ACTIVE
    # {"slots": [{"day","start","end"}], "blackout_dates": [{"start","end","reason"}], "notes"}
    availability: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class Facility(FacilityBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    status: FacilityStatus = Field(default=FacilityStatus.ACTIVE, sa_column=status_column())
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    facility_type_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("configlookup.id", ondelete="SET NULL"), nullable=True, index=True
        ),
    )
    location_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("location.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    # [{"lookup_id": 3, "quantity": 1}] — equipment lookups with counts.
    equipment: Optional[list] = Field(default=None, sa_column=Column(JSONB))
    image: Optional[str] = None
    facility_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class FacilityEquipmentInput(SQLModel):
    lookup_uuid: str
    quantity: int = 1


class FacilityEquipmentRead(SQLModel):
    lookup_uuid: str
    name: str
    quantity: int = 1


class FacilityCreate(FacilityBase):
    facility_type_uuid: Optional[str] = None
    location_uuid: Optional[str] = None
    equipment: Optional[List[FacilityEquipmentInput]] = None


class FacilityUpdate(SQLModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    floor: Optional[str] = None
    room_number: Optional[str] = None
    hourly_cost: Optional[float] = None
    daily_cost: Optional[float] = None
    currency: Optional[str] = None
    is_bookable: Optional[bool] = None
    status: Optional[FacilityStatus] = None
    availability: Optional[dict] = None
    facility_type_uuid: Optional[str] = None
    location_uuid: Optional[str] = None
    equipment: Optional[List[FacilityEquipmentInput]] = None


class FacilityRead(FacilityBase):
    id: int
    org_id: int
    facility_uuid: str
    facility_type: Optional[ConfigLookupOption] = None
    location_uuid: Optional[str] = None
    location_name: Optional[str] = None
    equipment: List[FacilityEquipmentRead] = []
    image: Optional[str] = None
    upcoming_bookings: int = 0
    creation_date: str
    update_date: str


class FacilityOption(SQLModel):
    """Picker projection — never includes costs."""

    facility_uuid: str
    name: str
    code: str = ""
    capacity: Optional[int] = None
    facility_type_name: Optional[str] = None
    location_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Reservations (bookings)
# ---------------------------------------------------------------------------


class ReservationSource(str, Enum):
    COURSE_SESSION = "course_session"
    OFFERING_SESSION = "offering_session"
    MANUAL = "manual"  # a hall booked directly (event, exam, meeting…)


class ReservationStatus(str, Enum):
    APPROVED = "approved"
    CANCELLED = "cancelled"


class ReservationKind(str, Enum):
    SESSION = "session"
    EVENT = "event"
    EXAM = "exam"
    MEETING = "meeting"
    MAINTENANCE = "maintenance"
    OTHER = "other"


# Only approved rows that were not saved over a known conflict take part in the
# PostgreSQL exclusion constraint (see services/administration/reservations.py).
NO_OVERLAP_CONSTRAINT = "ex_facilityreservation_no_overlap"


class FacilityReservation(SQLModel, table=True):
    __table_args__ = (
        Index("ix_facilityreservation_facility_time", "facility_id", "starts_at", "ends_at"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    facility_id: int = Field(
        sa_column=Column(Integer, ForeignKey("facility.id", ondelete="CASCADE"), nullable=False)
    )
    source: str = Field(default=ReservationSource.MANUAL.value, sa_column=Column(String(32), nullable=False))
    # The schedule session this row mirrors (at most one row per session).
    course_session_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("courseschedulesession.id", ondelete="CASCADE"), nullable=True, unique=True
        ),
    )
    offering_session_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("offeringsession.id", ondelete="CASCADE"), nullable=True, unique=True
        ),
    )
    starts_at: datetime = Field(sa_column=Column(DateTime, nullable=False))
    ends_at: datetime = Field(sa_column=Column(DateTime, nullable=False))
    status: str = Field(default=ReservationStatus.APPROVED.value, sa_column=Column(String(16), nullable=False))
    # Saved although it overlapped another booking (the user chose "book anyway").
    conflict_override: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    # Manual bookings only — session rows read their title from the session.
    title: Optional[str] = None
    kind: str = Field(default=ReservationKind.SESSION.value, sa_column=Column(String(16), nullable=False))
    attendees: Optional[int] = None
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_by_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    reservation_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class FacilityReservationCreate(SQLModel):
    title: str
    kind: ReservationKind = ReservationKind.EVENT
    start: str
    end: str
    attendees: Optional[int] = None
    notes: Optional[str] = None
    allow_conflict: bool = False


class FacilityReservationUpdate(SQLModel):
    # Move the booking to another room of the same organization.
    facility_uuid: Optional[str] = None
    title: Optional[str] = None
    kind: Optional[ReservationKind] = None
    start: Optional[str] = None
    end: Optional[str] = None
    attendees: Optional[int] = None
    notes: Optional[str] = None
    allow_conflict: bool = False


class FacilityBooking(SQLModel):
    """A reservation of a facility: a schedule session or a direct booking."""

    booking_uuid: str = ""
    source: str  # course_session | offering_session | manual
    session_uuid: Optional[str] = None
    facility_uuid: Optional[str] = None
    facility_name: Optional[str] = None
    title: Optional[str] = None
    # As entered on the session (may be date-only); see starts_at / ends_at.
    start: Optional[str] = None
    end: Optional[str] = None
    # The occupied range, always "YYYY-MM-DDTHH:MM" (end exclusive).
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    parent_name: Optional[str] = None
    parent_uuid: Optional[str] = None
    # True when the room comes from the parent's default, not the session.
    inherited: bool = False
    kind: str = ReservationKind.SESSION.value
    status: str = ReservationStatus.APPROVED.value
    attendees: Optional[int] = None
    notes: Optional[str] = None
    # Saved over a conflict with another booking of the same room.
    double_booked: bool = False


class FacilityRef(SQLModel):
    """Compact facility reference embedded in course/offering/program reads."""

    facility_uuid: str
    name: str
    capacity: Optional[int] = None
    location_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Smart suggestions
# ---------------------------------------------------------------------------


class SuggestionReason(SQLModel):
    """Why a room ranks where it does; ``code`` is translated by the client.

    Codes: fits, roomy, seats, capacity_unknown, same_room, same_location,
    nearby, equipment, quiet_day, busy_day.
    """

    code: str
    params: dict = {}


class RoomSuggestion(SQLModel):
    """A room that is free for the requested time, ranked by fit (no costs)."""

    facility_uuid: str
    name: str
    code: str = ""
    capacity: Optional[int] = None
    facility_type_name: Optional[str] = None
    location_uuid: Optional[str] = None
    location_name: Optional[str] = None
    score: int = 0  # 0–100
    reasons: List[SuggestionReason] = []


class FreeSlot(SQLModel):
    start: str
    end: str
