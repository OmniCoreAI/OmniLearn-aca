import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, Session, select
from sqlmodel.ext.asyncio.session import AsyncSession

from cli import _install_async
from config.config import get_omnilearn_config
from src.core.db_url import prepare_asyncpg_connection
from src.db.organizations import Organization
from src.services.setup.setup import install_default_elements

logger = logging.getLogger(__name__)


async def auto_install():
    # Get the database session
    omnilearn_config = get_omnilearn_config()
    sync_connection_string = omnilearn_config.database_config.sql_connection_string  # type: ignore
    engine = create_engine(
        sync_connection_string, echo=False, pool_pre_ping=True
    )
    try:
        SQLModel.metadata.create_all(engine)

        # Check for existing orgs using the sync engine
        with Session(engine) as db_session:
            any_org = db_session.exec(select(Organization)).first()
    finally:
        # Always release the sync engine's pooled connections; this engine is
        # only used for the startup org check and must not leak a pool for the
        # lifetime of the process.
        engine.dispose()

    if not any_org:
        logger.info("No organizations found. Starting auto-installation")
        await _install_async(short=True)
        return

    # Refresh global default roles (IDs 1-4) so this release's new permission
    # keys (e.g. playgrounds, boards) land in the DB. Idempotent.
    try:
        # Normalise driver prefix + map libpq sslmode for asyncpg. Also mirror
        # the main engine's prepared-statement connect_args so this refresh
        # works on pooled deployments (PgBouncer / Supavisor) instead of
        # silently failing and leaving new RBAC permission keys out of the DB.
        async_connection_string, async_connect_args = prepare_asyncpg_connection(
            str(sync_connection_string),
            base_connect_args={
                "statement_cache_size": 0,
                "prepared_statement_name_func": lambda: "",
                "prepared_statement_cache_size": 0,
            },
        )
        async_engine = create_async_engine(
            async_connection_string,
            echo=False,
            pool_pre_ping=True,
            connect_args=async_connect_args,
        )
        factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
        try:
            async with factory() as session:
                await install_default_elements(session)
        finally:
            await async_engine.dispose()
    except Exception as e:
        logger.warning("Default-role refresh skipped (non-fatal): %s", e)
    logger.info("Organizations found. Skipping auto-installation")
