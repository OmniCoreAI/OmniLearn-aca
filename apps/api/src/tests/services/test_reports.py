"""Tests for the academy reports (src/services/reports)."""

from datetime import date

import pytest
from fastapi import HTTPException

from src.db.academic.admissions import AdmissionApplication, ApplicationStatus
from src.db.finance.ledger import FinanceLedgerEntry
from src.db.finance.reporting import FinanceRefund
from src.db.instructors.finance import InstructorWorkLog
from src.db.instructors.instructors import Instructor, InstructorStatus
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail
from src.services.finance.reporting import profit_loss
from src.services.reports.admissions import admissions_report
from src.services.reports.common import resolve_range
from src.services.reports.financial import financial_report
from src.services.reports.learning import learning_report
from src.services.reports.people import people_report

FROM, TO = "2026-07-01", "2026-09-30"


def _entry(org, uuid, kind, amount, day, category="tuition", method="bank_transfer", status="recorded", course=None):
    return FinanceLedgerEntry(
        org_id=org.id, entry_uuid=uuid, entry_type=kind, category=category, title=uuid, amount=amount,
        currency="EGP", entry_date=day, payment_method=method, status=status, course_uuid=course,
        creation_date=day, update_date=day,
    )


class TestRange:
    def test_default_is_last_twelve_months(self):
        r = resolve_range(None, None, today=date(2026, 10, 7))
        assert (r.start, r.end) == (date(2025, 11, 1), date(2026, 10, 7))
        assert r.months()[0] == "2025-11" and r.months()[-1] == "2026-10" and len(r.months()) == 12

    def test_previous_period(self):
        # Whole months compare with the previous whole months…
        r = resolve_range(FROM, TO)
        assert (r.prev.start, r.prev.end) == (date(2026, 4, 1), date(2026, 6, 30))
        # …the last 12 months (to today) with the same dates a year earlier…
        r = resolve_range(None, None, today=date(2026, 10, 7))
        assert (r.prev.start, r.prev.end) == (date(2024, 11, 1), date(2025, 10, 7))
        # …this month so far with last month to the same day (clamped)…
        r = resolve_range("2026-03-01", "2026-03-31")
        assert (r.prev.start, r.prev.end) == (date(2026, 2, 1), date(2026, 2, 28))
        r = resolve_range("2026-03-01", "2026-03-30")
        assert (r.prev.start, r.prev.end) == (date(2026, 2, 1), date(2026, 2, 28))
        # …any other range with the same number of days just before it.
        r = resolve_range("2026-07-10", "2026-07-19")
        assert (r.prev.start, r.prev.end) == (date(2026, 6, 30), date(2026, 7, 9))

    def test_bad_range(self):
        with pytest.raises(HTTPException):
            resolve_range("2026-09-30", "2026-07-01")
        with pytest.raises(HTTPException):
            resolve_range("July", None)


class TestFinancialReport:
    async def _seed(self, db, org, course, regular_user):
        inst = Instructor(org_id=org.id, user_id=regular_user.id, instructor_uuid="instructor_x", status=InstructorStatus.ACTIVE)
        db.add(inst)
        await db.commit()
        await db.refresh(inst)
        db.add_all([
            _entry(org, "r1", "revenue", 1000, "2026-07-10", course=course.course_uuid),
            _entry(org, "r2", "revenue", 500, "2026-08-02", category="sponsorship", method="check"),
            _entry(org, "r3", "revenue", 999, "2026-08-03", status="cancelled"),  # ignored
            _entry(org, "e1", "expense", 200, "2026-08-15", category="venue"),
            _entry(org, "old", "revenue", 300, "2026-05-01"),  # previous period
            FinanceRefund(org_id=org.id, refund_uuid="f1", entry_uuid="r1", amount=100, status="approved", decided_at="2026-09-01", creation_date="2026-08-30"),
            InstructorWorkLog(org_id=org.id, instructor_id=inst.id, hours=4, rate_applied=50, amount=200, currency="EGP", work_date="2026-07-20", course_uuid=course.course_uuid, worklog_uuid="w1"),
            InstructorWorkLog(org_id=org.id, instructor_id=inst.id, hours=2, rate_applied=50, amount=100, currency="EGP", work_date="2026-09-05", course_uuid=course.course_uuid, worklog_uuid="w2"),
        ])
        await db.commit()

    async def test_totals_match_finance_profit_and_loss(self, db, org, course, admin_user, regular_user):
        await self._seed(db, org, course, regular_user)
        report = await financial_report(db, admin_user, org.id, FROM, TO)
        pl = await profit_loss(db, admin_user, org.id, FROM, TO)

        t = report.totals
        assert (t.gross_revenue, t.refunds, t.net_revenue) == (pl.gross_revenue, pl.refunds, pl.net_revenue) == (1500, 100, 1400)
        assert (t.operating_expenses, t.instructor_cost, t.net_profit) == (pl.operating_expenses, pl.instructor_cost, pl.net_profit) == (200, 300, 900)
        assert t.instructor_hours == 6 and report.previous.gross_revenue == 300

    async def test_breakdowns(self, db, org, course, admin_user, regular_user):
        await self._seed(db, org, course, regular_user)
        report = await financial_report(db, admin_user, org.id, FROM, TO)

        assert [m.month for m in report.monthly] == ["2026-07", "2026-08", "2026-09"]
        july = report.monthly[0]
        assert (july.revenue, july.instructor_cost, july.net) == (1000, 200, 800)
        assert report.monthly[2].refunds == 100

        assert [(r.key, r.total) for r in report.revenue_by_category] == [("tuition", 1000), ("sponsorship", 500)]
        assert {r.key for r in report.revenue_by_payment_method} == {"bank_transfer", "check"}
        assert report.revenue_by_course[0].label == course.name
        [inst] = report.instructors
        assert (inst.hours, inst.sessions, inst.amount, inst.avg_rate, inst.share_pct) == (6, 2, 300, 50, 100.0)
        assert inst.courses == [course.name]
        assert report.instructor_cost_by_course[0].course_name == course.name

    async def test_learners_cannot_see_finance(self, db, org, regular_user):
        with pytest.raises(HTTPException) as err:
            await financial_report(db, regular_user, org.id, FROM, TO)
        assert err.value.status_code == 403


