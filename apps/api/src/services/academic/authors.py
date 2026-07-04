from datetime import datetime
from typing import List, Optional
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import AuthorWithRole
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import User, UserRead, UserReadAuthor


async def get_resource_authors(
    db_session: AsyncSession, resource_uuid: str
) -> List[AuthorWithRole]:
    """Return authorship rows (with their user) for an academic resource.

    Reuses the same polymorphic ``ResourceAuthor`` table and ``AuthorWithRole``
    shape used by courses, so no new authorship model is introduced.
    """
    authors_statement = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid == resource_uuid)
        .order_by(ResourceAuthor.id.asc())  # type: ignore
    )
    author_results = (await db_session.execute(authors_statement)).all()

    return [
        AuthorWithRole(
            user=UserRead.model_validate(user),
            authorship=resource_author.authorship,
            authorship_status=resource_author.authorship_status,
            creation_date=resource_author.creation_date,
            update_date=resource_author.update_date,
        )
        for resource_author, user in author_results
    ]


def build_creator_author(resource_uuid: str, user_id: int) -> ResourceAuthor:
    """Build a CREATOR ResourceAuthor row for a freshly created resource."""
    return ResourceAuthor(
        resource_uuid=resource_uuid,
        user_id=user_id,
        authorship=ResourceAuthorshipEnum.CREATOR,
        authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )


async def get_user_author(
    db_session: AsyncSession, user_id: Optional[int]
) -> Optional[UserReadAuthor]:
    """Minimal author projection for a user id (used to embed a coordinator)."""
    if not user_id:
        return None
    user = (
        await db_session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if not user:
        return None
    return UserReadAuthor.model_validate(user)


async def ensure_coordinator_authorship(
    db_session: AsyncSession, resource_uuid: str, user_id: Optional[int]
) -> None:
    """Grant the coordinator MAINTAINER authorship on the resource (idempotent).

    Does not flush/commit — the caller controls the transaction. A coordinator
    that is also the CREATOR keeps their CREATOR row (no duplicate is added).
    """
    if not user_id:
        return
    existing = (
        await db_session.execute(
            select(ResourceAuthor).where(
                ResourceAuthor.resource_uuid == resource_uuid,
                ResourceAuthor.user_id == user_id,
            )
        )
    ).scalars().first()
    if existing:
        return
    db_session.add(
        ResourceAuthor(
            resource_uuid=resource_uuid,
            user_id=user_id,
            authorship=ResourceAuthorshipEnum.MAINTAINER,
            authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
