"""Certificate templates: CRUD, resolution, serial numbers and render context.

Which template a certificate uses:

1. the course's ``Certifications.config["certificate_template_uuid"]``;
2. the training program the course belongs to;
3. the org's default template;
4. none — the legacy pattern (``config.certificate_pattern``) is drawn.
"""
import re
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import uuid4

from fastapi import UploadFile
from pydantic import ValidationError
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.links import TrainingProgramCourse
from src.db.academic.training_programs import TrainingProgram
from src.db.administration.certificates import (
    LAYOUTS,
    CertificateDesign,
    CertificateRenderRead,
    CertificateTemplate,
    CertificateTemplateCreate,
    CertificateTemplateOption,
    CertificateTemplateRead,
    CertificateTemplateUpdate,
)
from src.db.administration.lookups import ConfigStatus
from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.users import User
from src.services.administration.authz import AnyUser, authorize_admin, require_org_member
from src.services.administration.common import bad_request, get_by_uuid_or_404, get_org_or_404, now
from src.services.administration.overview import register_overview_counter
from src.services.utils.upload_content import upload_file

WHAT = "manage certificate templates"
SERIAL_TOKEN_RE = re.compile(r"\{(YYYY|YY|MM|SEQ(?::(\d))?)\}")
ASSET_KINDS = ("background", "secondary_logo", "signature_0", "signature_1", "signature_2")

