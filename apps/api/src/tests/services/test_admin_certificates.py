"""Certificate templates: validation, resolution order, serial numbers, render context."""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.db.academic.links import TrainingProgramCourse
from src.db.academic.training_programs import TrainingProgram
from src.db.administration.certificates import CertificateTemplateCreate, CertificateTemplateUpdate
from src.db.courses.certifications import CertificateUser, Certifications
from src.services.administration import certificates as cert_svc
from src.services.courses import certifications as course_cert_svc


async def _template(db, admin_user, org, name="Classic", **extra):
    return await cert_svc.create_template(db, admin_user, org.id, CertificateTemplateCreate(name=name, **extra))


async def _certification(db, course, **config):
    cert = Certifications(course_id=course.id, certification_uuid=f"certification_{course.id}", config=config)
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return cert


class TestTemplates:
    @pytest.mark.asyncio
    async def test_create_validate_default_duplicate(self, db, org, admin_user, regular_user):
        first = await _template(db, admin_user, org, is_default=True, design={"primary_color": "#112233", "font_family": "Comic Sans"})
        assert first.design["primary_color"] == "#112233"
        assert first.design["font_family"] == "Cairo"  # not whitelisted → safe default
        assert first.design["title_text"] == "Certificate of Completion"

        second = await _template(db, admin_user, org, name="Modern", is_default=True, layout="modern")
        assert (await cert_svc.get_template(db, admin_user, first.template_uuid)).is_default is False
        assert second.is_default

        for bad in (
            {"design": {"primary_color": "red"}},
            {"serial_format": "NOSEQ-{YYYY}"},
            {"serial_format": "{SEQ}<script>"},
            {"layout": "wild"},
        ):
            with pytest.raises(HTTPException) as exc:
                await _template(db, admin_user, org, name="Bad", **bad)
            assert exc.value.status_code == 400
        with pytest.raises(HTTPException):
            await _template(db, admin_user, org, design={"signatures": [{"name": "a"}] * 4})

        copy = await cert_svc.duplicate_template(db, admin_user, second.template_uuid)
        assert copy.name == "Modern (copy)" and copy.is_default is False and copy.layout == "modern"

        with pytest.raises(HTTPException) as exc:
            await _template(db, regular_user, org)
        assert exc.value.status_code == 403
        options = await cert_svc.template_options(db, regular_user, org.id)
        assert {o.name for o in options} == {"Classic", "Modern", "Modern (copy)"}

    @pytest.mark.asyncio
    async def test_design_update_merges_and_assets(self, db, org, admin_user):
        tpl = await _template(db, admin_user, org, design={"secondary_logo": "x/logo.png"})
        updated = await cert_svc.update_template(
            db, admin_user, tpl.template_uuid, CertificateTemplateUpdate(design={"title_text": "شهادة إتمام", "direction": "rtl"})
        )
        assert updated.design["secondary_logo"] == "x/logo.png" and updated.design["direction"] == "rtl"
        with pytest.raises(HTTPException):
            await cert_svc.upload_asset(db, admin_user, tpl.template_uuid, "evil", MagicMock())
        with patch.object(cert_svc, "upload_file", new=AsyncMock(return_value="sig.png")):
            signed = await cert_svc.upload_asset(db, admin_user, tpl.template_uuid, "signature_1", MagicMock())
        assert signed.design["signatures"][1]["image"] == f"{tpl.template_uuid}/sig.png"
        assert signed.design["signatures"][0]["image"] is None


