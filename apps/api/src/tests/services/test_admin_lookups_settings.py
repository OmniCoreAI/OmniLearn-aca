"""Administration & Configuration foundation: lookups, settings, overview, authz."""
import pytest
from fastapi import HTTPException

from src.db.administration.lookups import (
    ConfigLookupCreate,
    ConfigLookupUpdate,
    ConfigStatus,
    LookupKind,
    LookupReorderItem,
)
from src.services.administration import lookups as lk_svc
from src.services.administration import settings as st_svc
from src.services.administration.overview import get_overview


class TestLookups:
    @pytest.mark.asyncio
    async def test_defaults_seeded_once(self, db, org, admin_user):
        rows = await lk_svc.list_lookups(db, admin_user, org.id, "facility_type")
        names = [r.name for r in rows]
        assert "Training room" in names and "Computer lab" in names
        assert all(r.is_system for r in rows)
        assert rows[0].extra and rows[0].extra.get("name_ar")

        # Deleting a seeded default must not bring it back on the next list.
        training = next(r for r in rows if r.name == "Training room")
        await lk_svc.delete_lookup(db, admin_user, training.lookup_uuid)
        again = await lk_svc.list_lookups(db, admin_user, org.id, "facility_type")
        assert "Training room" not in [r.name for r in again]
        assert len(again) == len(rows) - 1

    @pytest.mark.asyncio
    async def test_create_derives_code_and_rejects_duplicates(self, db, org, admin_user):
        created = await lk_svc.create_lookup(
            db,
            admin_user,
            org.id,
            ConfigLookupCreate(kind=LookupKind.COURSE_CATEGORY, name="Cyber Security"),
        )
        assert created.code == "CYBER-SECURITY"
        assert created.kind == "course_category"
        with pytest.raises(HTTPException) as exc:
            await lk_svc.create_lookup(
                db,
                admin_user,
                org.id,
                ConfigLookupCreate(kind=LookupKind.COURSE_CATEGORY, name="cyber security"),
            )
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_same_code_allowed_across_kinds(self, db, org, admin_user):
        await lk_svc.create_lookup(
            db, admin_user, org.id, ConfigLookupCreate(kind=LookupKind.COURSE_CATEGORY, name="Other")
        )
        other = await lk_svc.create_lookup(
            db, admin_user, org.id, ConfigLookupCreate(kind=LookupKind.ADDON_CATEGORY, name="Other")
        )
        assert other.code == "OTHER"

    @pytest.mark.asyncio
    async def test_unknown_kind_rejected(self, db, org, admin_user):
        with pytest.raises(HTTPException) as exc:
            await lk_svc.list_lookups(db, admin_user, org.id, "planets")
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_parent_status_and_reorder(self, db, org, admin_user):
        parent = await lk_svc.create_lookup(
            db, admin_user, org.id, ConfigLookupCreate(kind=LookupKind.COURSE_CATEGORY, name="Technology")
        )
        child = await lk_svc.create_lookup(
            db,
            admin_user,
            org.id,
            ConfigLookupCreate(kind=LookupKind.COURSE_CATEGORY, name="AI", parent_uuid=parent.lookup_uuid),
        )
        assert child.parent_uuid == parent.lookup_uuid

        # A parent with children cannot be deleted.
        with pytest.raises(HTTPException) as exc:
            await lk_svc.delete_lookup(db, admin_user, parent.lookup_uuid)
        assert exc.value.status_code == 409

        updated = await lk_svc.update_lookup(
            db, admin_user, child.lookup_uuid, ConfigLookupUpdate(status=ConfigStatus.INACTIVE)
        )
        assert updated.status == ConfigStatus.INACTIVE
        options = await lk_svc.list_lookup_options(db, admin_user, org.id, "course_category")
        assert [o.name for o in options] == ["Technology"]

        reordered = await lk_svc.reorder_lookups(
            db, admin_user, org.id, [LookupReorderItem(lookup_uuid=parent.lookup_uuid, sort_order=7)]
        )
        assert reordered[0].sort_order == 7

    @pytest.mark.asyncio
    async def test_parent_must_match_kind(self, db, org, admin_user):
        parent = await lk_svc.create_lookup(
            db, admin_user, org.id, ConfigLookupCreate(kind=LookupKind.ADDON_CATEGORY, name="Food")
        )
        with pytest.raises(HTTPException) as exc:
            await lk_svc.create_lookup(
                db,
                admin_user,
                org.id,
                ConfigLookupCreate(kind=LookupKind.COURSE_CATEGORY, name="X", parent_uuid=parent.lookup_uuid),
            )
        assert exc.value.status_code == 400


class TestLookupAuthz:
    @pytest.mark.asyncio
    async def test_regular_user_cannot_manage_but_can_pick(self, db, org, admin_user, regular_user):
        with pytest.raises(HTTPException) as exc:
            await lk_svc.list_lookups(db, regular_user, org.id, "equipment")
        assert exc.value.status_code == 403
        with pytest.raises(HTTPException) as exc:
            await lk_svc.create_lookup(
                db, regular_user, org.id, ConfigLookupCreate(kind=LookupKind.EQUIPMENT, name="Drone")
            )
        assert exc.value.status_code == 403
        options = await lk_svc.list_lookup_options(db, regular_user, org.id, "equipment")
        assert "Projector" in [o.name for o in options]

    @pytest.mark.asyncio
    async def test_non_member_denied(self, db, org, other_org, admin_user, regular_user):
        with pytest.raises(HTTPException) as exc:
            await lk_svc.list_lookup_options(db, regular_user, other_org.id, "equipment")
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_anonymous_denied(self, db, org, anonymous_user):
        with pytest.raises(HTTPException) as exc:
            await lk_svc.list_lookups(db, anonymous_user, org.id, "equipment")
        assert exc.value.status_code == 401


class TestSettings:
    @pytest.mark.asyncio
    async def test_finance_defaults_and_validation(self, db, org, admin_user, regular_user):
        value = await st_svc.get_setting(db, regular_user, org.id, "finance_defaults")
        assert value["default_currency"] == "EGP"
        assert value["tax_rates"][0]["rate"] == 14.0

        saved = await st_svc.put_setting(
            db,
            admin_user,
            org.id,
            "finance_defaults",
            {"default_currency": "sar", "currencies": ["egp", "usd", "EGP"], "tax_rates": []},
        )
        # Default currency is always offered and codes are normalized/deduped.
        assert saved["currencies"] == ["SAR", "EGP", "USD"]
        assert (await st_svc.get_setting(db, admin_user, org.id, "finance_defaults"))["default_currency"] == "SAR"

        with pytest.raises(HTTPException) as exc:
            await st_svc.put_setting(db, admin_user, org.id, "finance_defaults", {"currencies": ["EURO"]})
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_unknown_key_and_member_cannot_write(self, db, org, admin_user, regular_user):
        with pytest.raises(HTTPException) as exc:
            await st_svc.get_setting(db, admin_user, org.id, "anything")
        assert exc.value.status_code == 400
        with pytest.raises(HTTPException) as exc:
            await st_svc.put_setting(db, regular_user, org.id, "finance_defaults", {})
        assert exc.value.status_code == 403


class TestOverview:
    @pytest.mark.asyncio
    async def test_counts_and_access(self, db, org, admin_user, regular_user):
        counts = await get_overview(db, admin_user, org.id)
        assert counts["instructors"] == 0
        assert "courses" in counts
        with pytest.raises(HTTPException) as exc:
            await get_overview(db, regular_user, org.id)
        assert exc.value.status_code == 403
