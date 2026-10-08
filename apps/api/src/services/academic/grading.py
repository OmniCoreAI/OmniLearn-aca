"""Assessment & results: grade scales, weighted components, gradebook,
grade submission/approval, GPA and transcripts.

Scores come from the offering's content course (existing LMS assignments,
quizzes and exams) and can be overridden by staff; every change is kept in
the score's history. Grades become official only when a coordinator approves
the instructor's submission, which also sets each registration to
completed / failed.
"""
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.calendar import AcademicTerm
from src.db.academic.catalog import AcademicCourse
from src.db.academic.cohorts import Cohort
from src.db.academic.grading import (
    AssessmentComponent,
    AssessmentComponentCreate,
    AssessmentComponentRead,
    AssessmentComponentUpdate,
    ComponentScore,
    GradeBand,
    GradebookCell,
    GradebookRead,
    GradebookRow,
    GradeScale,
    GradeScaleCreate,
    GradeScaleRead,
    GradeScaleUpdate,
    GradeStatus,
    ScoreSource,
    ScoreUpdate,
    SourceAssignmentRef,
    Transcript,
    TranscriptCourse,
    TranscriptTerm,
)
from src.db.academic.offerings import (
    CohortMembership,
    CourseOffering,
    Enrollment,
    EnrollmentStatus,
)
from src.db.academic.programs import Program
from src.db.courses.assignments import (
    Assignment,
    AssignmentTask,
    AssignmentUserSubmission,
    AssignmentUserSubmissionStatus,
)
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.auth import resolve_acting_user_id
from src.security.rbac.constants import ADMIN_ROLE_ID
from src.security.rbac import AccessAction, AccessContext, check_resource_access
from src.services.academic import offerings as offerings_svc
from src.services.academic.common import (
    Principal,
    bad_request,
    conflict,
    get_by_uuid_or_404,
    now,
    require_academic_manager,
    require_academic_member,
)
from src.services.notifications import inbox
from src.services.notifications.assignments import slug

# Default postgraduate 4.0 scale. C (60) is the minimum pass.
DEFAULT_SCALE_NAME = "Standard 4.0"
DEFAULT_BANDS: List[dict] = [
    {"letter": "A", "min_score": 90, "points": 4.0, "passing": True},
    {"letter": "A-", "min_score": 85, "points": 3.7, "passing": True},
    {"letter": "B+", "min_score": 80, "points": 3.3, "passing": True},
    {"letter": "B", "min_score": 75, "points": 3.0, "passing": True},
    {"letter": "B-", "min_score": 70, "points": 2.7, "passing": True},
    {"letter": "C+", "min_score": 65, "points": 2.3, "passing": True},
    {"letter": "C", "min_score": 60, "points": 2.0, "passing": True},
    {"letter": "D", "min_score": 50, "points": 1.0, "passing": False},
    {"letter": "F", "min_score": 0, "points": 0.0, "passing": False},
]
LOCKED_STATES = {GradeStatus.SUBMITTED.value, GradeStatus.APPROVED.value}
RESULT_STATES = {EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED}


def _round(value: Optional[float], digits: int = 2) -> Optional[float]:
    return None if value is None else round(value + 0.0, digits)


# ---------------------------------------------------------------------------
# Grade scales
# ---------------------------------------------------------------------------

def _validate_bands(bands: List[GradeBand]) -> List[dict]:
    if not bands:
        raise bad_request("A grade scale needs at least one band")
    letters = set()
    for band in bands:
        if not band.letter.strip():
            raise bad_request("Every band needs a letter")
        if band.letter in letters:
            raise bad_request(f"Duplicate letter '{band.letter}'")
        letters.add(band.letter)
        if not (0 <= band.min_score <= 100):
            raise bad_request("Band minimum scores must be between 0 and 100")
        if band.points < 0:
            raise bad_request("Grade points cannot be negative")
    ordered = sorted(bands, key=lambda b: b.min_score, reverse=True)
    if ordered[-1].min_score != 0:
        raise bad_request("The lowest band must start at 0 so every score maps to a grade")
    if len({b.min_score for b in bands}) != len(bands):
        raise bad_request("Two bands cannot share the same minimum score")
    return [b.model_dump() for b in ordered]


def _pass_mark(bands: List[dict]) -> Optional[float]:
    passing = [b["min_score"] for b in bands if b.get("passing")]
    return min(passing) if passing else None


