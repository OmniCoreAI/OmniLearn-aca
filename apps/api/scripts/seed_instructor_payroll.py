"""Seed demo instructors, courses, training programs, work logs, and payroll.

Usage (from apps/api):
  .venv/Scripts/python.exe scripts/seed_instructor_payroll.py
  .venv/Scripts/python.exe scripts/seed_instructor_payroll.py --org-slug default --clear

The generated work-log UUIDs use a stable ``seed_payroll_`` prefix so rerunning
the script replaces only its own sample data.
"""
from __future__ import annotations

import argparse
import asyncio
import calendar
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import delete
from sqlmodel import select

from src.core.events.database import _async_session_factory
from src.db.academic.links import TrainingProgramCourse
from src.db.academic.training_programs import TrainingProgram, TrainingType
from src.db.courses.courses import Course, ThumbnailType
from src.db.finance.reporting import FinancePayrollPeriod
from src.db.instructors.finance import InstructorWorkLog
from src.db.instructors.instructors import (
    Instructor,
    InstructorCategory,
    InstructorCategoryLanguageRate,
    InstructorStatus,
)
from src.db.organizations import Organization
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.security import security_hash_password
from src.services.security.password_validation import generate_temporary_password

SEED_PREFIX = "seed_payroll_"
INSTRUCTOR_USERS = (
    ("amina.hassan", "Amina", "Hassan", "amina.hassan@example.com"),
    ("omar.farouk", "Omar", "Farouk", "omar.farouk@example.com"),
    ("salma.adel", "Salma", "Adel", "salma.adel@example.com"),
)
COURSE_DEFINITIONS = (
    (
        "course_demo_governance",
        "Governance and Institutional Integrity",
        "Practical governance frameworks, compliance, and institutional integrity.",
    ),
    (
        "course_demo_integrity",
        "Financial Compliance and Risk Management",
        "Financial controls, risk assessment, and compliance reporting.",
    ),
    (
        "course_demo_investigation",
        "Administrative Investigation Fundamentals",
        "Evidence handling, interviewing, and administrative investigation workflows.",
    ),
)
TRAINING_PROGRAM_DEFINITIONS = (
    (
        "trainingprogram_demo_governance",
        "GOV-BOOTCAMP-2026",
        "Governance Professional Bootcamp",
        TrainingType.BOOTCAMP,
        (0,),
    ),
    (
        "trainingprogram_demo_compliance",
        "FIN-COMPLIANCE-2026",
        "Financial Compliance Workshop",
        TrainingType.WORKSHOP,
        (1,),
    ),
    (
        "trainingprogram_demo_investigation",
        "ADM-INVESTIGATION-2026",
        "Administrative Investigation Seminar",
        TrainingType.SEMINAR,
        (2,),
    ),
)


def _month_shift(value: date, months: int) -> tuple[int, int]:
    month_index = value.year * 12 + value.month - 1 + months
    return month_index // 12, month_index % 12 + 1


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _work_date(year: int, month: int, preferred_day: int) -> str:
    day = min(preferred_day, calendar.monthrange(year, month)[1])
    return date(year, month, day).isoformat()


async def _ensure_resource_author(
    session,
    *,
    resource_uuid: str,
    user_id: int,
    authorship: ResourceAuthorshipEnum,
    now: str,
) -> None:
    author = (
        await session.exec(
            select(ResourceAuthor).where(
                ResourceAuthor.resource_uuid == resource_uuid,
                ResourceAuthor.user_id == user_id,
            )
        )
    ).first()
    if author is None:
        session.add(
            ResourceAuthor(
                resource_uuid=resource_uuid,
                user_id=user_id,
                authorship=authorship,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=now,
                update_date=now,
            )
        )