class TestLearningReport:
    async def test_enrollments_completions_and_activity(self, db, org, course, chapter, activity, admin_user, regular_user):
        trail = Trail(id=1, org_id=org.id, user_id=regular_user.id, trail_uuid="t", creation_date="2026-07-01", update_date="2026-07-01")
        db.add(trail)
        await db.commit()
        db.add(TrailRun(id=1, trail_id=1, course_id=course.id, org_id=org.id, user_id=regular_user.id, creation_date="2026-07-05 10:00:00", update_date="2026-07-05"))
        await db.commit()
        db.add(TrailStep(complete=True, teacher_verified=False, grade="", trailrun_id=1, trail_id=1, activity_id=activity.id,
                         course_id=course.id, org_id=org.id, user_id=regular_user.id, creation_date="2026-08-12 09:00:00", update_date="2026-08-12"))
        await db.commit()

        report = await learning_report(db, admin_user, org.id, FROM, TO)

        t = report.totals
        assert (t.enrollments, t.completions, t.active_learners, t.lessons_completed) == (1, 1, 1, 1)
        assert report.overall_completion_rate == 100.0
        months = {m.month: m for m in report.monthly}
        assert months["2026-07"].enrollments == 1 and months["2026-08"].completions == 1
        [row] = report.courses
        assert (row.enrolled, row.completed, row.avg_progress, row.active_learners) == (1, 1, 100.0, 1)

    async def test_admins_only(self, db, org, regular_user):
        with pytest.raises(HTTPException) as err:
            await learning_report(db, regular_user, org.id, FROM, TO)
        assert err.value.status_code == 403


class TestAdmissionsReport:
    async def test_outcomes_and_speed(self, db, org, admin_user, regular_user):
        from src.db.academic.cohorts import Cohort
        from src.db.academic.programs import Program

        db.add(Program(id=1, name="MSc AI", org_id=org.id, program_uuid="program_ai", creation_date="x", update_date="x"))
        await db.commit()
        # One application per applicant and intake, so each sits in its own intake.
        for i, name in enumerate(["Fall 2026", "Spring 2027", "Fall 2027", "Spring 2028"], start=1):
            db.add(Cohort(id=i, name=name, org_id=org.id, program_id=1, cohort_uuid=f"cohort_{i}", creation_date="x", update_date="x"))
        await db.commit()

        def app(i, status, submitted, decided=None):
            return AdmissionApplication(
                id=i, application_number=f"A{i}", program_id=1, cohort_id=i, applicant_id=regular_user.id, org_id=org.id,
                status=status, submitted_at=submitted, decided_at=decided, application_uuid=f"app_{i}",
            )

        db.add_all([
            app(1, ApplicationStatus.ACCEPTED, "2026-07-01", "2026-07-11"),
            app(2, ApplicationStatus.REJECTED, "2026-07-02", "2026-07-06"),
            app(3, ApplicationStatus.UNDER_REVIEW, "2026-08-01"),
            app(4, ApplicationStatus.DRAFT, None),
        ])
        await db.commit()

        report = await admissions_report(db, admin_user, org.id, FROM, TO)

        t = report.totals
        assert (t.submitted, t.accepted, t.rejected, t.pending) == (3, 1, 1, 1)
        assert t.acceptance_rate == 50.0 and t.avg_days_to_decision == 7.0
        assert report.drafts == 1
        assert report.by_program[0].name == "MSc AI" and report.by_program[0].submitted == 3
        assert {r.name for r in report.by_intake} == {"Fall 2026", "Spring 2027", "Fall 2027"}
        assert {m.month: m.submitted for m in report.monthly}["2026-07"] == 2


class TestPeopleReport:
    async def test_members_roles_and_activity(self, db, org, admin_user, regular_user):
        report = await people_report(db, admin_user, org.id, None, None)
        assert report.totals.members == 2
        assert {r.role for r in report.by_role} == {"Admin", "User"}
        assert report.unassigned_members == 2
        assert len(report.monthly) == 12
