"""Create (or refresh) one QA account per role, for manual and e2e testing.

Personas (all ``@omnilearn-qa.com``):
  qa.admin        Academy Admin
  qa.instructor   Instructor, active in the instructor registry
  qa.coordinator  Entity Coordinator of the entity "QA Ministry of Health" (QA-MOH)
  qa.trainee      Trainee, member of that entity

Every persona gets the same password, read from ``QA_PASSWORD`` in the env file
(generated on first run) and written back with the emails. Re-running resets
the passwords and clears forced password changes. For development and staging
only — it refuses to run without ``--yes``.

Usage (from apps/api):
  uv run python scripts/seed_qa_personas.py --yes
  uv run python scripts/seed_qa_personas.py --yes --org-slug aca --env-file ../../.env.test.local
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

from sqlmodel import select  # noqa: E402

from src.core.events.database import _async_session_factory  # noqa: E402
from src.db.administration.entities import (  # noqa: E402
    CoordinatorAssign,
    Entity,
    EntityCreate,
    EntityMember,
    EntityMemberCreate,
)
from src.db.instructors.instructors import Instructor, InstructorStatus  # noqa: E402
from src.db.organizations import Organization  # noqa: E402
from src.db.user_organizations import UserOrganization  # noqa: E402
from src.db.users import PublicUser, User  # noqa: E402
from src.security.rbac.constants import (  # noqa: E402
    ADMIN_ROLE_ID,
    INSTRUCTOR_ROLE_ID,
    TRAINEE_ROLE_ID,
)
from src.security.security import security_hash_password  # noqa: E402
from src.services.administration import entities as entity_svc  # noqa: E402
from src.services.security.password_validation import generate_temporary_password  # noqa: E402

DOMAIN = "omnilearn-qa.com"
ENTITY_CODE = "QA-MOH"
ENTITY_NAME = "QA Ministry of Health"
# key, username, first name, last name, starting role
PERSONAS = (
    ("ADMIN", "qa_admin", "QA", "Admin", ADMIN_ROLE_ID),
    ("INSTRUCTOR", "qa.instructor", "Ibrahim", "QA Instructor", INSTRUCTOR_ROLE_ID),
    # Promoted to Entity Coordinator by the entity service (from Trainee).
    ("COORDINATOR", "qa.coordinator", "Mona", "QA Coordinator", TRAINEE_ROLE_ID),
    ("TRAINEE", "qa.trainee", "Tarek", "QA Trainee", TRAINEE_ROLE_ID),
)


def _email(username: str) -> str:
    return f"{username.replace('_', '.')}@{DOMAIN}"


def _read_env(path: Path) -> dict:
    values = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip()
    return values


def _write_env(path: Path, password: str) -> None:
    lines = [
        f"# QA personas (dev only) — written by apps/api/scripts/seed_qa_personas.py on {datetime.now():%Y-%m-%d}",
        f"QA_PASSWORD={password}",
    ]
    lines += [f"QA_{key}_EMAIL={_email(username)}" for key, username, *_ in PERSONAS]
    path.write_text("\n".join(lines) + "\n")


async def _upsert_user(db, org_id: int, username: str, first: str, last: str, role_id: int, password_hash: str) -> User:
    now = str(datetime.now())
    user = (await db.execute(select(User).where(User.email == _email(username)))).scalars().first()
    if user is None:
        user = User(
            username=username, first_name=first, last_name=last, email=_email(username),
            user_uuid=f"user_{uuid4()}", email_verified=True, signup_method="admin_created",
            details={}, profile={}, creation_date=now, update_date=now, password=password_hash,
        )
    user.password = password_hash
    user.must_change_password = False
    user.failed_login_attempts = 0
    user.locked_until = None
    user.update_date = now
    db.add(user)
    await db.flush()
    membership = (
        await db.execute(select(UserOrganization).where(UserOrganization.user_id == user.id, UserOrganization.org_id == org_id))
    ).scalars().first()
    if membership is None:
        db.add(UserOrganization(user_id=user.id, org_id=org_id, role_id=role_id, creation_date=now, update_date=now))
    await db.commit()
    await db.refresh(user)
    return user


async def seed(org_slug: str | None, env_file: Path) -> None:
    env = _read_env(env_file)
    password = env.get("QA_PASSWORD") or generate_temporary_password()
    password_hash = security_hash_password(password)

    async with _async_session_factory() as db:
        stmt = select(Organization).order_by(Organization.id)
        if org_slug:
            stmt = stmt.where(Organization.slug == org_slug)
        org = (await db.execute(stmt)).scalars().first()
        if org is None:
            raise SystemExit(f"Organization {org_slug or '(any)'} not found")

        users = {}
        for key, username, first, last, role_id in PERSONAS:
            users[key] = await _upsert_user(db, org.id, username, first, last, role_id, password_hash)

        # Instructor registry row (teaching staff come only from the registry).
        instructor_user = users["INSTRUCTOR"]
        registry = (
            await db.execute(select(Instructor).where(Instructor.org_id == org.id, Instructor.user_id == instructor_user.id))
        ).scalars().first()
        if registry is None:
            now = str(datetime.now())
            db.add(Instructor(org_id=org.id, user_id=instructor_user.id, status=InstructorStatus.ACTIVE,
                              instructor_uuid=f"instructor_{uuid4()}", creation_date=now, update_date=now))
        else:
            registry.status = InstructorStatus.ACTIVE
            db.add(registry)
        await db.commit()

        # Entity, its coordinator and a trainee member — through the service so
        # groups, roles and coordinator rules match the app.
        admin = users["ADMIN"]
        actor = PublicUser.model_validate(admin, from_attributes=True)
        entity = (await db.execute(select(Entity).where(Entity.org_id == org.id, Entity.code == ENTITY_CODE))).scalars().first()
        if entity is None:
            created = await entity_svc.create_entity(db, actor, org.id, EntityCreate(name=ENTITY_NAME, code=ENTITY_CODE))
            entity_uuid = created.entity_uuid
        else:
            entity_uuid = entity.entity_uuid
        coordinator = users["COORDINATOR"]
        await entity_svc.assign_coordinator(db, actor, entity_uuid, CoordinatorAssign(user_uuid=coordinator.user_uuid))
        trainee = users["TRAINEE"]
        entity_id = (await db.execute(select(Entity.id).where(Entity.entity_uuid == entity_uuid))).scalar_one()
        is_member = (
            await db.execute(select(EntityMember.id).where(EntityMember.entity_id == entity_id, EntityMember.user_id == trainee.id))
        ).first()
        if not is_member:
            await entity_svc.add_member(db, actor, entity_uuid, EntityMemberCreate(user_uuid=trainee.user_uuid))

    _write_env(env_file, password)
    print(f"QA personas ready in org '{org.slug}'. Credentials written to {env_file}")
    for key, username, *_ in PERSONAS:
        print(f"  {key.lower():<12} {_email(username)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--org-slug", default=None, help="Organization slug (default: the first organization)")
    parser.add_argument("--env-file", default=str(ROOT.parents[1] / ".env.test.local"), help="Where to read/write QA credentials")
    parser.add_argument("--yes", action="store_true", help="Confirm this is a development / staging database")
    args = parser.parse_args()
    if not args.yes:
        raise SystemExit("This resets QA account passwords. Re-run with --yes on a development or staging database.")
    asyncio.run(seed(args.org_slug, Path(args.env_file)))


if __name__ == "__main__":
    main()
