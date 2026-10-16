"""Platform sections switched on/off in the .env file (src/security/modules.py)."""

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from config.config import ModulesConfig, load_modules_config
from src.security.modules import (
    MODULES,
    disabled_calendar_prefixes,
    disabled_modules,
    disabled_nav_items,
    is_module_enabled,
    module_states,
    require_module,
)
from src.security.rbac.nav_items import NAV_ITEM_IDS

ENV_VARS = [f"OMNILEARN_FEATURE_{name.upper()}" for name in ModulesConfig.model_fields]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for var in ENV_VARS:
        monkeypatch.delenv(var, raising=False)
    yield monkeypatch


class TestEnvSwitches:
    def test_everything_is_on_when_nothing_is_set(self):
        assert all(module_states().values())
        assert disabled_modules() == []
        assert disabled_nav_items() == []

    @pytest.mark.parametrize("value", ["false", "False", "0", "no", "off", " OFF "])
    def test_false_like_values_turn_a_module_off(self, clean_env, value):
        clean_env.setenv("OMNILEARN_FEATURE_POSTGRADUATE", value)
        assert load_modules_config().postgraduate is False
        assert is_module_enabled("postgraduate") is False
        assert is_module_enabled("finance") is True

    @pytest.mark.parametrize("value", ["true", "1", "yes", "on", ""])
    def test_other_values_leave_it_on(self, clean_env, value):
        clean_env.setenv("OMNILEARN_FEATURE_FINANCE", value)
        assert is_module_enabled("finance") is True

    def test_each_module_has_its_own_variable(self, clean_env):
        for name in MODULES:
            clean_env.setenv(f"OMNILEARN_FEATURE_{name.upper()}", "false")
        assert set(disabled_modules()) == set(MODULES)


class TestRegistry:
    def test_modules_only_name_real_sidebar_items(self):
        for module in MODULES.values():
            assert set(module.nav_items) <= NAV_ITEM_IDS

    def test_disabled_module_hides_its_sidebar_items(self, clean_env):
        clean_env.setenv("OMNILEARN_FEATURE_POSTGRADUATE", "false")
        clean_env.setenv("OMNILEARN_FEATURE_ANALYTICS", "false")
        assert set(disabled_nav_items()) == {"postgraduate", "postgraduate-teaching", "analytics"}

    def test_calendar_events_follow_their_module(self, clean_env):
        assert disabled_calendar_prefixes() == ()
        clean_env.setenv("OMNILEARN_FEATURE_TRAINING_PROGRAMS", "false")
        assert disabled_calendar_prefixes() == ("program:",)

    def test_unknown_module_is_a_programming_error(self):
        with pytest.raises(KeyError):
            require_module("nope")


class TestRequireModule:
    def test_passes_when_on(self):
        require_module("reports")()

    def test_404_when_off(self, clean_env):
        clean_env.setenv("OMNILEARN_FEATURE_REPORTS", "false")
        with pytest.raises(HTTPException) as exc:
            require_module("reports")()
        assert exc.value.status_code == 404
        assert exc.value.detail["code"] == "module_disabled"
        assert exc.value.detail["module"] == "reports"


@pytest.fixture
async def api_client():
    from src.db.users import PublicUser
    from src.router import require_authenticated_user, v1_router
    from src.security.auth import get_current_user

    user = PublicUser(
        id=1, username="admin", first_name="A", last_name="B", email="admin@test.com", user_uuid="user_admin"
    )
    app = FastAPI()
    app.include_router(v1_router)
    # Signed in, so a 404 below can only come from the module switch.
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_authenticated_user] = lambda: user
    # No database here: a route that gets past the switch may fail later, which
    # is fine; these tests only look at whether the switch stopped it.
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as client:
        yield client


class TestRoutesAreBlocked:
    """A signed-in call to a switched-off section gets 404 ``module_disabled``."""

    @pytest.mark.parametrize(
        "module, path",
        [
            ("postgraduate", "/api/v1/programs/org/1/page/1/limit/10"),
            ("postgraduate", "/api/v1/terms?org_id=1"),
            ("training_programs", "/api/v1/training-programs/org/1/page/1/limit/10"),
            ("finance", "/api/v1/finance/org/1/summary"),
            ("finance", "/api/v1/reports/org/1/financial"),
            ("postgraduate", "/api/v1/reports/org/1/admissions"),
            ("reports", "/api/v1/reports/org/1/learning"),
            ("analytics", "/api/v1/analytics/dashboard/home"),
            ("news", "/api/v1/cms/org/aca/news"),
            ("online_classes", "/api/v1/integrations/zoom/connection?org_id=1"),
        ],
    )
    async def test_switched_off_module_answers_404(self, api_client, clean_env, module, path):
        clean_env.setenv(f"OMNILEARN_FEATURE_{module.upper()}", "false")
        res = await api_client.get(path)
        assert res.status_code == 404, res.text
        assert res.json()["detail"]["code"] == "module_disabled"

    async def test_other_sections_keep_working(self, api_client, clean_env):
        clean_env.setenv("OMNILEARN_FEATURE_FINANCE", "false")
        res = await api_client.get("/api/v1/reports/org/1/learning")
        assert "module_disabled" not in res.text

    async def test_event_tracking_is_never_blocked(self, api_client, clean_env):
        clean_env.setenv("OMNILEARN_FEATURE_ANALYTICS", "false")
        res = await api_client.get("/api/v1/analytics/status")
        assert "module_disabled" not in res.text


class TestOrgRead:
    def test_cached_org_reads_get_the_current_switches(self, clean_env):
        from src.services.orgs.orgs import _with_live_modules

        cached = {"id": 1, "config": {"config": {"modules": {"postgraduate": False}}}}
        assert _with_live_modules(cached)["config"]["config"]["modules"]["postgraduate"] is True
        clean_env.setenv("OMNILEARN_FEATURE_NEWS", "false")
        assert _with_live_modules(cached)["config"]["config"]["modules"]["news"] is False

    def test_org_without_config_is_left_alone(self):
        from src.services.orgs.orgs import _with_live_modules

        assert _with_live_modules({"id": 1, "config": None}) == {"id": 1, "config": None}
