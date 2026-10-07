"""Facility reservations: session mirroring, direct hall bookings, opening hours, backfill.

The PostgreSQL exclusion constraint is not exercised here (tests run on
SQLite); the API-level conflict checks it backs up are.
"""
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.academic.calendar import AcademicTermCreate, AcademicYearCreate, TermType
from src.db.academic.catalog import AcademicCourseCreate
from src.db.academic.course_profiles import (
    CourseAcademicProfileUpsert,
    CourseScheduleSession,
    CourseScheduleSessionCreate,
)
from src.db.academic.offerings import (
    CourseOfferingCreate,
    CourseOfferingUpdate,
    OfferingSessionCreate,
    OfferingSessionUpdate,
    OfferingStatus,
)
from src.db.administration.facilities import (
    FacilityCreate,
    FacilityReservation,
    FacilityReservationCreate,
    FacilityReservationUpdate,
    ReservationKind,
)
from src.services.academic import calendar as calendar_svc
from src.services.academic import catalog as catalog_svc
from src.services.academic import course_profiles as course_profiles_svc
from src.services.academic import offerings as offerings_svc
from src.services.administration import facilities as fac_svc
from src.services.administration import reservations as res_svc


@pytest.fixture
def bypass_rbac():
    with ExitStack() as stack:
        for mod in (course_profiles_svc, offerings_svc):
            stack.enter_context(patch.object(mod, "check_resource_access", new=AsyncMock()))
        yield


async def _room(db, admin_user, org, name="Hall A", **extra):
    return await fac_svc.create_facility(db, admin_user, org.id, FacilityCreate(name=name, capacity=40, **extra))


async def _offering(db, org, admin_user, mock_request, code="NET-101"):
    year = await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2026/2027"), admin_user, db)
    fall = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.FALL), admin_user, db
    )
    course = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code=code, name="Networks"), admin_user, db)
    return await offerings_svc.create_offering(
        mock_request, org.id,
        CourseOfferingCreate(academic_course_uuid=course.academic_course_uuid, term_uuid=fall.term_uuid),
        admin_user, db,
    )


def _event(title="Graduation", start="2026-11-02T10:00", end="2026-11-02T12:00", **extra):
    return FacilityReservationCreate(title=title, start=start, end=end, **extra)


