"""Ensure finance reporting tables exist (dev helper)."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlmodel import SQLModel

from src.core.events.database import engine
from src.db.finance.reporting import (  # noqa: F401
    FinanceCourseConfig,
    FinancePayrollPeriod,
    FinanceRefund,
)


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        for table in ("financerefund", "financecourseconfig", "financepayrollperiod"):
            exists = await conn.execute(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    f"WHERE table_name = '{table}')"
                )
            )
            print(f"{table} exists:", exists.scalar())


if __name__ == "__main__":
    asyncio.run(main())
