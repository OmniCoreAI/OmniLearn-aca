"""Entities, coordinators (role 2), entity groups, positions and audience assignment."""
from contextlib import ExitStack
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.academic.course_profiles import CourseAcademicProfile
from src.db.academic.links import TrainingProgramCourse
from src.db.academic.training_programs import TrainingProgram
from src.db.administration.audience import AudienceAssignmentCreate
from src.db.administration.entities import (
    CoordinatorAssign,
    CoordinatorPermissions,
    EntityCreate,
    EntityGroupCreate,
    EntityMemberCreate,
    EntityMemberUpdate,
    EntityNewUser,
    EntityUpdate,
    PositionCreate,
)
from src.db.courses.courses import Course
from src.db.roles import DashboardPermission, Role, RoleTypeEnum
from src.db.trail_runs import TrailRun
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroups import UserGroup, UserGroupUpdate
from src.db.users import PublicUser, User
from src.security.org_auth import is_org_admin
from src.security.rbac.rbac import check_usergroup_access
from src.services.academic import training_programs as tp_svc
from src.services.administration import audience as aud_svc
from src.services.administration import entities as ent_svc
from src.services.administration import entity_coordination as coordination_svc
from src.services.administration.authz import authorize_admin
from src.services.administration.overview import get_overview
from src.services.finance.authz import authorize_finance_management
from src.services.instructors.authz import authorize_instructor_management
from src.services.users import usergroups as ug_svc
from src.tests.conftest import USER_RIGHTS


def _provisioning_patches():
    stack = ExitStack()
    for target in (
        "src.services.orgs.users.check_limits_with_usage",
        "src.services.orgs.users.increase_feature_usage",
        "src.services.orgs.users.track",
        "src.services.orgs.users.dispatch_webhooks",
        "src.services.admin.admin.track",
    ):
        stack.enter_context(patch(target, new_callable=AsyncMock))
    return stack