class TestHallBookings:
    @pytest.mark.asyncio
    async def test_book_conflict_override_and_cancel(self, db, org, admin_user):
        room = await _room(db, admin_user, org)
        booking = await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event(attendees=30))
        assert (booking.source, booking.kind, booking.status) == ("manual", "event", "approved")
        assert booking.start == "2026-11-02T10:00" and booking.facility_name == "Hall A"

        with pytest.raises(HTTPException) as exc:
            await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event("Exam", "2026-11-02T11:00", "2026-11-02T13:00"))
        assert exc.value.status_code == 409
        assert exc.value.detail.startswith(res_svc.CONFLICT_PREFIX)
        assert "Graduation" in exc.value.detail

        # Back-to-back is fine; booking over a conflict is allowed but flagged.
        await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event("Exam", "2026-11-02T12:00", "2026-11-02T13:00"))
        forced = await res_svc.create_reservation(
            db, admin_user, room.facility_uuid, _event("Meeting", "2026-11-02T09:00", "2026-11-02T10:30", allow_conflict=True)
        )
        assert forced.double_booked is True

        assert (await fac_svc.get_facility(db, admin_user, room.facility_uuid)).upcoming_bookings == 3

        # Cancelling frees the slot.
        await res_svc.cancel_reservation(db, admin_user, booking.booking_uuid)
        listed = await res_svc.list_bookings(db, admin_user, room.facility_uuid)
        assert [b.title for b in listed] == ["Meeting", "Exam"]
        assert await res_svc.check_facility(db, room.facility_uuid, admin_user, "2026-11-02T10:30", "2026-11-02T12:00") == []

    @pytest.mark.asyncio
    async def test_validation_and_update(self, db, org, admin_user):
        room = await _room(db, admin_user, org)
        for bad in (
            _event(title="  "),
            _event(start="2026-11-02T12:00", end="2026-11-02T12:00"),
            _event(start="2026-11-02T12:00", end="2026-11-02T10:00"),
            _event(start="2026-11-01", end="2026-12-15"),
            _event(attendees=41),
        ):
            with pytest.raises(HTTPException) as exc:
                await res_svc.create_reservation(db, admin_user, room.facility_uuid, bad)
            assert exc.value.status_code == 400

        # A date-only booking covers whole days.
        day = await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event("Open day", "2026-11-05", "2026-11-05"))
        assert (day.start, day.end) == ("2026-11-05T00:00", "2026-11-06T00:00")

        talk = await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event("Talk"))
        with pytest.raises(HTTPException) as exc:
            await res_svc.update_reservation(
                db, admin_user, talk.booking_uuid, FacilityReservationUpdate(start="2026-11-05T09:00", end="2026-11-05T10:00")
            )
        assert exc.value.status_code == 409
        moved = await res_svc.update_reservation(
            db, admin_user, talk.booking_uuid,
            FacilityReservationUpdate(start="2026-11-03T09:00", end="2026-11-03T10:00", kind=ReservationKind.MEETING),
        )
        assert (moved.start, moved.kind, moved.title) == ("2026-11-03T09:00", "meeting", "Talk")

    @pytest.mark.asyncio
    async def test_opening_hours(self, db, org, admin_user):
        room = await _room(
            db, admin_user, org,
            availability={"slots": [{"day": "mon", "start": "08:00", "end": "16:00"}], "blackout_dates": []},
        )
        # 2026-11-02 is a Monday, 2026-11-03 a Tuesday.
        await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event(start="2026-11-02T14:00", end="2026-11-02T16:00"))
        for start, end in (("2026-11-02T15:00", "2026-11-02T17:00"), ("2026-11-03T10:00", "2026-11-03T11:00")):
            reasons = await res_svc.check_facility(db, room.facility_uuid, admin_user, start, end)
            assert any("opening hours" in r for r in reasons), reasons

    @pytest.mark.asyncio
    async def test_session_bookings_are_read_only_here(self, db, org, course, admin_user, mock_request, bypass_rbac):
        room = await _room(db, admin_user, org)
        await course_profiles_svc.create_session(
            mock_request, course.course_uuid,
            CourseScheduleSessionCreate(title="Day 1", start_date="2026-11-02T09:00", end_date="2026-11-02T12:00", facility_uuid=room.facility_uuid),
            admin_user, db,
        )
        [session_booking] = await res_svc.list_bookings(db, admin_user, room.facility_uuid)
        assert session_booking.source == "course_session" and session_booking.inherited is False
        with pytest.raises(HTTPException) as exc:
            await res_svc.cancel_reservation(db, admin_user, session_booking.booking_uuid)
        assert exc.value.status_code == 400
        # A hall booking cannot take the session's slot.
        with pytest.raises(HTTPException) as exc:
            await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event())
        assert exc.value.status_code == 409


