"""Term auto-scheduling (OR-Tools): clash-free placement, existing bookings, apply."""
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.academic.calendar import AcademicTermCreate, AcademicYearCreate, TermType
from src.db.academic.catalog import AcademicCourseCreate
from src.db.academic.offerings import CourseOffering, CourseOfferingCreate, OfferingSession
from src.db.academic.scheduling import (
    AutoScheduleApply,
    AutoScheduleApplyMeeting,
    AutoScheduleOfferingOption,
    AutoScheduleRequest,
)
from src.db.administration.facilities import FacilityCreate, FacilityReservation, FacilityReservationCreate
from src.services.academic import auto_schedule as planner
from src.services.academic import calendar as calendar_svc
from src.services.academic import catalog as catalog_svc
from src.services.academic import offerings as offerings_svc
from src.services.administration import facilities as fac_svc
from src.services.administration import reservations as res_svc

# Teaching weeks: Sat 1 Feb 2031 → Fri 7 Mar 2031 (exams start 8 Mar), five weeks.
TERM = dict(start_date="2031-02-01", end_date="2031-03-20", exam_start="2031-03-08")
SUN_TO_THU = ["sun", "mon", "tue", "wed", "thu"]


@pytest.fixture
def bypass_rbac():
    with patch.object(offerings_svc, "check_resource_access", new=AsyncMock()):
        yield


async def _setup(db, org, admin_user, mock_request, sizes, instructor_for=()):
    year = await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2030/2031"), admin_user, db)
    term = await calendar_svc.create_term(
        org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.SPRING, **TERM), admin_user, db
    )
    offerings = []
    for i, size in enumerate(sizes):
        course = await catalog_svc.create_academic_course(org.id, AcademicCourseCreate(code=f"C-{i}", name=f"Course {i}"), admin_user, db)
        read = await offerings_svc.create_offering(
            mock_request, org.id, CourseOfferingCreate(academic_course_uuid=course.academic_course_uuid, term_uuid=term.term_uuid, capacity=size),
            admin_user, db,
        )
        row = (await db.execute(select(CourseOffering).where(CourseOffering.offering_uuid == read.offering_uuid))).scalars().one()
        if i in instructor_for:
            row.instructor_id = admin_user.id
            db.add(row)
        offerings.append(row)
    await db.commit()
    return term, offerings


async def _rooms(db, org, admin_user, **caps):
    return {
        name: await fac_svc.create_facility(db, admin_user, org.id, FacilityCreate(name=name, capacity=cap))
        for name, cap in caps.items()
    }


def _overlap(a, b):
    return a.day == b.day and a.start < b.end and b.start < a.end


def _request(**extra):
    return AutoScheduleRequest(**{"days": SUN_TO_THU, "meetings_per_week": 2, "duration_minutes": 90, "time_limit_seconds": 10, **extra})


class TestPlan:
    @pytest.mark.asyncio
    async def test_places_everyone_without_clashes(self, db, org, admin_user, mock_request, bypass_rbac):
        await _rooms(db, org, admin_user, Small=30, Big=60)
        # Offerings 0 and 2 share a teacher; offering 1 only fits the big room.
        term, offerings = await _setup(db, org, admin_user, mock_request, [25, 50, 25], instructor_for=(0, 2))
        plan = await planner.plan_term(mock_request, term.term_uuid, _request(), admin_user, db)

        assert plan.status in ("optimal", "feasible")
        assert plan.unplaced == [] and plan.weeks == 5
        by_offering = {}
        for m in plan.meetings:
            by_offering.setdefault(m.offering_code, []).append(m)
        assert all(len(ms) == 2 for ms in by_offering.values())
        codes = [o.code for o in offerings]
        for ms in by_offering.values():
            assert ms[0].day != ms[1].day and ms[0].start == ms[1].start
        assert {m.facility_name for m in by_offering[codes[1]]} == {"Big"}
        # The tightest room that seats them.
        assert {m.facility_name for m in by_offering[codes[0]] + by_offering[codes[2]]} == {"Small"}
        for i, a in enumerate(plan.meetings):
            for b in plan.meetings[i + 1:]:
                if a.facility_uuid == b.facility_uuid:
                    assert not _overlap(a, b)
        for a in by_offering[codes[0]]:
            for b in by_offering[codes[2]]:
                assert not _overlap(a, b)
        # Five teaching weeks → five dates per weekly meeting.
        assert all(len(m.dates) == 5 and not m.skipped for m in plan.meetings)
        assert plan.sessions_to_create == 30

    @pytest.mark.asyncio
    async def test_unplaceable_offerings_are_explained(self, db, org, admin_user, mock_request, bypass_rbac):
        await _rooms(db, org, admin_user, Small=30)
        term, offerings = await _setup(db, org, admin_user, mock_request, [100, 20])
        plan = await planner.plan_term(
            mock_request, term.term_uuid,
            _request(offerings=[
                AutoScheduleOfferingOption(offering_uuid=offerings[0].offering_uuid),
                AutoScheduleOfferingOption(offering_uuid=offerings[1].offering_uuid, meetings_per_week=6),
            ]),
            admin_user, db,
        )
        reasons = {u.offering_code: (u.reason, u.params) for u in plan.unplaced}
        assert reasons[offerings[0].code] == ("no_room", {"size": 100})
        assert reasons[offerings[1].code][0] == "too_many_meetings"
        assert plan.meetings == [] and plan.status == "empty"

    @pytest.mark.asyncio
    async def test_existing_bookings_block_weekly_or_skip_a_date(self, db, org, admin_user, mock_request, bypass_rbac):
        rooms = await _rooms(db, org, admin_user, Hall=40)
        term, offerings = await _setup(db, org, admin_user, mock_request, [30])
        # A weekly Sunday booking (all day, every week) and a one-off on Monday 10 Feb.
        for d in ("2031-02-02", "2031-02-09", "2031-02-16"):
            await res_svc.create_reservation(db, admin_user, rooms["Hall"].facility_uuid, FacilityReservationCreate(title="Sunday club", start=d, end=d))
        await res_svc.create_reservation(
            db, admin_user, rooms["Hall"].facility_uuid,
            FacilityReservationCreate(title="Open day", start="2031-02-10", end="2031-02-10"),
        )
        plan = await planner.plan_term(mock_request, term.term_uuid, _request(meetings_per_week=4), admin_user, db)
        days = sorted(m.day for m in plan.meetings)
        assert "sun" not in days and len(days) == 4
        monday = next(m for m in plan.meetings if m.day == "mon")
        assert [s.date for s in monday.skipped] == ["2031-02-10"]
        assert "Open day" in monday.skipped[0].reasons[0]
        assert len(monday.dates) == 4


