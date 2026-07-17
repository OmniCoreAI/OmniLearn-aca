"""Tests for admin-provisioned user creation and forced password change.

Covers src/services/orgs/users.py::admin_create_user and the
must_change_password clearing in src/services/users/users.py::update_user_password.
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import select

from src.db.roles import Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import AdminUserCreate, User, UserUpdatePassword
from src.security.security import security_hash_password
from src.services.orgs.users import admin_create_user, DEFAULT_MEMBER_ROLE_ID
from src.services.security.password_validation import (
    generate_temporary_password,
    validate_password_complexity,
)
from src.services.users.users import update_user_password


def _patch_side_effects():
    """Patch the external side-effect helpers admin_create_user calls."""
    return (
        patch("src.services.orgs.users.rbac_check", new_callable=AsyncMock),
        patch("src.services.orgs.users.check_limits_with_usage", new_callable=AsyncMock),
        patch("src.services.orgs.users.increase_feature_usage", new_callable=AsyncMock),
        patch("src.services.orgs.users.track", new_callable=AsyncMock),
        patch("src.services.orgs.users.dispatch_webhooks", new_callable=AsyncMock),
    )


async def _make_role(db, org, **overrides):
    role = Role(
        name=overrides.pop("name", "Custom Role"),
        org_id=overrides.pop("org_id", org.id),
        role_type=overrides.pop("role_type", RoleTypeEnum.TYPE_ORGANIZATION),
        role_uuid=overrides.pop("role_uuid", "role_custom"),
        rights=overrides.pop("rights", {}),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


class TestGenerateTemporaryPassword:
    def test_generated_password_meets_complexity(self):
        for _ in range(50):
            pwd = generate_temporary_password()
            assert validate_password_complexity(pwd).is_valid
            assert len(pwd) >= 12

    def test_passwords_are_unique(self):
        passwords = {generate_temporary_password() for _ in range(20)}
        assert len(passwords) == 20


class TestAdminCreateUser:
    @pytest.mark.asyncio
    async def test_creates_user_with_defaults(self, mock_request, db, org, admin_user, user_role):
        p_rbac, p_limit, p_incr, p_track, p_hook = _patch_side_effects()
        with p_rbac, p_limit, p_incr, p_track, p_hook:
            result = await admin_create_user(
                mock_request,
                org.id,
                AdminUserCreate(
                    username="newbie",
                    email="Newbie@Test.com",
                    first_name="New",
                    last_name="Bie",
                ),
                db,
                admin_user,
            )

        # Temporary password returned once and is strong.
        assert validate_password_complexity(result.temporary_password).is_valid
        # Read model reflects forced change + auto-verified.
        assert result.user.must_change_password is True
        assert result.user.email_verified is True
        assert result.user.username == "newbie"

        # Persisted user has the expected flags and normalized email.
        user = (await db.execute(
            select(User).where(User.username == "newbie")
        )).scalars().first()
        assert user is not None
        assert user.email == "newbie@test.com"
        assert user.must_change_password is True
        assert user.signup_method == "admin_created"
        # Password is stored hashed, never in plaintext.
        assert user.password and user.password != result.temporary_password

        # Linked to org with the default learner role.
        link = (await db.execute(
            select(UserOrganization).where(UserOrganization.user_id == user.id)
        )).scalars().first()
        assert link is not None
        assert link.role_id == DEFAULT_MEMBER_ROLE_ID

    @pytest.mark.asyncio
    async def test_assigns_chosen_role(self, mock_request, db, org, admin_user):
        role = await _make_role(db, org, name="Instructor", role_uuid="role_instructor")
        p_rbac, p_limit, p_incr, p_track, p_hook = _patch_side_effects()
        with p_rbac, p_limit, p_incr, p_track, p_hook:
            result = await admin_create_user(
                mock_request,
                org.id,
                AdminUserCreate(username="teacher", email="teacher@test.com", role_uuid="role_instructor"),
                db,
                admin_user,
            )

        link = (await db.execute(
            select(UserOrganization).where(UserOrganization.user_id == result.user.id)
        )).scalars().first()
        assert link.role_id == role.id

    @pytest.mark.asyncio
    async def test_duplicate_email_rejected(self, mock_request, db, org, admin_user, regular_user):
        p_rbac, p_limit, p_incr, p_track, p_hook = _patch_side_effects()
        with p_rbac, p_limit, p_incr, p_track, p_hook:
            with pytest.raises(Exception) as exc:
                await admin_create_user(
                    mock_request,
                    org.id,
                    AdminUserCreate(username="unique_name", email=regular_user.email),
                    db,
                    admin_user,
                )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_missing_org_returns_404(self, mock_request, db, admin_user):
        with pytest.raises(Exception) as exc:
            await admin_create_user(
                mock_request,
                999,
                AdminUserCreate(username="ghost", email="ghost@test.com"),
                db,
                admin_user,
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_unknown_role_returns_404(self, mock_request, db, org, admin_user):
        p_rbac, p_limit, p_incr, p_track, p_hook = _patch_side_effects()
        with p_rbac, p_limit, p_incr, p_track, p_hook:
            with pytest.raises(Exception) as exc:
                await admin_create_user(
                    mock_request,
                    org.id,
                    AdminUserCreate(username="x", email="x@test.com", role_uuid="role_nope"),
                    db,
                    admin_user,
                )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_role_from_other_org_rejected(
        self, mock_request, db, org, other_org, admin_user
    ):
        await _make_role(db, other_org, name="Other", role_uuid="role_other_org", org_id=other_org.id)
        p_rbac, p_limit, p_incr, p_track, p_hook = _patch_side_effects()
        with p_rbac, p_limit, p_incr, p_track, p_hook:
            with pytest.raises(Exception) as exc:
                await admin_create_user(
                    mock_request,
                    org.id,
                    AdminUserCreate(username="y", email="y@test.com", role_uuid="role_other_org"),
                    db,
                    admin_user,
                )
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_short_username_rejected(self, mock_request, db, org, admin_user):
        p_rbac, p_limit, p_incr, p_track, p_hook = _patch_side_effects()
        with p_rbac, p_limit, p_incr, p_track, p_hook:
            with pytest.raises(Exception) as exc:
                await admin_create_user(
                    mock_request,
                    org.id,
                    AdminUserCreate(username="a", email="a@test.com"),
                    db,
                    admin_user,
                )
        assert exc.value.status_code == 400


class TestForcedPasswordChangeClearsFlag:
    @pytest.mark.asyncio
    async def test_password_change_clears_must_change_flag(self, mock_request, db, org):
        temp = "TempPass1!"
        user = User(
            username="forced",
            first_name="Forced",
            last_name="User",
            email="forced@test.com",
            password=security_hash_password(temp),
            user_uuid="user_forced",
            email_verified=True,
            must_change_password=True,
            signup_method="admin_created",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        current_user = SimpleNamespace(id=user.id, user_uuid=user.user_uuid)

        with patch("src.routers.users._invalidate_session_cache") as invalidate:
            result = await update_user_password(
                mock_request,
                db,
                current_user,
                user.id,
                UserUpdatePassword(old_password=temp, new_password="BrandNew1!"),
            )

        assert result.must_change_password is False
        invalidate.assert_called_once_with(user.id)

        refreshed = (await db.execute(
            select(User).where(User.id == user.id)
        )).scalars().first()
        assert refreshed.must_change_password is False
