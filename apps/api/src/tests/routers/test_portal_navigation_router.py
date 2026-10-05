"""Router tests for src/routers/portal_navigation.py."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI, HTTPException, status
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.routers.portal_navigation import router as portal_navigation_router
from src.security.auth import get_current_user
from src.security.superadmin import require_superadmin


@pytest.fixture
def regular_user():
    return PublicUser(
        id=5,
        user_uuid="user_5",
        username="learner",
        email="learner@example.com",
        first_name="Lena",
        last_name="Learner",
    )


@pytest.fixture
def superadmin_user():
    return PublicUser(
        id=1,
        user_uuid="user_1",
        username="root",
        email="root@example.com",
        first_name="Root",
        last_name="Admin",
        is_superadmin=True,
    )


@pytest.fixture
def app_as_regular_user(regular_user):
    app = FastAPI()
    app.include_router(portal_navigation_router, prefix="/api/v1/portal-navigation")
    app.dependency_overrides[get_db_session] = lambda: object()
    app.dependency_overrides[get_current_user] = lambda: regular_user
    yield app


@pytest.fixture
def app_as_superadmin(superadmin_user):
    app = FastAPI()
    app.include_router(portal_navigation_router, prefix="/api/v1/portal-navigation")
    app.dependency_overrides[get_db_session] = lambda: object()
    app.dependency_overrides[get_current_user] = lambda: superadmin_user
    app.dependency_overrides[require_superadmin] = lambda: superadmin_user
    yield app


@pytest.mark.asyncio
async def test_get_portal_navigation_returns_defaults_for_regular_user(app_as_regular_user):
    with patch(
        "src.routers.portal_navigation.get_nav_registry_and_visibility",
        new_callable=AsyncMock,
        return_value=(
            [{"id": "home", "section": "overview"}],
            {"role_global_admin": ["home"], "role_global_user": []},
        ),
    ):
        transport = ASGITransport(app=app_as_regular_user)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/portal-navigation")

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == [{"id": "home", "section": "overview"}]
    assert body["visibility"]["role_global_user"] == []


@pytest.mark.asyncio
async def test_put_portal_navigation_requires_superadmin(app_as_regular_user):
    # require_superadmin is NOT overridden here, so it runs for real and
    # should reject a plain regular_user with 403 via get_current_user's
    # lazy re-resolution — simulate that directly by overriding it to raise.
    def _deny():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin access required")

    app_as_regular_user.dependency_overrides[require_superadmin] = _deny

    transport = ASGITransport(app=app_as_regular_user)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put(
            "/api/v1/portal-navigation/role_global_instructor",
            json={"item_ids": ["home"]},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_put_portal_navigation_persists_for_superadmin(app_as_superadmin):
    with patch(
        "src.routers.portal_navigation.set_nav_visibility",
        new_callable=AsyncMock,
    ) as mock_set:
        mock_set.return_value = type(
            "Row", (), {"role_uuid": "role_global_instructor", "visible_items": ["home", "assignments"], "update_date": "now"}
        )()

        transport = ASGITransport(app=app_as_superadmin)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.put(
                "/api/v1/portal-navigation/role_global_instructor",
                json={"item_ids": ["home", "assignments"]},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["visible_items"] == ["home", "assignments"]
    mock_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_put_portal_navigation_rejects_unknown_role(app_as_superadmin):
    with patch(
        "src.routers.portal_navigation.set_nav_visibility",
        new_callable=AsyncMock,
        side_effect=HTTPException(status_code=400, detail="Unknown system role_uuid: bogus"),
    ):
        transport = ASGITransport(app=app_as_superadmin)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.put(
                "/api/v1/portal-navigation/bogus",
                json={"item_ids": ["home"]},
            )

    assert response.status_code == 400
