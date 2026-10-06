"""
Service tests for Phase 3 — admissions: requirements & eligibility engine,
application lifecycle, entrance tests, interviews, document verification,
decisions (with audited overrides), enrollment and private documents.
"""

import pytest
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlmodel import select

from src.db.administration.notifications import NotificationLog
from src.db.academic.admissions import (
    AdmissionRequirementCreate,
    ApplicantProfile,
    ApplicationCreate,
    ApplicationDocument,
    ApplicationStatus,
    ApplicationUpdate,
    CheckOverride,
    CheckStatus,
    DecisionRequest,
    DocumentReview,
    DocumentStatus,
    EntranceTestCreate,
    InterviewCreate,
    InterviewUpdate,
    RequirementType,
    TestAttemptCreate,
    TestAttemptResult,
)
from src.db.academic.cohorts import CohortCreate, CohortUpdate
from src.db.academic.offerings import CohortMembership
from src.db.academic.programs import Program, ProgramCreate, ProgramLevel
from src.db.notification_inbox import Notification
from src.services.academic import admissions as admissions_svc
from src.services.academic import cohorts as cohorts_svc
from src.services.academic import programs as programs_svc
from src.services.academic import students as students_svc
from src.services.notifications import dispatcher


@pytest.fixture
def bypass_program_rbac():
    with ExitStack() as stack:
        for mod in (programs_svc, cohorts_svc, students_svc, admissions_svc):
            stack.enter_context(patch.object(mod, "check_resource_access", new=AsyncMock()))
        yield


GOOD_PROFILE = ApplicantProfile(degree_level="bachelor", gpa=3.4, gpa_scale=4.0, language_test="IELTS", language_score=7)


async def _program(db, org, admin_user, request, *, requirements=True):
    program = await programs_svc.create_program(
        request, org.id, ProgramCreate(name="MSc AI", code="MSC-AI", program_level=ProgramLevel.MASTERS), admin_user, db
    )
    cohort = await cohorts_svc.create_cohort(
        request, program.program_uuid, CohortCreate(name="Fall intake", academic_year="2026/2027"), admin_user, db
    )
    await cohorts_svc.update_cohort(request, cohort.cohort_uuid, CohortUpdate(admission_status="open"), admin_user, db)
    test = None
    if requirements:
        test = await admissions_svc.create_test(
            request, program.program_uuid,
            EntranceTestCreate(code="msc ai et", name="Entrance exam", passing_score=60, attempt_limit=2),
            admin_user, db,
        )
        for req in (
            AdmissionRequirementCreate(requirement_type=RequirementType.DEGREE, label="Bachelor's degree", config={"degree_level": "bachelor"}),
            AdmissionRequirementCreate(requirement_type=RequirementType.MIN_GPA, label="GPA ≥ 2.75", config={"min_gpa": 2.75}),
            AdmissionRequirementCreate(requirement_type=RequirementType.DOCUMENT, label="Transcript", config={"document_type": "transcript"}),
            AdmissionRequirementCreate(requirement_type=RequirementType.ENTRANCE_TEST, label="Entrance exam", config={"test_uuid": test.test_uuid}),
            AdmissionRequirementCreate(requirement_type=RequirementType.INTERVIEW, label="Interview"),
            AdmissionRequirementCreate(requirement_type=RequirementType.LANGUAGE, label="IELTS 6.5", mandatory=False, config={"test": "IELTS", "min_score": 6.5}),
        ):
            await admissions_svc.create_requirement(request, program.program_uuid, req, admin_user, db)
    return program, cohort, test


async def _apply(db, cohort, user, request, profile=GOOD_PROFILE):
    app = await admissions_svc.create_application(request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid, profile=profile), user, db)
    app = await admissions_svc.submit_application(request, app.application_uuid, user, db)
    return app


def _check(app, label):
    return next(c for c in app.checks if c.label == label)