async def _upsert_instructor_users(
    session,
    *,
    org_id: int,
    now: str,
) -> tuple[list[User], list[tuple[str, str]]]:
    role = (
        await session.exec(
            select(Role).where(Role.role_uuid == "role_global_instructor")
        )
    ).first()
    if role is None or role.id is None:
        raise SystemExit("Global instructor role is missing; run the application setup first")

    users: list[User] = []
    credentials: list[tuple[str, str]] = []
    for username, first_name, last_name, email in INSTRUCTOR_USERS:
        user = (
            await session.exec(select(User).where(User.email == email))
        ).first()
        if user is None:
            temporary_password = generate_temporary_password()
            user = User(
                username=username,
                first_name=first_name,
                last_name=last_name,
                email=email,
                password=security_hash_password(temporary_password),
                user_uuid=f"{SEED_PREFIX}user_{username.replace('.', '_')}",
                email_verified=True,
                email_verified_at=now,
                signup_method="admin_created",
                must_change_password=True,
                creation_date=now,
                update_date=now,
            )
            session.add(user)
            await session.flush()
            credentials.append((email, temporary_password))

        membership = (
            await session.exec(
                select(UserOrganization).where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.org_id == org_id,
                )
            )
        ).first()
        if membership is None:
            session.add(
                UserOrganization(
                    user_id=user.id,
                    org_id=org_id,
                    role_id=role.id,
                    creation_date=now,
                    update_date=now,
                )
            )
        else:
            membership.role_id = role.id
            membership.update_date = now
            session.add(membership)
        users.append(user)
    return users, credentials


async def _upsert_courses(
    session,
    *,
    org_id: int,
    author_ids: list[int],
    now: str,
) -> list[Course]:
    courses: list[Course] = []
    for index, (course_uuid, name, description) in enumerate(COURSE_DEFINITIONS):
        course = (
            await session.exec(
                select(Course).where(
                    Course.org_id == org_id,
                    Course.course_uuid == course_uuid,
                )
            )
        ).first()
        if course is None:
            course = Course(
                org_id=org_id,
                course_uuid=course_uuid,
                name=name,
                description=description,
                about=description,
                learnings="Applied skills, practical exercises, and assessment.",
                tags="governance,compliance,professional-training",
                thumbnail_type=ThumbnailType.IMAGE,
                thumbnail_image="",
                public=True,
                published=True,
                open_to_contributors=False,
                creation_date=now,
                update_date=now,
                extra_metadata={"seeded": True},
            )
            session.add(course)
            await session.flush()
        else:
            course.name = name
            course.description = description
            course.public = True
            course.published = True
            course.update_date = now
            session.add(course)

        await _ensure_resource_author(
            session,
            resource_uuid=course_uuid,
            user_id=author_ids[index % len(author_ids)],
            authorship=ResourceAuthorshipEnum.CREATOR,
            now=now,
        )
        courses.append(course)
    return courses


async def _upsert_training_programs(
    session,
    *,
    org_id: int,
    coordinator_ids: list[int],
    courses: list[Course],
    now: str,
) -> list[TrainingProgram]:
    programs: list[TrainingProgram] = []
    today = date.today()
    for index, (
        program_uuid,
        code,
        name,
        training_type,
        course_indexes,
    ) in enumerate(TRAINING_PROGRAM_DEFINITIONS):
        program = (
            await session.exec(
                select(TrainingProgram).where(
                    TrainingProgram.org_id == org_id,
                    TrainingProgram.trainingprogram_uuid == program_uuid,
                )
            )
        ).first()
        coordinator_id = coordinator_ids[index % len(coordinator_ids)]
        if program is None:
            program = TrainingProgram(
                org_id=org_id,
                trainingprogram_uuid=program_uuid,
                name=name,
                description=f"Demo training program: {name}",
                about="Instructor-led professional training with applied course content.",
                code=code,
                training_type=training_type,
                capacity=30,
                is_paid=True,
                price=12500.0 if index == 0 else 6500.0,
                currency="EGP",
                in_plan=True,
                location="Cairo Training Center",
                start_date=today.isoformat(),
                end_date=date(today.year, 12, 31).isoformat(),
                public=True,
                published=True,
                coordinator_id=coordinator_id,
                creation_date=now,
                update_date=now,
                extra_metadata={"seeded": True},
            )
            session.add(program)
            await session.flush()
        else:
            program.name = name
            program.training_type = training_type
            program.coordinator_id = coordinator_id
            program.public = True
            program.published = True
            program.update_date = now
            session.add(program)

        await _ensure_resource_author(
            session,
            resource_uuid=program_uuid,
            user_id=coordinator_id,
            authorship=ResourceAuthorshipEnum.MAINTAINER,
            now=now,
        )
        for order, course_index in enumerate(course_indexes):
            course = courses[course_index]
            link = (
                await session.exec(
                    select(TrainingProgramCourse).where(
                        TrainingProgramCourse.course_id == course.id
                    )
                )
            ).first()
            if link is None:
                link = TrainingProgramCourse(
                    training_program_id=program.id,
                    course_id=course.id,
                    org_id=org_id,
                    order=order,
                    creation_date=now,
                    update_date=now,
                )
            else:
                link.training_program_id = program.id
                link.order = order
                link.update_date = now
            session.add(link)
        programs.append(program)
    return programs