class TestApply:
    @pytest.mark.asyncio
    async def test_apply_creates_booked_sessions(self, db, org, admin_user, mock_request, bypass_rbac):
        await _rooms(db, org, admin_user, Small=30, Big=60)
        term, offerings = await _setup(db, org, admin_user, mock_request, [25, 50], instructor_for=(0, 1))
        plan = await planner.plan_term(mock_request, term.term_uuid, _request(), admin_user, db)
        result = await planner.apply_plan(
            mock_request, term.term_uuid,
            AutoScheduleApply(meetings=[
                AutoScheduleApplyMeeting(offering_uuid=m.offering_uuid, day=m.day, start=m.start, end=m.end, facility_uuid=m.facility_uuid)
                for m in plan.meetings
            ]),
            admin_user, db,
        )
        assert (result.offerings, result.created) == (2, plan.sessions_to_create)
        sessions = (await db.execute(select(OfferingSession))).scalars().all()
        assert len(sessions) == result.created
        assert all(date.fromisoformat(s.start_datetime[:10]) <= date(2031, 3, 7) for s in sessions)
        reservations = (await db.execute(select(FacilityReservation))).scalars().all()
        assert len(reservations) == result.created
        # Offerings without a default room take the planned one.
        await db.refresh(offerings[0])
        assert offerings[0].facility_id is not None

        # Scheduled offerings drop out of the next plan; re-applying changes nothing.
        again = await planner.plan_term(mock_request, term.term_uuid, _request(), admin_user, db)
        assert again.status == "empty" and again.meetings == []
        repeat = await planner.apply_plan(
            mock_request, term.term_uuid,
            AutoScheduleApply(meetings=[
                AutoScheduleApplyMeeting(offering_uuid=plan.meetings[0].offering_uuid, day=plan.meetings[0].day, start=plan.meetings[0].start,
                                         end=plan.meetings[0].end, facility_uuid=plan.meetings[0].facility_uuid)
            ]),
            admin_user, db,
        )
        assert repeat.created == 0 and repeat.already_scheduled == [plan.meetings[0].offering_code]

    @pytest.mark.asyncio
    async def test_edited_plan_with_a_clash_is_refused(self, db, org, admin_user, mock_request, bypass_rbac):
        rooms = await _rooms(db, org, admin_user, Small=30)
        term, offerings = await _setup(db, org, admin_user, mock_request, [20, 20])
        meetings = [
            AutoScheduleApplyMeeting(offering_uuid=o.offering_uuid, day="sun", start="09:00", end="10:30", facility_uuid=rooms["Small"].facility_uuid)
            for o in offerings
        ]
        with pytest.raises(HTTPException) as exc:
            await planner.apply_plan(mock_request, term.term_uuid, AutoScheduleApply(meetings=meetings), admin_user, db)
        assert exc.value.status_code == 400 and "clash" in exc.value.detail
        assert (await db.execute(select(OfferingSession))).scalars().all() == []

    @pytest.mark.asyncio
    async def test_term_needs_dates(self, db, org, admin_user, mock_request, bypass_rbac):
        year = await calendar_svc.create_academic_year(org.id, AcademicYearCreate(code="2030/2031"), admin_user, db)
        term = await calendar_svc.create_term(
            org.id, AcademicTermCreate(academic_year_uuid=year.academic_year_uuid, term_type=TermType.FALL), admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await planner.plan_term(mock_request, term.term_uuid, _request(), admin_user, db)
        assert exc.value.status_code == 400