async def _scale_read(db_session: AsyncSession, scale: GradeScale) -> GradeScaleRead:
    used = (
        await db_session.execute(
            select(func.count()).select_from(Program).where(Program.grade_scale_id == scale.id)
        )
    ).scalar() or 0
    return GradeScaleRead(
        **scale.model_dump(exclude={"bands"}),
        bands=[GradeBand(**b) for b in scale.bands or []],
        pass_mark=_pass_mark(scale.bands or []),
        program_count=int(used),
    )


async def get_default_scale(db_session: AsyncSession, org_id: int) -> GradeScale:
    """The org's default scale, created on first use from ``DEFAULT_BANDS``."""
    scale = (
        await db_session.execute(
            select(GradeScale).where(GradeScale.org_id == org_id, GradeScale.is_default == True)  # noqa: E712
        )
    ).scalars().first()
    if scale:
        return scale
    scale = (
        await db_session.execute(select(GradeScale).where(GradeScale.org_id == org_id))
    ).scalars().first()
    if scale:
        return scale
    scale = GradeScale(
        name=DEFAULT_SCALE_NAME,
        description="Default postgraduate scale (C / 60% minimum pass)",
        is_default=True,
        org_id=org_id,
        bands=DEFAULT_BANDS,
        grade_scale_uuid=f"gradescale_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(scale)
    await db_session.flush()
    return scale


async def _clear_other_defaults(db_session: AsyncSession, scale: GradeScale) -> None:
    others = (
        await db_session.execute(
            select(GradeScale).where(GradeScale.org_id == scale.org_id, GradeScale.id != scale.id)
        )
    ).scalars().all()
    for other in others:
        if other.is_default:
            other.is_default = False
            db_session.add(other)


async def list_grade_scales(org_id: int, current_user: Principal, db_session: AsyncSession) -> List[GradeScaleRead]:
    await require_academic_member(current_user, org_id, db_session)
    await get_default_scale(db_session, org_id)
    await db_session.commit()
    scales = (
        await db_session.execute(select(GradeScale).where(GradeScale.org_id == org_id).order_by(GradeScale.name))
    ).scalars().all()
    return [await _scale_read(db_session, s) for s in scales]


async def create_grade_scale(
    org_id: int, data: GradeScaleCreate, current_user: Principal, db_session: AsyncSession
) -> GradeScaleRead:
    await require_academic_manager(current_user, org_id, db_session)
    bands = _validate_bands(data.bands)
    name = data.name.strip()
    if (
        await db_session.execute(select(GradeScale).where(GradeScale.org_id == org_id, GradeScale.name == name))
    ).scalars().first():
        raise conflict(f"A grade scale named '{name}' already exists")
    scale = GradeScale(
        name=name,
        description=data.description,
        is_default=data.is_default,
        org_id=org_id,
        bands=bands,
        grade_scale_uuid=f"gradescale_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    db_session.add(scale)
    await db_session.flush()
    if scale.is_default:
        await _clear_other_defaults(db_session, scale)
    await db_session.commit()
    await db_session.refresh(scale)
    return await _scale_read(db_session, scale)


async def update_grade_scale(
    grade_scale_uuid: str, data: GradeScaleUpdate, current_user: Principal, db_session: AsyncSession
) -> GradeScaleRead:
    scale = await get_by_uuid_or_404(db_session, GradeScale, GradeScale.grade_scale_uuid, grade_scale_uuid, "Grade scale")
    await require_academic_manager(current_user, scale.org_id, db_session)
    update = data.model_dump(exclude_unset=True)
    if "bands" in update and data.bands is not None:
        if await _scale_has_approved_results(db_session, scale):
            raise conflict("Approved results use this scale; create a new scale instead of changing its bands")
        scale.bands = _validate_bands(data.bands)
        update.pop("bands")
    if update.get("name"):
        update["name"] = update["name"].strip()
    for key, value in update.items():
        setattr(scale, key, value)
    scale.update_date = now()
    db_session.add(scale)
    if scale.is_default:
        await _clear_other_defaults(db_session, scale)
    await db_session.commit()
    await db_session.refresh(scale)
    return await _scale_read(db_session, scale)


async def _scale_has_approved_results(db_session: AsyncSession, scale: GradeScale) -> bool:
    """Approved results exist for offerings resolved to this scale."""
    offerings = (
        await db_session.execute(
            select(CourseOffering).where(
                CourseOffering.org_id == scale.org_id,
                CourseOffering.grade_status == GradeStatus.APPROVED.value,
            )
        )
    ).scalars().all()
    for offering in offerings:
        if (await resolve_scale(db_session, offering)).id == scale.id:
            return True
    return False


async def delete_grade_scale(grade_scale_uuid: str, current_user: Principal, db_session: AsyncSession) -> str:
    scale = await get_by_uuid_or_404(db_session, GradeScale, GradeScale.grade_scale_uuid, grade_scale_uuid, "Grade scale")
    await require_academic_manager(current_user, scale.org_id, db_session)
    if scale.is_default:
        raise conflict("Make another scale the default before deleting this one")
    used = (
        await db_session.execute(select(func.count()).select_from(Program).where(Program.grade_scale_id == scale.id))
    ).scalar() or 0
    if used:
        raise conflict("Programs use this grade scale")
    await db_session.delete(scale)
    await db_session.commit()
    return "Grade scale deleted"


async def resolve_scale(db_session: AsyncSession, offering: CourseOffering) -> GradeScale:
    """Program scale for cohort offerings, otherwise the org default."""
    if offering.cohort_id:
        cohort = await db_session.get(Cohort, offering.cohort_id)
        program = await db_session.get(Program, cohort.program_id) if cohort else None
        if program and program.grade_scale_id:
            scale = await db_session.get(GradeScale, program.grade_scale_id)
            if scale:
                return scale
    return await get_default_scale(db_session, offering.org_id)


def grade_for(bands: List[dict], total: float) -> Tuple[str, float, bool]:
    for band in sorted(bands, key=lambda b: b["min_score"], reverse=True):
        if total + 1e-9 >= band["min_score"]:
            return band["letter"], float(band["points"]), bool(band.get("passing"))
    last = bands[-1]
    return last["letter"], float(last["points"]), bool(last.get("passing"))


# ---------------------------------------------------------------------------
# Components
# ---------------------------------------------------------------------------

async def _content_assignments(db_session: AsyncSession, offering: CourseOffering) -> Dict[str, Assignment]:
    if not offering.content_course_id:
        return {}
    rows = (
        await db_session.execute(select(Assignment).where(Assignment.course_id == offering.content_course_id))
    ).scalars().all()
    return {a.assignment_uuid: a for a in rows}


async def _component_read(
    db_session: AsyncSession, component: AssessmentComponent, assignments: Dict[str, Assignment]
) -> AssessmentComponentRead:
    return AssessmentComponentRead(
        **component.model_dump(exclude={"source_assignments"}),
        source_assignments=[
            SourceAssignmentRef(assignment_uuid=uuid, title=assignments[uuid].title)
            for uuid in (component.source_assignments or [])
            if uuid in assignments
        ],
    )


def _assert_editable(offering: CourseOffering) -> None:
    if offering.grade_status in LOCKED_STATES:
        raise conflict("Grades are submitted/approved; return them before changing the assessment scheme")


async def _components(db_session: AsyncSession, offering: CourseOffering) -> List[AssessmentComponent]:
    return list(
        (
            await db_session.execute(
                select(AssessmentComponent)
                .where(AssessmentComponent.offering_id == offering.id)
                .order_by(AssessmentComponent.order, AssessmentComponent.id)  # type: ignore
            )
        ).scalars().all()
    )


async def _validate_component(
    db_session: AsyncSession,
    offering: CourseOffering,
    data: dict,
    exclude_id: Optional[int] = None,
) -> None:
    if data.get("weight") is not None and not (0 < data["weight"] <= 100):
        raise bad_request("Weight must be between 0 and 100")
    if data.get("max_score") is not None and data["max_score"] <= 0:
        raise bad_request("Maximum score must be positive")
    if data.get("weight") is not None:
        others = sum(c.weight for c in await _components(db_session, offering) if c.id != exclude_id)
        if others + data["weight"] > 100 + 1e-9:
            raise bad_request(f"Weights would total {others + data['weight']:g}% (maximum 100%)")
    if data.get("source_assignments"):
        available = await _content_assignments(db_session, offering)
        unknown = [u for u in data["source_assignments"] if u not in available]
        if unknown:
            raise bad_request("Linked assignments must belong to the offering's content course")


async def list_components(
    request: Request, offering_uuid: str, current_user: Principal, db_session: AsyncSession
) -> List[AssessmentComponentRead]:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await require_academic_member(current_user, offering.org_id, db_session)
    assignments = await _content_assignments(db_session, offering)
    return [await _component_read(db_session, c, assignments) for c in await _components(db_session, offering)]


async def create_component(
    request: Request,
    offering_uuid: str,
    data: AssessmentComponentCreate,
    current_user: Principal,
    db_session: AsyncSession,
) -> AssessmentComponentRead:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    _assert_editable(offering)
    await _validate_component(db_session, offering, data.model_dump())
    component = AssessmentComponent(
        **data.model_dump(exclude={"source_assignments"}),
        source_assignments=list(dict.fromkeys(data.source_assignments)),
        offering_id=offering.id,
        org_id=offering.org_id,
        component_uuid=f"acomponent_{uuid4()}",
        creation_date=now(),
        update_date=now(),
    )
    component.name = component.name.strip()
    if not component.name:
        raise bad_request("Component name is required")
    db_session.add(component)
    await db_session.commit()
    await db_session.refresh(component)
    return await _component_read(db_session, component, await _content_assignments(db_session, offering))


async def _get_component(db_session: AsyncSession, offering: CourseOffering, component_uuid: str) -> AssessmentComponent:
    component = await get_by_uuid_or_404(
        db_session, AssessmentComponent, AssessmentComponent.component_uuid, component_uuid, "Component"
    )
    if component.offering_id != offering.id:
        raise bad_request("Component does not belong to this offering")
    return component


async def update_component(
    request: Request,
    offering_uuid: str,
    component_uuid: str,
    data: AssessmentComponentUpdate,
    current_user: Principal,
    db_session: AsyncSession,
) -> AssessmentComponentRead:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    _assert_editable(offering)
    component = await _get_component(db_session, offering, component_uuid)
    update = data.model_dump(exclude_unset=True)
    await _validate_component(db_session, offering, update, exclude_id=component.id)
    if "source_assignments" in update:
        update["source_assignments"] = list(dict.fromkeys(update["source_assignments"] or []))
    for key, value in update.items():
        setattr(component, key, value)
    component.update_date = now()
    db_session.add(component)
    await db_session.commit()
    await db_session.refresh(component)
    return await _component_read(db_session, component, await _content_assignments(db_session, offering))


async def delete_component(
    request: Request, offering_uuid: str, component_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    _assert_editable(offering)
    component = await _get_component(db_session, offering, component_uuid)
    await db_session.delete(component)
    await db_session.commit()
    return "Component deleted"


# ---------------------------------------------------------------------------
# Scores
# ---------------------------------------------------------------------------

async def _assignment_percentage(db_session: AsyncSession, assignment: Assignment, user_id: int) -> Optional[float]:
    """Percentage (0-100) of a GRADED submission, or None when not graded yet."""
    submission = (
        await db_session.execute(
            select(AssignmentUserSubmission).where(
                AssignmentUserSubmission.assignment_id == assignment.id,
                AssignmentUserSubmission.user_id == user_id,
                AssignmentUserSubmission.submission_status == AssignmentUserSubmissionStatus.GRADED,
            )
        )
    ).scalars().first()
    if not submission:
        return None
    max_total = (
        await db_session.execute(
            select(func.coalesce(func.sum(AssignmentTask.max_grade_value), 0)).where(
                AssignmentTask.assignment_id == assignment.id
            )
        )
    ).scalar() or 0
    if not max_total:
        return None
    return max(0.0, min(100.0, (submission.grade or 0) / float(max_total) * 100.0))


def _log(score: ComponentScore, by: Optional[int], new: Optional[float], source: ScoreSource, note: Optional[str]) -> None:
    history = list(score.history or [])
    history.append({"at": now(), "by": by, "from": score.score, "to": new, "source": source.value, "note": note})
    score.history = history


async def _score_row(db_session: AsyncSession, component: AssessmentComponent, enrollment: Enrollment) -> ComponentScore:
    def existing():
        return select(ComponentScore).where(
            ComponentScore.component_id == component.id, ComponentScore.enrollment_id == enrollment.id
        )

    row = (await db_session.execute(existing())).scalars().first()
    if row:
        return row
    row = ComponentScore(component_id=component.id, enrollment_id=enrollment.id, org_id=component.org_id, history=[])
    try:
        # Create it now, inside a savepoint: two saves of the same cell at once
        # (double submit, retry) would otherwise both insert and one would 500.
        async with db_session.begin_nested():
            db_session.add(row)
            await db_session.flush()
    except IntegrityError:
        row = (await db_session.execute(existing())).scalars().one()
    return row


async def _graded_enrollments(db_session: AsyncSession, offering: CourseOffering) -> List[Enrollment]:
    """Students who take part in grading (dropped/withdrawn are excluded)."""
    return list(
        (
            await db_session.execute(
                select(Enrollment)
                .where(
                    Enrollment.offering_id == offering.id,
                    Enrollment.status.in_(  # type: ignore[attr-defined]
                        [EnrollmentStatus.REGISTERED, EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED]
                    ),
                )
                .order_by(Enrollment.registered_at)  # type: ignore
            )
        ).scalars().all()
    )


async def sync_scores(
    request: Request, offering_uuid: str, current_user: Principal, db_session: AsyncSession
) -> GradebookRead:
    """Pull scores from graded LMS submissions into auto-sourced cells.
    Manual overrides are never overwritten."""
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    _assert_editable(offering)
    assignments = await _content_assignments(db_session, offering)
    by = resolve_acting_user_id(current_user) or None
    for component in await _components(db_session, offering):
        linked = [assignments[u] for u in (component.source_assignments or []) if u in assignments]
        if not linked:
            continue
        for enrollment in await _graded_enrollments(db_session, offering):
            row = await _score_row(db_session, component, enrollment)
            if row.source == ScoreSource.MANUAL and row.id is not None:
                continue
            percentages = [await _assignment_percentage(db_session, a, enrollment.user_id) for a in linked]
            graded = [p for p in percentages if p is not None]
            new = _round(sum(graded) / len(graded) / 100.0 * component.max_score) if graded else None
            if row.id is not None and row.score == new:
                continue
            _log(row, by, new, ScoreSource.AUTO, "synced from assignments")
            row.score = new
            row.source = ScoreSource.AUTO
            row.updated_by_id = by
            row.update_date = now()
            db_session.add(row)
    await db_session.commit()
    return await get_gradebook(request, offering_uuid, current_user, db_session)


async def set_scores(
    request: Request,
    offering_uuid: str,
    updates: List[ScoreUpdate],
    current_user: Principal,
    db_session: AsyncSession,
) -> GradebookRead:
    """Enter or override scores. ``score=None`` clears a manual override."""
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    _assert_editable(offering)
    by = resolve_acting_user_id(current_user) or None
    for update in updates:
        component = await _get_component(db_session, offering, update.component_uuid)
        enrollment = await get_by_uuid_or_404(
            db_session, Enrollment, Enrollment.enrollment_uuid, update.enrollment_uuid, "Enrollment"
        )
        if enrollment.offering_id != offering.id:
            raise bad_request("Enrollment does not belong to this offering")
        if update.score is not None and not (0 <= update.score <= component.max_score):
            raise bad_request(f"Score for {component.name} must be between 0 and {component.max_score:g}")
        row = await _score_row(db_session, component, enrollment)
        source = ScoreSource.MANUAL if update.score is not None else ScoreSource.AUTO
        _log(row, by, update.score, source, update.note)
        row.score = update.score
        row.source = source
        row.updated_by_id = by
        row.update_date = now()
        db_session.add(row)
    await db_session.commit()
    return await get_gradebook(request, offering_uuid, current_user, db_session)


# ---------------------------------------------------------------------------
# Gradebook
# ---------------------------------------------------------------------------

def compute_result(
    components: List[AssessmentComponent], scores: Dict[int, Optional[float]], bands: List[dict]
) -> Tuple[Optional[float], bool, Optional[str], Optional[float], Optional[bool]]:
    """Weighted total on 0-100. ``complete`` when every component is scored
    and weights total 100 — only then is a letter grade assigned."""
    total, scored = 0.0, 0
    for component in components:
        value = scores.get(component.id)  # type: ignore[arg-type]
        if value is None:
            continue
        scored += 1
        total += value / component.max_score * component.weight
    total_weight = sum(c.weight for c in components)
    complete = bool(components) and scored == len(components) and abs(total_weight - 100) < 1e-6
    if not scored:
        return None, False, None, None, None
    if not complete:
        return _round(total), False, None, None, None
    letter, points, passed = grade_for(bands, total)
    return _round(total), True, letter, points, passed


async def get_gradebook(
    request: Request, offering_uuid: str, current_user: Principal, db_session: AsyncSession
) -> GradebookRead:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    scale = await resolve_scale(db_session, offering)
    components = await _components(db_session, offering)
    assignments = await _content_assignments(db_session, offering)
    enrollments = await _graded_enrollments(db_session, offering)
    score_rows = (
        await db_session.execute(
            select(ComponentScore).where(
                ComponentScore.component_id.in_([c.id for c in components] or [0])  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()
    by_enrollment: Dict[int, Dict[int, ComponentScore]] = {}
    for row in score_rows:
        by_enrollment.setdefault(row.enrollment_id, {})[row.component_id] = row

    rows: List[GradebookRow] = []
    for enrollment in enrollments:
        user = await db_session.get(User, enrollment.user_id)
        membership = (
            await db_session.get(CohortMembership, enrollment.membership_id) if enrollment.membership_id else None
        )
        cells = by_enrollment.get(enrollment.id, {})  # type: ignore[arg-type]
        values = {cid: cell.score for cid, cell in cells.items()}
        total, complete, letter, points, passed = compute_result(components, values, scale.bands)
        if enrollment.status in RESULT_STATES and enrollment.letter_grade:
            # Official approved result wins over a live recomputation.
            total, letter, points, passed = (
                enrollment.final_score, enrollment.letter_grade, enrollment.grade_points, enrollment.result_passed
            )
        rows.append(
            GradebookRow(
                enrollment_uuid=enrollment.enrollment_uuid,
                student_number=membership.student_number if membership else None,
                user_uuid=user.user_uuid if user else "",
                name=(f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username) if user else "",
                email=user.email if user else None,
                enrollment_status=enrollment.status.value,
                cells=[
                    GradebookCell(
                        component_uuid=c.component_uuid,
                        score=cells[c.id].score if c.id in cells else None,
                        source=cells[c.id].source.value if c.id in cells and cells[c.id].source else None,
                    )
                    for c in components
                ],
                weighted_total=total,
                complete=complete,
                letter_grade=letter,
                grade_points=points,
                passed=passed,
            )
        )
    return GradebookRead(
        offering_uuid=offering.offering_uuid,
        grade_status=GradeStatus(offering.grade_status or "open"),
        grade_note=offering.grade_note,
        grades_submitted_at=offering.grades_submitted_at,
        grades_approved_at=offering.grades_approved_at,
        total_weight=_round(sum(c.weight for c in components)) or 0,
        scale=await _scale_read(db_session, scale),
        components=[await _component_read(db_session, c, assignments) for c in components],
        rows=rows,
    )


# ---------------------------------------------------------------------------
# Submission & approval workflow
# ---------------------------------------------------------------------------

async def _notify_grades(db_session: AsyncSession, offering: CourseOffering, stage: str, actor_id: Optional[int]) -> None:
    """In-app notice for each step: approvers hear about submissions, teaching
    staff about returns and approvals, students when results are official."""
    course = await db_session.get(AcademicCourse, offering.academic_course_id)
    label = f"{course.code} · {course.name}" if course else offering.code
    key = slug(offering.offering_uuid, "offering_")
    staff = [offering.instructor_id, offering.teaching_assistant_id]
    teaching_path = f"/dash/postgraduate/teaching/offerings/{key}"
    payload = {"offering_uuid": offering.offering_uuid, "name": label}
    sends: List[Tuple[List[Optional[int]], str, str, str, Optional[str]]] = []
    if stage == "submitted":
        program = await offerings_svc._cohort_program(db_session, offering.cohort_id)
        admins = (
            await db_session.execute(
                select(UserOrganization.user_id).where(
                    UserOrganization.org_id == offering.org_id, UserOrganization.role_id == ADMIN_ROLE_ID
                )
            )
        ).scalars().all()
        approvers = [program.coordinator_id if program else None, *admins]
        sends.append((approvers, "grades_submitted", f"Grades submitted for approval: {label}", f"/dash/postgraduate/offerings/{key}", offering.grade_note))
    elif stage == "returned":
        sends.append((staff, "grades_returned", f"Grades returned for changes: {label}", teaching_path, offering.grade_note))
    elif stage == "approved":
        sends.append((staff, "grades_approved", f"Grades approved: {label}", teaching_path, None))
        students = [e.user_id for e in await _graded_enrollments(db_session, offering)]
        sends.append((students, "result_published", f"Your result for {label} is published", "/academics", None))
    for user_ids, type, title, link, body in sends:
        recipients = [u for u in dict.fromkeys(user_ids) if u and u != actor_id]
        if recipients:
            await inbox.push(db_session, offering.org_id, recipients, type, title, body=body, link=link, payload=payload)

async def submit_grades(
    request: Request, offering_uuid: str, note: Optional[str], current_user: Principal, db_session: AsyncSession
) -> GradebookRead:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_staff(request, db_session, current_user, offering)
    if offering.grade_status in LOCKED_STATES:
        raise conflict(f"Grades are already {offering.grade_status}")
    book = await get_gradebook(request, offering_uuid, current_user, db_session)
    if abs(book.total_weight - 100) > 1e-6:
        raise conflict(f"Assessment weights total {book.total_weight:g}%; they must total 100%")
    registered = [r for r in book.rows if r.enrollment_status == EnrollmentStatus.REGISTERED.value]
    if not registered:
        raise conflict("There are no registered students to grade")
    missing = [r.student_number or r.name for r in registered if not r.complete]
    if missing:
        raise conflict(f"Scores are missing for: {', '.join(missing[:5])}{'…' if len(missing) > 5 else ''}")
    offering.grade_status = GradeStatus.SUBMITTED.value
    offering.grade_note = note
    offering.grades_submitted_at = now()
    offering.grades_submitted_by_id = resolve_acting_user_id(current_user) or None
    db_session.add(offering)
    await db_session.commit()
    await _notify_grades(db_session, offering, "submitted", offering.grades_submitted_by_id)
    return await get_gradebook(request, offering_uuid, current_user, db_session)


async def return_grades(
    request: Request, offering_uuid: str, note: Optional[str], current_user: Principal, db_session: AsyncSession
) -> GradebookRead:
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_manager(request, db_session, current_user, offering)
    if offering.grade_status != GradeStatus.SUBMITTED.value:
        raise conflict("Only submitted grades can be returned")
    if not (note or "").strip():
        raise bad_request("Explain what needs to change when returning grades")
    offering.grade_status = GradeStatus.RETURNED.value
    offering.grade_note = note
    db_session.add(offering)
    await db_session.commit()
    await _notify_grades(db_session, offering, "returned", resolve_acting_user_id(current_user))
    return await get_gradebook(request, offering_uuid, current_user, db_session)


async def approve_grades(
    request: Request, offering_uuid: str, note: Optional[str], current_user: Principal, db_session: AsyncSession
) -> GradebookRead:
    """Make results official: store them on each enrollment and set
    registrations to completed / failed (which keeps course access)."""
    offering = await offerings_svc.get_offering_or_404(db_session, offering_uuid)
    await offerings_svc.require_offering_manager(request, db_session, current_user, offering)
    if offering.grade_status != GradeStatus.SUBMITTED.value:
        raise conflict("Grades must be submitted by the instructor before approval")
    # Separation of duties: whoever teaches the offering cannot make its
    # results official, even when they also manage the program.
    approver = resolve_acting_user_id(current_user)
    if approver and approver in (offering.instructor_id, offering.teaching_assistant_id):
        raise HTTPException(
            status_code=403, detail="The offering's instructor or teaching assistant cannot approve its grades"
        )
    book = await get_gradebook(request, offering_uuid, current_user, db_session)
    rows = {r.enrollment_uuid: r for r in book.rows}
    incomplete = [
        r.student_number or r.name
        for r in book.rows
        if r.enrollment_status == EnrollmentStatus.REGISTERED.value and not r.complete
    ]
    if incomplete:
        raise conflict(
            f"Scores are incomplete for: {', '.join(incomplete[:5])}{'…' if len(incomplete) > 5 else ''}; "
            "return the grades to the instructor"
        )
    for enrollment in await _graded_enrollments(db_session, offering):
        if enrollment.status != EnrollmentStatus.REGISTERED:
            continue
        row = rows[enrollment.enrollment_uuid]
        enrollment.final_score = row.weighted_total
        enrollment.letter_grade = row.letter_grade
        enrollment.grade_points = row.grade_points
        enrollment.result_passed = row.passed
        enrollment.graded_at = now()
        await offerings_svc.set_enrollment_status(
            db_session, offering, enrollment, EnrollmentStatus.COMPLETED if row.passed else EnrollmentStatus.FAILED
        )
    offering.grade_status = GradeStatus.APPROVED.value
    offering.grade_note = note or offering.grade_note
    offering.grades_approved_at = now()
    offering.grades_approved_by_id = resolve_acting_user_id(current_user) or None
    db_session.add(offering)
    await db_session.commit()
    await _notify_grades(db_session, offering, "approved", offering.grades_approved_by_id)
    return await get_gradebook(request, offering_uuid, current_user, db_session)


# ---------------------------------------------------------------------------
# Transcript & GPA
# ---------------------------------------------------------------------------

def _gpa(entries: List[Tuple[float, float]]) -> Optional[float]:
    """entries: (grade_points, credits)."""
    credits = sum(c for _, c in entries)
    if credits <= 0:
        return None
    return round(sum(p * c for p, c in entries) / credits, 2)


async def build_transcript(db_session: AsyncSession, membership: CohortMembership) -> Transcript:
    """Official results for a student record, by term (term start order).

    Retake rule: when a course is attempted more than once, only the latest
    graded attempt counts in credits and CGPA (earlier ones stay listed)."""
    user = await db_session.get(User, membership.user_id)
    cohort = await db_session.get(Cohort, membership.cohort_id)
    program = await db_session.get(Program, cohort.program_id) if cohort else None

    enrollments = (
        await db_session.execute(
            select(Enrollment).where(
                Enrollment.user_id == membership.user_id,
                Enrollment.org_id == membership.org_id,
                Enrollment.status.in_(list(RESULT_STATES)),  # type: ignore[attr-defined]
            )
        )
    ).scalars().all()

    records = []
    for enrollment in enrollments:
        offering = await db_session.get(CourseOffering, enrollment.offering_id)
        if not offering:
            continue
        # Keep the transcript program-scoped: this cohort's offerings plus
        # open offerings the student took.
        if offering.cohort_id not in (None, membership.cohort_id):
            continue
        course = await db_session.get(AcademicCourse, offering.academic_course_id)
        term = await db_session.get(AcademicTerm, offering.term_id)
        records.append((term, course, offering, enrollment))
    records.sort(key=lambda r: ((r[0].start_date or "") if r[0] else "", r[0].order if r[0] else 0, r[3].graded_at or ""))

    latest_attempt: Dict[int, int] = {}
    for _, course, _, enrollment in records:
        latest_attempt[course.id] = enrollment.id  # type: ignore[index]

    terms: List[TranscriptTerm] = []
    cumulative: List[Tuple[float, float]] = []
    total_attempted = total_earned = 0.0
    by_term: Dict[str, list] = {}
    order: List[str] = []
    for term, course, offering, enrollment in records:
        key = term.code if term else "—"
        if key not in by_term:
            by_term[key] = []
            order.append(key)
        by_term[key].append((term, course, offering, enrollment))

    for key in order:
        items = by_term[key]
        courses: List[TranscriptCourse] = []
        term_entries: List[Tuple[float, float]] = []
        attempted = earned = 0.0
        for term, course, offering, enrollment in items:
            counted = latest_attempt.get(course.id) == enrollment.id
            credits = float(course.credits or 0)
            graded = enrollment.grade_points is not None
            passed = (
                enrollment.result_passed
                if enrollment.result_passed is not None
                else enrollment.status == EnrollmentStatus.COMPLETED
            )
            courses.append(
                TranscriptCourse(
                    offering_uuid=offering.offering_uuid,
                    course_code=course.code,
                    course_name=course.name,
                    credits=credits,
                    final_score=enrollment.final_score,
                    letter_grade=enrollment.letter_grade,
                    grade_points=enrollment.grade_points,
                    status=enrollment.status.value,
                    counted_in_gpa=counted and graded,
                    ungraded=not graded,
                )
            )
            if graded:
                term_entries.append((enrollment.grade_points, credits))  # type: ignore[arg-type]
            attempted += credits
            earned += credits if passed else 0.0
            if counted:
                if graded:
                    cumulative.append((enrollment.grade_points, credits))  # type: ignore[arg-type]
                total_attempted += credits
                total_earned += credits if passed else 0.0
        term = items[0][0]
        terms.append(
            TranscriptTerm(
                term_code=key,
                term_name=term.name if term else None,
                courses=courses,
                credits_attempted=attempted,
                credits_earned=earned,
                term_gpa=_gpa(term_entries),
                cumulative_gpa=_gpa(cumulative),
            )
        )

    min_credits = program.min_credits if program else None
    return Transcript(
        membership_uuid=membership.membership_uuid,
        student_number=membership.student_number,
        student_name=(f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username) if user else "",
        program_name=program.name if program else None,
        cohort_code=cohort.code if cohort else None,
        status=membership.status.value,
        terms=terms,
        credits_attempted=total_attempted,
        credits_earned=total_earned,
        cgpa=_gpa(cumulative),
        program_min_credits=min_credits,
        credits_remaining=max(0.0, min_credits - total_earned) if min_credits is not None else None,
    )


async def get_student_transcript(
    request: Request, membership_uuid: str, current_user: Principal, db_session: AsyncSession
) -> Transcript:
    membership = await get_by_uuid_or_404(
        db_session, CohortMembership, CohortMembership.membership_uuid, membership_uuid, "Student"
    )
    # Students may read their own transcript; staff need program read access.
    if resolve_acting_user_id(current_user) != membership.user_id:
        cohort = await db_session.get(Cohort, membership.cohort_id)
        program = await db_session.get(Program, cohort.program_id) if cohort else None
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        await check_resource_access(
            request, db_session, current_user, program.program_uuid, AccessAction.READ, context=AccessContext.DASHBOARD
        )
    return await build_transcript(db_session, membership)
