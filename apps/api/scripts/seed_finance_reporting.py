"""Seed finance reporting mock data (course configs, course-linked ledger, refunds).

Works even when the org has no Course rows yet — uses demo course UUIDs.

Usage (from apps/api):
  .venv/Scripts/python.exe scripts/seed_finance_reporting.py
  .venv/Scripts/python.exe scripts/seed_finance_reporting.py --org-slug default --clear
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlmodel import select

from src.core.events.database import _async_session_factory
from src.db.courses.courses import Course
from src.db.finance.ledger import FinanceLedgerEntry
from src.db.finance.reporting import FinanceCourseConfig, FinanceRefund
from src.db.organizations import Organization
from src.db.users import User

DEMO_COURSES = [
    ("course_demo_governance", "الحوكمة الرشيدة"),
    ("course_demo_integrity", "النزاهة المؤسسية"),
    ("course_demo_investigation", "التحقيق الإداري"),
]


async def seed(org_slug: str, clear: bool) -> None:
    async with _async_session_factory() as session:
        org = (
            await session.execute(select(Organization).where(Organization.slug == org_slug))
        ).scalars().first()
        if not org or not org.id:
            raise SystemExit(f"Organization '{org_slug}' not found")

        admin = (
            await session.execute(select(User).where(User.email == "dev@test.com"))
        ).scalars().first()
        created_by = admin.id if admin else None
        now = str(datetime.now())

        if clear:
            await session.execute(
                text("DELETE FROM financerefund WHERE org_id = :org_id"),
                {"org_id": org.id},
            )
            await session.execute(
                text("DELETE FROM financecourseconfig WHERE org_id = :org_id"),
                {"org_id": org.id},
            )
            await session.commit()
            print(f"Cleared refunds & course configs for org_id={org.id}")

        real_courses = (
            await session.execute(select(Course).where(Course.org_id == org.id).limit(5))
        ).scalars().all()

        if real_courses:
            course_uuids = [c.course_uuid for c in real_courses if c.course_uuid]
        else:
            course_uuids = [c[0] for c in DEMO_COURSES]
            print("No Course rows — using demo course UUIDs for attribution")

        # Attribute revenue tuition entries round-robin to courses
        revenues = (
            await session.execute(
                select(FinanceLedgerEntry).where(
                    FinanceLedgerEntry.org_id == org.id,
                    FinanceLedgerEntry.entry_type == "revenue",
                )
            )
        ).scalars().all()
        linked = 0
        for i, entry in enumerate(revenues):
            if entry.course_uuid:
                continue
            if entry.category not in ("tuition", "registration", "offer", "other"):
                continue
            entry.course_uuid = course_uuids[i % len(course_uuids)]
            entry.update_date = now
            session.add(entry)
            linked += 1

        configs_created = 0
        for i, cuuid in enumerate(course_uuids):
            existing = (
                await session.execute(
                    select(FinanceCourseConfig).where(
                        FinanceCourseConfig.org_id == org.id,
                        FinanceCourseConfig.course_uuid == cuuid,
                    )
                )
            ).scalars().first()
            if existing:
                continue
            attendees = 20 + (i * 5)
            session.add(
                FinanceCourseConfig(
                    org_id=org.id,
                    course_uuid=cuuid,
                    config_uuid=f"fcc_{uuid4()}",
                    currency="EGP",
                    tuition_unit_amount=1000.0,
                    certification_unit_cost=100.0,
                    addons_unit_cost=200.0,
                    other_fixed_cost=5000.0 + i * 1000,
                    attendees_override=attendees,
                    certified_attendees_override=max(attendees - 3, 0),
                    creation_date=now,
                    update_date=now,
                )
            )
            configs_created += 1

        await session.commit()

        revenue_for_refund = (
            await session.execute(
                select(FinanceLedgerEntry)
                .where(
                    FinanceLedgerEntry.org_id == org.id,
                    FinanceLedgerEntry.entry_type == "revenue",
                )
                .limit(4)
            )
        ).scalars().all()

        refunds_created = 0
        statuses = ["pending", "approved", "recorded", "rejected"]
        for i, entry in enumerate(revenue_for_refund):
            already = (
                await session.execute(
                    select(FinanceRefund).where(FinanceRefund.entry_uuid == entry.entry_uuid)
                )
            ).scalars().first()
            if already:
                continue
            status = statuses[i % len(statuses)]
            amount = round(min(float(entry.amount or 0) * 0.15, 8000.0), 2)
            session.add(
                FinanceRefund(
                    org_id=org.id,
                    refund_uuid=f"ref_{uuid4()}",
                    entry_uuid=entry.entry_uuid,
                    amount=amount,
                    currency=entry.currency or "EGP",
                    reason=f"Mock refund sample ({status}) — partial withdrawal",
                    status=status,
                    decided_by=created_by if status != "pending" else None,
                    decided_at=now if status != "pending" else None,
                    decision_note="Seeded decision" if status != "pending" else None,
                    created_by=created_by,
                    creation_date=now,
                    update_date=now,
                )
            )
            refunds_created += 1

        await session.commit()
        print(
            f"Reporting seed for org_id={org.id}: "
            f"linked={linked}, configs={configs_created}, "
            f"refunds={refunds_created}, courses={len(course_uuids)}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed finance reporting mock data")
    parser.add_argument("--org-slug", default="default")
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    asyncio.run(seed(args.org_slug, args.clear))


if __name__ == "__main__":
    main()