register_overview_counter(
    "certificate_templates",
    lambda org_id: select(func.count(CertificateTemplate.id)).where(CertificateTemplate.org_id == org_id),
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _design(value: Optional[dict]) -> dict:
    try:
        return CertificateDesign(**(value or {})).model_dump()
    except ValidationError as exc:
        raise bad_request("; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()))


def _serial_format(value: str) -> str:
    value = (value or "").strip()
    if not value or len(value) > 60:
        raise bad_request("Enter a serial format (up to 60 characters)")
    if "{SEQ" not in value:
        raise bad_request("The serial format needs a {SEQ} (or {SEQ:5}) counter")
    if re.search(r"[^A-Za-z0-9{}:\-_/.]", value):
        raise bad_request("Use letters, digits, - _ / . and the {YYYY} {YY} {MM} {SEQ:n} tokens")
    return value


def _layout(value: str) -> str:
    if value not in LAYOUTS:
        raise bad_request(f"Layout must be one of: {', '.join(LAYOUTS)}")
    return value


async def _usage(db_session: AsyncSession, template: CertificateTemplate) -> int:
    programs = (
        await db_session.execute(
            select(func.count(TrainingProgram.id)).where(TrainingProgram.certificate_template_id == template.id)
        )
    ).scalar() or 0
    courses = 0
    for (config,) in (
        await db_session.execute(
            select(Certifications.config)
            .join(Course, Course.id == Certifications.course_id)  # type: ignore[arg-type]
            .where(Course.org_id == template.org_id)
        )
    ).all():
        if isinstance(config, dict) and config.get("certificate_template_uuid") == template.template_uuid:
            courses += 1
    return int(programs) + courses


async def _read(db_session: AsyncSession, template: CertificateTemplate, with_usage: bool = True) -> CertificateTemplateRead:
    return CertificateTemplateRead(
        **template.model_dump(exclude={"org_id", "design"}),
        design=CertificateDesign(**(template.design or {})).model_dump(),
        usage_count=await _usage(db_session, template) if with_usage else 0,
    )


async def _clear_other_defaults(db_session: AsyncSession, template: CertificateTemplate) -> None:
    for other in (
        await db_session.execute(
            select(CertificateTemplate).where(
                CertificateTemplate.org_id == template.org_id,
                CertificateTemplate.is_default == True,  # noqa: E712
                CertificateTemplate.id != template.id,
            )
        )
    ).scalars().all():
        other.is_default = False
        db_session.add(other)


async def get_template_by_uuid(db_session: AsyncSession, template_uuid: str) -> CertificateTemplate:
    return await get_by_uuid_or_404(
        db_session, CertificateTemplate, CertificateTemplate.template_uuid, template_uuid, "Certificate template"
    )


async def resolve_template_id(db_session: AsyncSession, org_id: int, template_uuid: Optional[str]) -> Optional[int]:
    if not template_uuid:
        return None
    template = await get_template_by_uuid(db_session, template_uuid)
    if template.org_id != org_id:
        raise bad_request("Certificate template belongs to a different organization")
    return template.id


async def template_uuid_for(db_session: AsyncSession, template_id: Optional[int]) -> Optional[str]:
    if not template_id:
        return None
    template = await db_session.get(CertificateTemplate, template_id)
    return template.template_uuid if template else None


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def list_templates(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[CertificateTemplateRead]:
    await authorize_admin(db_session, current_user, org_id, "configuration", "read", WHAT)
    rows = (
        await db_session.execute(
            select(CertificateTemplate).where(CertificateTemplate.org_id == org_id).order_by(CertificateTemplate.name)
        )
    ).scalars().all()
    return [await _read(db_session, r) for r in rows]


async def template_options(db_session: AsyncSession, current_user: AnyUser, org_id: int) -> List[CertificateTemplateOption]:
    """Active templates for course / program pickers (any org member)."""
    await require_org_member(db_session, current_user, org_id)
    rows = (
        await db_session.execute(
            select(CertificateTemplate)
            .where(CertificateTemplate.org_id == org_id, CertificateTemplate.status == ConfigStatus.ACTIVE.value)
            .order_by(CertificateTemplate.name)
        )
    ).scalars().all()
    return [CertificateTemplateOption(template_uuid=r.template_uuid, name=r.name, is_default=r.is_default) for r in rows]


async def get_template(db_session: AsyncSession, current_user: AnyUser, template_uuid: str) -> CertificateTemplateRead:
    template = await get_template_by_uuid(db_session, template_uuid)
    await require_org_member(db_session, current_user, template.org_id)
    return await _read(db_session, template)


async def create_template(
    db_session: AsyncSession, current_user: AnyUser, org_id: int, payload: CertificateTemplateCreate
) -> CertificateTemplateRead:
    await authorize_admin(db_session, current_user, org_id, "configuration", "create", WHAT)
    await get_org_or_404(db_session, org_id)
    name = (payload.name or "").strip()
    if not name:
        raise bad_request("Name is required")
    template = CertificateTemplate(
        org_id=org_id,
        name=name,
        layout=_layout(payload.layout),
        orientation=payload.orientation,
        status=payload.status,
        is_default=payload.is_default,
        design=_design(payload.design),
        serial_format=_serial_format(payload.serial_format),
        template_uuid=f"certificatetemplate_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(template)
    await db_session.flush()
    if template.is_default:
        await _clear_other_defaults(db_session, template)
    await db_session.commit()
    await db_session.refresh(template)
    return await _read(db_session, template)


async def update_template(
    db_session: AsyncSession, current_user: AnyUser, template_uuid: str, payload: CertificateTemplateUpdate
) -> CertificateTemplateRead:
    template = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, template.org_id, "configuration", "update", WHAT)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise bad_request("Name is required")
        template.name = name
    if data.get("layout") is not None:
        template.layout = _layout(data["layout"])
    if data.get("orientation") is not None:
        template.orientation = data["orientation"]
    if data.get("status") is not None:
        template.status = data["status"]
    if data.get("serial_format") is not None:
        template.serial_format = _serial_format(data["serial_format"])
    if "design" in data:
        # Keep uploaded images unless the new design explicitly replaces them.
        template.design = _design({**(template.design or {}), **(data["design"] or {})})
    if data.get("is_default") is not None:
        template.is_default = data["is_default"]
    template.update_date = now()
    db_session.add(template)
    if template.is_default:
        await _clear_other_defaults(db_session, template)
    await db_session.commit()
    await db_session.refresh(template)
    return await _read(db_session, template)


async def duplicate_template(db_session: AsyncSession, current_user: AnyUser, template_uuid: str) -> CertificateTemplateRead:
    source = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, source.org_id, "configuration", "create", WHAT)
    copy = CertificateTemplate(
        org_id=source.org_id,
        name=f"{source.name} (copy)"[:250],
        layout=source.layout,
        orientation=source.orientation,
        status=ConfigStatus.ACTIVE,
        is_default=False,
        # Image names include their folder, so the copy can share them.
        design=CertificateDesign(**(source.design or {})).model_dump(),
        serial_format=source.serial_format,
        template_uuid=f"certificatetemplate_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(copy)
    await db_session.commit()
    await db_session.refresh(copy)
    return await _read(db_session, copy)


async def delete_template(db_session: AsyncSession, current_user: AnyUser, template_uuid: str) -> str:
    template = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, template.org_id, "configuration", "delete", WHAT)
    # Programs fall back to the default (FK SET NULL); courses that named it
    # resolve to the default because the uuid no longer exists.
    await db_session.delete(template)
    await db_session.commit()
    return "Template deleted"


async def upload_asset(
    db_session: AsyncSession, current_user: AnyUser, template_uuid: str, kind: str, file: UploadFile
) -> CertificateTemplateRead:
    if kind not in ASSET_KINDS:
        raise bad_request(f"kind must be one of: {', '.join(ASSET_KINDS)}")
    template = await get_template_by_uuid(db_session, template_uuid)
    await authorize_admin(db_session, current_user, template.org_id, "configuration", "update", WHAT)
    org = await db_session.get(Organization, template.org_id)
    name = await upload_file(
        file=file,
        directory=f"certificates/templates/{template.template_uuid}",
        type_of_dir="orgs",
        uuid=org.org_uuid if org else "",
        allowed_types=["image"],
        filename_prefix=kind,
    )
    # Stored with its folder ("<template_uuid>/<file>") so copies can share it.
    name = f"{template.template_uuid}/{name}"
    stored = CertificateDesign(**(template.design or {})).model_dump()
    if kind == "background":
        stored["background_image"] = name
    elif kind == "secondary_logo":
        stored["secondary_logo"] = name
    else:
        index = int(kind.split("_")[1])
        signatures = list(stored.get("signatures") or [])
        while len(signatures) <= index:
            signatures.append({"name": "", "title": "", "image": None})
        signatures[index] = {**signatures[index], "image": name}
        stored["signatures"] = signatures
    template.design = stored
    template.update_date = now()
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)
    return await _read(db_session, template)


# ---------------------------------------------------------------------------
# Resolution, serial numbers, rendering
# ---------------------------------------------------------------------------


async def resolve_for_course(
    db_session: AsyncSession, course: Course, certification: Optional[Certifications]
) -> Optional[CertificateTemplate]:
    active = ConfigStatus.ACTIVE.value
    config = certification.config if certification and isinstance(certification.config, dict) else {}
    uuid = config.get("certificate_template_uuid")
    if uuid:
        template = (
            await db_session.execute(
                select(CertificateTemplate).where(
                    CertificateTemplate.template_uuid == uuid,
                    CertificateTemplate.org_id == course.org_id,
                    CertificateTemplate.status == active,
                )
            )
        ).scalars().first()
        if template:
            return template
    program_template_id = (
        await db_session.execute(
            select(TrainingProgram.certificate_template_id)
            .join(TrainingProgramCourse, TrainingProgramCourse.training_program_id == TrainingProgram.id)  # type: ignore[arg-type]
            .where(TrainingProgramCourse.course_id == course.id)
        )
    ).scalars().first()
    if program_template_id:
        template = await db_session.get(CertificateTemplate, program_template_id)
        if template and template.status == active:
            return template
    return (
        await db_session.execute(
            select(CertificateTemplate).where(
                CertificateTemplate.org_id == course.org_id,
                CertificateTemplate.is_default == True,  # noqa: E712
                CertificateTemplate.status == active,
            )
        )
    ).scalars().first()


def _serial_prefix_and_width(fmt: str, when: datetime) -> Tuple[str, str, int]:
    """Split a format into the literal text before/after {SEQ} for this date."""
    width = 4

    def repl(match: re.Match) -> str:
        nonlocal width
        token = match.group(1)
        if token == "YYYY":
            return f"{when.year:04d}"
        if token == "YY":
            return f"{when.year % 100:02d}"
        if token == "MM":
            return f"{when.month:02d}"
        width = int(match.group(2) or 4)
        return "\x00"

    filled = SERIAL_TOKEN_RE.sub(repl, fmt)
    before, _, after = filled.partition("\x00")
    return before, after, width


async def next_serial(db_session: AsyncSession, org_id: int, fmt: str, when: Optional[datetime] = None) -> str:
    """Next free serial for ``fmt`` in the org (sequence resets per prefix)."""
    when = when or datetime.now()
    before, after, width = _serial_prefix_and_width(fmt, when)
    existing = (
        await db_session.execute(
            select(CertificateUser.serial_no)
            .join(Certifications, Certifications.id == CertificateUser.certification_id)  # type: ignore[arg-type]
            .join(Course, Course.id == Certifications.course_id)  # type: ignore[arg-type]
            .where(Course.org_id == org_id, CertificateUser.serial_no.like(f"{before}%"))  # type: ignore[union-attr]
        )
    ).scalars().all()
    highest = 0
    for serial in existing:
        middle = serial[len(before): len(serial) - len(after) if after else None]
        if middle.isdigit():
            highest = max(highest, int(middle))
    return f"{before}{highest + 1:0{width}d}{after}"


async def assign_serial(db_session: AsyncSession, certificate_user: CertificateUser, course: Course, certification: Certifications) -> None:
    template = await resolve_for_course(db_session, course, certification)
    if template is None:
        return
    certificate_user.serial_no = await next_serial(db_session, course.org_id, template.serial_format)


def _person(user: Optional[User]) -> str:
    if user is None:
        return ""
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username


async def render_context(
    db_session: AsyncSession, certificate_user: CertificateUser, certification: Certifications, course: Course
) -> Optional[CertificateRenderRead]:
    template = await resolve_for_course(db_session, course, certification)
    if template is None:
        return None
    user = await db_session.get(User, certificate_user.user_id)
    org = await db_session.get(Organization, course.org_id)
    program = (
        await db_session.execute(
            select(TrainingProgram.name)
            .join(TrainingProgramCourse, TrainingProgramCourse.training_program_id == TrainingProgram.id)  # type: ignore[arg-type]
            .where(TrainingProgramCourse.course_id == course.id)
        )
    ).scalars().first()
    instructor = ""
    try:
        from src.db.academic.course_profiles import CourseAcademicProfile
        from src.db.instructors.instructors import Instructor

        profile = (
            await db_session.execute(select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id))
        ).scalars().first()
        if profile and profile.instructor_id:
            inst = await db_session.get(Instructor, profile.instructor_id)
            instructor = _person(await db_session.get(User, inst.user_id)) if inst else ""
    except Exception:
        instructor = ""
    config = certification.config if isinstance(certification.config, dict) else {}
    instructor = instructor or config.get("certificate_instructor") or ""
    issued = (certificate_user.created_at or "")[:10]
    variables = {
        "student_name": _person(user),
        "course_name": course.name,
        "program_name": program or "",
        "completion_date": issued,
        "issue_date": issued,
        "certificate_id": certificate_user.serial_no or certificate_user.user_certification_uuid,
        "instructor_name": instructor,
        "org_name": org.name if org else "",
        "certification_name": config.get("certification_name") or "",
    }
    return CertificateRenderRead(
        template=await _read(db_session, template, with_usage=False),
        variables=variables,
        org_uuid=org.org_uuid if org else "",
    )
