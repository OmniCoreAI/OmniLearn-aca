"""Locations and facilities (rooms) — Administration & Configuration.

A **Location** is a building / branch / campus / training center. A
**Facility** is a bookable space inside a location (training room, lecture
hall, computer lab…) with a capacity, equipment, weekly availability and cost.

Facilities are attached by foreign key (``facility_id``, ON DELETE SET NULL) to
course academic profiles, course offerings, training programs and the schedule
sessions of both — a session without its own facility uses its parent's
default facility. The legacy free-text ``classroom`` / ``location`` fields stay
as a fallback.
"""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Integer, Text
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


class FacilityBooking(SQLModel):
    """A schedule session that occupies a facility."""

    source: str  # course_session | offering_session
    session_uuid: str
    title: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    parent_name: Optional[str] = None
    parent_uuid: Optional[str] = None
    # True when the room comes from the parent's default, not the session.
    inherited: bool = False


class FacilityRef(SQLModel):
    """Compact facility reference embedded in course/offering/program reads."""

    facility_uuid: str
    name: str
    capacity: Optional[int] = None
    location_name: Optional[str] = None