class TestApplicationLifecycle:
    @pytest.mark.asyncio
    async def test_full_admission_flow(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, test = await _program(db, org, admin_user, mock_request)
        app = await _apply(db, cohort, regular_user, mock_request)
        assert app.status == ApplicationStatus.SUBMITTED
        assert app.application_number.startswith("APP-MSC-AI-2026-")
        assert _check(app, "Bachelor's degree").status == CheckStatus.MET
        assert _check(app, "GPA ≥ 2.75").status == CheckStatus.MET
        assert _check(app, "IELTS 6.5").status == CheckStatus.MET
        assert app.eligible is None and app.pending_checks == 3  # transcript, test, interview

        app = await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        # Cannot accept while mandatory checks are pending.
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.decide(mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.ACCEPTED), admin_user, db)
        assert exc.value.status_code == 409

        # Document (inserted directly: file storage is covered elsewhere) → verify.
        application = await admissions_svc._get(db, app.application_uuid)
        db.add(ApplicationDocument(
            application_id=application.id, org_id=org.id, document_type="transcript", original_name="t.pdf",
            storage_key="orgs/x/admissions/y/t.pdf", document_uuid="admdoc_1", creation_date="",
        ))
        await db.commit()
        app = await admissions_svc.get_application(mock_request, app.application_uuid, admin_user, db)
        assert _check(app, "Transcript").detail == "Awaiting verification"
        app = await admissions_svc.review_document(
            mock_request, app.application_uuid, "admdoc_1", DocumentReview(status=DocumentStatus.VERIFIED), admin_user, db
        )
        assert _check(app, "Transcript").status == CheckStatus.MET

        # Entrance test: fail, then pass on the second attempt.
        app = await admissions_svc.schedule_test(mock_request, app.application_uuid, TestAttemptCreate(test_uuid=test.test_uuid), admin_user, db)
        app = await admissions_svc.record_test_result(
            mock_request, app.application_uuid, app.test_attempts[0].attempt_uuid, TestAttemptResult(score=40), admin_user, db
        )
        assert _check(app, "Entrance exam").status == CheckStatus.PENDING  # one attempt left
        app = await admissions_svc.schedule_test(mock_request, app.application_uuid, TestAttemptCreate(test_uuid=test.test_uuid), admin_user, db)
        app = await admissions_svc.record_test_result(
            mock_request, app.application_uuid, app.test_attempts[1].attempt_uuid, TestAttemptResult(score=75), admin_user, db
        )
        assert _check(app, "Entrance exam").status == CheckStatus.MET

        # Interview completed with an accept recommendation.
        app = await admissions_svc.schedule_interview(
            mock_request, app.application_uuid, InterviewCreate(scheduled_at="2026-08-01T10:00", panel_uuids=[admin_user.user_uuid]), admin_user, db
        )
        with pytest.raises(HTTPException):
            await admissions_svc.update_interview(
                mock_request, app.application_uuid, app.interviews[0].interview_uuid, InterviewUpdate(status="completed"), admin_user, db
            )
        app = await admissions_svc.update_interview(
            mock_request, app.application_uuid, app.interviews[0].interview_uuid,
            InterviewUpdate(status="completed", recommendation="accept", score=80), admin_user, db,
        )
        assert app.eligible is True

        app = await admissions_svc.decide(mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.ACCEPTED), admin_user, db)
        assert app.status == ApplicationStatus.ACCEPTED
        app = await admissions_svc.enroll_applicant(mock_request, app.application_uuid, admin_user, db)
        assert app.status == ApplicationStatus.ENROLLED
        assert app.student_number == "MSC-AI-2026-001"
        member = (await db.execute(select(CohortMembership).where(CohortMembership.user_id == regular_user.id))).scalars().first()
        assert member is not None
        actions = [e.action for e in app.events]
        assert actions[0] == "created" and "decision" in actions and actions[-1] == "enrolled"

    @pytest.mark.asyncio
    async def test_closed_intake_and_duplicates(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        await _apply(db, cohort, regular_user, mock_request)
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.create_application(mock_request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid), regular_user, db)
        assert exc.value.status_code == 409  # one application per intake
        await cohorts_svc.update_cohort(mock_request, cohort.cohort_uuid, CohortUpdate(admission_status="closed"), admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.create_application(mock_request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid), admin_user, db)
        assert exc.value.status_code == 409  # intake closed

    @pytest.mark.asyncio
    async def test_submit_requires_background_and_drafts_editable_only_by_owner(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await admissions_svc.create_application(mock_request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid), regular_user, db)
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.submit_application(mock_request, app.application_uuid, regular_user, db)
        assert exc.value.status_code == 400
        await admissions_svc.update_application(mock_request, app.application_uuid, ApplicationUpdate(profile=GOOD_PROFILE), regular_user, db)
        app = await admissions_svc.submit_application(mock_request, app.application_uuid, regular_user, db)
        with pytest.raises(HTTPException):
            await admissions_svc.update_application(mock_request, app.application_uuid, ApplicationUpdate(profile=GOOD_PROFILE), regular_user, db)


