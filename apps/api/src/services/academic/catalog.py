"""Course catalog service: reusable academic courses + course prerequisites."""
from typing import List, Optional
from uuid import uuid4

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.catalog import (
    AcademicCourse,
    AcademicCourseCreate,
    AcademicCourseRead,
    AcademicCourseUpdate,
    CoursePrerequisite,
    PrerequisiteRef,
    PrerequisiteSet,
)
from src.db.academic.curricula import CurriculumItem
from src.db.academic.offerings import CourseOffering
from src.db.courses.courses import Course
from src.services.academic.common import (
    Principal,
    bad_request,
    conflict,
    get_by_uuid_or_404,
    normalize_code,
    now,
    require_academic_manager,
    require_academic_member,
)


async def _resolve_template(db_session: AsyncSession, org_id: int, course_uuid: Optional[str]) -> Optional[int]:
    if not course_uuid:
        return None
    course = await get_by_uuid_or_404(db_session, Course, Course.course_uuid, course_uuid, "Template course")
    if course.org_id != org_id:
        raise bad_request("Template course belongs to another organization")
    return course.id


async def _assert_code_unique(
    db_session: AsyncSession, org_id: int, code: str, exclude_id: Optional[int] = None
) -> None:
    existing = (
        await db_session.execute(
            select(AcademicCourse).where(AcademicCourse.org_id == org_id, AcademicCourse.code == code)
        )
    ).scalars().first()
    if existing and existing.id != exclude_id:
        raise conflict(f"Course code '{code}' already exists in the catalog")


async def to_read(db_session: AsyncSession, course: AcademicCourse) -> AcademicCourseRead:
    prereq_rows = (
        await db_session.execute(
            select(CoursePrerequisite, AcademicCourse)
            .join(AcademicCourse, AcademicCourse.id == CoursePrerequisite.prerequisite_id)  # type: ignore
            .where(CoursePrerequisite.academic_course_id == course.id)
        )
    ).all()
    prerequisites = [
        PrerequisiteRef(
            academic_course_uuid=pc.academic_course_uuid, code=pc.code, name=pc.name, min_grade=link.min_grade
        )
        for link, pc in prereq_rows
    ]
    offering_count = (
        await db_session.execute(
            select(func.count()).select_from(CourseOffering).where(CourseOffering.academic_course_id == course.id)
        )
    ).scalar() or 0
    template_uuid = None
    if course.template_course_id:
        template = await db_session.get(Course, course.template_course_id)
        template_uuid = template.course_uuid if template else None
    return AcademicCourseRead(
        **course.model_dump(exclude={"learning_outcomes"}),
        learning_outcomes=course.learning_outcomes or [],
        template_course_uuid=template_uuid,
        prerequisites=prerequisites,
        offering_count=int(offering_count),
    )


def _validate_numbers(data: dict) -> None:
    if data.get("credits") is not None and data["credits"] < 0:
        raise bad_request("Credits cannot be negative")
    if data.get("contact_hours") is not None and data["contact_hours"] < 0:
        raise bad_request("Contact hours cannot be negative")
    if "name" in data and data["name"] is not None and len(data["name"].strip()) < 2:
        raise bad_request("Course name must be at least 2 characters")


async def create_academic_course(
    org_id: int, data: AcademicCourseCreate, current_user: Principal, db_session: AsyncSession
) -> AcademicCourseRead:
    await require_academic_manager(current_user, org_id, db_session)
    _validate_numbers(data.model_dump())
    code = normalize_code(data.code, "Course", max_len=20)
    await _assert_code_unique(db_session, org_id, code)
    template_id = await _resolve_template(db_session, org_id, data.template_course_uuid)

    course = AcademicCourse.model_validate(
        data.model_dump(exclude={"template_course_uuid", "learning_outcomes"}),
        update={"org_id": org_id, "code": code},
    )
    course.name = course.name.strip()
    course.template_course_id = template_id
    course.learning_outcomes = [o for o in (data.learning_outcomes or []) if o and o.strip()]
    course.academic_course_uuid = f"acourse_{uuid4()}"
    course.creation_date = course.update_date = now()
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)
    return await to_read(db_session, course)


async def list_academic_courses(
    org_id: int,
    current_user: Principal,
    db_session: AsyncSession,
    query: Optional[str] = None,
) -> List[AcademicCourseRead]:
    await require_academic_member(current_user, org_id, db_session)
    statement = select(AcademicCourse).where(AcademicCourse.org_id == org_id)
    if query:
        like = f"%{query.strip()}%"
        statement = statement.where(
            AcademicCourse.code.ilike(like) | AcademicCourse.name.ilike(like)  # type: ignore
        )
    courses = (await db_session.execute(statement.order_by(AcademicCourse.code))).scalars().all()  # type: ignore
    return [await to_read(db_session, c) for c in courses]


