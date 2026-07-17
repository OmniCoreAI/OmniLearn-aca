from typing import Any, List, Sequence
from fastapi import Request
from sqlalchemy import ColumnElement, func, true as sa_true
from sqlmodel import select, or_, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel, ConfigDict
from src.db.users import PublicUser, AnonymousUser, UserRead, User, APITokenUser
from src.db.courses.courses import CourseRead
from src.db.folders.folders import Folder, FolderRead
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.playgrounds import Playground, PlaygroundRead, PlaygroundAccessType
from src.services.courses.courses import search_courses
from src.services.search.normalization import (
    LIKE_ESCAPE_CHAR,
    build_like_pattern,
    escape_like_wildcards,
)
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_member


class SearchResult(BaseModel):
    """Paginated search result grouped by resource type.

    Each resource list is capped at `limit` per page; `total_*` holds the full
    count for the whole query so the UI can show per-tab totals.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    courses: List[CourseRead]
    folders: List[FolderRead]
    users: List[UserRead]
    playgrounds: List[PlaygroundRead]

    total_courses: int = 0
    total_folders: int = 0
    total_users: int = 0
    total_playgrounds: int = 0


def _empty_result() -> SearchResult:
    return SearchResult(
        courses=[],
        folders=[],
        users=[],
        playgrounds=[],
    )


_escape_like_wildcards = escape_like_wildcards  # back-compat alias for existing tests


def _ilike_any(columns: Sequence[ColumnElement[Any]], pattern: str) -> ColumnElement[bool]:
    """Return a SQL boolean matching `pattern` against any of the given columns.

    Uses SQLAlchemy's `ilike`, which is parameterized and keeps the driver
    responsible for escaping — no string interpolation on user input.
    """
    return or_(*(column.ilike(pattern, escape=LIKE_ESCAPE_CHAR) for column in columns))


async def _paginate_and_count(
    db_session: AsyncSession,
    query,
    page: int,
    limit: int,
) -> tuple[list, int]:
    """Run `query` with LIMIT/OFFSET for the current page and return both the
    page rows (as scalar model instances) and the full unpaginated count in one
    helper.

    Note: only use this helper for single-model selects (e.g. ``select(Foo)``).
    Multi-column selects (e.g. ``select(Foo, Bar.col)``) return tuples and must
    be fetched with ``.all()`` directly.
    """
    offset = (page - 1) * limit
    rows = (await db_session.execute(query.offset(offset).limit(limit))).scalars().all()
    total = (await db_session.execute(
        select(func.count()).select_from(query.order_by(None).subquery())
    )).scalar_one()
    return list(rows), int(total)


async def search_across_org(
    request: Request,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_slug: str,
    search_query: str,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
) -> SearchResult:
    """Search across the org's resources with per-type access control.

    SECURITY:
    - Anonymous users see public content only; they cannot search users.
    - Authenticated non-members see public content only; they cannot search users.
    - Org members additionally see org-scoped non-public content where the
      resource itself doesn't restrict it further (e.g. unpublished items and
      usergroup-restricted playgrounds are always excluded from search).
    - Pattern matching goes through SQLAlchemy `ilike` — fully parameterized.
    - Limit is capped at 50 per page.
    """
    from fastapi import HTTPException, status

    limit = min(limit, 50)

    pattern = build_like_pattern(search_query)

    org = (await db_session.execute(
        select(Organization).where(Organization.slug == org_slug)
    )).scalars().first()
    if not org:
        return _empty_result()

    if isinstance(current_user, APITokenUser):
        if org.id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API token cannot search in organizations outside its scope",
            )
        if current_user.rights:
            rights = current_user.rights
            if isinstance(rights, dict):
                search_rights = rights.get("search", {})
                has_permission = search_rights.get("action_read", False)
            else:
                search_rights = getattr(rights, "search", None)
                has_permission = bool(
                    search_rights and getattr(search_rights, "action_read", False)
                )
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="API token does not have search permission",
                )

    is_anon = isinstance(current_user, AnonymousUser)
    user_is_member = (
        not is_anon and await is_org_member(resolve_acting_user_id(current_user), org.id, db_session)
    )
    only_public = is_anon or not user_is_member

    # ── Courses ──────────────────────────────────────────────────────────────
    # `search_courses` already applies its own per-user access filter.
    courses = await search_courses(
        request, current_user, org_slug, search_query, db_session, page, limit
    )
    total_courses = len(courses)

    # ── Folders ──────────────────────────────────────────────────────────────
    folders_q = (
        select(Folder)
        .where(Folder.org_id == org.id)
        .where(_ilike_any([Folder.name, Folder.description], pattern))
    )
    if only_public:
        folders_q = folders_q.where(Folder.public == sa_true())
    folders, total_folders = await _paginate_and_count(
        db_session, folders_q, page, limit
    )

    # ── Users (org members only; anonymous and non-member traffic is denied) ─
    if only_public:
        users: list = []
        total_users = 0
    else:
        users_q = (
            select(User)
            .join(UserOrganization, and_(
                UserOrganization.user_id == User.id,
                UserOrganization.org_id == org.id,
            ))
            .where(
                _ilike_any(
                    [User.username, User.first_name, User.last_name, User.bio],
                    pattern,
                )
            )
        )
        users, total_users = await _paginate_and_count(db_session, users_q, page, limit)

    # ── Playgrounds (published only; restricted are usergroup-gated elsewhere) ─
    playgrounds_q = (
        select(Playground)
        .where(Playground.org_id == org.id)
        .where(Playground.published == sa_true())
        .where(_ilike_any([Playground.name, Playground.description], pattern))
    )
    if only_public:
        playgrounds_q = playgrounds_q.where(
            Playground.access_type == PlaygroundAccessType.PUBLIC
        )
    else:
        playgrounds_q = playgrounds_q.where(
            Playground.access_type.in_([  # type: ignore[attr-defined]
                PlaygroundAccessType.PUBLIC,
                PlaygroundAccessType.AUTHENTICATED,
            ])
        )
    playgrounds, total_playgrounds = await _paginate_and_count(
        db_session, playgrounds_q, page, limit
    )

    folder_reads = [FolderRead.model_validate(f) for f in folders]

    user_reads = [UserRead.model_validate(u) for u in users]

    playground_reads: list[PlaygroundRead] = []
    for pg in playgrounds:
        read = PlaygroundRead.model_validate(pg)
        read.org_uuid = org.org_uuid
        read.org_slug = org.slug
        playground_reads.append(read)

    return SearchResult(
        courses=courses,
        folders=folder_reads,
        users=user_reads,
        playgrounds=playground_reads,
        total_courses=total_courses,
        total_folders=total_folders,
        total_users=total_users,
        total_playgrounds=total_playgrounds,
    )
