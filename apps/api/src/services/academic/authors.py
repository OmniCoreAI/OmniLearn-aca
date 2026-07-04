from datetime import datetime
from typing import List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import AuthorWithRole
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import User, UserRead


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
