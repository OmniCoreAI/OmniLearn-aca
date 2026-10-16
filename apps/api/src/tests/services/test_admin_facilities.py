"""Locations & facilities: CRUD, pickers, attachment to courses, booking conflicts."""
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.db.academic.course_profiles import (
    CourseAcademicProfileUpsert,
    CourseScheduleSessionCreate,
    CourseScheduleSessionUpdate,
)
from src.db.academic.training_programs import TrainingProgramCreate, TrainingProgramUpdate
from src.db.administration.facilities import (
    FacilityCreate,
    FacilityEquipmentInput,
    FacilityStatus,
    FacilityUpdate,
    LocationCreate,
    LocationUpdate,
)
from src.services.academic import course_profiles as course_profiles_svc
from src.services.academic import training_programs as tp_svc
from src.services.administration import facilities as fac_svc
from src.services.administration import lookups as lk_svc
from src.services.administration import reservations as res_svc
from src.services.administration.overview import get_overview


@pytest.fixture
def bypass_course_rbac():
    with ExitStack() as stack:
        for mod in (course_profiles_svc, tp_svc):
            stack.enter_context(patch.object(mod, "check_resource_access", new=AsyncMock()))
        yield


async def _lookup_uuid(db, admin_user, org, kind, name):
    rows = await lk_svc.list_lookups(db, admin_user, org.id, kind)
    return next(r.lookup_uuid for r in rows if r.name == name)


async def _make_room(db, admin_user, org, name="Training Room A", **extra):
    return await fac_svc.create_facility(
        db,
        admin_user,
        org.id,
        FacilityCreate(
            name=name,
            capacity=30,
            hourly_cost=300.0,
            currency="EGP",
            facility_type_uuid=await _lookup_uuid(db, admin_user, org, "facility_type", "Training room"),
            equipment=[
                FacilityEquipmentInput(
                    lookup_uuid=await _lookup_uuid(db, admin_user, org, "equipment", "Projector"), quantity=1
                ),
                FacilityEquipmentInput(
                    lookup_uuid=await _lookup_uuid(db, admin_user, org, "equipment", "Whiteboard"), quantity=2
                ),
            ],
            **extra,
        ),
    )


class TestLocations:
    @pytest.mark.asyncio
    async def test_location_crud_and_hierarchy(self, db, org, admin_user):
        campus = await fac_svc.create_location(
            db,
            admin_user,
            org.id,
            LocationCreate(
                name="Main Campus",
                city="Cairo",
                location_type_uuid=await _lookup_uuid(db, admin_user, org, "location_type", "Campus"),
            ),
        )
        assert campus.code == "MAIN-CAMPUS"
        assert campus.location_type.name == "Campus"
        building = await fac_svc.create_location(
            db, admin_user, org.id, LocationCreate(name="Building B", parent_uuid=campus.location_uuid)
        )
        assert building.parent_name == "Main Campus"
        with pytest.raises(HTTPException) as exc:
            await fac_svc.update_location(
                db, admin_user, building.location_uuid, LocationUpdate(parent_uuid=building.location_uuid)
            )
        assert exc.value.status_code == 400

        room = await _make_room(db, admin_user, org, location_uuid=building.location_uuid)
        assert room.location_name == "Building B"
        assert [loc.facility_count for loc in await fac_svc.list_locations(db, admin_user, org.id) if loc.name == "Building B"] == [1]

        # Deleting the location keeps the facility.
        await fac_svc.delete_location(db, admin_user, building.location_uuid)
        again = await fac_svc.get_facility(db, admin_user, room.facility_uuid)
        assert again.location_uuid is None


class TestFacilities:
    @pytest.mark.asyncio
    async def test_create_read_equipment_and_type(self, db, org, admin_user):
        room = await _make_room(db, admin_user, org)
        assert room.code == "TRAINING-ROOM-A"
        assert room.facility_type.name == "Training room"
        assert {(e.name, e.quantity) for e in room.equipment} == {("Projector", 1), ("Whiteboard", 2)}
        assert room.hourly_cost == 300.0

        # The facility type is now in use and cannot be deleted.
        with pytest.raises(HTTPException) as exc:
            await lk_svc.delete_lookup(db, admin_user, room.facility_type.lookup_uuid)
        assert exc.value.status_code == 409

        counts = await get_overview(db, admin_user, org.id)
        assert counts["facilities"] == 1

    @pytest.mark.asyncio
    async def test_validation(self, db, org, admin_user):
        with pytest.raises(HTTPException):
            await fac_svc.create_facility(db, admin_user, org.id, FacilityCreate(name="X", capacity=-1))
        with pytest.raises(HTTPException):
            await fac_svc.create_facility(
                db,
                admin_user,
                org.id,
                FacilityCreate(name="X", availability={"blackout_dates": [{"start": "2026-10-10", "end": "2026-10-01"}]}),
            )
        with pytest.raises(HTTPException):
            await fac_svc.create_facility(
                db, admin_user, org.id, FacilityCreate(name="X", equipment=[FacilityEquipmentInput(lookup_uuid="nope")])
            )

    @pytest.mark.asyncio
    async def test_options_hide_costs_and_unavailable_rooms(self, db, org, admin_user, regular_user):
        room = await _make_room(db, admin_user, org)
        await _make_room(db, admin_user, org, name="Lab 2", status=FacilityStatus.MAINTENANCE)
        options = await fac_svc.list_facility_options(db, regular_user, org.id)
        assert [o.name for o in options] == ["Training Room A"]
        assert not hasattr(options[0], "hourly_cost")
        assert options[0].facility_type_name == "Training room"
        with pytest.raises(HTTPException) as exc:
            await fac_svc.list_facilities(db, regular_user, org.id)
        assert exc.value.status_code == 403
        with pytest.raises(HTTPException) as exc:
            await fac_svc.update_facility(db, regular_user, room.facility_uuid, FacilityUpdate(capacity=1))
        assert exc.value.status_code == 403


