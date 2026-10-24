"""Academic calendar: org-wide academic years and terms."""
from typing import List, Optional
from uuid import uuid4

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.calendar import (
    AcademicTerm,
    AcademicTermCreate,
    AcademicTermRead,
    AcademicTermUpdate,
    AcademicYear,
    AcademicYearCreate,
    AcademicYearRead,
    AcademicYearUpdate,
    TermType,
)
from src.db.academic.offerings import CourseOffering
from src.services.academic.common import (
    Principal,
    conflict,
    get_by_uuid_or_404,
    normalize_code,
    now,
    require_academic_manager,
    require_academic_member,
    validate_academic_year_code,
    validate_date_range,
)


# ---------------------------------------------------------------------------
# Academic years
# ---------------------------------------------------------------------------

async def _assert_year_code_unique(
    db_session: AsyncSession, org_id: int, code: str, exclude_id: Optional[int] = None
) -> None:
    existing = (
        await db_session.execute(
            select(AcademicYear).where(AcademicYear.org_id == org_id, AcademicYear.code == code)
        )
    ).scalars().first()
    if existing and existing.id != exclude_id:
        raise conflict(f"Academic year '{code}' already exists")


async def create_academic_year(
    org_id: int, data: AcademicYearCreate, current_user: Principal, db_session: AsyncSession
) -> AcademicYearRead:
    await require_academic_manager(current_user, org_id, db_session)
    code = data.code.strip()
    validate_academic_year_code(code)
    validate_date_range(data.start_date, data.end_date)
    await _assert_year_code_unique(db_session, org_id, code)

    year = AcademicYear.model_validate(data, update={"org_id": org_id, "code": code})
    year.name = data.name or f"Academic Year {code}"
    year.academic_year_uuid = f"academicyear_{uuid4()}"
    year.creation_date = year.update_date = now()
    db_session.add(year)
    await db_session.commit()
    await db_session.refresh(year)
    return AcademicYearRead.model_validate(year)


async def list_academic_years(
    org_id: int, current_user: Principal, db_session: AsyncSession
) -> List[AcademicYearRead]:
    await require_academic_member(current_user, org_id, db_session)
    rows = (
        await db_session.execute(
            select(AcademicYear).where(AcademicYear.org_id == org_id).order_by(AcademicYear.code.desc())  # type: ignore
        )
    ).scalars().all()
    return [AcademicYearRead.model_validate(r) for r in rows]


async def update_academic_year(
    academic_year_uuid: str, data: AcademicYearUpdate, current_user: Principal, db_session: AsyncSession
) -> AcademicYearRead:
    year = await get_by_uuid_or_404(
        db_session, AcademicYear, AcademicYear.academic_year_uuid, academic_year_uuid, "Academic year"
    )
    await require_academic_manager(current_user, year.org_id, db_session)
    update = data.model_dump(exclude_unset=True)
    if "code" in update and update["code"]:
        update["code"] = update["code"].strip()
        validate_academic_year_code(update["code"])
        await _assert_year_code_unique(db_session, year.org_id, update["code"], exclude_id=year.id)
    validate_date_range(update.get("start_date", year.start_date), update.get("end_date", year.end_date))
    for key, value in update.items():
        setattr(year, key, value)
    year.update_date = now()
    db_session.add(year)
    await db_session.commit()
    await db_session.refresh(year)
    return AcademicYearRead.model_validate(year)