class TestResolutionAndSerials:
    @pytest.mark.asyncio
    async def test_course_then_program_then_default(self, db, org, admin_user, course):
        cert = await _certification(db, course)
        assert await cert_svc.resolve_for_course(db, course, cert) is None  # legacy pattern

        default = await _template(db, admin_user, org, name="Default", is_default=True)
        assert (await cert_svc.resolve_for_course(db, course, cert)).template_uuid == default.template_uuid

        program_tpl = await _template(db, admin_user, org, name="Program")
        tp = TrainingProgram(name="Track", org_id=org.id, trainingprogram_uuid="trainingprogram_t", published=True,
                             public=True, creation_date="", update_date="", certificate_template_id=program_tpl.id)
        db.add(tp)
        await db.commit()
        db.add(TrainingProgramCourse(training_program_id=tp.id, course_id=course.id, org_id=org.id))
        await db.commit()
        assert (await cert_svc.resolve_for_course(db, course, cert)).template_uuid == program_tpl.template_uuid

        course_tpl = await _template(db, admin_user, org, name="Course")
        cert.config = {"certificate_template_uuid": course_tpl.template_uuid}
        db.add(cert)
        await db.commit()
        assert (await cert_svc.resolve_for_course(db, course, cert)).template_uuid == course_tpl.template_uuid

        # An inactive template is skipped.
        await cert_svc.update_template(db, admin_user, course_tpl.template_uuid, CertificateTemplateUpdate(status="inactive"))
        assert (await cert_svc.resolve_for_course(db, course, cert)).template_uuid == program_tpl.template_uuid

    @pytest.mark.asyncio
    async def test_serials_increment_per_prefix(self, db, org, admin_user, course, regular_user):
        cert = await _certification(db, course)
        when = datetime(2026, 9, 27)
        assert await cert_svc.next_serial(db, org.id, "EACA-{YYYY}-{SEQ:5}", when) == "EACA-2026-00001"
        db.add(CertificateUser(user_id=regular_user.id, certification_id=cert.id, user_certification_uuid="u1",
                               serial_no="EACA-2026-00041", created_at="", updated_at=""))
        await db.commit()
        assert await cert_svc.next_serial(db, org.id, "EACA-{YYYY}-{SEQ:5}", when) == "EACA-2026-00042"
        assert await cert_svc.next_serial(db, org.id, "EACA-{YYYY}-{SEQ:5}", datetime(2027, 1, 1)) == "EACA-2027-00001"
        assert await cert_svc.next_serial(db, org.id, "C{SEQ:3}/{YY}", when) == "C001/26"

    @pytest.mark.asyncio
    async def test_issued_certificate_gets_serial_and_render_context(self, db, org, admin_user, course, regular_user):
        await _template(db, admin_user, org, name="Default", is_default=True, serial_format="EACA-{YYYY}-{SEQ:4}")
        cert = await _certification(db, course, certification_name="Cyber Pro", certificate_instructor="Dr. Hany")
        with patch.object(course_cert_svc, "track", new=AsyncMock()), patch.object(course_cert_svc, "dispatch_webhooks", new=AsyncMock()):
            issued = await course_cert_svc.create_certificate_user(MagicMock(), regular_user.id, cert.id, db)
        assert issued.serial_no == f"EACA-{datetime.now().year}-0001"

        public = await course_cert_svc.get_certificate_by_user_certification_uuid(MagicMock(), issued.user_certification_uuid, None, db)
        render = public["render"]
        assert render["template"]["name"] == "Default"
        variables = render["variables"]
        assert variables["student_name"] == "Regular User"
        assert variables["course_name"] == course.name
        assert variables["certificate_id"] == issued.serial_no
        assert variables["instructor_name"] == "Dr. Hany" and variables["certification_name"] == "Cyber Pro"
        assert render["org_uuid"] == org.org_uuid

    @pytest.mark.asyncio
    async def test_legacy_certificates_have_no_render(self, db, org, course, regular_user):
        cert = await _certification(db, course, certificate_pattern="royal")
        cu = CertificateUser(user_id=regular_user.id, certification_id=cert.id, user_certification_uuid="legacy-1", created_at="", updated_at="")
        db.add(cu)
        await db.commit()
        public = await course_cert_svc.get_certificate_by_user_certification_uuid(MagicMock(), "legacy-1", None, db)
        assert public["render"] is None and public["certificate_user"].serial_no is None