class TestAttachmentAndConflicts:
    @pytest.mark.asyncio
    async def test_course_default_room_and_session_conflicts(
        self, db, org, course, admin_user, mock_request, bypass_course_rbac
    ):
        room = await _make_room(db, admin_user, org)
        profile = await course_profiles_svc.upsert_course_academic_profile(
            mock_request, course.course_uuid, CourseAcademicProfileUpsert(facility_uuid=room.facility_uuid), admin_user, db
        )
        assert profile.facility.name == "Training Room A"

        first = await course_profiles_svc.create_session(
            mock_request,
            course.course_uuid,
            CourseScheduleSessionCreate(title="Day 1", start_date="2026-10-04T09:00", end_date="2026-10-04T12:00"),
            admin_user,
            db,
        )
        assert first.facility is None  # inherits the course default

        bookings = await res_svc.list_bookings(db, admin_user, room.facility_uuid)
        assert [(b.title, b.inherited) for b in bookings] == [("Day 1", True)]

        # Overlapping session in the same (inherited) room is rejected…
        with pytest.raises(HTTPException) as exc:
            await course_profiles_svc.create_session(
                mock_request,
                course.course_uuid,
                CourseScheduleSessionCreate(title="Clash", start_date="2026-10-04T11:00", end_date="2026-10-04T13:00"),
                admin_user,
                db,
            )
        assert exc.value.status_code == 409
        assert "Training Room A" in exc.value.detail

        # …unless explicitly allowed; adjacent sessions never clash.
        await course_profiles_svc.create_session(
            mock_request,
            course.course_uuid,
            CourseScheduleSessionCreate(
                title="Allowed", start_date="2026-10-04T11:00", end_date="2026-10-04T13:00", allow_conflict=True
            ),
            admin_user,
            db,
        )
        await course_profiles_svc.create_session(
            mock_request,
            course.course_uuid,
            CourseScheduleSessionCreate(title="Afternoon", start_date="2026-10-04T13:00", end_date="2026-10-04T15:00"),
            admin_user,
            db,
        )

        # Moving a session into the clash window is rejected too.
        afternoon = [s for s in await course_profiles_svc.list_sessions(mock_request, course.course_uuid, admin_user, db) if s.title == "Afternoon"][0]
        with pytest.raises(HTTPException) as exc:
            await course_profiles_svc.update_session(
                mock_request,
                course.course_uuid,
                afternoon.session_uuid,
                CourseScheduleSessionUpdate(start_date="2026-10-04T10:00"),
                admin_user,
                db,
            )
        assert exc.value.status_code == 409
        # Editing only the title does not re-check the booking.
        await course_profiles_svc.update_session(
            mock_request, course.course_uuid, afternoon.session_uuid, CourseScheduleSessionUpdate(title="PM"), admin_user, db
        )

    @pytest.mark.asyncio
    async def test_blackout_and_unavailable_rooms(
        self, db, org, course, admin_user, mock_request, bypass_course_rbac
    ):
        room = await _make_room(
            db,
            admin_user,
            org,
            availability={"slots": [], "blackout_dates": [{"start": "2026-12-25", "end": "2026-12-26", "reason": "Maintenance"}]},
        )
        with pytest.raises(HTTPException) as exc:
            await course_profiles_svc.create_session(
                mock_request,
                course.course_uuid,
                CourseScheduleSessionCreate(title="Holiday", start_date="2026-12-26T10:00", facility_uuid=room.facility_uuid),
                admin_user,
                db,
            )
        assert exc.value.status_code == 409
        assert "Maintenance" in exc.value.detail

        await fac_svc.update_facility(db, admin_user, room.facility_uuid, FacilityUpdate(is_bookable=False))
        with pytest.raises(HTTPException) as exc:
            await course_profiles_svc.create_session(
                mock_request,
                course.course_uuid,
                CourseScheduleSessionCreate(title="Any", start_date="2026-11-01", facility_uuid=room.facility_uuid),
                admin_user,
                db,
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_delete_room_detaches(self, db, org, course, admin_user, mock_request, bypass_course_rbac):
        room = await _make_room(db, admin_user, org)
        session = await course_profiles_svc.create_session(
            mock_request,
            course.course_uuid,
            CourseScheduleSessionCreate(title="S", start_date="2026-10-01", facility_uuid=room.facility_uuid, location="Room 3"),
            admin_user,
            db,
        )
        assert session.facility.facility_uuid == room.facility_uuid
        await fac_svc.delete_facility(db, admin_user, room.facility_uuid)
        # SQLite in tests does not enforce FKs; emulate what Postgres' SET NULL does.
        sessions = await course_profiles_svc.list_sessions(mock_request, course.course_uuid, admin_user, db)
        assert sessions[0].location == "Room 3"
        assert sessions[0].facility is None

    @pytest.mark.asyncio
    async def test_training_program_venue(self, db, org, admin_user, mock_request, bypass_course_rbac):
        room = await _make_room(db, admin_user, org)
        with patch.object(tp_svc, "require_org_membership", new=AsyncMock()):
            tp = await tp_svc.create_training_program(
                mock_request, org.id, TrainingProgramCreate(name="AI Fundamentals", facility_uuid=room.facility_uuid), admin_user, db
            )
        assert tp.facility.name == "Training Room A"
        updated = await tp_svc.update_training_program(
            mock_request, tp.trainingprogram_uuid, TrainingProgramUpdate(facility_uuid=""), admin_user, db
        )
        assert updated.facility is None
