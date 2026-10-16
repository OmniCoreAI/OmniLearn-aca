"""Sample finance data for trying out the Reports section (dev / staging only).

Adds 24 months (ending today, so reports have a previous period to compare with) of:
  - ledger revenue (tuition, registration, subscriptions, offers, donations)
    linked to the academy's existing courses, with mixed payment methods
  - ledger expenses (rent, salaries, marketing, tools, travel)
  - approved / recorded refunds against some of that revenue
  - instructor teaching-hour logs (hours × rate) for the academy's instructors

It creates no users and no courses. If fewer than two instructors are in the
registry, staff members who already hold the Instructor role are registered
too (marked as sample). Every row it writes carries the ``sample_rpt_``
prefix in its uuid, and ``--remove`` deletes exactly those rows. Re-running
replaces the previous sample. Figures are deterministic (seeded random).

Usage (from apps/api):
  uv run python scripts/seed_report_samples.py --yes --org-slug aca
  uv run python scripts/seed_report_samples.py --yes --org-slug aca --remove
"""
from __future__ import annotations

import argparse
import asyncio
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text  # noqa: E402
from sqlmodel import select  # noqa: E402

from src.core.events.database import _async_session_factory  # noqa: E402
from src.db.courses.courses import Course  # noqa: E402
from src.db.finance.ledger import FinanceLedgerEntry  # noqa: E402
from src.db.finance.reporting import FinanceRefund  # noqa: E402
from src.db.instructors.finance import InstructorWorkLog  # noqa: E402
from src.db.instructors.instructors import Instructor, InstructorStatus  # noqa: E402
from src.db.organizations import Organization  # noqa: E402
from src.db.user_organizations import UserOrganization  # noqa: E402
from src.security.rbac.constants import ADMIN_ROLE_ID, INSTRUCTOR_ROLE_ID  # noqa: E402

PREFIX = "sample_rpt_"
INSTRUCTOR_PREFIX = f"instructor_{PREFIX}"
NOTE = "Sample data for the Reports section (scripts/seed_report_samples.py)"
CURRENCY = "EGP"
MONTHS = 24
# Intakes in Feb/Mar and Sep/Oct bring more revenue.
SEASON = {1: 0.8, 2: 1.25, 3: 1.15, 4: 0.9, 5: 0.85, 6: 0.7, 7: 0.6, 8: 0.75, 9: 1.35, 10: 1.3, 11: 1.0, 12: 0.85}
PAYMENT_METHODS = ["bank_transfer"] * 5 + ["cash"] * 2 + ["card"] * 2 + ["check"]
DEFAULT_RATES = [450.0, 600.0, 520.0]


def _stamp(d: date, hour: int = 10) -> str:
    return str(datetime(d.year, d.month, d.day, hour, 0, 0))


def _month_starts(today: date) -> list[date]:
    out = []
    y, m = today.year, today.month
    for _ in range(MONTHS):
        out.append(date(y, m, 1))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    return list(reversed(out))


def _day_in(month: date, rng: random.Random, today: date) -> date:
    nxt = date(month.year + (month.month == 12), month.month % 12 + 1, 1)
    last = min((nxt - timedelta(days=1)).day, (today - month).days + 1 if month <= today < nxt else 31)
    return month.replace(day=rng.randint(1, max(1, last)))


async def remove(session, org_id: int) -> dict[str, int]:
    counts = {}
    for table, column in (
        ("financerefund", "refund_uuid"),
        ("financeledgerentry", "entry_uuid"),
        ("instructorworklog", "worklog_uuid"),
        ("instructor", "instructor_uuid"),
    ):
        prefix = INSTRUCTOR_PREFIX if table == "instructor" else PREFIX
        result = await session.execute(
            text(f"DELETE FROM {table} WHERE org_id = :org AND {column} LIKE :p"),
            {"org": org_id, "p": f"{prefix}%"},
        )
        counts[table] = result.rowcount or 0
    await session.commit()
    return counts