class TestDecisions:
    @pytest.mark.asyncio
    async def test_ineligible_needs_documented_override(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request)
        low = ApplicantProfile(degree_level="bachelor", gpa=2.0, gpa_scale=4.0)
        app = await _apply(db, cohort, regular_user, mock_request, profile=low)
        assert _check(app, "GPA ≥ 2.75").status == CheckStatus.NOT_MET and app.eligible is False
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.decide(
                mock_request, app.application_uuid,
                DecisionRequest(decision=ApplicationStatus.ACCEPTED, override_requirements=True), admin_user, db,
            )
        assert exc.value.status_code == 400  # override needs a reason
        app = await admissions_svc.decide(
            mock_request, app.application_uuid,
            DecisionRequest(decision=ApplicationStatus.ACCEPTED, override_requirements=True, note="Committee exception #12"),
            admin_user, db,
        )
        assert app.status == ApplicationStatus.ACCEPTED
        assert app.events[-1].action == "decision_override"

    @pytest.mark.asyncio
    async def test_reject_needs_reason_and_waitlist_then_accept(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        program, cohort, _ = await _program(db, org, admin_user, mock_request)
        app = await _apply(db, cohort, regular_user, mock_request)
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        with pytest.raises(HTTPException):
            await admissions_svc.decide(mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.REJECTED), admin_user, db)
        app = await admissions_svc.decide(
            mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.WAITLISTED, note="Capacity"), admin_user, db
        )
        # Manual check override (with reason) on a waitlisted application.
        requirement = next(c for c in app.checks if c.label == "Interview")
        with pytest.raises(HTTPException):
            await admissions_svc.override_check(
                mock_request, app.application_uuid, requirement.requirement_uuid, CheckOverride(status=CheckStatus.MET), admin_user, db
            )
        app = await admissions_svc.override_check(
            mock_request, app.application_uuid, requirement.requirement_uuid,
            CheckOverride(status=CheckStatus.MET, note="Interviewed at open day"), admin_user, db,
        )
        assert _check(app, "Interview").overridden is True

    @pytest.mark.asyncio
    async def test_each_side_is_notified(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        program, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        row = (await db.execute(select(Program).where(Program.program_uuid == program.program_uuid))).scalars().one()
        row.coordinator_id = admin_user.id
        db.add(row)
        await db.commit()

        async def inbox_of(user_id):
            rows = (await db.execute(select(Notification).where(Notification.user_id == user_id).order_by(Notification.id))).scalars().all()
            return [(n.type, n.title, n.body) for n in rows]

        app = await _apply(db, cohort, regular_user, mock_request)
        assert [t for t, *_ in await inbox_of(admin_user.id)] == ["application_submitted"]
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        await admissions_svc.decide(
            mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.WAITLISTED, note="Capacity"), admin_user, db
        )
        await admissions_svc.decide(mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.ACCEPTED), admin_user, db)
        enrolled = await admissions_svc.enroll_applicant(mock_request, app.application_uuid, admin_user, db)
        assert await inbox_of(regular_user.id) == [
            ("application_waitlisted", "You are on the waiting list for MSc AI", "Capacity"),
            ("application_accepted", "You have been accepted to MSc AI", None),
            ("application_enrolled", "You are now a student of MSc AI", f"Your student number is {enrolled.student_number}"),
        ]
        assert len(await inbox_of(admin_user.id)) == 1  # never told about their own decisions

    @pytest.mark.asyncio
    async def test_decisions_and_enrolment_are_emailed(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac, monkeypatch):
        sent = []
        monkeypatch.setattr(dispatcher, "email_transport", lambda to, subject, html, sender_name: sent.append((to, subject, html)) or {"id": "ok"})
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await _apply(db, cohort, regular_user, mock_request)
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        await admissions_svc.decide(
            mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.WAITLISTED, note="<b>Capacity</b>"), admin_user, db
        )
        await admissions_svc.decide(mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.ACCEPTED), admin_user, db)
        enrolled = await admissions_svc.enroll_applicant(mock_request, app.application_uuid, admin_user, db)

        logs = (await db.execute(select(NotificationLog).order_by(NotificationLog.id))).scalars().all()
        assert [(log.event_key, log.channel, log.status) for log in logs] == [
            ("application_waitlisted", "email", "sent"),
            ("application_accepted", "email", "sent"),
            ("application_enrolled", "email", "sent"),
        ]
        assert {to for to, *_ in sent} == {"regular@test.com"}
        assert [subject for _, subject, _ in sent] == [
            "Your application to MSc AI is on the waiting list",
            "You have been accepted to MSc AI",
            "Welcome to MSc AI",
        ]
        assert "&lt;b&gt;Capacity&lt;/b&gt;" in sent[0][2]  # staff notes are escaped
        assert enrolled.student_number in sent[2][2]

    @pytest.mark.asyncio
    async def test_applicant_withdraws(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await _apply(db, cohort, regular_user, mock_request)
        app = await admissions_svc.withdraw_application(mock_request, app.application_uuid, "Changed plans", regular_user, db)
        assert app.status == ApplicationStatus.WITHDRAWN
        with pytest.raises(HTTPException):
            await admissions_svc.withdraw_application(mock_request, app.application_uuid, None, regular_user, db)


    @pytest.mark.asyncio
    async def test_withdrawn_application_can_be_reopened(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await _apply(db, cohort, regular_user, mock_request)
        await admissions_svc.withdraw_application(mock_request, app.application_uuid, "By mistake", regular_user, db)
        again = await admissions_svc.create_application(
            mock_request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid, profile=GOOD_PROFILE), regular_user, db
        )
        assert again.application_uuid == app.application_uuid
        assert again.application_number == app.application_number
        assert again.status == ApplicationStatus.DRAFT
        assert again.events[-1].action == "reopened"

    @pytest.mark.asyncio
    async def test_rejected_application_stays_final_for_the_intake(
        self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac
    ):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await _apply(db, cohort, regular_user, mock_request)
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        await admissions_svc.decide(
            mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.REJECTED, note="GPA"), admin_user, db
        )
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.create_application(mock_request, ApplicationCreate(cohort_uuid=cohort.cohort_uuid), regular_user, db)
        assert exc.value.status_code == 409 and "rejected" in exc.value.detail

    @pytest.mark.asyncio
    async def test_accepting_respects_cohort_capacity(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        await cohorts_svc.update_cohort(mock_request, cohort.cohort_uuid, CohortUpdate(capacity=1), admin_user, db)
        # The only seat is already taken by an admitted student.
        await students_svc.add_student(mock_request, cohort.cohort_uuid, admin_user.user_uuid, admin_user, db)
        app = await _apply(db, cohort, regular_user, mock_request)
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        with pytest.raises(HTTPException) as exc:
            await admissions_svc.decide(
                mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.ACCEPTED), admin_user, db
            )
        assert exc.value.status_code == 409 and "waitlist" in exc.value.detail
        app = await admissions_svc.decide(
            mock_request, app.application_uuid, DecisionRequest(decision=ApplicationStatus.WAITLISTED, note="Full"), admin_user, db
        )
        assert app.status == ApplicationStatus.WAITLISTED