@pytest.fixture
async def coordinator_role(db, org):
    rights = USER_RIGHTS.model_copy(update={"dashboard": DashboardPermission(action_access=True)})
    r = Role(
        id=2,
        name="Entity Coordinator",
        org_id=org.id,
        role_type=RoleTypeEnum.TYPE_ORGANIZATION,
        role_uuid="role_global_maintainer",
        rights=rights.model_dump(),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(r)
    await db.commit()
    return r


async def _make_user(db, org, uid, username, role_id=4) -> PublicUser:
    u = User(
        id=uid,
        username=username,
        first_name=username.capitalize(),
        last_name="Test",
        email=f"{username}@test.com",
        password="x",
        user_uuid=f"user_{username}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    db.add(
        UserOrganization(
            user_id=uid,
            org_id=org.id,
            role_id=role_id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db.commit()
    return PublicUser(
        id=uid, username=username, first_name=u.first_name, last_name=u.last_name, email=u.email, user_uuid=u.user_uuid
    )


async def _role_of(db, org, user_id) -> int:
    return (
        await db.execute(
            select(UserOrganization.role_id).where(
                UserOrganization.user_id == user_id, UserOrganization.org_id == org.id
            )
        )
    ).scalar_one()


async def _entity(db, admin_user, org, name="Ministry of Communications", **extra):
    return await ent_svc.create_entity(db, admin_user, org.id, EntityCreate(name=name, **extra))


async def _coordinated_entity(db, admin_user, org, coordinator_role, username="coord", uid=20, **extra):
    entity = await _entity(db, admin_user, org, **extra)
    coord = await _make_user(db, org, uid, username)
    await ent_svc.assign_coordinator(db, admin_user, entity.entity_uuid, CoordinatorAssign(user_uuid=coord.user_uuid))
    return entity, coord


async def _restricted_course(db, org, cid=50, uuid="course_cyber", name="Cybersecurity Fundamentals"):
    c = Course(
        id=cid,
        name=name,
        description="",
        public=False,
        published=True,
        open_to_contributors=False,
        org_id=org.id,
        course_uuid=uuid,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(c)
    await db.commit()
    return c


async def _add_member(db, actor, entity, user, **extra):
    return await ent_svc.add_member(db, actor, entity.entity_uuid, EntityMemberCreate(user_uuid=user.user_uuid, **extra))


def _assign(resource_uuid, audience_type, audience_uuid, **extra):
    return AudienceAssignmentCreate(
        resource_type=extra.pop("resource_type", "course"),
        resource_uuid=resource_uuid,
        audience_type=audience_type,
        audience_uuid=audience_uuid,
        **extra,
    )


class TestEntities:
    @pytest.mark.asyncio
    async def test_create_builds_locked_members_group(self, db, org, admin_user):
        entity = await _entity(db, admin_user, org, code="mcit")
        assert entity.code == "MCIT"
        assert entity.coordinator_permissions.can_add_instructors is False
        group = (
            await db.execute(select(UserGroup).where(UserGroup.usergroup_uuid == entity.members_group_uuid))
        ).scalar_one()
        assert group.group_type == "system"
        assert group.managed_key == f"entity:{entity.entity_uuid}"

        with pytest.raises(HTTPException) as exc:
            await _entity(db, admin_user, org, name="Other", code="MCIT")
        assert exc.value.status_code == 409

        counts = await get_overview(db, admin_user, org.id)
        assert counts["entities"] == 1

        # The generic user-groups API refuses to touch the system group.
        request = MagicMock()
        with pytest.raises(HTTPException) as exc:
            await ug_svc.update_usergroup_by_id(request, db, admin_user, group.id, UserGroupUpdate(name="x"))
        assert exc.value.status_code == 409
        with pytest.raises(HTTPException) as exc:
            await ug_svc.delete_usergroup_by_id(request, db, admin_user, group.id)
        assert exc.value.status_code == 409
        with pytest.raises(HTTPException) as exc:
            await ug_svc.add_users_to_usergroup(request, db, admin_user, group.id, "2")
        assert exc.value.status_code == 409
        listed = await ug_svc.read_usergroups_by_org_id(request, db, admin_user, org.id)
        assert [(g.managed, g.entity_name) for g in listed] == [(True, "Ministry of Communications")]

    @pytest.mark.asyncio
    async def test_parent_cycle_rejected(self, db, org, admin_user):
        parent = await _entity(db, admin_user, org, name="Ministry")
        child = await _entity(db, admin_user, org, name="IT Directorate", parent_uuid=parent.entity_uuid)
        assert child.parent_name == "Ministry"
        with pytest.raises(HTTPException) as exc:
            await ent_svc.update_entity(db, admin_user, parent.entity_uuid, EntityUpdate(parent_uuid=child.entity_uuid))
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_regular_user_cannot_manage_entities(self, db, org, admin_user, regular_user):
        entity = await _entity(db, admin_user, org)
        with pytest.raises(HTTPException) as exc:
            await ent_svc.list_entities(db, regular_user, org.id)
        assert exc.value.status_code == 403
        with pytest.raises(HTTPException) as exc:
            await ent_svc.get_entity(db, regular_user, entity.entity_uuid)
        assert exc.value.status_code == 403


class TestCoordinator:
    @pytest.mark.asyncio
    async def test_assign_promotes_trainee_and_removal_demotes(self, db, org, admin_user, coordinator_role):
        entity, coord = await _coordinated_entity(db, admin_user, org, coordinator_role)
        assert await _role_of(db, org, coord.id) == 2
        mine = await ent_svc.list_my_entities(db, coord, org.id)
        assert [e.entity_uuid for e in mine] == [entity.entity_uuid]
        assert mine[0].viewer_is_coordinator is True
        assert [c.user_uuid for c in (await ent_svc.get_entity(db, admin_user, entity.entity_uuid)).coordinators] == [coord.user_uuid]

        # Removal accepts the coordinator's user uuid (as listed on the entity).
        await ent_svc.remove_coordinator(db, admin_user, entity.entity_uuid, coord.user_uuid)
        assert await _role_of(db, org, coord.id) == 4
        assert await ent_svc.list_my_entities(db, coord, org.id) == []

    @pytest.mark.asyncio
    async def test_other_staff_roles_are_not_changed(self, db, org, admin_user):
        entity = await _entity(db, admin_user, org)
        instructor = await _make_user(db, org, 21, "teacher", role_id=3)
        with pytest.raises(HTTPException) as exc:
            await ent_svc.assign_coordinator(db, admin_user, entity.entity_uuid, CoordinatorAssign(user_uuid=instructor.user_uuid))
        assert exc.value.status_code == 409
        # An academy admin can coordinate without losing role 1.
        await ent_svc.assign_coordinator(db, admin_user, entity.entity_uuid, CoordinatorAssign(user_uuid=admin_user.user_uuid))
        assert await _role_of(db, org, admin_user.id) == 1

    @pytest.mark.asyncio
    async def test_new_coordinator_account(self, db, org, admin_user):
        entity = await _entity(db, admin_user, org)
        with _provisioning_patches():
            read = await ent_svc.assign_coordinator(
                db,
                admin_user,
                entity.entity_uuid,
                CoordinatorAssign(new_user=EntityNewUser(first_name="Mona", last_name="Ali", email="Mona@Ministry.gov.eg")),
            )
        assert read.is_coordinator and read.temporary_password
        assert read.email == "mona@ministry.gov.eg"
        user = (await db.execute(select(User).where(User.email == "mona@ministry.gov.eg"))).scalar_one()
        assert await _role_of(db, org, user.id) == 2

    @pytest.mark.asyncio
    async def test_scope_and_capabilities(self, db, org, admin_user, coordinator_role):
        entity, coord = await _coordinated_entity(db, admin_user, org, coordinator_role)
        other = await _entity(db, admin_user, org, name="University")

        # Own entity: read + groups; other entity: 403.
        await ent_svc.get_entity(db, coord, entity.entity_uuid)
        group = await ent_svc.create_entity_group(db, coord, entity.entity_uuid, EntityGroupCreate(name="IT Department", group_type="department"))
        assert group.group_type == "department"
        with pytest.raises(HTTPException) as exc:
            await ent_svc.get_entity(db, coord, other.entity_uuid)
        assert exc.value.status_code == 403
        with pytest.raises(HTTPException) as exc:
            await ent_svc.list_members(db, coord, other.entity_uuid)
        assert exc.value.status_code == 403

        # Coordinators cannot edit the entity itself or its permissions.
        with pytest.raises(HTTPException) as exc:
            await ent_svc.update_entity(
                db, coord, entity.entity_uuid, EntityUpdate(coordinator_permissions=CoordinatorPermissions(can_add_instructors=True))
            )
        assert exc.value.status_code == 403

        # Capability switched off by the academy → 403.
        await ent_svc.update_entity(
            db, admin_user, entity.entity_uuid, EntityUpdate(coordinator_permissions=CoordinatorPermissions(can_manage_groups=False))
        )
        with pytest.raises(HTTPException) as exc:
            await ent_svc.create_entity_group(db, coord, entity.entity_uuid, EntityGroupCreate(name="HR"))
        assert exc.value.status_code == 403

        # Coordinators add members by email, never by browsing org users.
        trainee = await _make_user(db, org, 22, "trainee")
        with pytest.raises(HTTPException) as exc:
            await _add_member(db, coord, entity, trainee)
        assert exc.value.status_code == 403
        read = await ent_svc.add_member(
            db, coord, entity.entity_uuid,
            EntityMemberCreate(new_user=EntityNewUser(first_name="T", email="trainee@test.com")),
        )
        assert read.user.user_uuid == trainee.user_uuid and read.temporary_password is None

    @pytest.mark.asyncio
    async def test_role_2_has_no_academy_admin_power(self, db, org, admin_user, coordinator_role):
        _entity_read, coord = await _coordinated_entity(db, admin_user, org, coordinator_role)
        assert await is_org_admin(coord.id, org.id, db) is False
        for call in (
            authorize_admin(db, coord, org.id, "configuration", "read"),
            authorize_admin(db, coord, org.id, "entities", "read"),
            authorize_instructor_management(db, coord, org.id, "read"),
            authorize_finance_management(db, coord, org.id, "read"),
        ):
            with pytest.raises(HTTPException) as exc:
                await call
            assert exc.value.status_code == 403
        with pytest.raises(HTTPException) as exc:
            await ent_svc.list_entities(db, coord, org.id)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_non_coordinator_member_with_role_2_is_denied(self, db, org, admin_user, coordinator_role):
        entity = await _entity(db, admin_user, org)
        stray = await _make_user(db, org, 23, "stray", role_id=2)
        with pytest.raises(HTTPException) as exc:
            await ent_svc.get_entity(db, stray, entity.entity_uuid)
        assert exc.value.status_code == 403


class TestMembers:
    @pytest.mark.asyncio
    async def test_add_update_deactivate_remove(self, db, org, admin_user, regular_user):
        entity = await _entity(db, admin_user, org)
        manager = await ent_svc.create_position(db, admin_user, org.id, PositionCreate(name="Manager"))
        group = await ent_svc.create_entity_group(db, admin_user, entity.entity_uuid, EntityGroupCreate(name="IT Department"))
        member = await _add_member(
            db, admin_user, entity, regular_user,
            position_uuid=manager.position_uuid, employee_id="E-1", group_uuids=[group.usergroup_uuid],
        )
        assert member.position_name == "Manager"
        assert [g.name for g in member.groups] == ["IT Department"]
        page = await ent_svc.list_members(db, admin_user, entity.entity_uuid, group_uuid=group.usergroup_uuid)
        assert page.total == 1

        other = await _make_user(db, org, 24, "other")
        with pytest.raises(HTTPException) as exc:
            await _add_member(db, admin_user, entity, other, employee_id="E-1")
        assert exc.value.status_code == 409

        entity_read = await ent_svc.get_entity(db, admin_user, entity.entity_uuid)
        assert entity_read.member_count == 1 and entity_read.group_count == 1

        updated = await ent_svc.update_member(db, admin_user, entity.entity_uuid, member.member_uuid, EntityMemberUpdate(status="inactive"))
        assert updated.groups == []
        assert (await ent_svc.get_entity(db, admin_user, entity.entity_uuid)).member_count == 0

        await ent_svc.remove_member(db, admin_user, entity.entity_uuid, member.member_uuid)
        assert (await ent_svc.list_members(db, admin_user, entity.entity_uuid)).total == 0

    @pytest.mark.asyncio
    async def test_foreign_position_rejected(self, db, org, admin_user, regular_user):
        a = await _entity(db, admin_user, org, name="A")
        b = await _entity(db, admin_user, org, name="B")
        b_only = await ent_svc.create_position(db, admin_user, org.id, PositionCreate(name="Dean", entity_uuid=b.entity_uuid))
        with pytest.raises(HTTPException) as exc:
            await _add_member(db, admin_user, a, regular_user, position_uuid=b_only.position_uuid)
        assert exc.value.status_code == 400
        positions = await ent_svc.list_positions(db, admin_user, org.id, a.entity_uuid)
        assert positions == []


class TestAudience:
    @pytest.mark.asyncio
    async def test_entity_assignment_restricts_course_to_members(self, db, org, admin_user, regular_user):
        course = await _restricted_course(db, org)
        entity = await _entity(db, admin_user, org)
        outsider = await _make_user(db, org, 25, "outsider")
        await _add_member(db, admin_user, entity, regular_user)
        assert await check_usergroup_access(course.course_uuid, outsider.id, db) is True  # no links yet

        with _provisioning_patches():
            assignment = await aud_svc.create_assignment(
                db, admin_user, _assign(course.course_uuid, "entity", entity.entity_uuid, auto_enroll=True)
            )
        assert assignment.member_count == 1
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is True
        assert await check_usergroup_access(course.course_uuid, outsider.id, db) is False
        runs = (await db.execute(select(TrailRun).where(TrailRun.course_id == course.id))).scalars().all()
        assert [r.user_id for r in runs] == [regular_user.id]

        with pytest.raises(HTTPException) as exc:
            await aud_svc.create_assignment(db, admin_user, _assign(course.course_uuid, "entity", entity.entity_uuid))
        assert exc.value.status_code == 409

        audience = await aud_svc.get_resource_audience(db, admin_user, "course", course.course_uuid)
        assert audience.covered_users == 1 and audience.other_groups == []
        listed = {e.entity_uuid: e for e in await ent_svc.list_entities(db, admin_user, org.id)}
        assert listed[entity.entity_uuid].learning_count == 1

        await aud_svc.delete_assignment(db, admin_user, assignment.assignment_uuid)
        listed = {e.entity_uuid: e for e in await ent_svc.list_entities(db, admin_user, org.id)}
        assert listed[entity.entity_uuid].learning_count == 0
        links = (await db.execute(select(UserGroupResource).where(UserGroupResource.resource_uuid == course.course_uuid))).scalars().all()
        assert links == []

    @pytest.mark.asyncio
    async def test_entity_assignment_skips_coordinators(self, db, org, admin_user, regular_user, coordinator_role):
        course = await _restricted_course(db, org)
        entity, coord = await _coordinated_entity(db, admin_user, org, coordinator_role)
        await _add_member(db, admin_user, entity, regular_user)

        with _provisioning_patches():
            assignment = await aud_svc.create_assignment(
                db, admin_user, _assign(course.course_uuid, "entity", entity.entity_uuid, auto_enroll=True)
            )
        # Coordinators manage the entity's learning; only members are enrolled.
        assert assignment.member_count == 1
        assert await check_usergroup_access(course.course_uuid, coord.id, db) is False
        runs = (await db.execute(select(TrailRun).where(TrailRun.course_id == course.id))).scalars().all()
        assert [r.user_id for r in runs] == [regular_user.id]
        progress = await coordination_svc.get_entity_progress(db, admin_user, entity.entity_uuid)
        assert [m.user.user_uuid for m in progress.members] == [regular_user.user_uuid]

        # Back to a regular member: entity-wide learning applies again.
        with _provisioning_patches():
            await ent_svc.remove_coordinator(db, admin_user, entity.entity_uuid, coord.user_uuid)
        assert await check_usergroup_access(course.course_uuid, coord.id, db) is True

    @pytest.mark.asyncio
    async def test_inactive_group_stops_granting_access(self, db, org, admin_user, regular_user):
        course = await _restricted_course(db, org)
        entity = await _entity(db, admin_user, org)
        group = await ent_svc.create_entity_group(db, admin_user, entity.entity_uuid, EntityGroupCreate(name="IT"))
        member = await _add_member(db, admin_user, entity, regular_user)
        await ent_svc.set_entity_group_members(db, admin_user, entity.entity_uuid, group.usergroup_uuid, [member.member_uuid])
        await aud_svc.create_assignment(db, admin_user, _assign(course.course_uuid, "usergroup", group.usergroup_uuid))
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is True
        from src.db.administration.entities import EntityGroupUpdate

        await ent_svc.update_entity_group(db, admin_user, entity.entity_uuid, group.usergroup_uuid, EntityGroupUpdate(status="inactive"))
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is False

    @pytest.mark.asyncio
    async def test_position_audience_follows_member_changes(self, db, org, admin_user, regular_user):
        course = await _restricted_course(db, org)
        entity = await _entity(db, admin_user, org)
        manager = await ent_svc.create_position(db, admin_user, org.id, PositionCreate(name="Manager"))
        engineer = await ent_svc.create_position(db, admin_user, org.id, PositionCreate(name="Engineer"))
        member = await _add_member(db, admin_user, entity, regular_user, position_uuid=engineer.position_uuid)
        await aud_svc.create_assignment(
            db, admin_user, _assign(course.course_uuid, "position", manager.position_uuid, entity_uuid=entity.entity_uuid)
        )
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is False

        await ent_svc.update_member(db, admin_user, entity.entity_uuid, member.member_uuid, EntityMemberUpdate(position_uuid=manager.position_uuid))
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is True

        await ent_svc.update_member(db, admin_user, entity.entity_uuid, member.member_uuid, EntityMemberUpdate(position_uuid=engineer.position_uuid))
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is False

        # Deleting the position removes the assignment and its system group.
        await ent_svc.delete_position(db, admin_user, manager.position_uuid)
        assert (await aud_svc.get_resource_audience(db, admin_user, "course", course.course_uuid)).assignments == []
        sys_groups = (await db.execute(select(UserGroup).where(UserGroup.managed_key.like("audience:%")))).scalars().all()
        assert sys_groups == []

    @pytest.mark.asyncio
    async def test_listener_gets_newly_covered_users(self, db, org, admin_user, regular_user):
        course = await _restricted_course(db, org)
        calls = []

        async def listener(_db, org_id, rtype, ruuid, user_ids):
            calls.append((org_id, rtype, ruuid, user_ids))

        aud_svc.register_audience_listener(listener)
        try:
            await aud_svc.create_assignment(db, admin_user, _assign(course.course_uuid, "user", regular_user.user_uuid))
            await aud_svc.resync_resource(db, admin_user, "course", course.course_uuid)
        finally:
            aud_svc._LISTENERS.remove(listener)
        assert calls == [(org.id, "course", course.course_uuid, [regular_user.id])]

    @pytest.mark.asyncio
    async def test_training_program_links_courses(self, db, org, admin_user, regular_user):
        c1 = await _restricted_course(db, org, 51, "course_one", "One")
        c2 = await _restricted_course(db, org, 52, "course_two", "Two")
        tp = TrainingProgram(
            name="Cyber Track", org_id=org.id, trainingprogram_uuid="trainingprogram_cyber",
            published=True, public=False, creation_date="", update_date="",
        )
        db.add(tp)
        await db.commit()
        for course in (c1, c2):
            db.add(TrainingProgramCourse(training_program_id=tp.id, course_id=course.id, org_id=org.id))
        await db.commit()
        entity = await _entity(db, admin_user, org)
        await _add_member(db, admin_user, entity, regular_user)
        await aud_svc.create_assignment(
            db, admin_user,
            _assign(tp.trainingprogram_uuid, "entity", entity.entity_uuid, resource_type="training_program"),
        )
        for uuid in (tp.trainingprogram_uuid, c1.course_uuid, c2.course_uuid):
            assert await check_usergroup_access(uuid, regular_user.id, db) is True

        with patch.object(tp_svc, "check_resource_access", new=AsyncMock()):
            await tp_svc.unlink_course_from_training_program(MagicMock(), tp.trainingprogram_uuid, c2.course_uuid, admin_user, db)
        links = (await db.execute(select(UserGroupResource).where(UserGroupResource.resource_uuid == c2.course_uuid))).scalars().all()
        assert links == []
        assert await check_usergroup_access(c1.course_uuid, regular_user.id, db) is True


class TestCoordinatorAssignments:
    @pytest.mark.asyncio
    async def test_only_available_courses_within_own_entity(self, db, org, admin_user, regular_user, coordinator_role):
        entity, coord = await _coordinated_entity(db, admin_user, org, coordinator_role)
        other = await _entity(db, admin_user, org, name="University")
        course = await _restricted_course(db, org)
        hidden = await _restricted_course(db, org, 53, "course_hidden", "Hidden")
        group = await ent_svc.create_entity_group(db, coord, entity.entity_uuid, EntityGroupCreate(name="IT Department"))
        other_group = await ent_svc.create_entity_group(db, admin_user, other.entity_uuid, EntityGroupCreate(name="Faculty"))
        member = await ent_svc.add_member(
            db, coord, entity.entity_uuid,
            EntityMemberCreate(new_user=EntityNewUser(first_name="R", email="regular@test.com"), group_uuids=[group.usergroup_uuid]),
        )
        assert member.user.user_uuid == regular_user.user_uuid

        # Not yet available → 403.
        with pytest.raises(HTTPException) as exc:
            await aud_svc.create_assignment(db, coord, _assign(course.course_uuid, "usergroup", group.usergroup_uuid, entity_uuid=entity.entity_uuid))
        assert exc.value.status_code == 403

        available = await aud_svc.create_assignment(
            db, admin_user, _assign(course.course_uuid, "entity", entity.entity_uuid, mode="available")
        )
        # "Available" alone grants nothing.
        assert await check_usergroup_access(course.course_uuid, 99, db) is True
        learning = await aud_svc.list_entity_learning(db, coord, entity.entity_uuid)
        assert [r.resource_uuid for r in learning] == [course.course_uuid]

        assigned = await aud_svc.create_assignment(
            db, coord, _assign(course.course_uuid, "usergroup", group.usergroup_uuid, entity_uuid=entity.entity_uuid)
        )
        assert assigned.entity_uuid == entity.entity_uuid
        assert await check_usergroup_access(course.course_uuid, regular_user.id, db) is True

        for payload, code in (
            (_assign(hidden.course_uuid, "usergroup", group.usergroup_uuid, entity_uuid=entity.entity_uuid), 403),
            (_assign(course.course_uuid, "usergroup", other_group.usergroup_uuid, entity_uuid=entity.entity_uuid), 403),
            (_assign(course.course_uuid, "entity", entity.entity_uuid, entity_uuid=entity.entity_uuid, mode="available"), 403),
            (_assign(course.course_uuid, "usergroup", group.usergroup_uuid), 403),
            (_assign(course.course_uuid, "entity", other.entity_uuid, entity_uuid=other.entity_uuid), 403),
        ):
            with pytest.raises(HTTPException) as exc:
                await aud_svc.create_assignment(db, coord, payload)
            assert exc.value.status_code == code

        # Picker only offers the coordinator's entity.
        options = await aud_svc.audience_options(db, coord, org.id, q="a", entity_uuid=entity.entity_uuid)
        assert {o.audience_uuid for o in options if o.audience_type == "usergroup"} == {group.usergroup_uuid}
        with pytest.raises(HTTPException):
            await aud_svc.audience_options(db, coord, org.id)

        # Capability off → cannot assign.
        await ent_svc.update_entity(
            db, admin_user, entity.entity_uuid, EntityUpdate(coordinator_permissions=CoordinatorPermissions(can_assign_training=False))
        )
        with pytest.raises(HTTPException) as exc:
            await aud_svc.delete_assignment(db, coord, assigned.assignment_uuid)
        assert exc.value.status_code == 403

        # Withdrawing availability withdraws the coordinator's assignment too.
        await aud_svc.delete_assignment(db, admin_user, available.assignment_uuid)
        assert await aud_svc.list_entity_learning(db, admin_user, entity.entity_uuid) == []
        links = (await db.execute(select(UserGroupResource).where(UserGroupResource.resource_uuid == course.course_uuid))).scalars().all()
        assert links == []


class TestTrainingProgramVisibility:
    @pytest.mark.asyncio
    async def test_management_list_is_admins_and_program_staff(self, db, org, admin_user, regular_user):
        coordinator = await _make_user(db, org, 30, "tpcoord", role_id=3)
        trainer = await _make_user(db, org, 31, "tptrainer", role_id=3)
        for uuid, name, published, coordinator_id in (
            ("trainingprogram_live", "Live", True, None),
            ("trainingprogram_draft", "Draft", False, None),
            ("trainingprogram_mine", "Mine", False, coordinator.id),
        ):
            db.add(TrainingProgram(
                name=name, org_id=org.id, trainingprogram_uuid=uuid, published=published,
                public=False, coordinator_id=coordinator_id, creation_date="", update_date="",
            ))
        await db.commit()
        # The trainer teaches a course linked to "Draft".
        course = await _restricted_course(db, org)
        draft = (await db.execute(select(TrainingProgram).where(TrainingProgram.name == "Draft"))).scalar_one()
        db.add(TrainingProgramCourse(training_program_id=draft.id, course_id=course.id, org_id=org.id))
        db.add(CourseAcademicProfile(course_id=course.id, org_id=org.id, instructor_id=trainer.id, profile_uuid="profile_t"))
        await db.commit()

        async def names(user):
            return {tp.name for tp in await tp_svc.get_training_programs_by_org(MagicMock(), org.id, user, db)}

        assert await names(admin_user) == {"Live", "Draft", "Mine"}
        assert await names(coordinator) == {"Mine"}
        assert await names(trainer) == {"Draft"}
        # Learners use the catalog, not the management list.
        assert await names(regular_user) == set()

    @pytest.mark.asyncio
    async def test_catalog_shows_open_and_assigned_published_programs(self, db, org, admin_user, regular_user):
        outsider = await _make_user(db, org, 32, "outsider2")
        for uuid, name, published, public in (
            ("trainingprogram_open", "Open", True, False),
            ("trainingprogram_assigned", "Assigned", True, False),
            ("trainingprogram_public", "Public", True, True),
            ("trainingprogram_unpublished", "Unpublished", False, False),
        ):
            db.add(TrainingProgram(
                name=name, org_id=org.id, trainingprogram_uuid=uuid, published=published,
                public=public, creation_date="", update_date="",
            ))
        await db.commit()
        entity = await _entity(db, admin_user, org)
        await _add_member(db, admin_user, entity, regular_user)
        await aud_svc.create_assignment(
            db, admin_user,
            _assign("trainingprogram_assigned", "entity", entity.entity_uuid, resource_type="training_program"),
        )

        mine = {p.name: p.assigned for p in await tp_svc.get_training_program_catalog(org.id, regular_user, db)}
        assert mine == {"Open": False, "Assigned": True, "Public": False}
        theirs = {p.name for p in await tp_svc.get_training_program_catalog(org.id, outsider, db)}
        assert theirs == {"Open", "Public"}


class TestProgramListVisibility:
    @pytest.mark.asyncio
    async def test_program_list_is_admins_and_coordinators(self, db, org, admin_user, regular_user):
        from src.db.academic.cohorts import Cohort
        from src.db.academic.programs import Program
        from src.services.academic import programs as programs_svc

        program_coord = await _make_user(db, org, 40, "pcoord", role_id=3)
        cohort_coord = await _make_user(db, org, 41, "ccoord", role_id=3)
        db.add(Program(name="MSc AI", org_id=org.id, program_uuid="program_ai", coordinator_id=program_coord.id,
                       creation_date="", update_date=""))
        db.add(Program(name="MSc Data", org_id=org.id, program_uuid="program_data", creation_date="", update_date=""))
        await db.commit()
        data = (await db.execute(select(Program).where(Program.program_uuid == "program_data"))).scalar_one()
        db.add(Cohort(name="2026", org_id=org.id, program_id=data.id, coordinator_id=cohort_coord.id,
                      cohort_uuid="cohort_2026", creation_date="", update_date=""))
        await db.commit()

        async def names(user):
            return {p.name for p in await programs_svc.get_programs_by_org(MagicMock(), org.id, user, db, 1, 50)}

        assert await names(admin_user) == {"MSc AI", "MSc Data"}
        assert await names(program_coord) == {"MSc AI"}
        assert await names(cohort_coord) == {"MSc Data"}
        assert await names(regular_user) == set()
