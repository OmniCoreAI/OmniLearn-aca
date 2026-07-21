"""Seed mock finance ledger entries for local development.

Usage (from apps/api):
  .venv/Scripts/python.exe scripts/seed_finance_ledger.py
  .venv/Scripts/python.exe scripts/seed_finance_ledger.py --org-slug default --clear
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import _async_session_factory
from src.db.finance.ledger import FinanceLedgerEntry
from src.db.organizations import Organization
from src.db.users import User


def _entry(
    *,
    org_id: int,
    entry_type: str,
    category: str,
    title: str,
    amount: float,
    entry_date: date,
    payment_method: str,
    description: str | None = None,
    created_by: int | None = None,
    currency: str = "EGP",
) -> FinanceLedgerEntry:
    now = str(datetime.now())
    return FinanceLedgerEntry(
        org_id=org_id,
        entry_uuid=f"fin_{uuid4()}",
        entry_type=entry_type,
        category=category,
        title=title,
        amount=round(amount, 2),
        currency=currency,
        entry_date=entry_date.isoformat(),
        description=description,
        payment_method=payment_method,
        status="recorded",
        offer_uuid=None,
        course_uuid=None,
        created_by=created_by,
        creation_date=now,
        update_date=now,
    )


def build_mock_rows(org_id: int, created_by: int | None) -> list[FinanceLedgerEntry]:
    today = date.today()
    rows: list[FinanceLedgerEntry] = []

    # --- Revenue: tuition / cohorts over ~90 days ---
    revenue_plan = [
        (-85, "tuition", "رسوم دفعة مكافحة الفساد — يناير", 185000, "bank_transfer"),
        (-78, "registration", "رسوم تسجيل متدربين جدد", 24000, "cash"),
        (-70, "tuition", "برنامج الحوكمة الرشيدة — دفعة 3", 142000, "bank_transfer"),
        (-62, "subscription", "اشتراك سنوي منصة التعلم", 36000, "card"),
        (-55, "tuition", "دورة النزاهة المؤسسية — شركة حكومية", 98000, "bank_transfer"),
        (-48, "offer", "عرض تدريبي مخصص — وزارة", 76000, "check"),
        (-40, "tuition", "ورشة الإفصاح المالي", 28500, "cash"),
        (-33, "registration", "رسوم امتحانات شهادات", 12500, "cash"),
        (-25, "tuition", "برنامج التحقيق الإداري — دفعة مسائية", 156000, "bank_transfer"),
        (-18, "donation", "منحة دعم تدريب", 50000, "bank_transfer"),
        (-12, "tuition", "دورة التحول الرقمي الرقابي", 64000, "card"),
        (-7, "subscription", "تجديد اشتراكات متدربين", 18500, "card"),
        (-3, "tuition", "برنامج مكافحة غسل الأموال — قاعة 2", 112000, "bank_transfer"),
        (-1, "registration", "رسوم تسجيل أونلاين", 8600, "card"),
        (0, "tuition", "تحصيل متأخرات دفعة سابقة", 32000, "cash"),
    ]

    for days_ago, category, title, amount, method in revenue_plan:
        rows.append(
            _entry(
                org_id=org_id,
                entry_type="revenue",
                category=category,
                title=title,
                amount=amount,
                entry_date=today + timedelta(days=days_ago),
                payment_method=method,
                description="Mock seed revenue",
                created_by=created_by,
            )
        )

    # --- Expenses ---
    expense_plan = [
        (-80, "rent", "إيجار مقر التدريب — يناير", 45000, "bank_transfer"),
        (-72, "marketing", "حملة تسويق برامج الربع الأول", 18500, "card"),
        (-65, "tools", "اشتراكات أدوات ومنصات", 9200, "card"),
        (-58, "salaries", "بدل مدربين زائرين", 38000, "bank_transfer"),
        (-50, "travel", "بدل انتقالات ورش خارجية", 6400, "cash"),
        (-42, "rent", "إيجار قاعة مؤتمرات إضافية", 12000, "check"),
        (-35, "marketing", "طباعة مواد تدريبية", 7800, "cash"),
        (-28, "tools", "صيانة أجهزة عرض ومعامل", 5400, "bank_transfer"),
        (-20, "salaries", "مكافآت تنسيق إداري", 15000, "bank_transfer"),
        (-14, "other", "مصروفات ضيافة فعاليات", 3200, "cash"),
        (-8, "marketing", "إعلانات رقمية — فبراير", 11000, "card"),
        (-4, "travel", "مهمة ميدانية — محافظة", 4800, "cash"),
        (-2, "rent", "إيجار شهر جاري", 45000, "bank_transfer"),
        (0, "other", "مستلزمات مكتبية", 2100, "cash"),
    ]

    for days_ago, category, title, amount, method in expense_plan:
        rows.append(
            _entry(
                org_id=org_id,
                entry_type="expense",
                category=category,
                title=title,
                amount=amount,
                entry_date=today + timedelta(days=days_ago),
                payment_method=method,
                description="Mock seed expense",
                created_by=created_by,
            )
        )

    return rows


async def seed(org_slug: str, clear: bool) -> None:
    async with _async_session_factory() as session:  # type: AsyncSession
        org = (
            await session.execute(select(Organization).where(Organization.slug == org_slug))
        ).scalars().first()
        if not org:
            raise SystemExit(f"Organization slug={org_slug!r} not found")

        admin = (
            await session.execute(
                select(User).where(User.email == "dev@test.com")
            )
        ).scalars().first()
        created_by = admin.id if admin else None

        if clear:
            await session.execute(
                text("DELETE FROM financeledgerentry WHERE org_id = :org_id"),
                {"org_id": org.id},
            )
            await session.commit()
            print(f"Cleared existing finance entries for org_id={org.id}")

        rows = build_mock_rows(org.id, created_by)
        for row in rows:
            session.add(row)
        await session.commit()

        revenue = sum(r.amount for r in rows if r.entry_type == "revenue")
        expenses = sum(r.amount for r in rows if r.entry_type == "expense")
        print(
            f"Seeded {len(rows)} entries for org '{org.slug}' (id={org.id}): "
            f"revenue={revenue:,.0f} EGP, expenses={expenses:,.0f} EGP, "
            f"net={revenue - expenses:,.0f} EGP"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed finance ledger mock data")
    parser.add_argument("--org-slug", default="default")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete existing ledger rows for the org before seeding",
    )
    args = parser.parse_args()
    asyncio.run(seed(args.org_slug, args.clear))


if __name__ == "__main__":
    main()