class TestSessionMirroring:
    @pytest.mark.asyncio
    async def test_course_sessions_follow_default_room_and_deletion(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        hall_a = await _room(db, admin_user, org)
        hall_b = await _room(db, admin_user, org, name="Hall B")
        await course_profiles_svc.upsert_course_academic_profile(
            mock_request, course.course_uuid, CourseAcademicProfileUpsert(facility_uuid=hall_a.facility_uuid), admin_user, db
        )
        session = await course_profiles_svc.create_session(
            mock_request, course.course_uuid,
            CourseScheduleSessionCreate(title="Day 1", start_date="2026-11-02T09:00", end_date="2026-11-02T12:00"),
            admin_user, db,
        )
        assert len(await res_svc.list_bookings(db, admin_user, hall_a.facility_uuid)) == 1

        # Moving the course default moves the inheriting session's booking…
        await course_profiles_svc.upsert_course_academic_profile(
            mock_request, course.course_uuid, CourseAcademicProfileUpsert(facility_uuid=hall_b.facility_uuid), admin_user, db
        )
        assert await res_svc.list_bookings(db, admin_user, hall_a.facility_uuid) == []
        assert [b.title for b in await res_svc.list_bookings(db, admin_user, hall_b.facility_uuid)] == ["Day 1"]

        # …and deleting the session releases the room.
        await course_profiles_svc.delete_session(mock_request, course.course_uuid, session.session_uuid, admin_user, db)
        assert (await db.execute(select(FacilityReservation))).scalars().all() == []

    @pytest.mark.asyncio
    async def test_offering_sessions_and_cancellation(self, db, org, admin_user, mock_request, bypass_rbac):
        room = await _room(db, admin_user, org)
        offering = await _offering(db, org, admin_user, mock_request)
        await offerings_svc.update_offering(
            mock_request, offering.offering_uuid, CourseOfferingUpdate(facility_uuid=room.facility_uuid), admin_user, db
        )
        lecture = await offerings_svc.create_session(
            mock_request, offering.offering_uuid,
            OfferingSessionCreate(title="Lecture 1", start_datetime="2026-11-02T09:00", end_datetime="2026-11-02T11:00"),
            admin_user, db,
        )
        [booking] = await res_svc.list_org_bookings(db, admin_user, org.id)
        assert (booking.source, booking.parent_name, booking.inherited) == (
            "offering_session", offering.code, True,
        )

        # A clashing hall booking is refused; moving the lecture frees the slot.
        with pytest.raises(HTTPException):
            await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event(start="2026-11-02T10:00", end="2026-11-02T10:30"))
        await offerings_svc.update_session(
            mock_request, offering.offering_uuid, lecture.session_uuid,
            OfferingSessionUpdate(start_datetime="2026-11-04T09:00", end_datetime="2026-11-04T11:00"),
            admin_user, db,
        )
        await res_svc.create_reservation(db, admin_user, room.facility_uuid, _event(start="2026-11-02T10:00", end="2026-11-02T10:30"))

        # Cancelling the offering gives its rooms back.
        await offerings_svc.update_offering(
            mock_request, offering.offering_uuid, CourseOfferingUpdate(status=OfferingStatus.CANCELLED), admin_user, db
        )
        assert [b.source for b in await res_svc.list_org_bookings(db, admin_user, org.id)] == ["manual"]


class TestBackfill:
    @pytest.mark.asyncio
    async def test_existing_sessions_are_mirrored_and_overlaps_flagged(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        room = await _room(db, admin_user, org)
        profile = await course_profiles_svc.upsert_course_academic_profile(
            mock_request, course.course_uuid, CourseAcademicProfileUpsert(facility_uuid=room.facility_uuid), admin_user, db
        )
        from src.db.academic.course_profiles import CourseAcademicProfile

        profile_row = (
            await db.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.profile_uuid == profile.profile_uuid))
        ).scalars().one()
        # Sessions saved before reservations existed (written straight to the table).
        for i, (start, end) in enumerate((
            ("2026-11-02T09:00", "2026-11-02T12:00"),
            ("2026-11-02T11:00", "2026-11-02T13:00"),
            ("2026-11-02T13:00", "2026-11-02T14:00"),
            (None, None),
        )):
            db.add(CourseScheduleSession(
                profile_id=profile_row.id, org_id=org.id, title=f"S{i}", start_date=start, end_date=end, session_uuid=f"session_{i}",
            ))
        await db.commit()

        created = await db.run_sync(lambda s: res_svc.backfill_reservations(s.connection()))
        assert created == 3
        await db.commit()
        rows = (await db.execute(select(FacilityReservation).order_by(FacilityReservation.starts_at))).scalars().all()
        assert [r.conflict_override for r in rows] == [False, True, False]
        # Only runs on an empty table.
        assert await db.run_sync(lambda s: res_svc.backfill_reservations(s.connection())) == 0
