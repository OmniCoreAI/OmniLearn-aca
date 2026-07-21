"""Seed a coherent finance ecosystem linked to real academic entities.

Creates / refreshes:
  - postgraduate programs + cohorts + semesters + dedicated courses
  - course finance configs, ledger revenue/expenses, refunds
  - instructor work-log costs tied to the same courses
  - monthly payroll periods

Usage (from apps/api):
  .venv/Scripts/python.exe scripts/seed_finance_ecosystem.py --org-slug default --clear
"""
from __future__ import annotations

import argparse
import asyncio
import calendar
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import delete, text
from sqlmodel import select

from src.core.events.database import _async_session_factory
from src.db.academic.cohorts import Cohort, CohortStatus
from src.db.academic.links import SemesterCourse
from src.db.academic.programs import Program, ProgramLevel, ProgramStatus
from src.db.academic.semesters import Semester
from src.db.academic.training_programs import TrainingProgram
from src.db.courses.courses import Course, ThumbnailType
from src.db.finance.ledger import FinanceLedgerEntry
from src.db.finance.reporting import FinanceCourseConfig, FinancePayrollPeriod, FinanceRefund
from src.db.instructors.finance import InstructorWorkLog
from src.db.instructors.instructors import Instructor
from src.db.organizations import Organization
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import User

SEED_PREFIX = "seed_eco_"
DEMO_PROGRAM_PREFIX = "program_pg_"
DEMO_TRAINING_PREFIX = "trainingprogram_demo_"
TRAINING_PROGRAM_COURSE_MAP = {
    "trainingprogram_demo_governance": "course_demo_governance",
    "trainingprogram_demo_compliance": "course_demo_integrity",
    "trainingprogram_demo_investigation": "course_demo_investigation",
}
POSTGRADUATE_PROGRAM_COURSE_MAP = {
    "program_pg_masters_governance": (
        "course_pg_policy_analysis",
        "course_pg_public_finance",
    ),
    "program_pg_diploma_compliance": ("course_pg_compliance_systems",),
}


def _now() -> str:
    return str(datetime.now())


def _month_shift(value: date, months: int) -> tuple[int, int]:
    month_index = value.year * 12 + value.month - 1 + months
    return month_index // 12, month_index % 12 + 1


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _work_date(year: int, month: int, preferred_day: int) -> str:
    day = min(preferred_day, calendar.monthrange(year, month)[1])
    return date(year, month, day).isoformat()


async def _ensure_author(session, *, resource_uuid: str, user_id: int, now: str) -> None:
    existing = (
        await session.exec(
            select(ResourceAuthor).where(
                ResourceAuthor.resource_uuid == resource_uuid,
                ResourceAuthor.user_id == user_id,
            )
        )
    ).first()
    if existing is None:
        session.add(
            ResourceAuthor(
                resource_uuid=resource_uuid,
                user_id=user_id,
                authorship=ResourceAuthorshipEnum.CREATOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=now,
                update_date=now,
            )
        )


