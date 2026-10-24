"""Router tests for src/routers/calendar.py."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser
from src.routers.calendar import router as calendar_router
from src.security.auth import get_current_user


@pytest.fixture
def app():
    app = FastAPI()
    app.include_router(calendar_router, prefix="/api/v1/calendar")
    app.dependency_overrides[get_db_session] = lambda: AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=7)
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_requires_authentication(app, client):
    app.dependency_overrides[get_current_user] = lambda: AnonymousUser()
    response = await client.get("/api/v1/calendar/events", params={"org_id": 1})
    assert response.status_code == 401


async def test_rejects_invalid_dates(client):
    with patch("src.routers.calendar.require_org_membership", new=AsyncMock()):
        response = await client.get("/api/v1/calendar/events", params={"org_id": 1, "start": "soon"})
    assert response.status_code == 400


async def test_passes_range_and_user_to_service(client):
    payload = {"scope": "learning", "events": []}
    with (
        patch("src.routers.calendar.require_org_membership", new=AsyncMock()) as membership,
        patch("src.routers.calendar.get_calendar_events", new=AsyncMock(return_value=payload)) as service,
    ):
        response = await client.get(
            "/api/v1/calendar/events",
            params={"org_id": 1, "start": "2026-10-01", "end": "2026-11-01T00:00:00Z"},
        )
    assert response.status_code == 200
    assert response.json() == payload
    membership.assert_awaited_once()
    org_id, user_id, _db, start, end = service.await_args.args
    assert (org_id, user_id) == (1, 7)
    assert (start, end) == (datetime(2026, 10, 1), datetime(2026, 11, 1))
