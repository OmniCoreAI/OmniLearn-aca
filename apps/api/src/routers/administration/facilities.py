from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.administration.facilities import (
    FacilityBooking,
    FacilityCreate,
    FacilityOption,
    FacilityRead,
    FacilityReservationCreate,
    FacilityReservationUpdate,
    FacilityUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.administration import facilities as svc
from src.services.administration import reservations as booking_svc

router = APIRouter()


@router.post("/", response_model=FacilityRead, summary="Create a facility / room")
async def api_create_facility(
    payload: FacilityCreate,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityRead:
    return await svc.create_facility(db_session, current_user, org_id, payload)


@router.get("/org/{org_id}", response_model=List[FacilityRead], summary="List facilities")
async def api_list_facilities(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[FacilityRead]:
    return await svc.list_facilities(db_session, current_user, org_id)


@router.get(
    "/org/{org_id}/options",
    response_model=List[FacilityOption],
    summary="Bookable facilities for pickers (any org member; no costs)",
)
async def api_facility_options(
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[FacilityOption]:
    return await svc.list_facility_options(db_session, current_user, org_id)


@router.get(
    "/org/{org_id}/bookings",
    response_model=List[FacilityBooking],
    summary="Bookings of every facility in the organization (optionally within a date range)",
)
async def api_org_bookings(
    org_id: int,
    since: Optional[str] = None,
    until: Optional[str] = None,
    include_cancelled: bool = False,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[FacilityBooking]:
    return await booking_svc.list_org_bookings(db_session, current_user, org_id, since, until, include_cancelled)


@router.put("/bookings/{booking_uuid}", response_model=FacilityBooking, summary="Change a hall booking")
async def api_update_booking(
    booking_uuid: str,
    payload: FacilityReservationUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityBooking:
    return await booking_svc.update_reservation(db_session, current_user, booking_uuid, payload)


@router.post("/bookings/{booking_uuid}/cancel", response_model=FacilityBooking, summary="Cancel a hall booking")
async def api_cancel_booking(
    booking_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityBooking:
    return await booking_svc.cancel_reservation(db_session, current_user, booking_uuid)


@router.get("/{facility_uuid}", response_model=FacilityRead, summary="Get a facility")
async def api_get_facility(
    facility_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityRead:
    return await svc.get_facility(db_session, current_user, facility_uuid)


@router.get(
    "/{facility_uuid}/bookings",
    response_model=List[FacilityBooking],
    summary="Bookings of a facility — sessions and direct bookings (optionally within a date range)",
)
async def api_facility_bookings(
    facility_uuid: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[FacilityBooking]:
    return await booking_svc.list_bookings(db_session, current_user, facility_uuid, since, until)


@router.post(
    "/{facility_uuid}/bookings",
    response_model=FacilityBooking,
    summary="Book a hall directly (event, exam, meeting, maintenance…); 409 on a conflict",
)
async def api_create_booking(
    facility_uuid: str,
    payload: FacilityReservationCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityBooking:
    return await booking_svc.create_reservation(db_session, current_user, facility_uuid, payload)


@router.get(
    "/{facility_uuid}/conflicts",
    response_model=List[str],
    summary="Why a time range cannot use the facility (empty when it is free)",
)
async def api_facility_conflicts(
    facility_uuid: str,
    start: str,
    end: Optional[str] = None,
    exclude: Optional[str] = None,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[str]:
    return await booking_svc.check_facility(db_session, facility_uuid, current_user, start, end, exclude)


@router.put("/{facility_uuid}", response_model=FacilityRead, summary="Update a facility")
async def api_update_facility(
    facility_uuid: str,
    payload: FacilityUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityRead:
    return await svc.update_facility(db_session, current_user, facility_uuid, payload)


@router.put("/{facility_uuid}/image", response_model=FacilityRead, summary="Upload a facility photo")
async def api_upload_facility_image(
    facility_uuid: str,
    image: UploadFile,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FacilityRead:
    return await svc.upload_facility_image(db_session, current_user, facility_uuid, image)


@router.delete("/{facility_uuid}", summary="Delete a facility (bookings keep their text location)")
async def api_delete_facility(
    facility_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> str:
    return await svc.delete_facility(db_session, current_user, facility_uuid)