async def delete_academic_year(
    academic_year_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    year = await get_by_uuid_or_404(
        db_session, AcademicYear, AcademicYear.academic_year_uuid, academic_year_uuid, "Academic year"
    )
    await require_academic_manager(current_user, year.org_id, db_session)
    term_count = (
        await db_session.execute(
            select(func.count()).select_from(AcademicTerm).where(AcademicTerm.academic_year_id == year.id)
        )
    ).scalar() or 0
    if term_count:
        raise conflict("Delete or move the year's terms first")
    await db_session.delete(year)
    await db_session.commit()
    return "Academic year deleted"


# ---------------------------------------------------------------------------
# Terms
# ---------------------------------------------------------------------------

def generate_term_code(term_type: TermType, year_code: str, start_date: Optional[str]) -> str:
    """``FALL-2026`` style code. Falls in the first calendar year of the
    academic year, spring/summer in the second, unless a start date says otherwise."""
    first, second = validate_academic_year_code(year_code)
    if start_date and len(start_date) >= 4 and start_date[:4].isdigit():
        calendar_year = int(start_date[:4])
    else:
        calendar_year = first if term_type == TermType.FALL else second
    return f"{term_type.value.upper()}-{calendar_year}"


async def _term_read(db_session: AsyncSession, term: AcademicTerm) -> AcademicTermRead:
    year = await db_session.get(AcademicYear, term.academic_year_id)
    return AcademicTermRead(
        **term.model_dump(), academic_year_code=year.code if year else None
    )


async def create_term(
    org_id: int, data: AcademicTermCreate, current_user: Principal, db_session: AsyncSession
) -> AcademicTermRead:
    await require_academic_manager(current_user, org_id, db_session)
    year = await get_by_uuid_or_404(
        db_session, AcademicYear, AcademicYear.academic_year_uuid, data.academic_year_uuid, "Academic year"
    )
    if year.org_id != org_id:
        raise conflict("Academic year belongs to another organization")
    validate_date_range(data.start_date, data.end_date)
    validate_date_range(data.registration_start, data.registration_end, "Registration start")
    validate_date_range(data.exam_start, data.exam_end, "Exam start")

    term_type = TermType(data.term_type)
    if term_type == TermType.CUSTOM:
        code = normalize_code(data.code, "Term")
    else:
        code = generate_term_code(term_type, year.code, data.start_date)
    if (
        await db_session.execute(
            select(AcademicTerm).where(AcademicTerm.org_id == org_id, AcademicTerm.code == code)
        )
    ).scalars().first():
        raise conflict(f"Term '{code}' already exists")

    term = AcademicTerm.model_validate(
        data.model_dump(exclude={"academic_year_uuid", "code"}),
        update={"org_id": org_id, "academic_year_id": year.id, "code": code},
    )
    term.name = data.name or code.replace("-", " ").title()
    term.term_uuid = f"term_{uuid4()}"
    term.creation_date = term.update_date = now()
    db_session.add(term)
    await db_session.commit()
    await db_session.refresh(term)
    return await _term_read(db_session, term)


async def list_terms(
    org_id: int,
    current_user: Principal,
    db_session: AsyncSession,
    academic_year_uuid: Optional[str] = None,
) -> List[AcademicTermRead]:
    await require_academic_member(current_user, org_id, db_session)
    statement = select(AcademicTerm).where(AcademicTerm.org_id == org_id)
    if academic_year_uuid:
        year = await get_by_uuid_or_404(
            db_session, AcademicYear, AcademicYear.academic_year_uuid, academic_year_uuid, "Academic year"
        )
        statement = statement.where(AcademicTerm.academic_year_id == year.id)
    statement = statement.order_by(AcademicTerm.start_date, AcademicTerm.order)  # type: ignore
    terms = (await db_session.execute(statement)).scalars().all()
    return [await _term_read(db_session, t) for t in terms]


async def get_term(term_uuid: str, current_user: Principal, db_session: AsyncSession) -> AcademicTermRead:
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
    await require_academic_member(current_user, term.org_id, db_session)
    return await _term_read(db_session, term)


async def update_term(
    term_uuid: str, data: AcademicTermUpdate, current_user: Principal, db_session: AsyncSession
) -> AcademicTermRead:
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
    await require_academic_manager(current_user, term.org_id, db_session)
    update = data.model_dump(exclude_unset=True)
    merged = {**term.model_dump(), **update}
    validate_date_range(merged.get("start_date"), merged.get("end_date"))
    validate_date_range(merged.get("registration_start"), merged.get("registration_end"), "Registration start")
    validate_date_range(merged.get("exam_start"), merged.get("exam_end"), "Exam start")
    for key, value in update.items():
        setattr(term, key, value)
    term.update_date = now()
    db_session.add(term)
    await db_session.commit()
    await db_session.refresh(term)
    return await _term_read(db_session, term)


async def delete_term(term_uuid: str, current_user: Principal, db_session: AsyncSession) -> str:
    term = await get_by_uuid_or_404(db_session, AcademicTerm, AcademicTerm.term_uuid, term_uuid, "Term")
    await require_academic_manager(current_user, term.org_id, db_session)
    used = (
        await db_session.execute(
            select(func.count()).select_from(CourseOffering).where(CourseOffering.term_id == term.id)
        )
    ).scalar() or 0
    if used:
        raise conflict("This term has course offerings; close it instead of deleting")
    await db_session.delete(term)
    await db_session.commit()
    return "Term deleted"