class TestAccessAndPrivacy:
    @pytest.mark.asyncio
    async def test_applicant_cannot_act_as_staff(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await _apply(db, cohort, regular_user, mock_request)
        denied = AsyncMock(side_effect=HTTPException(status_code=403, detail="Forbidden"))
        with patch.object(admissions_svc, "check_resource_access", new=denied):
            with pytest.raises(HTTPException) as exc:
                await admissions_svc.start_review(mock_request, app.application_uuid, regular_user, db)
            assert exc.value.status_code == 403
            # ...but can still read their own application.
            own = await admissions_svc.get_application(mock_request, app.application_uuid, regular_user, db)
            assert own.application_uuid == app.application_uuid

    @pytest.mark.asyncio
    async def test_admission_documents_not_served_publicly(self, db, admin_user):
        from src.routers.local_content import _check_content_access

        with pytest.raises(HTTPException) as exc:
            await _check_content_access("orgs/org_test/admissions/application_1/x_transcript.pdf", admin_user, db)
        assert exc.value.status_code == 403


class TestApplicantView:
    @pytest.mark.asyncio
    async def test_applicant_does_not_see_panel_notes(self, db, org, admin_user, regular_user, mock_request, bypass_program_rbac):
        _, cohort, _ = await _program(db, org, admin_user, mock_request, requirements=False)
        app = await _apply(db, cohort, regular_user, mock_request)
        await admissions_svc.start_review(mock_request, app.application_uuid, admin_user, db)
        app = await admissions_svc.schedule_interview(
            mock_request, app.application_uuid, InterviewCreate(panel_uuids=[admin_user.user_uuid]), admin_user, db
        )
        await admissions_svc.update_interview(
            mock_request, app.application_uuid, app.interviews[0].interview_uuid,
            InterviewUpdate(status="completed", recommendation="reject", score=30, notes="Weak research fit"), admin_user, db,
        )
        staff = await admissions_svc.get_application(mock_request, app.application_uuid, admin_user, db)
        assert staff.interviews[0].notes == "Weak research fit"
        own = await admissions_svc.get_application(mock_request, app.application_uuid, regular_user, db)
        assert own.interviews[0].notes is None and own.interviews[0].score is None and own.interviews[0].panel == []
        assert {e.action for e in own.events} <= admissions_svc.APPLICANT_EVENTS
        assert all(e.actor is None for e in own.events)