async def _upsert_category(
    session,
    *,
    org_id: int,
    uuid: str,
    name: str,
    rate: float,
    now: str,
) -> InstructorCategory:
    category = (
        await session.exec(
            select(InstructorCategory).where(
                InstructorCategory.org_id == org_id,
                InstructorCategory.category_uuid == uuid,
            )
        )
    ).first()
    if category is None:
        category = InstructorCategory(
            org_id=org_id,
            category_uuid=uuid,
            name=name,
            description="Demo category generated by payroll seed",
            hourly_rate=rate,
            currency="EGP",
            creation_date=now,
            update_date=now,
        )
        session.add(category)
        await session.flush()
    else:
        category.name = name
        category.hourly_rate = rate
        category.currency = "EGP"
        category.update_date = now
        session.add(category)

    await session.exec(
        delete(InstructorCategoryLanguageRate).where(
            InstructorCategoryLanguageRate.category_id == category.id
        )
    )
    session.add(
        InstructorCategoryLanguageRate(
            category_id=category.id,
            org_id=org_id,
            language="Arabic",
            hourly_rate=rate,
        )
    )
    session.add(
        InstructorCategoryLanguageRate(
            category_id=category.id,
            org_id=org_id,
            language="English",
            hourly_rate=round(rate * 1.25, 2),
        )
    )
    return category


