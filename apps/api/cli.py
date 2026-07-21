# ruff: noqa: E402
# stdout/stderr reconfig must run before any other import that might print.
import asyncio
import os
import sys
from typing import Annotated

# Force UTF-8 so install messages with emoji don't crash cp1252 consoles (Windows).
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
import typer
from config.config import get_omnilearn_config
from src.db.organizations import OrganizationCreate
from src.db.users import UserCreate
from src.services.setup.setup import (
    install_create_organization,
    install_create_organization_user,
    install_default_elements,
)

cli = typer.Typer()


def _to_async_url(url: str) -> str:
    # asyncpg uses the `ssl` connect arg, not libpq's `sslmode` (which the sync
    # psycopg2 path needs), so translate it when producing the async URL.
    if "+asyncpg" in url:
        return url.replace("sslmode=", "ssl=")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url.replace("sslmode=", "ssl=")
    return url


def _to_sync_url(url: str) -> str:
    # Sync engine uses psycopg2, which wants libpq's `sslmode`, so convert back.
    return url.replace("+asyncpg", "").replace("ssl=", "sslmode=")


@cli.command()
def install(
    short: Annotated[bool, typer.Option(help="Install with predefined values")] = False
):
    """Install OmniLearn: schema, default elements, organization, and admin user.

    Typer entry point — uses asyncio.run because no loop is running yet.
    Programmatic async callers (FastAPI lifespan, etc.) should await
    `_install_async` directly to keep the SQLAlchemy greenlet context.
    """
    asyncio.run(_install_async(short))


async def _install_async(short: bool) -> None:
    omnilearn_config = get_omnilearn_config()
    sql_url = omnilearn_config.database_config.sql_connection_string  # type: ignore

    # Schema DDL runs on a sync engine (SQLModel.metadata.create_all is sync).
    sync_engine = create_engine(_to_sync_url(sql_url), echo=False, pool_pre_ping=True)
    SQLModel.metadata.create_all(sync_engine)
    sync_engine.dispose()

    # The install_* coroutines use sqlmodel.ext.asyncio.session.AsyncSession.
    # expire_on_commit=False keeps already-loaded attributes accessible after
    # each commit — without it, `UserRead.model_validate(user)` inside
    # `install_create_organization_user` triggers async refresh outside the
    # session's greenlet context and raises MissingGreenlet.
    async_engine = create_async_engine(
        _to_async_url(sql_url), echo=False, pool_pre_ping=True
    )

    try:
        async with AsyncSession(
            async_engine, expire_on_commit=False
        ) as db_session:
            if short:
                # Install the default elements
                print("Installing default elements...")
                await install_default_elements(db_session)
                print("Default elements installed ✅")

                # Honor OMNILEARN_INITIAL_ORG_NAME / OMNILEARN_INITIAL_ORG_SLUG when
                # set — defaults to ACA org for this deployment.
                org_name = os.environ.get("OMNILEARN_INITIAL_ORG_NAME", "aca")
                org_slug = os.environ.get("OMNILEARN_INITIAL_ORG_SLUG", "aca").lower()

                # Create the Organization
                print(f"Creating organization '{org_name}' (slug: {org_slug})...")
                org = OrganizationCreate(
                    name=org_name,
                    description=org_name,
                    slug=org_slug,
                    email="",
                    logo_image="",
                    thumbnail_image="",
                    about="",
                    label="",
                )
                await install_create_organization(org, db_session)
                print(f"Organization '{org_name}' created ✅")

                # Create Organization User
                print("Creating default organization user...")
                # Use email from environment variable if provided, otherwise default to OmniCore AI admin
                email = os.environ.get("OMNILEARN_INITIAL_ADMIN_EMAIL", "admin@omnicoreai.com")
                # Require password from environment variable
                password = os.environ.get("OMNILEARN_INITIAL_ADMIN_PASSWORD")
                if not password:
                    print("❌ Error: OMNILEARN_INITIAL_ADMIN_PASSWORD environment variable is required")
                    print("Please set OMNILEARN_INITIAL_ADMIN_PASSWORD environment variable before running installation.")
                    raise typer.Exit(code=1)
                print("Using password from OMNILEARN_INITIAL_ADMIN_PASSWORD environment variable")
                if email != "admin@omnicoreai.com":
                    print(f"Using email from OMNILEARN_INITIAL_ADMIN_EMAIL environment variable: {email}")
                user = UserCreate(
                    username="admin", email=email, password=password
                )
                await install_create_organization_user(
                    user, org_slug, db_session, is_superadmin=True
                )
                print("Default organization user created ✅")

                # Show the user how to login
                print("Installation completed ✅")
                print("")
                print("Login with the following credentials:")
                print("email: " + email)
                print("password: (the password you set in OMNILEARN_INITIAL_ADMIN_PASSWORD)")
                print("⚠️ Remember to change the password after logging in ⚠️")

            else:
                # Install the default elements
                print("Installing default elements...")
                await install_default_elements(db_session)
                print("Default elements installed ✅")

                # Create the Organization
                print("Creating your organization...")
                orgname = typer.prompt("What's shall we call your organization?")
                slug = typer.prompt(
                    "What's the slug for your organization? (e.g. school, acme)"
                )
                org = OrganizationCreate(
                    name=orgname,
                    description="Default Organization",
                    slug=slug.lower(),
                    email="",
                    logo_image="",
                    thumbnail_image="",
                    about="",
                    label="",
                )
                await install_create_organization(org, db_session)
                print(orgname + " Organization created ✅")

                # Create Organization User
                print("Creating your organization user...")
                username = typer.prompt("What's the username for the user?")
                email = typer.prompt("What's the email for the user?")
                password = typer.prompt("What's the password for the user?", hide_input=True)
                user = UserCreate(username=username, email=email, password=password)
                await install_create_organization_user(
                    user, slug, db_session, is_superadmin=True
                )
                print(username + " user created ✅")

                # Show the user how to login
                print("Installation completed ✅")
                print("")
                print("Login with the following credentials:")
                print("email: " + email)
                print("password: The password you entered")
    finally:
        await async_engine.dispose()




@cli.command()
def main():
    cli()


if __name__ == "__main__":
    cli()
