"""Ensure financeledgerentry table exists (dev helper).

Usage (from apps/api):
  python scripts/create_finance_ledger_table.py
"""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from src.core.events.database import engine
from src.db.finance.ledger import FinanceLedgerEntry  # noqa: F401
from sqlmodel import SQLModel


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        exists = await conn.execute(
            text(
                "SELECT EXISTS ("
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'financeledgerentry')"
            )
        )
        print("financeledgerentry exists:", exists.scalar())


if __name__ == "__main__":
    asyncio.run(main())