async def seed(org_slug: str, clear: bool) -> None:
    async with _async_session_factory() as session:
        org = (
            await session.exec(
                select(Organization).where(Organization.slug == org_slug)
            )
        ).first()
        if not org or not org.id:
            raise SystemExit(f"Organization {org_slug!r} not found")

        today = date.today()
        months = [_month_shift(today, offset) for offset in (-2, -1, 0)]
        month_keys = [_month_key(year, month) for year, month in months]

        # Always replace the script's own rows to make reruns deterministic.
        await session.exec(
            delete(InstructorWorkLog).where(
                InstructorWorkLog.org_id == org.id,
                InstructorWorkLog.worklog_uuid.startswith(SEED_PREFIX),
            )
        )
        if clear:
            await session.exec(
                delete(FinancePayrollPeriod).where(
                    FinancePayrollPeriod.org_id == org.id,
                    FinancePayrollPeriod.month.in_(month_keys),
                )
            )

        now = str(datetime.now())
        senior = await _upsert_category(
            session,
            org_id=org.id,
            uuid=f"{SEED_PREFIX}category_senior",
            name="Senior Instructor",
            rate=850.0,
            now=now,
        )
        specialist = await _upsert_category(
            session,
            org_id=org.id,
            uuid=f"{SEED_PREFIX}category_specialist",
            name="Subject Specialist",
            rate=650.0,
            now=now,
        )

        users, credentials = await _upsert_instructor_users(
            session, org_id=org.id, now=now
        )

        instructors: list[Instructor] = []
        for index, user in enumerate(users):
            instructor = (
                await session.exec(
                    select(Instructor).where(
                        Instructor.org_id == org.id,
                        Instructor.user_id == user.id,
                    )
                )
            ).first()
            category = senior if index % 2 == 0 else specialist
            if instructor is None:
                instructor = Instructor(
                    org_id=org.id,
                    user_id=user.id,
                    category_id=category.id,
                    department="Training",
                    languages=["Arabic", "English"],
                    contact_info={},
                    hourly_rate=None,
                    status=InstructorStatus.ACTIVE,
                    instructor_uuid=f"{SEED_PREFIX}instructor_{user.id}",
                    creation_date=now,
                    update_date=now,
                    extra_metadata={"seeded": True},
                )
                session.add(instructor)
                await session.flush()
            else:
                instructor.category_id = category.id
                instructor.department = "Training"
                instructor.languages = ["Arabic", "English"]
                instructor.status = InstructorStatus.ACTIVE
                instructor.update_date = now
                session.add(instructor)
            instructors.append(instructor)

        author_ids = [instructor.user_id for instructor in instructors]
        courses = await _upsert_courses(
            session,
            org_id=org.id,
            author_ids=author_ids,
            now=now,
        )
        training_programs = await _upsert_training_programs(
            session,
            org_id=org.id,
            coordinator_ids=author_ids,
            courses=courses,
            now=now,
        )
        course_uuids = [course.course_uuid for course in courses]

        totals: dict[str, tuple[float, float]] = {}
        for month_index, (year, month) in enumerate(months):
            month_hours = 0.0
            month_pay = 0.0
            for instructor_index, instructor in enumerate(instructors):
                category = senior if instructor_index % 2 == 0 else specialist
                base_rate = float(category.hourly_rate or 0)
                plans = (
                    (4 + month_index * 2 + instructor_index, 8, "Arabic", base_rate),
                    (
                        6 + month_index + instructor_index,
                        18,
                        "English",
                        round(base_rate * 1.25, 2),
                    ),
                )
                for log_index, (hours, day, language, rate) in enumerate(plans):
                    amount = round(hours * rate, 2)
                    log = InstructorWorkLog(
                        org_id=org.id,
                        instructor_id=instructor.id,
                        hours=float(hours),
                        language=language,
                        rate_applied=rate,
                        amount=amount,
                        currency="EGP",
                        work_date=_work_date(year, month, day),
                        description=f"Demo {language} training delivery",
                        course_uuid=course_uuids[
                            (month_index + instructor_index + log_index)
                            % len(course_uuids)
                        ],
                        worklog_uuid=(
                            f"{SEED_PREFIX}{year}{month:02d}_"
                            f"{instructor.id}_{log_index}"
                        ),
                        creation_date=now,
                        update_date=now,
                    )
                    session.add(log)
                    month_hours += float(hours)
                    month_pay += amount

            key = _month_key(year, month)
            totals[key] = (month_hours, month_pay)
            period = (
                await session.exec(
                    select(FinancePayrollPeriod).where(
                        FinancePayrollPeriod.org_id == org.id,
                        FinancePayrollPeriod.month == key,
                    )
                )
            ).first()
            is_closed = month_index < len(months) - 1
            if period is None:
                period = FinancePayrollPeriod(
                    org_id=org.id,
                    month=key,
                    creation_date=now,
                    update_date=now,
                )
            period.status = "closed" if is_closed else "open"
            period.total_hours = round(month_hours, 2)
            period.total_pay = round(month_pay, 2)
            period.currency = "EGP"
            period.closed_at = now if is_closed else None
            period.update_date = now
            session.add(period)

        await session.commit()

        print(
            f"Seeded {len(instructors)} instructors and "
            f"{len(instructors) * 2 * len(months)} work logs for org "
            f"{org.slug!r} (id={org.id})"
        )
        print(
            f"Seeded {len(courses)} courses and "
            f"{len(training_programs)} training programs"
        )
        for month, (hours, pay) in totals.items():
            print(f"  {month}: {hours:,.1f} hours, {pay:,.2f} EGP")
        if credentials:
            print("New instructor temporary credentials (shown once):")
            for email, password in credentials:
                print(f"  {email}: {password}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed instructor costs and monthly payroll data"
    )
    parser.add_argument("--org-slug", default="default")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Replace payroll period rows for the generated months",
    )
    args = parser.parse_args()
    asyncio.run(seed(args.org_slug, args.clear))


if __name__ == "__main__":
    main()
