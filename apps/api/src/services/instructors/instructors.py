"""Instructor service — CRUD for the User-extension instructor profile.

Besides the profile (bio, expertise, availability, photo), this module owns:
- creating the platform account on the fly for a brand-new instructor,
- the academy's approval of instructors invited by an entity coordinator,
- linking an instructor to the courses they teach (via the course academic
  profile, which also grants maintainer authorship on the course).
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.academic.course_profiles import CourseAcademicProfile
from src.db.academic.offerings import CourseOffering
from src.db.courses.courses import Course
from src.db.instructors.instructors import (
    Instructor,
    InstructorApprove,
    InstructorCategory,
    InstructorCourseRead,
    InstructorCreate,
    InstructorOption,
    InstructorRead,
    InstructorStatus,
    InstructorUpdate,
)
from src.db.organizations import Organization
from src.db.resource_authors import ResourceAuthor
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.security.rbac.constants import INSTRUCTOR_ROLE_ID, TRAINEE_ROLE_ID
from src.services.academic.authors import ensure_coordinator_authorship, get_user_author
from src.services.academic.validation import resolve_org_user
from src.services.administration.authz import require_org_member
from src.services.instructors.authz import authorize_instructor_management
from src.services.instructors.categories import _to_read as _category_to_read
from src.services.instructors.validation import (
    resolve_effective_rate,
    validate_instructor_payload,
)
from src.services.utils.upload_content import upload_file

AnyUser = PublicUser | AnonymousUser | APITokenUser


async def _get_instructor_or_404(db_session: AsyncSession, instructor_uuid: str) -> Instructor:
    instructor = (
        await db_session.execute(
            select(Instructor).where(Instructor.instructor_uuid == instructor_uuid)
        )
    ).scalars().first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor


async def _resolve_category_id(
    db_session: AsyncSession, org_id: int, category_uuid: Optional[str]
) -> Optional[int]:
    if not category_uuid:
        return None
    category = (
        await db_session.execute(
            select(InstructorCategory).where(InstructorCategory.category_uuid == category_uuid)
        )
    ).scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Instructor category not found")
    if category.org_id != org_id:
        raise HTTPException(status_code=400, detail="Category belongs to a different organization")
    return category.id


async def _to_read(db_session: AsyncSession, instructor: Instructor) -> InstructorRead:
    user = await get_user_author(db_session, instructor.user_id)
    category = None
    if instructor.category_id is not None:
        cat = (
            await db_session.execute(
                select(InstructorCategory).where(InstructorCategory.id == instructor.category_id)
            )
        ).scalars().first()
        if cat:
            category = await _category_to_read(db_session, cat)
    rate = source = currency = None
    try:
        rate, source, currency = await resolve_effective_rate(db_session, instructor, None)
    except HTTPException:
        pass  # no rate configured yet — shown as "—"
    return InstructorRead(
        **instructor.model_dump(),
        user=user,
        category=category,
        effective_hourly_rate=rate,
        rate_source=source,
        rate_currency=currency,
    )


async def _promote_to_instructor_role(db_session: AsyncSession, org_id: int, user_id: int) -> None:
    """Give a plain Trainee the Instructor role. Never downgrades other roles."""
    membership = (
        await db_session.execute(
            select(UserOrganization).where(
                UserOrganization.org_id == org_id, UserOrganization.user_id == user_id
            )
        )
    ).scalars().first()
    if membership and membership.role_id == TRAINEE_ROLE_ID:
        membership.role_id = INSTRUCTOR_ROLE_ID
        membership.update_date = str(datetime.now())
        db_session.add(membership)


async def create_instructor(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
    payload: InstructorCreate,
) -> InstructorRead:
    await authorize_instructor_management(db_session, current_user, org_id, "create")

    org = (
        await db_session.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    validate_instructor_payload(payload.model_dump())
    category_id = await _resolve_category_id(db_session, org_id, payload.category_uuid)

    temporary_password = None
    if payload.new_user is not None:
        if payload.user_uuid:
            raise HTTPException(status_code=400, detail="Provide either an existing user or a new user, not both")
        # Imported lazily: orgs.users pulls in the invite/email stack.
        from src.services.orgs.users import provision_org_user

        new_user = payload.new_user
        if not (new_user.first_name or "").strip() or "@" not in (new_user.email or ""):
            raise HTTPException(status_code=400, detail="A new instructor needs a name and a valid email")
        user, temporary_password = await provision_org_user(
            db_session,
            org_id,
            email=new_user.email,
            first_name=new_user.first_name.strip(),
            last_name=(new_user.last_name or "").strip(),
            role_id=INSTRUCTOR_ROLE_ID,
            extra_metadata={"phone": new_user.phone.strip()} if (new_user.phone or "").strip() else None,
        )
        user_id = user.id
    else:
        user_id = await resolve_org_user(db_session, org_id, payload.user_uuid, label="Instructor user")
        if not user_id:
            raise HTTPException(status_code=400, detail="A valid user is required for an instructor")

    # Enforce 1:1 (org, user) with a friendly error before hitting the constraint.
    existing = (
        await db_session.execute(
            select(Instructor).where(
                Instructor.org_id == org_id, Instructor.user_id == user_id
            )
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            status_code=409, detail="This user is already an instructor in this organization"
        )

    status = payload.status or InstructorStatus.ACTIVE
    instructor = Instructor(
        department=payload.department,
        languages=payload.languages,
        contact_info=payload.contact_info,
        hourly_rate=payload.hourly_rate,
        status=status,
        bio=payload.bio,
        specializations=payload.specializations,
        availability=payload.availability,
        org_id=org_id,
        user_id=user_id,
        category_id=category_id,
        instructor_uuid=f"instructor_{uuid4()}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        extra_metadata=payload.extra_metadata,
    )
    db_session.add(instructor)
    if status != InstructorStatus.PENDING_APPROVAL:
        await _promote_to_instructor_role(db_session, org_id, user_id)
    await db_session.commit()
    await db_session.refresh(instructor)
    read = await _to_read(db_session, instructor)
    read.temporary_password = temporary_password
    return read


async def list_instructors(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
) -> List[InstructorRead]:
    await authorize_instructor_management(db_session, current_user, org_id, "read")
    instructors = (
        await db_session.execute(
            select(Instructor)
            .where(Instructor.org_id == org_id)
            .order_by(Instructor.creation_date.desc())  # type: ignore
        )
    ).scalars().all()
    return [await _to_read(db_session, i) for i in instructors]


async def list_instructor_options(
    db_session: AsyncSession,
    current_user: AnyUser,
    org_id: int,
) -> List[InstructorOption]:
    """Active instructors for pickers — any org member, names only (no rates)."""
    await require_org_member(db_session, current_user, org_id)
    rows = (
        await db_session.execute(
            select(Instructor, User, InstructorCategory)
            .join(User, User.id == Instructor.user_id)  # type: ignore[arg-type]
            .join(InstructorCategory, InstructorCategory.id == Instructor.category_id, isouter=True)  # type: ignore[arg-type]
            .where(Instructor.org_id == org_id, Instructor.status == InstructorStatus.ACTIVE)
        )
    ).all()
    options = [
        InstructorOption(
            instructor_uuid=inst.instructor_uuid,
            user_uuid=user.user_uuid,
            name=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
            category_name=cat.name if cat else None,
            specializations=inst.specializations or [],
        )
        for inst, user, cat in rows
    ]
    return sorted(options, key=lambda o: o.name.lower())


async def get_instructor(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
) -> InstructorRead:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "read")
    return await _to_read(db_session, instructor)


async def update_instructor(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
    payload: InstructorUpdate,
) -> InstructorRead:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "update")

    data = payload.model_dump(exclude_unset=True)
    validate_instructor_payload({**instructor.model_dump(), **data})

    if "category_uuid" in data:
        instructor.category_id = await _resolve_category_id(
            db_session, instructor.org_id, data.pop("category_uuid")
        )

    for key, value in data.items():
        setattr(instructor, key, value)
    instructor.update_date = str(datetime.now())

    db_session.add(instructor)
    if data.get("status") == InstructorStatus.ACTIVE:
        await _promote_to_instructor_role(db_session, instructor.org_id, instructor.user_id)
    await db_session.commit()
    await db_session.refresh(instructor)
    return await _to_read(db_session, instructor)


async def approve_instructor(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
    payload: InstructorApprove,
) -> InstructorRead:
    """Activate a pending instructor, setting category/rate and the Instructor role."""
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "update")
    if instructor.status != InstructorStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=409, detail="This instructor is not pending approval")
    validate_instructor_payload({"hourly_rate": payload.hourly_rate})
    instructor.category_id = await _resolve_category_id(
        db_session, instructor.org_id, payload.category_uuid
    )
    instructor.hourly_rate = payload.hourly_rate
    instructor.status = InstructorStatus.ACTIVE
    instructor.update_date = str(datetime.now())
    db_session.add(instructor)
    await _promote_to_instructor_role(db_session, instructor.org_id, instructor.user_id)
    await db_session.commit()
    await db_session.refresh(instructor)
    return await _to_read(db_session, instructor)


async def upload_instructor_image(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
    image: UploadFile,
) -> InstructorRead:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "update")
    org = await db_session.get(Organization, instructor.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    instructor.profile_image = await upload_file(
        file=image,
        directory=f"instructors/{instructor.instructor_uuid}/images",
        type_of_dir="orgs",
        uuid=org.org_uuid,
        allowed_types=["image"],
        filename_prefix="instructor",
    )
    instructor.update_date = str(datetime.now())
    db_session.add(instructor)
    await db_session.commit()
    await db_session.refresh(instructor)
    return await _to_read(db_session, instructor)


async def delete_instructor(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
) -> str:
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "delete")
    await db_session.delete(instructor)
    await db_session.commit()
    return "Instructor deleted"


# ---------------------------------------------------------------------------
# Instructor ↔ courses
# ---------------------------------------------------------------------------


async def list_instructor_courses(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
) -> List[InstructorCourseRead]:
    """Courses the instructor teaches (profile/offering) or co-authors."""
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "read")
    user_id = instructor.user_id
    seen: dict[str, InstructorCourseRead] = {}

    def add(course: Course, source: str) -> None:
        if course.course_uuid not in seen:
            seen[course.course_uuid] = InstructorCourseRead(
                course_uuid=course.course_uuid,
                name=course.name,
                published=bool(course.published),
                source=source,
            )

    for course in (
        await db_session.execute(
            select(Course)
            .join(CourseAcademicProfile, CourseAcademicProfile.course_id == Course.id)  # type: ignore[arg-type]
            .where(CourseAcademicProfile.instructor_id == user_id, Course.org_id == instructor.org_id)
        )
    ).scalars().all():
        add(course, "profile")

    for course in (
        await db_session.execute(
            select(Course)
            .join(CourseOffering, CourseOffering.content_course_id == Course.id)  # type: ignore[arg-type]
            .where(
                (CourseOffering.instructor_id == user_id)
                | (CourseOffering.teaching_assistant_id == user_id),
                Course.org_id == instructor.org_id,
            )
        )
    ).scalars().all():
        add(course, "offering")

    for course in (
        await db_session.execute(
            select(Course)
            .join(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)  # type: ignore[arg-type]
            .where(ResourceAuthor.user_id == user_id, Course.org_id == instructor.org_id)
        )
    ).scalars().all():
        add(course, "author")

    return sorted(seen.values(), key=lambda c: c.name.lower())


async def _course_in_org_or_404(db_session: AsyncSession, course_uuid: str, org_id: int) -> Course:
    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course or course.org_id != org_id:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


async def assign_instructor_course(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
    course_uuid: str,
) -> List[InstructorCourseRead]:
    """Make the instructor the course's instructor (academic profile) + co-author."""
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "update")
    if instructor.status != InstructorStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Only active instructors can be assigned to courses")
    course = await _course_in_org_or_404(db_session, course_uuid, instructor.org_id)

    profile = (
        await db_session.execute(
            select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id)
        )
    ).scalars().first()
    if not profile:
        profile = CourseAcademicProfile(
            course_id=course.id,
            org_id=course.org_id,
            profile_uuid=f"courseprofile_{uuid4()}",
            creation_date=str(datetime.now()),
        )
    profile.instructor_id = instructor.user_id
    profile.update_date = str(datetime.now())
    db_session.add(profile)
    await ensure_coordinator_authorship(db_session, course.course_uuid, instructor.user_id)
    await db_session.commit()
    return await list_instructor_courses(db_session, current_user, instructor_uuid)


async def unassign_instructor_course(
    db_session: AsyncSession,
    current_user: AnyUser,
    instructor_uuid: str,
    course_uuid: str,
) -> List[InstructorCourseRead]:
    """Clear the course's instructor. Authorship is kept (it may predate the link)."""
    instructor = await _get_instructor_or_404(db_session, instructor_uuid)
    await authorize_instructor_management(db_session, current_user, instructor.org_id, "update")
    course = await _course_in_org_or_404(db_session, course_uuid, instructor.org_id)
    profile = (
        await db_session.execute(
            select(CourseAcademicProfile).where(CourseAcademicProfile.course_id == course.id)
        )
    ).scalars().first()
    if profile and profile.instructor_id == instructor.user_id:
        profile.instructor_id = None
        profile.update_date = str(datetime.now())
        db_session.add(profile)
        await db_session.commit()
    return await list_instructor_courses(db_session, current_user, instructor_uuid)