async def seed(org_slug: str, only_remove: bool) -> None:
    async with _async_session_factory() as session:
        org = (await session.execute(select(Organization).where(Organization.slug == org_slug))).scalars().first()
        if not org:
            raise SystemExit(f"Organization {org_slug!r} not found")

        removed = await remove(session, org.id)
        if only_remove:
            print(f"Removed sample report data from '{org.slug}': {removed}")
            return

        today = date.today()
        now = str(datetime.now())
        rng = random.Random(20261007)

        courses = (await session.execute(select(Course).where(Course.org_id == org.id).order_by(Course.id))).scalars().all()
        if not courses:
            raise SystemExit("This academy has no courses yet; create one first so revenue can be attributed.")
        admin = (
            await session.execute(
                select(UserOrganization).where(UserOrganization.org_id == org.id, UserOrganization.role_id == ADMIN_ROLE_ID)
            )
        ).scalars().first()
        created_by = admin.user_id if admin else None

        # ---- instructors: the registry, plus Instructor-role staff not in it yet (marked as sample)
        instructors = (
            await session.execute(select(Instructor).where(Instructor.org_id == org.id).order_by(Instructor.id))
        ).scalars().all()
        if len(instructors) < 2:
            registered = {i.user_id for i in instructors}
            staff = (
                await session.execute(
                    select(UserOrganization).where(
                        UserOrganization.org_id == org.id, UserOrganization.role_id == INSTRUCTOR_ROLE_ID
                    )
                )
            ).scalars().all()
            for n, member in enumerate(m for m in staff if m.user_id not in registered):
                inst = Instructor(
                    org_id=org.id,
                    user_id=member.user_id,
                    instructor_uuid=f"{INSTRUCTOR_PREFIX}{member.user_id}",
                    status=InstructorStatus.ACTIVE,
                    hourly_rate=DEFAULT_RATES[(len(instructors) + n) % len(DEFAULT_RATES)],
                    department="Sample",
                    creation_date=now,
                    update_date=now,
                )
                session.add(inst)
            await session.commit()
            instructors = (
                await session.execute(select(Instructor).where(Instructor.org_id == org.id).order_by(Instructor.id))
            ).scalars().all()
        if not instructors:
            raise SystemExit("No instructors (or Instructor-role members) to attribute teaching hours to.")

        entries: list[FinanceLedgerEntry] = []
        worklogs: list[InstructorWorkLog] = []
        n = 0

        def entry(kind: str, category: str, title: str, amount: float, day: date, course: str | None = None, method: str | None = None, status: str = "recorded"):
            nonlocal n
            n += 1
            entries.append(
                FinanceLedgerEntry(
                    org_id=org.id,
                    entry_uuid=f"{PREFIX}entry_{n:04d}",
                    entry_type=kind,
                    category=category,
                    title=title,
                    amount=round(amount, 2),
                    currency=CURRENCY,
                    entry_date=day.isoformat(),
                    description=NOTE,
                    payment_method=method or rng.choice(PAYMENT_METHODS),
                    status=status,
                    course_uuid=course,
                    created_by=created_by,
                    creation_date=_stamp(day),
                    update_date=_stamp(day),
                )
            )

        for i, month in enumerate(_month_starts(today)):
            season = SEASON[month.month]
            growth = 0.7 + 0.5 * i / (MONTHS - 1)  # the academy grows over time
            label = month.strftime("%Y-%m")

            # Revenue
            for course in courses:
                for _ in range(rng.randint(1, 2)):
                    seats = rng.randint(1, 5)
                    fee = rng.choice([2500, 3200, 4000, 4800])
                    entry("revenue", "tuition", f"Tuition — {course.name} ({label})", seats * fee * season * growth * rng.uniform(0.85, 1.15), _day_in(month, rng, today), course.course_uuid)
            for _ in range(rng.randint(3, 7)):
                entry("revenue", "registration", f"Registration fees ({label})", rng.choice([300, 450, 600]) * rng.randint(2, 6), _day_in(month, rng, today), method=rng.choice(["cash", "card"]))
            entry("revenue", "subscription", f"Library and platform subscriptions ({label})", rng.uniform(4000, 9000) * growth, _day_in(month, rng, today), method="bank_transfer")
            if month.month in (2, 3, 9, 10):
                course = rng.choice(courses)
                entry("revenue", "offer", f"Early-registration offer — {course.name}", rng.uniform(6000, 14000), _day_in(month, rng, today), course.course_uuid)
            if rng.random() < 0.25:
                entry("revenue", "donation", f"Training sponsorship ({label})", rng.uniform(10000, 25000), _day_in(month, rng, today), method="bank_transfer")
            if month.year == today.year and month.month == today.month:
                course = rng.choice(courses)
                entry("revenue", "tuition", f"Tuition (awaiting transfer) — {course.name}", rng.uniform(5000, 12000), today, course.course_uuid, "bank_transfer", status="pending")

            # Expenses
            entry("expense", "rent", f"Training hall rent ({label})", 12000, month.replace(day=1), method="bank_transfer")
            entry("expense", "salaries", f"Administrative staff salaries ({label})", 26000 * (1 + 0.03 * (i // 6)), month.replace(day=min(25, _day_in(month, rng, today).day)), method="bank_transfer")
            entry("expense", "marketing", f"Course promotion ({label})", rng.uniform(2500, 9000) * season, _day_in(month, rng, today))
            entry("expense", "tools", f"Software licences ({label})", rng.choice([1800, 2200, 2600]), _day_in(month, rng, today), method="card")
            if rng.random() < 0.4:
                entry("expense", "travel", f"Trainer travel ({label})", rng.uniform(1500, 6000), _day_in(month, rng, today))

            # Teaching hours
            for inst in instructors:
                rate = float(inst.hourly_rate or DEFAULT_RATES[inst.id % len(DEFAULT_RATES)])
                for _ in range(int(rng.randint(6, 14) * season)):
                    hours = rng.choice([1.5, 2, 2, 3])
                    day = _day_in(month, rng, today)
                    worklogs.append(
                        InstructorWorkLog(
                            org_id=org.id,
                            instructor_id=inst.id,
                            hours=hours,
                            language=rng.choice(["ar", "ar", "en"]),
                            rate_applied=rate,
                            amount=round(hours * rate, 2),
                            currency=CURRENCY,
                            work_date=day.isoformat(),
                            description=NOTE,
                            course_uuid=rng.choice(courses).course_uuid,
                            worklog_uuid=f"{PREFIX}log_{len(worklogs) + 1:05d}",
                            creation_date=_stamp(day, 18),
                            update_date=_stamp(day, 18),
                        )
                    )

        session.add_all(entries)
        session.add_all(worklogs)
        await session.flush()

        # Refunds against a handful of tuition payments, decided a few days later.
        tuition = [e for e in entries if e.category == "tuition" and e.status == "recorded" and date.fromisoformat(e.entry_date) < today - timedelta(days=10)]
        refunds = 0
        for e in rng.sample(tuition, min(12, len(tuition))):
            paid = date.fromisoformat(e.entry_date)
            decided = paid + timedelta(days=rng.randint(4, 12))
            refunds += 1
            session.add(
                FinanceRefund(
                    org_id=org.id,
                    refund_uuid=f"{PREFIX}refund_{refunds:03d}",
                    entry_uuid=e.entry_uuid,
                    amount=round(e.amount * rng.choice([0.25, 0.5, 1.0]), 2),
                    currency=CURRENCY,
                    reason="Withdrew before the course started" if refunds % 2 else "Course moved to a later intake",
                    status=rng.choice(["approved", "recorded"]),
                    decided_by=created_by,
                    decided_at=_stamp(decided, 12),
                    decision_note=NOTE,
                    created_by=created_by,
                    creation_date=_stamp(paid + timedelta(days=2)),
                    update_date=_stamp(decided, 12),
                )
            )
        await session.commit()

        revenue = sum(e.amount for e in entries if e.entry_type == "revenue" and e.status == "recorded")
        expenses = sum(e.amount for e in entries if e.entry_type == "expense")
        pay = sum(w.amount for w in worklogs)
        print(
            f"Sample report data for '{org.slug}' ({_month_starts(today)[0]} → {today}):\n"
            f"  ledger entries: {len(entries)} (revenue {revenue:,.0f} {CURRENCY}, expenses {expenses:,.0f} {CURRENCY})\n"
            f"  refunds: {refunds}\n"
            f"  teaching-hour logs: {len(worklogs)} for {len(instructors)} instructors ({pay:,.0f} {CURRENCY})\n"
            f"  replaced previous sample: {removed}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample finance data for the Reports section (dev only)")
    parser.add_argument("--org-slug", default="aca")
    parser.add_argument("--remove", action="store_true", help="Delete the sample data and exit")
    parser.add_argument("--yes", action="store_true", help="Confirm writing to the configured database")
    args = parser.parse_args()
    if not args.yes:
        raise SystemExit("This writes to the configured database. Re-run with --yes (development / staging only).")
    asyncio.run(seed(args.org_slug, args.remove))


if __name__ == "__main__":
    main()