async def get_academic_course(
    academic_course_uuid: str, current_user: Principal, db_session: AsyncSession
) -> AcademicCourseRead:
    course = await get_by_uuid_or_404(
        db_session, AcademicCourse, AcademicCourse.academic_course_uuid, academic_course_uuid, "Course"
    )
    await require_academic_member(current_user, course.org_id, db_session)
    return await to_read(db_session, course)


async def update_academic_course(
    academic_course_uuid: str, data: AcademicCourseUpdate, current_user: Principal, db_session: AsyncSession
) -> AcademicCourseRead:
    course = await get_by_uuid_or_404(
        db_session, AcademicCourse, AcademicCourse.academic_course_uuid, academic_course_uuid, "Course"
    )
    await require_academic_manager(current_user, course.org_id, db_session)
    update = data.model_dump(exclude_unset=True)
    _validate_numbers(update)
    if "code" in update and update["code"] is not None:
        update["code"] = normalize_code(update["code"], "Course", max_len=20)
        await _assert_code_unique(db_session, course.org_id, update["code"], exclude_id=course.id)
    if "template_course_uuid" in update:
        course.template_course_id = await _resolve_template(
            db_session, course.org_id, update.pop("template_course_uuid")
        )
    if "learning_outcomes" in update:
        course.learning_outcomes = [o for o in (update.pop("learning_outcomes") or []) if o and o.strip()]
    for key, value in update.items():
        setattr(course, key, value)
    course.update_date = now()
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)
    return await to_read(db_session, course)


async def delete_academic_course(
    academic_course_uuid: str, current_user: Principal, db_session: AsyncSession
) -> str:
    course = await get_by_uuid_or_404(
        db_session, AcademicCourse, AcademicCourse.academic_course_uuid, academic_course_uuid, "Course"
    )
    await require_academic_manager(current_user, course.org_id, db_session)
    for model, column in ((CourseOffering, CourseOffering.academic_course_id), (CurriculumItem, CurriculumItem.academic_course_id)):
        used = (
            await db_session.execute(select(func.count()).select_from(model).where(column == course.id))
        ).scalar() or 0
        if used:
            raise conflict("This course is used by curricula or offerings; retire it instead of deleting")
    await db_session.delete(course)
    await db_session.commit()
    return "Course deleted"


async def _prereq_graph(db_session: AsyncSession, org_id: int) -> dict[int, set[int]]:
    rows = (
        await db_session.execute(
            select(CoursePrerequisite.academic_course_id, CoursePrerequisite.prerequisite_id).where(
                CoursePrerequisite.org_id == org_id
            )
        )
    ).all()
    graph: dict[int, set[int]] = {}
    for course_id, prereq_id in rows:
        graph.setdefault(course_id, set()).add(prereq_id)
    return graph


def _reaches(graph: dict[int, set[int]], start: int, target: int) -> bool:
    stack, seen = [start], set()
    while stack:
        node = stack.pop()
        if node == target:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(graph.get(node, ()))
    return False


async def set_prerequisites(
    academic_course_uuid: str,
    prerequisites: List[PrerequisiteSet],
    current_user: Principal,
    db_session: AsyncSession,
) -> AcademicCourseRead:
    """Replace the course's prerequisite list (rejects self-references and cycles)."""
    course = await get_by_uuid_or_404(
        db_session, AcademicCourse, AcademicCourse.academic_course_uuid, academic_course_uuid, "Course"
    )
    await require_academic_manager(current_user, course.org_id, db_session)

    resolved: list[tuple[AcademicCourse, Optional[str]]] = []
    for item in prerequisites:
        prereq = await get_by_uuid_or_404(
            db_session, AcademicCourse, AcademicCourse.academic_course_uuid, item.prerequisite_uuid, "Prerequisite course"
        )
        if prereq.org_id != course.org_id:
            raise bad_request("Prerequisite belongs to another organization")
        if prereq.id == course.id:
            raise bad_request("A course cannot be its own prerequisite")
        resolved.append((prereq, item.min_grade))

    graph = await _prereq_graph(db_session, course.org_id)
    graph[course.id] = {p.id for p, _ in resolved}  # type: ignore[misc]
    for prereq, _ in resolved:
        if _reaches(graph, prereq.id, course.id):  # type: ignore[arg-type]
            raise conflict(f"Adding {prereq.code} would create a prerequisite cycle")

    existing = (
        await db_session.execute(
            select(CoursePrerequisite).where(CoursePrerequisite.academic_course_id == course.id)
        )
    ).scalars().all()
    for row in existing:
        await db_session.delete(row)
    for prereq, min_grade in resolved:
        db_session.add(
            CoursePrerequisite(
                academic_course_id=course.id,
                prerequisite_id=prereq.id,
                min_grade=min_grade,
                org_id=course.org_id,
                creation_date=now(),
            )
        )
    await db_session.commit()
    return await to_read(db_session, course)