async def _upsert_course(
    session,
    *,
    org_id: int,
    course_uuid: str,
    name: str,
    description: str,
    author_id: int,
    now: str,
) -> Course:
    course = (
        await session.exec(
            select(Course).where(Course.org_id == org_id, Course.course_uuid == course_uuid)
        )
    ).first()
    if course is None:
        course = Course(
            org_id=org_id,
            course_uuid=course_uuid,
            name=name,
            description=description,
            about=description,
            learnings="Applied skills and assessed outcomes.",
            tags="finance,academic,training",
            thumbnail_type=ThumbnailType.IMAGE,
            public=True,
            published=True,
            open_to_contributors=False,
            creation_date=now,
            update_date=now,
            extra_metadata={"seeded": True, "ecosystem": True},
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
    await _ensure_author(session, resource_uuid=course_uuid, user_id=author_id, now=now)
    return course


async def _upsert_postgraduate(
    session,
    *,
    org_id: int,
    author_id: int,
    now: str,
) -> tuple[list[Program], list[Course]]:
    """Create masters/diploma programs with cohort/semester and dedicated courses."""
    specs = [
        {
            "program_uuid": f"{DEMO_PROGRAM_PREFIX}masters_governance",
            "code": "PG-MA-GOV-2026",
            "name": "Master of Public Governance",
            "level": ProgramLevel.MASTERS,
            "price": 85000.0,
            "courses": [
                (
                    "course_pg_policy_analysis",
                    "Policy Analysis and Evaluation",
                    "Methods for evaluating public policy outcomes.",
                ),
                (
                    "course_pg_public_finance",
                    "Public Finance and Budgeting",
                    "Budget cycles, fiscal controls, and public expenditure.",
                ),
            ],
        },
        {
            "program_uuid": f"{DEMO_PROGRAM_PREFIX}diploma_compliance",
            "code": "PG-DIP-COMP-2026",
            "name": "Professional Diploma in Institutional Compliance",
            "level": ProgramLevel.DIPLOMA,
            "price": 42000.0,
            "courses": [
                (
                    "course_pg_compliance_systems",
                    "Compliance Systems Design",
                    "Building internal compliance frameworks and controls.",
                ),
            ],
        },
    ]

    programs: list[Program] = []
    courses: list[Course] = []
    today = date.today()

    for spec in specs:
        program = (
            await session.exec(
                select(Program).where(
                    Program.org_id == org_id,
                    Program.program_uuid == spec["program_uuid"],
                )
            )
        ).first()
        if program is None:
            program = Program(
                org_id=org_id,
                program_uuid=spec["program_uuid"],
                name=spec["name"],
                description=f"Postgraduate program: {spec['name']}",
                about="Academic postgraduate pathway with assessed courses.",
                code=spec["code"],
                program_level=spec["level"],
                status=ProgramStatus.ACTIVE,
                capacity=40,
                is_paid=True,
                price=spec["price"],
                currency="EGP",
                in_plan=True,
                start_date=today.isoformat(),
                end_date=date(today.year + 1, 6, 30).isoformat(),
                public=True,
                published=True,
                coordinator_id=author_id,
                creation_date=now,
                update_date=now,
                extra_metadata={"seeded": True, "ecosystem": True},
            )
            session.add(program)
            await session.flush()
        else:
            program.name = spec["name"]
            program.status = ProgramStatus.ACTIVE
            program.published = True
            program.public = True
            program.price = spec["price"]
            program.coordinator_id = author_id
            program.update_date = now
            session.add(program)

        await _ensure_author(
            session, resource_uuid=program.program_uuid, user_id=author_id, now=now
        )

        cohort_uuid = f"{SEED_PREFIX}cohort_{spec['code'].lower()}"
        cohort = (
            await session.exec(
                select(Cohort).where(
                    Cohort.org_id == org_id,
                    Cohort.cohort_uuid == cohort_uuid,
                )
            )
        ).first()
        if cohort is None:
            cohort = Cohort(
                org_id=org_id,
                program_id=program.id,
                cohort_uuid=cohort_uuid,
                name=f"{spec['name']} — Cohort 2026",
                description="Active postgraduate cohort",
                academic_year="2025/2026",
                capacity=35,
                start_date=today.isoformat(),
                end_date=date(today.year + 1, 6, 30).isoformat(),
                status=CohortStatus.ACTIVE,
                coordinator_id=author_id,
                creation_date=now,
                update_date=now,
                extra_metadata={"seeded": True},
            )
            session.add(cohort)
            await session.flush()

        semester_uuid = f"{SEED_PREFIX}semester_{spec['code'].lower()}"
        semester = (
            await session.exec(
                select(Semester).where(
                    Semester.org_id == org_id,
                    Semester.semester_uuid == semester_uuid,
                )
            )
        ).first()
        if semester is None:
            semester = Semester(
                org_id=org_id,
                cohort_id=cohort.id,
                program_id=program.id,
                semester_uuid=semester_uuid,
                name="Semester 1",
                description="First semester of the postgraduate pathway",
                order=1,
                start_date=today.isoformat(),
                end_date=date(today.year, 12, 31).isoformat(),
                creation_date=now,
                update_date=now,
                extra_metadata={"seeded": True},
            )
            session.add(semester)
            await session.flush()

        for order, (course_uuid, name, description) in enumerate(spec["courses"]):
            course = await _upsert_course(
                session,
                org_id=org_id,
                course_uuid=course_uuid,
                name=name,
                description=description,
                author_id=author_id,
                now=now,
            )
            courses.append(course)
            # SemesterCourse.course_id is globally unique — detach any prior link first.
            old_link = (
                await session.exec(
                    select(SemesterCourse).where(SemesterCourse.course_id == course.id)
                )
            ).first()
            if old_link and old_link.semester_id != semester.id:
                await session.delete(old_link)
                await session.flush()
                old_link = None
            if old_link is None:
                session.add(
                    SemesterCourse(
                        semester_id=semester.id,
                        course_id=course.id,
                        org_id=org_id,
                        order=order,
                        code=f"{spec['code']}-C{order + 1}",
                        credit_hours=3.0,
                        creation_date=now,
                        update_date=now,
                    )
                )
            else:
                old_link.order = order
                old_link.update_date = now
                session.add(old_link)

        programs.append(program)

    return programs, courses


async def _load_training_entities(session, org_id: int) -> tuple[list[TrainingProgram], list[Course]]:
    programs = (
        await session.exec(
            select(TrainingProgram).where(
                TrainingProgram.org_id == org_id,
                TrainingProgram.trainingprogram_uuid.startswith(DEMO_TRAINING_PREFIX),
            ).order_by(TrainingProgram.trainingprogram_uuid)
        )
    ).all()
    courses = (
        await session.exec(
            select(Course).where(
                Course.org_id == org_id,
                Course.course_uuid.startswith("course_demo_"),
            ).order_by(Course.course_uuid)
        )
    ).all()
    return list(programs), list(courses)


def _build_ledger_rows(
    *,
    org_id: int,
    created_by: int | None,
    training_programs: list[TrainingProgram],
    pg_programs: list[Program],
    training_courses: list[Course],
    pg_courses: list[Course],
    instructors: list[Instructor],
    instructor_names: dict[int, str],
) -> list[FinanceLedgerEntry]:
    today = date.today()
    rows: list[FinanceLedgerEntry] = []
    now = _now()
    course_by_uuid = {
        course.course_uuid: course for course in [*training_courses, *pg_courses]
    }

    def add(
        *,
        entry_type: str,
        category: str,
        title: str,
        amount: float,
        days_ago: int,
        method: str,
        description: str,
        course_uuid: str | None = None,
    ) -> None:
        rows.append(
            FinanceLedgerEntry(
                org_id=org_id,
                entry_uuid=f"{SEED_PREFIX}fin_{uuid4().hex[:12]}",
                entry_type=entry_type,
                category=category,
                title=title,
                amount=round(amount, 2),
                currency="EGP",
                entry_date=(today + timedelta(days=days_ago)).isoformat(),
                description=description,
                payment_method=method,
                status="recorded",
                offer_uuid=None,
                course_uuid=course_uuid,
                created_by=created_by,
                creation_date=now,
                update_date=now,
            )
        )

    # --- Training program tuition / registration ---
    for i, program in enumerate(training_programs):
        linked_course = course_by_uuid.get(
            TRAINING_PROGRAM_COURSE_MAP.get(program.trainingprogram_uuid, "")
        )
        price = float(program.price or 6500)
        attendees = 18 + i * 4
        add(
            entry_type="revenue",
            category="tuition",
            title=f"Tuition — {program.name} (cohort intake)",
            amount=price * attendees,
            days_ago=-(70 - i * 12),
            method="bank_transfer",
            description=(
                f"Tuition collections for training program {program.code or program.trainingprogram_uuid}"
            ),
            course_uuid=linked_course.course_uuid if linked_course else None,
        )
        add(
            entry_type="revenue",
            category="registration",
            title=f"Registration fees — {program.name}",
            amount=750.0 * attendees,
            days_ago=-(65 - i * 12),
            method="card",
            description=f"Registration fees for {program.name}",
            course_uuid=linked_course.course_uuid if linked_course else None,
        )

    # --- Postgraduate tuition ---
    for i, program in enumerate(pg_programs):
        program_course_uuids = POSTGRADUATE_PROGRAM_COURSE_MAP.get(
            program.program_uuid, ()
        )
        linked_course = course_by_uuid.get(
            program_course_uuids[0] if program_course_uuids else ""
        )
        price = float(program.price or 40000)
        students = 12 + i * 3
        add(
            entry_type="revenue",
            category="tuition",
            title=f"Postgraduate tuition — {program.name}",
            amount=price * students,
            days_ago=-(55 - i * 10),
            method="bank_transfer",
            description=(
                f"Semester tuition for postgraduate program {program.code or program.program_uuid}"
            ),
            course_uuid=linked_course.course_uuid if linked_course else None,
        )
        add(
            entry_type="revenue",
            category="registration",
            title=f"Postgraduate registration — {program.name}",
            amount=1500.0 * students,
            days_ago=-(50 - i * 10),
            method="cash",
            description=f"Registration and admission fees for {program.name}",
            course_uuid=linked_course.course_uuid if linked_course else None,
        )

    # --- Per-course add-on / certification revenue ---
    for i, course in enumerate([*training_courses, *pg_courses]):
        add(
            entry_type="revenue",
            category="offer",
            title=f"Certification & materials — {course.name}",
            amount=3500.0 + i * 800,
            days_ago=-(30 - i * 3),
            method="card",
            description=f"Course add-ons and certification fees for {course.course_uuid}",
            course_uuid=course.course_uuid,
        )

    # --- Operating expenses named against real offerings ---
    if training_programs:
        add(
            entry_type="expense",
            category="marketing",
            title=f"Marketing campaign — {training_programs[0].name}",
            amount=18500,
            days_ago=-60,
            method="card",
            description=f"Digital and print campaign for {training_programs[0].code}",
            course_uuid=training_courses[0].course_uuid if training_courses else None,
        )
        add(
            entry_type="expense",
            category="rent",
            title=f"Venue hire — {training_programs[0].name}",
            amount=22000,
            days_ago=-45,
            method="bank_transfer",
            description=f"Training venue for {training_programs[0].name}",
            course_uuid=training_courses[0].course_uuid if training_courses else None,
        )
    if pg_programs:
        add(
            entry_type="expense",
            category="tools",
            title=f"LMS & research tools — {pg_programs[0].name}",
            amount=9200,
            days_ago=-40,
            method="card",
            description=f"Platform licences for postgraduate program {pg_programs[0].code}",
            course_uuid=pg_courses[0].course_uuid if pg_courses else None,
        )
        add(
            entry_type="expense",
            category="travel",
            title=f"External examiners travel — {pg_programs[0].name}",
            amount=6400,
            days_ago=-20,
            method="cash",
            description=f"Travel support for {pg_programs[0].name}",
            course_uuid=pg_courses[0].course_uuid if pg_courses else None,
        )

    # Instructor support expenses (cash extras beyond work-log payroll)
    for instructor in instructors[:3]:
        name = instructor_names.get(instructor.id or 0, "Instructor")
        course = (training_courses or pg_courses)[
            instructors.index(instructor) % max(len(training_courses or pg_courses), 1)
        ] if (training_courses or pg_courses) else None
        add(
            entry_type="expense",
            category="salaries",
            title=f"Instructor support stipend — {name}",
            amount=8500,
            days_ago=-15 - instructors.index(instructor),
            method="bank_transfer",
            description=f"Support stipend for instructor {instructor.instructor_uuid}",
            course_uuid=course.course_uuid if course else None,
        )

    add(
        entry_type="expense",
        category="other",
        title="Shared academic administration overhead",
        amount=12000,
        days_ago=-5,
        method="bank_transfer",
        description="Shared overhead across training and postgraduate offerings",
    )
    return rows


async def _seed_configs_and_refunds(
    session,
    *,
    org_id: int,
    courses: list[Course],
    training_programs: list[TrainingProgram],
    pg_programs: list[Program],
    created_by: int | None,
    now: str,
) -> tuple[int, int]:
    tuition_by_course: dict[str, float] = {}
    for program in training_programs:
        course_uuid = TRAINING_PROGRAM_COURSE_MAP.get(
            program.trainingprogram_uuid
        )
        if course_uuid:
            tuition_by_course[course_uuid] = float(program.price or 6500)
    for program in pg_programs:
        course_uuids = POSTGRADUATE_PROGRAM_COURSE_MAP.get(
            program.program_uuid, ()
        )
        per_course_tuition = float(program.price or 42000) / max(
            len(course_uuids), 1
        )
        for course_uuid in course_uuids:
            tuition_by_course[course_uuid] = per_course_tuition

    configs = 0
    for i, course in enumerate(courses):
        existing = (
            await session.exec(
                select(FinanceCourseConfig).where(
                    FinanceCourseConfig.org_id == org_id,
                    FinanceCourseConfig.course_uuid == course.course_uuid,
                )
            )
        ).first()
        attendees = 16 + i * 4
        tuition = tuition_by_course.get(course.course_uuid, 6500.0)
        if existing is None:
            existing = FinanceCourseConfig(
                org_id=org_id,
                course_uuid=course.course_uuid,
                config_uuid=f"{SEED_PREFIX}fcc_{uuid4().hex[:10]}",
                creation_date=now,
                update_date=now,
            )
        existing.currency = "EGP"
        existing.tuition_unit_amount = tuition
        existing.certification_unit_cost = 250.0
        existing.addons_unit_cost = 400.0
        existing.other_fixed_cost = 3500.0 + i * 500
        existing.attendees_override = attendees
        existing.certified_attendees_override = max(attendees - 2, 0)
        existing.update_date = now
        session.add(existing)
        configs += 1

    await session.flush()

    revenues = (
        await session.exec(
            select(FinanceLedgerEntry)
            .where(
                FinanceLedgerEntry.org_id == org_id,
                FinanceLedgerEntry.entry_type == "revenue",
                FinanceLedgerEntry.entry_uuid.startswith(SEED_PREFIX),
            )
            .order_by(FinanceLedgerEntry.id)
        )
    ).all()

    refunds = 0
    statuses = ["pending", "approved", "recorded", "rejected"]
    for i, entry in enumerate(revenues[:4]):
        status = statuses[i % len(statuses)]
        amount = round(min(float(entry.amount or 0) * 0.08, 12000.0), 2)
        session.add(
            FinanceRefund(
                org_id=org_id,
                refund_uuid=f"{SEED_PREFIX}ref_{uuid4().hex[:10]}",
                entry_uuid=entry.entry_uuid,
                amount=amount,
                currency=entry.currency or "EGP",
                reason=f"Partial withdrawal from {entry.title}",
                status=status,
                decided_by=created_by if status != "pending" else None,
                decided_at=now if status != "pending" else None,
                decision_note="Ecosystem seed decision" if status != "pending" else None,
                created_by=created_by,
                creation_date=now,
                update_date=now,
            )
        )
        refunds += 1
    return configs, refunds


async def _seed_instructor_costs(
    session,
    *,
    org_id: int,
    instructors: list[Instructor],
    courses: list[Course],
    now: str,
) -> dict[str, tuple[float, float]]:
    await session.exec(
        delete(InstructorWorkLog).where(
            InstructorWorkLog.org_id == org_id,
            InstructorWorkLog.worklog_uuid.startswith(SEED_PREFIX),
        )
    )
    # Also clear previous payroll-seed worklogs so payroll totals match this ecosystem.
    await session.exec(
        delete(InstructorWorkLog).where(
            InstructorWorkLog.org_id == org_id,
            InstructorWorkLog.worklog_uuid.startswith("seed_payroll_"),
        )
    )

    today = date.today()
    months = [_month_shift(today, offset) for offset in (-2, -1, 0)]
    totals: dict[str, tuple[float, float]] = {}
    rates = [850.0, 650.0, 750.0]

    for month_index, (year, month) in enumerate(months):
        month_hours = 0.0
        month_pay = 0.0
        for instructor_index, instructor in enumerate(instructors):
            rate = rates[instructor_index % len(rates)]
            plans = (
                (5 + month_index + instructor_index, 7, "Arabic", rate),
                (4 + month_index, 16, "English", round(rate * 1.2, 2)),
            )
            for log_index, (hours, day, language, applied) in enumerate(plans):
                course = courses[(instructor_index + log_index + month_index) % len(courses)]
                amount = round(hours * applied, 2)
                session.add(
                    InstructorWorkLog(
                        org_id=org_id,
                        instructor_id=instructor.id,
                        hours=float(hours),
                        language=language,
                        rate_applied=applied,
                        amount=amount,
                        currency="EGP",
                        work_date=_work_date(year, month, day),
                        description=f"{language} delivery for {course.name}",
                        course_uuid=course.course_uuid,
                        worklog_uuid=(
                            f"{SEED_PREFIX}{year}{month:02d}_"
                            f"{instructor.id}_{log_index}"
                        ),
                        creation_date=now,
                        update_date=now,
                    )
                )
                month_hours += float(hours)
                month_pay += amount
        key = _month_key(year, month)
        totals[key] = (round(month_hours, 2), round(month_pay, 2))

        period = (
            await session.exec(
                select(FinancePayrollPeriod).where(
                    FinancePayrollPeriod.org_id == org_id,
                    FinancePayrollPeriod.month == key,
                )
            )
        ).first()
        is_closed = month_index < len(months) - 1
        if period is None:
            period = FinancePayrollPeriod(
                org_id=org_id,
                month=key,
                creation_date=now,
                update_date=now,
            )
        period.status = "closed" if is_closed else "open"
        period.total_hours = totals[key][0]
        period.total_pay = totals[key][1]
        period.currency = "EGP"
        period.closed_at = now if is_closed else None
        period.update_date = now
        session.add(period)

    return totals


async def seed(org_slug: str, clear: bool) -> None:
    async with _async_session_factory() as session:
        org = (
            await session.exec(select(Organization).where(Organization.slug == org_slug))
        ).first()
        if not org or not org.id:
            raise SystemExit(f"Organization {org_slug!r} not found")

        admin = (
            await session.exec(select(User).where(User.email == "dev@test.com"))
        ).first()
        if admin is None:
            admin = (
                await session.exec(
                    select(User)
                    .join(Instructor, Instructor.user_id == User.id)
                    .where(Instructor.org_id == org.id)
                    .limit(1)
                )
            ).first()
        created_by = admin.id if admin else None
        now = _now()

        instructors = (
            await session.exec(
                select(Instructor)
                .where(Instructor.org_id == org.id)
                .order_by(Instructor.id)
            )
        ).all()
        if not instructors:
            raise SystemExit(
                "No instructors found. Run scripts/seed_instructor_payroll.py first."
            )

        author_id = instructors[0].user_id
        instructor_users = (
            await session.exec(
                select(User).where(User.id.in_([i.user_id for i in instructors]))
            )
        ).all()
        name_by_user = {
            u.id: f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
            for u in instructor_users
        }
        instructor_names = {
            i.id: name_by_user.get(i.user_id, i.instructor_uuid) for i in instructors if i.id
        }

        if clear:
            await session.execute(
                text(
                    "DELETE FROM financerefund WHERE org_id = :org_id "
                    "AND (refund_uuid LIKE :p OR entry_uuid LIKE :p2)"
                ),
                {"org_id": org.id, "p": f"{SEED_PREFIX}%", "p2": f"{SEED_PREFIX}%"},
            )
            await session.execute(
                text("DELETE FROM financerefund WHERE org_id = :org_id"),
                {"org_id": org.id},
            )
            await session.execute(
                text("DELETE FROM financeledgerentry WHERE org_id = :org_id"),
                {"org_id": org.id},
            )
            await session.execute(
                text("DELETE FROM financecourseconfig WHERE org_id = :org_id"),
                {"org_id": org.id},
            )
            await session.commit()
            print(f"Cleared previous finance ledger/reporting rows for org_id={org.id}")

        pg_programs, pg_courses = await _upsert_postgraduate(
            session, org_id=org.id, author_id=author_id, now=now
        )
        training_programs, training_courses = await _load_training_entities(session, org.id)
        if not training_courses:
            raise SystemExit(
                "No demo training courses found. Run scripts/seed_instructor_payroll.py first."
            )

        all_courses = [*training_courses, *pg_courses]
        ledger_rows = _build_ledger_rows(
            org_id=org.id,
            created_by=created_by,
            training_programs=training_programs,
            pg_programs=pg_programs,
            training_courses=training_courses,
            pg_courses=pg_courses,
            instructors=list(instructors),
            instructor_names=instructor_names,
        )
        for row in ledger_rows:
            session.add(row)
        await session.flush()

        configs, refunds = await _seed_configs_and_refunds(
            session,
            org_id=org.id,
            courses=all_courses,
            training_programs=training_programs,
            pg_programs=pg_programs,
            created_by=created_by,
            now=now,
        )
        payroll = await _seed_instructor_costs(
            session,
            org_id=org.id,
            instructors=list(instructors),
            courses=all_courses,
            now=now,
        )
        await session.commit()

        revenue = sum(r.amount for r in ledger_rows if r.entry_type == "revenue")
        expenses = sum(r.amount for r in ledger_rows if r.entry_type == "expense")
        linked = sum(1 for r in ledger_rows if r.course_uuid)
        print(
            f"Ecosystem seed for org '{org.slug}' (id={org.id}):\n"
            f"  postgraduate_programs={len(pg_programs)}, "
            f"training_programs={len(training_programs)}, "
            f"courses={len(all_courses)}\n"
            f"  ledger={len(ledger_rows)} "
            f"(linked_to_courses={linked}, revenue={revenue:,.0f}, expenses={expenses:,.0f})\n"
            f"  course_configs={configs}, refunds={refunds}"
        )
        for month, (hours, pay) in payroll.items():
            print(f"  payroll {month}: {hours:,.1f} hours, {pay:,.2f} EGP")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed interrelated finance + academic demo data"
    )
    parser.add_argument("--org-slug", default="default")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Replace existing finance ledger/reporting rows for the org",
    )
    args = parser.parse_args()
    asyncio.run(seed(args.org_slug, args.clear))


if __name__ == "__main__":
    main()
