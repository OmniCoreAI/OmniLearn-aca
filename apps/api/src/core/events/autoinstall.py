import logging
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel, Session, select
from sqlmodel.ext.asyncio.session import AsyncSession

from cli import _install_async
from config.config import get_omnilearn_config
from src.core.db_url import prepare_asyncpg_connection
from src.db.organizations import Organization
from src.db.users import User, UserCreate
from src.services.setup.setup import (
    install_create_organization_user,
    install_default_elements,
)

logger = logging.getLogger(__name__)

DEFAULT_ADMIN_EMAIL = "admin@omnicoreai.com"
DEFAULT_ORG_SLUG = "aca"


def _initial_org_slug() -> str:
    return os.environ.get("OMNILEARN_INITIAL_ORG_SLUG", DEFAULT_ORG_SLUG).strip().lower() or DEFAULT_ORG_SLUG


async def _ensure_initial_superadmin(db_session: AsyncSession) -> None:
    """Create (or promote) the configured superadmin if missing.

    Runs on every startup after the org already exists so rebuilds / compose
    restarts still get the admin user without wiping the database.
    """
    email = os.environ.get("OMNILEARN_INITIAL_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).strip()
    password = os.environ.get("OMNILEARN_INITIAL_ADMIN_PASSWORD")
    if not email or not password:
        logger.info(
            "Skipping initial superadmin ensure: set OMNILEARN_INITIAL_ADMIN_EMAIL "
            "and OMNILEARN_INITIAL_ADMIN_PASSWORD to provision %s",
            DEFAULT_ADMIN_EMAIL,
        )
        return

    existing = (
        await db_session.execute(select(User).where(User.email == email))
    ).scalars().first()
    if existing:
        if not existing.is_superadmin:
            existing.is_superadmin = True
            db_session.add(existing)
            await db_session.commit()
            logger.info("Promoted existing user %s to superadmin", email)
        return

    org_slug = _initial_org_slug()
    org = (
        await db_session.execute(
            select(Organization).where(Organization.slug == org_slug)
        )
    ).scalars().first()
    if not org:
        org = (await db_session.execute(select(Organization))).scalars().first()
    if not org:
        logger.warning("No organization found; cannot ensure initial superadmin")
        return

    username = "admin"
    # Avoid username collision with an older default admin on the same org.
    username_taken = (
        await db_session.execute(select(User).where(User.username == username))
    ).scalars().first()
    if username_taken:
        username = "omnicoreai_admin"

    await install_create_organization_user(
        UserCreate(username=username, email=email, password=password),
        org.slug,
        db_session,
        is_superadmin=True,
    )
    logger.info("Created initial superadmin %s on org '%s'", email, org.slug)


async def _ensure_initial_org_logo(db_session: AsyncSession) -> None:
    """Seed the initial org's logo from the bundled repo asset (idempotent).

    Only sets the logo when the org has none, so a logo uploaded later via the
    UI is never overwritten. The asset is baked into the image by the Dockerfile
    at /app/api/assets/initial-org-logo.png.
    """
    import shutil

    asset_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "assets", "initial-org-logo.png"
        )
    )
    if not os.path.exists(asset_path):
        return

    org_slug = _initial_org_slug()
    org = (
        await db_session.execute(
            select(Organization).where(Organization.slug == org_slug)
        )
    ).scalars().first()
    if not org:
        org = (await db_session.execute(select(Organization))).scalars().first()
    # Skip if there's no org or it already has a logo (respects manual uploads).
    if not org or org.logo_image:
        return

    dest_dir = f"content/orgs/{org.org_uuid}/logos"
    filename = "initial-org-logo.png"
    try:
        os.makedirs(dest_dir, exist_ok=True)
        shutil.copyfile(asset_path, os.path.join(dest_dir, filename))
    except OSError as e:
        logger.warning("Could not seed initial org logo: %s", e)
        return

    org.logo_image = filename
    db_session.add(org)
    await db_session.commit()
    logger.info("Seeded initial org logo for '%s'", org.slug)


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
                await _ensure_initial_superadmin(session)
                await _ensure_initial_org_logo(session)
        finally:
            await async_engine.dispose()
    except Exception as e:
        logger.warning("Default-role refresh / superadmin ensure skipped (non-fatal): %s", e)
    logger.info("Organizations found. Skipping auto-installation")
