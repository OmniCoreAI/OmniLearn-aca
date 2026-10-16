"""Zoom OAuth + REST client for one organization's connection.

All Zoom HTTP traffic goes through here:

* OAuth: authorize URL with a signed, user-bound ``state``; code exchange;
  refresh; revoke.
* Tokens are stored Fernet-encrypted on ``ZoomConnection`` and refreshed five
  minutes before they expire. Zoom rotates the refresh token on every refresh,
  so refreshes are serialized per organization (Redis lock across workers,
  asyncio lock inside one) and re-read the row after taking the lock.
* REST calls retry once on 401 with a forced refresh, and map Zoom failures to
  the user-facing errors in ``errors.py``. Tokens are never logged.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import secrets
import time
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
import jwt
from sqlmodel.ext.asyncio.session import AsyncSession

from config.config import ZoomConfig, get_omnilearn_config
from src.core.redis import get_redis_client
from src.db.integrations.zoom import ZoomConnection, ZoomConnectionStatus
from src.services.integrations.zoom import errors
from src.services.webhooks.crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

ZOOM_OAUTH_BASE = "https://zoom.us/oauth"
ZOOM_API_BASE = "https://api.zoom.us/v2"
HTTP_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
REFRESH_MARGIN_SECONDS = 300
STATE_TTL_SECONDS = 600
STATE_AUDIENCE = "zoom-oauth-state"

# Zoom "meeting does not exist" style codes (REST error body ``code``).
MEETING_GONE_CODES = {3001, 3000}

_local_locks: dict[int, asyncio.Lock] = {}
# Tests swap in an ``httpx.MockTransport``; production uses the default network transport.
_transport: Optional[httpx.AsyncBaseTransport] = None


def _http() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=HTTP_TIMEOUT, transport=_transport)


def get_zoom_config() -> ZoomConfig:
    return get_omnilearn_config().zoom_config


def _state_secret() -> str:
    return get_omnilearn_config().security_config.auth_jwt_secret_key


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------


def build_state(org_id: int, user_id: int) -> str:
    """Signed state binding the callback to the admin who started it."""
    now = int(time.time())
    payload = {
        "aud": STATE_AUDIENCE,
        "org": org_id,
        "usr": user_id,
        "nonce": secrets.token_urlsafe(16),
        "iat": now,
        "exp": now + STATE_TTL_SECONDS,
    }
    return jwt.encode(payload, _state_secret(), algorithm="HS256")


def verify_state(state: str, org_id_hint: Optional[int], user_id: int) -> int:
    """Return the org id the state was issued for, or raise."""
    try:
        payload = jwt.decode(state, _state_secret(), algorithms=["HS256"], audience=STATE_AUDIENCE)
    except jwt.PyJWTError:
        raise errors.oauth_failed("The Zoom sign-in link expired or is invalid. Please start again.")
    if payload.get("usr") != user_id or (org_id_hint is not None and payload.get("org") != org_id_hint):
        raise errors.oauth_failed("This Zoom sign-in was started by someone else. Please start again.")
    nonce = payload.get("nonce")
    r = get_redis_client()
    if r is not None and nonce:
        try:
            # One-time use: a replayed callback is rejected.
            if not r.set(f"zoom:oauth_state:{nonce}", "1", nx=True, ex=STATE_TTL_SECONDS):
                raise errors.oauth_failed("This Zoom sign-in was already used. Please start again.")
        except errors.ZoomError:
            raise
        except Exception:
            logger.warning("Zoom OAuth: could not record state nonce", exc_info=True)
    return int(payload["org"])


def authorize_url(cfg: ZoomConfig, state: str) -> str:
    query = urlencode(
        {
            "response_type": "code",
            "client_id": cfg.client_id,
            "redirect_uri": cfg.redirect_uri,
            "state": state,
        }
    )
    return f"{ZOOM_OAUTH_BASE}/authorize?{query}"


def _basic_auth(cfg: ZoomConfig) -> str:
    raw = f"{cfg.client_id}:{cfg.client_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


async def _token_request(cfg: ZoomConfig, data: dict[str, str]) -> dict[str, Any]:
    try:
        async with _http() as http:
            res = await http.post(
                f"{ZOOM_OAUTH_BASE}/token",
                data=data,
                headers={"Authorization": _basic_auth(cfg)},
            )
    except httpx.TimeoutException:
        raise errors.timeout()
    except httpx.HTTPError:
        logger.warning("Zoom OAuth token request failed (network)", exc_info=True)
        raise errors.unavailable()
    if res.status_code != 200:
        body = _safe_json(res)
        logger.warning(
            "Zoom OAuth token request rejected: status=%s grant=%s reason=%s",
            res.status_code, data.get("grant_type"), body.get("reason") or body.get("error"),
        )
        if data.get("grant_type") == "refresh_token":
            raise errors.reauth_required()
        raise errors.oauth_failed()
    return res.json()


async def exchange_code(cfg: ZoomConfig, code: str) -> dict[str, Any]:
    return await _token_request(
        cfg, {"grant_type": "authorization_code", "code": code, "redirect_uri": cfg.redirect_uri or ""}
    )


async def revoke_token(cfg: ZoomConfig, token: str) -> None:
    """Best effort: a failed revoke must not block disconnecting locally."""
    try:
        async with _http() as http:
            res = await http.post(
                f"{ZOOM_OAUTH_BASE}/revoke",
                data={"token": token},
                headers={"Authorization": _basic_auth(cfg)},
            )
        if res.status_code != 200:
            logger.info("Zoom token revoke returned %s", res.status_code)
    except httpx.HTTPError:
        logger.info("Zoom token revoke failed (network)", exc_info=True)


def store_tokens(connection: ZoomConnection, token_body: dict[str, Any]) -> None:
    connection.access_token_encrypted = encrypt_secret(token_body["access_token"])
    if token_body.get("refresh_token"):
        connection.refresh_token_encrypted = encrypt_secret(token_body["refresh_token"])
    connection.token_expires_at = int(time.time()) + int(token_body.get("expires_in") or 3600)
    if token_body.get("scope"):
        connection.scopes = token_body["scope"]
    connection.status = ZoomConnectionStatus.ACTIVE.value
    connection.last_error = None
    connection.update_date = str(datetime.now())


def _safe_json(res: httpx.Response) -> dict[str, Any]:
    try:
        body = res.json()
        return body if isinstance(body, dict) else {}
    except ValueError:
        return {}


# ---------------------------------------------------------------------------
# Token broker + REST
# ---------------------------------------------------------------------------


class _RefreshLock:
    """Per-org lock: Redis across workers when available, asyncio within one."""

    def __init__(self, org_id: int):
        self.org_id = org_id
        self.key = f"zoom:refresh_lock:{org_id}"
        self.token = secrets.token_hex(8)
        self.local = _local_locks.setdefault(org_id, asyncio.Lock())
        self.redis = get_redis_client()
        self.held_remote = False

    async def __aenter__(self):
        await self.local.acquire()
        if self.redis is not None:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                try:
                    if self.redis.set(self.key, self.token, nx=True, ex=30):
                        self.held_remote = True
                        break
                except Exception:
                    logger.debug("Zoom refresh lock: Redis unavailable", exc_info=True)
                    break
                await asyncio.sleep(0.2)
        return self

    async def __aexit__(self, *exc):
        try:
            if self.held_remote and self.redis is not None and self.redis.get(self.key) == self.token.encode():
                self.redis.delete(self.key)
        except Exception:
            logger.debug("Zoom refresh lock release failed", exc_info=True)
        finally:
            self.local.release()


class ZoomClient:
    def __init__(self, db_session: AsyncSession, connection: ZoomConnection, cfg: Optional[ZoomConfig] = None):
        self.db = db_session
        self.connection = connection
        self.cfg = cfg or get_zoom_config()

    # -- tokens ---------------------------------------------------------------

    def _token_fresh(self) -> bool:
        return (
            bool(self.connection.access_token_encrypted)
            and self.connection.token_expires_at - REFRESH_MARGIN_SECONDS > int(time.time())
        )

    async def access_token(self, force_refresh: bool = False) -> str:
        if self.connection.status == ZoomConnectionStatus.REAUTH_REQUIRED.value:
            raise errors.reauth_required()
        if not force_refresh and self._token_fresh():
            return decrypt_secret(self.connection.access_token_encrypted)
        return await self.refresh_access_token(force=force_refresh)

    async def refresh_access_token(self, force: bool = False) -> str:
        stale_token = self.connection.access_token_encrypted
        async with _RefreshLock(self.connection.org_id):
            # Another request may have refreshed while we waited.
            await self.db.refresh(self.connection)
            rotated = self.connection.access_token_encrypted != stale_token
            if self._token_fresh() and (not force or rotated):
                return decrypt_secret(self.connection.access_token_encrypted)
            if not self.connection.refresh_token_encrypted:
                raise errors.reauth_required()
            try:
                body = await _token_request(
                    self.cfg,
                    {
                        "grant_type": "refresh_token",
                        "refresh_token": decrypt_secret(self.connection.refresh_token_encrypted),
                    },
                )
            except errors.ZoomError as exc:
                if exc.code == "zoom_reauth_required":
                    self.connection.status = ZoomConnectionStatus.REAUTH_REQUIRED.value
                    self.connection.last_error = "Refresh token rejected by Zoom"
                    self.connection.update_date = str(datetime.now())
                    self.db.add(self.connection)
                    await self.db.commit()
                raise
            store_tokens(self.connection, body)
            self.db.add(self.connection)
            await self.db.commit()
            await self.db.refresh(self.connection)
            return body["access_token"]

    # -- REST -----------------------------------------------------------------

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[dict] = None,
        params: Optional[dict] = None,
        not_found_ok: bool = False,
    ) -> Optional[dict[str, Any]]:
        """Call the Zoom REST API. Returns the JSON body ({} for 204)."""
        for attempt in (1, 2):
            token = await self.access_token(force_refresh=attempt == 2)
            try:
                async with _http() as http:
                    res = await http.request(
                        method,
                        f"{ZOOM_API_BASE}{path}",
                        json=json,
                        params=params,
                        headers={"Authorization": f"Bearer {token}"},
                    )
            except httpx.TimeoutException:
                logger.warning("Zoom API timeout: %s %s", method, path)
                raise errors.timeout()
            except httpx.HTTPError:
                logger.warning("Zoom API network error: %s %s", method, path, exc_info=True)
                raise errors.unavailable()

            if res.status_code == 401 and attempt == 1:
                continue
            return self._handle(res, method, path, not_found_ok)
        return None  # pragma: no cover - loop always returns

    def _handle(self, res: httpx.Response, method: str, path: str, not_found_ok: bool) -> Optional[dict[str, Any]]:
        if res.status_code in (200, 201):
            return _safe_json(res)
        if res.status_code == 204:
            return {}
        body = _safe_json(res)
        zoom_code = body.get("code")
        zoom_message = str(body.get("message") or "")
        logger.warning(
            "Zoom API error: %s %s status=%s code=%s message=%s",
            method, path, res.status_code, zoom_code, zoom_message[:200],
        )
        if res.status_code == 404 or zoom_code in MEETING_GONE_CODES:
            if not_found_ok:
                return None
            raise errors.meeting_gone()
        if res.status_code == 429:
            raw_retry = res.headers.get("Retry-After") or ""
            raise errors.rate_limited(int(raw_retry) if raw_retry.isdigit() else 5)
        if res.status_code == 401:
            raise errors.reauth_required()
        if res.status_code in (400, 409, 412) and zoom_message:
            raise errors.rejected(zoom_message[:300])
        if res.status_code == 403:
            raise errors.rejected(
                zoom_message[:300] or "Zoom refused this request. Check the app's scopes and the account's plan."
            )
        raise errors.unavailable()

    # -- endpoints --------------------------------------------------------------

    async def get_me(self) -> dict[str, Any]:
        return await self.request("GET", "/users/me") or {}

    async def get_zak(self) -> str:
        body = await self.request("GET", "/users/me/token", params={"type": "zak"}) or {}
        token = body.get("token")
        if not token:
            raise errors.unavailable()
        return token

    async def create_meeting(self, payload: dict) -> dict[str, Any]:
        return await self.request("POST", "/users/me/meetings", json=payload) or {}

    async def update_meeting(self, meeting_id: str, payload: dict) -> None:
        await self.request("PATCH", f"/meetings/{meeting_id}", json=payload)

    async def delete_meeting(self, meeting_id: str) -> bool:
        """False when Zoom no longer has it (already deleted there)."""
        res = await self.request(
            "DELETE", f"/meetings/{meeting_id}", params={"schedule_for_reminder": "true"}, not_found_ok=True
        )
        return res is not None

    async def get_meeting(self, meeting_id: str) -> Optional[dict[str, Any]]:
        return await self.request("GET", f"/meetings/{meeting_id}", not_found_ok=True)

    async def get_past_participants(self, meeting_uuid: str) -> list[dict[str, Any]]:
        """Participants of a past meeting instance (all pages)."""
        out: list[dict[str, Any]] = []
        token = ""
        for _ in range(50):
            params: dict[str, Any] = {"page_size": 300}
            if token:
                params["next_page_token"] = token
            body = await self.request(
                "GET", f"/past_meetings/{_double_encode(meeting_uuid)}/participants",
                params=params, not_found_ok=True,
            )
            if not body:
                break
            out.extend(body.get("participants") or [])
            token = body.get("next_page_token") or ""
            if not token:
                break
        return out

    async def get_recordings(self, meeting_ref: str) -> Optional[dict[str, Any]]:
        return await self.request(
            "GET", f"/meetings/{_double_encode(meeting_ref)}/recordings", not_found_ok=True
        )


def _double_encode(value: str) -> str:
    """Zoom requires meeting UUIDs that start with '/' or contain '//' to be
    double URL-encoded in paths; other UUIDs are encoded once."""
    from urllib.parse import quote

    if value.isdigit():
        return value
    once = quote(value, safe="")
    if value.startswith("/") or "//" in value:
        return quote(once, safe="")
    return once
