"""Users & entities report: who is in the academy, how they joined, who is
active, and how each entity (government body) is learning.

"Active learner" = completed at least one lesson in the period. Sign-in
activity uses each user's last sign-in, so it shows who has been back
recently rather than every visit.
"""

from typing import Optional

from pydantic import BaseModel
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.administration.entities import Entity, EntityMember
from src.db.courses.chapter_activities import ChapterActivity
from src.db.roles import Role
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.services.reports.common import ReportRange, authorize_reports, month_of, org_or_404, pct, resolve_range, to_day


class PeopleTotals(BaseModel):
    members: int = 0
    new_members: int = 0
    signed_in: int = 0
    active_learners: int = 0
    never_signed_in: int = 0
    entities: int = 0


class PeopleMonth(BaseModel):
    month: str
    new_members: int = 0
    active_learners: int = 0


class RoleRow(BaseModel):
    role: str
    role_uuid: str
    count: int
    share_pct: float


class EntityRow(BaseModel):
    entity_uuid: str
    name: str
    name_ar: Optional[str] = None
    code: str
    members: int
    coordinators: int
    active_learners: int
    enrollments: int
    completions: int
    completion_rate: float


class PeopleReport(BaseModel):
    range: ReportRange
    totals: PeopleTotals
    previous: PeopleTotals
    monthly: list[PeopleMonth]
    by_role: list[RoleRow]
    entities: list[EntityRow]
    unassigned_members: int


async def people_report(
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> PeopleReport:
    await authorize_reports(db_session, current_user, org_id)
    await org_or_404(db_session, org_id)
    rng = resolve_range(date_from, date_to)

    memberships = (
        await db_session.execute(
            select(UserOrganization, Role, User)
            .join(Role, Role.id == UserOrganization.role_id)
            .join(User, User.id == UserOrganization.user_id)
            .where(UserOrganization.org_id == org_id)
        )
    ).all()
    member_ids = {u.id for _m, _r, u in memberships}

    steps = (
        await db_session.execute(
            select(TrailStep.user_id, TrailStep.creation_date).where(
                TrailStep.org_id == org_id,
                TrailStep.complete == True,  # noqa: E712
                TrailStep.creation_date >= rng.prev.start.isoformat(),
                TrailStep.creation_date <= rng.end.isoformat() + "~",
            )
        )
    ).all()

    def totals(period) -> PeopleTotals:
        t = PeopleTotals(members=len(memberships))
        for m, _r, u in memberships:
            if period.contains(to_day(m.creation_date)):
                t.new_members += 1
            if period.contains(to_day(u.last_login_at)):
                t.signed_in += 1
            if not u.last_login_at:
                t.never_signed_in += 1
        t.active_learners = len({uid for uid, stamp in steps if period.contains(to_day(stamp))})
        return t

    monthly = {m: PeopleMonth(month=m) for m in rng.months()}
    month_active: dict[str, set[int]] = {m: set() for m in monthly}
    for m, _r, _u in memberships:
        d = to_day(m.creation_date)
        if rng.contains(d):
            monthly[month_of(d)].new_members += 1  # type: ignore[index]
    for uid, stamp in steps:
        d = to_day(stamp)
        if rng.contains(d):
            month_active[month_of(d)].add(uid)  # type: ignore[index]
    for k, row in monthly.items():
        row.active_learners = len(month_active[k])

    roles: dict[str, list] = {}
    for _m, r, _u in memberships:
        roles.setdefault(r.role_uuid or r.name, [r.name, 0])[1] += 1
    by_role = sorted(
        (RoleRow(role=name, role_uuid=uuid, count=n, share_pct=pct(n, len(memberships))) for uuid, (name, n) in roles.items()),
        key=lambda r: r.count,
        reverse=True,
    )

    # ---- entities
    entities = (await db_session.execute(select(Entity).where(Entity.org_id == org_id))).scalars().all()
    entity_members = (
        await db_session.execute(select(EntityMember).where(EntityMember.org_id == org_id))
    ).scalars().all()
    active_status = "active"
    members_by_entity: dict[int, list[EntityMember]] = {}
    for em in entity_members:
        if str(getattr(em.status, "value", em.status)) == active_status:
            members_by_entity.setdefault(em.entity_id, []).append(em)
    assigned = {em.user_id for items in members_by_entity.values() for em in items}

    lessons = {
        row[0]: row[1]
        for row in (
            await db_session.execute(
                select(ChapterActivity.course_id, func.count(ChapterActivity.id))
                .where(ChapterActivity.org_id == org_id)
                .group_by(ChapterActivity.course_id)
            )
        ).all()
    }
    runs = (await db_session.execute(select(TrailRun).where(TrailRun.org_id == org_id))).scalars().all()
    done = {
        r[0]: r[1]
        for r in (
            await db_session.execute(
                select(TrailStep.trailrun_id, func.count(func.distinct(TrailStep.activity_id)))
                .where(TrailStep.org_id == org_id, TrailStep.complete == True)  # noqa: E712
                .group_by(TrailStep.trailrun_id)
            )
        ).all()
    }
    runs_by_user: dict[int, list[TrailRun]] = {}
    for run in runs:
        runs_by_user.setdefault(run.user_id, []).append(run)
    active_now = {uid for uid, stamp in steps if rng.contains(to_day(stamp))}

    entity_rows = []
    for e in entities:
        if str(getattr(e.status, "value", getattr(e, "status", active_status))) != active_status:
            continue
        members = members_by_entity.get(e.id, [])
        user_ids = {m.user_id for m in members}
        enrollments = [run for uid in user_ids for run in runs_by_user.get(uid, [])]
        completions = sum(
            1 for run in enrollments if lessons.get(run.course_id, 0) and done.get(run.id, 0) >= lessons[run.course_id]
        )
        entity_rows.append(
            EntityRow(
                entity_uuid=getattr(e, "entity_uuid", "") or str(e.id),
                name=e.name,
                name_ar=e.name_ar,
                code=e.code,
                members=len(user_ids),
                coordinators=sum(1 for m in members if m.is_coordinator),
                active_learners=len(user_ids & active_now),
                enrollments=len(enrollments),
                completions=completions,
                completion_rate=pct(completions, len(enrollments)),
            )
        )
    entity_rows.sort(key=lambda r: r.members, reverse=True)

    current = totals(rng)
    current.entities = len(entity_rows)
    previous = totals(rng.prev)
    previous.entities = current.entities
    return PeopleReport(
        range=rng.to_read(),
        totals=current,
        previous=previous,
        monthly=list(monthly.values()),
        by_role=by_role,
        entities=entity_rows,
        unassigned_members=len(member_ids - assigned),
    )
