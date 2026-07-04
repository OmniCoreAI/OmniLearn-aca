"""
Coverage for the Academic Management RBAC resolution branches.

Targets the program_/cohort_/semester_/trainingprogram_ prefixes wired
into:
- src/security/rbac/utils.py            (check_element_type, get_element_organization_id)
- src/security/rbac/resource_access.py  (_get_resource for the academic models)
- src/security/rbac/config.py           (RESOURCE_CONFIGS entries)

These exercise the real RBAC resolution functions (no bypass) with academic rows
inserted directly via their model classes.
"""

import pytest
from unittest.mock import Mock
from starlette.requests import Request

from src.security.rbac.utils import (
    check_element_type,
    get_element_organization_id,
)
from src.security.rbac.config import RESOURCE_CONFIGS
from src.security.rbac.resource_access import ResourceAccessChecker
from src.db.users import AnonymousUser
from src.db.academic.programs import Program, ProgramLevel
from src.db.academic.cohorts import Cohort
from src.db.academic.semesters import Semester
from src.db.academic.training_programs import TrainingProgram, TrainingType


# ---------------------------------------------------------------------------
# Row helpers
# ---------------------------------------------------------------------------

async def _insert_program(db, org, uuid="program_test"):
    p = Program(
        name="Test Program",
        program_level=ProgramLevel.MASTERS,
        public=True,
        published=True,
        org_id=org.id,
        program_uuid=uuid,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _insert_cohort(db, org, program, uuid="cohort_test"):
    c = Cohort(name="2026 Intake", org_id=org.id, program_id=program.id, cohort_uuid=uuid)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def _insert_semester(db, org, program, cohort, uuid="semester_test"):
    s = Semester(
        name="Semester 1",
        org_id=org.id,
        cohort_id=cohort.id,
        program_id=program.id,
        semester_uuid=uuid,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def _insert_training_program(db, org, uuid="trainingprogram_test"):
    tp = TrainingProgram(
        name="Docker Bootcamp",
        training_type=TrainingType.BOOTCAMP,
        public=True,
        published=True,
        org_id=org.id,
        trainingprogram_uuid=uuid,
    )
    db.add(tp)
    await db.commit()
    await db.refresh(tp)
    return tp


# ---------------------------------------------------------------------------
# check_element_type — prefix -> rights bucket
# ---------------------------------------------------------------------------

class TestCheckElementType:
    @pytest.mark.asyncio
    async def test_program_prefix(self):
        assert await check_element_type("program_abc") == "programs"

    @pytest.mark.asyncio
    async def test_cohort_prefix(self):
        assert await check_element_type("cohort_abc") == "programs"

    @pytest.mark.asyncio
    async def test_semester_prefix(self):
        assert await check_element_type("semester_abc") == "programs"

    @pytest.mark.asyncio
    async def test_training_program_prefix(self):
        # Must be resolved before "program_" to avoid a substring collision.
        assert await check_element_type("trainingprogram_abc") == "training_programs"


# ---------------------------------------------------------------------------
# get_element_organization_id — resolve owning org for each academic type
# ---------------------------------------------------------------------------

class TestGetElementOrgId:
    @pytest.mark.asyncio
    async def test_program_org_id(self, db, org):
        await _insert_program(db, org, uuid="program_org")
        assert await get_element_organization_id("program_org", db) == org.id

    @pytest.mark.asyncio
    async def test_cohort_org_id(self, db, org):
        p = await _insert_program(db, org, uuid="program_forcohort")
        await _insert_cohort(db, org, p, uuid="cohort_org")
        assert await get_element_organization_id("cohort_org", db) == org.id

    @pytest.mark.asyncio
    async def test_semester_org_id(self, db, org):
        p = await _insert_program(db, org, uuid="program_forsem")
        c = await _insert_cohort(db, org, p, uuid="cohort_forsem")
        await _insert_semester(db, org, p, c, uuid="semester_org")
        assert await get_element_organization_id("semester_org", db) == org.id

    @pytest.mark.asyncio
    async def test_training_program_org_id(self, db, org):
        await _insert_training_program(db, org, uuid="trainingprogram_org")
        assert await get_element_organization_id("trainingprogram_org", db) == org.id


# ---------------------------------------------------------------------------
# resource_access._get_resource — resolve each academic model by uuid
# ---------------------------------------------------------------------------

class TestGetResourceAcademic:
    def _checker(self, db):
        request = Mock(spec=Request)
        request.state = type("S", (), {})()
        return ResourceAccessChecker(request, db, AnonymousUser())

    @pytest.mark.asyncio
    async def test_get_resource_program(self, db, org):
        await _insert_program(db, org, uuid="program_load")
        checker = self._checker(db)
        resource = await checker._get_resource("program_load", RESOURCE_CONFIGS["programs"])
        assert resource is not None
        assert resource.program_uuid == "program_load"

    @pytest.mark.asyncio
    async def test_get_resource_training_program(self, db, org):
        await _insert_training_program(db, org, uuid="trainingprogram_load")
        checker = self._checker(db)
        resource = await checker._get_resource(
            "trainingprogram_load", RESOURCE_CONFIGS["training_programs"]
        )
        assert resource is not None
        assert resource.trainingprogram_uuid == "trainingprogram_load"

    @pytest.mark.asyncio
    async def test_get_resource_cohort(self, db, org):
        p = await _insert_program(db, org, uuid="program_loadcohort")
        await _insert_cohort(db, org, p, uuid="cohort_load")
        checker = self._checker(db)
        resource = await checker._get_resource("cohort_load", RESOURCE_CONFIGS["cohorts"])
        assert resource is not None
        assert resource.cohort_uuid == "cohort_load"

    @pytest.mark.asyncio
    async def test_get_resource_semester(self, db, org):
        p = await _insert_program(db, org, uuid="program_loadsem")
        c = await _insert_cohort(db, org, p, uuid="cohort_loadsem")
        await _insert_semester(db, org, p, c, uuid="semester_load")
        checker = self._checker(db)
        resource = await checker._get_resource("semester_load", RESOURCE_CONFIGS["semesters"])
        assert resource is not None
        assert resource.semester_uuid == "semester_load"


# ---------------------------------------------------------------------------
# RESOURCE_CONFIGS wiring
# ---------------------------------------------------------------------------

class TestAcademicResourceConfigs:
    def test_top_level_configs_present(self):
        assert RESOURCE_CONFIGS["programs"].uuid_prefix == "program_"
        assert RESOURCE_CONFIGS["training_programs"].uuid_prefix == "trainingprogram_"

    def test_child_configs_delegate_to_parents(self):
        assert RESOURCE_CONFIGS["cohorts"].parent_resource_type == "programs"
        assert RESOURCE_CONFIGS["semesters"].parent_resource_type == "cohorts"

    def test_subjects_config_removed(self):
        # The Subject layer was dropped; courses link directly to a Semester.
        assert "subjects" not in RESOURCE_CONFIGS
