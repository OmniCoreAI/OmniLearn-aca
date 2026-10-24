"""Add-ons: pricing, catalog, attachments, participant selections, legacy sync."""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.db.academic.course_profiles import CourseAcademicProfileUpsert, CourseAddOn
from src.db.administration.addons import (
    AddOnAttachmentCreate,
    AddOnAttachmentUpdate,
    AddOnCreate,
    AddOnTargetType,
    AddOnUpdate,
    MySelectionItem,
    MySelectionUpdate,
)
from src.db.administration.lookups import ConfigStatus
from src.services.academic import course_profiles as course_profiles_svc
from src.services.administration import addons as addon_svc
from src.services.administration import lookups as lk_svc


async def _category(db, admin_user, org, name="Meals"):
    rows = await lk_svc.list_lookups(db, admin_user, org.id, "addon_category")
    return next(r.lookup_uuid for r in rows if r.name == name)


async def _addon(db, admin_user, org, name="Lunch Meal", price=50.0, **extra):
    return await addon_svc.create_addon(
        db, admin_user, org.id, AddOnCreate(name=name, price=price, currency="EGP", **extra)
    )


async def _attach(db, admin_user, addon, course, **extra):
    return await addon_svc.create_attachment(
        db,
        admin_user,
        AddOnAttachmentCreate(
            addon_uuid=addon.addon_uuid, target_type=AddOnTargetType.COURSE, target_uuid=course.course_uuid, **extra
        ),
    )


class TestPricing:
    def test_exclusive_and_inclusive_tax(self):
        assert addon_svc.line_amounts(50, 1, 14, False) == (7.0, 57.0)
        assert addon_svc.line_amounts(57, 1, 14, True) == (7.0, 57.0)
        assert addon_svc.line_amounts(10, 3, None, False) == (0.0, 30.0)
        assert addon_svc.line_amounts(10, 0, 14, False) == (0.0, 0.0)


class TestCatalog:
    @pytest.mark.asyncio
    async def test_create_update_and_category_usage(self, db, org, admin_user):
        meals = await _category(db, admin_user, org)
        lunch = await _addon(db, admin_user, org, category_uuid=meals, tax_rate=14)
        assert lunch.code == "LUNCH-MEAL"
        assert lunch.category.name == "Meals"
        with pytest.raises(HTTPException) as exc:
            await lk_svc.delete_lookup(db, admin_user, meals)
        assert exc.value.status_code == 409

        updated = await addon_svc.update_addon(db, admin_user, lunch.addon_uuid, AddOnUpdate(price=60))
        assert updated.price == 60

    @pytest.mark.asyncio
    async def test_validation(self, db, org, admin_user):
        for bad in (
            dict(price=-1),
            dict(tax_rate=150),
            dict(stock=-2),
            dict(available_from="2026-10-10", available_until="2026-10-01"),
            dict(available_from="10/10/2026"),
        ):
            with pytest.raises(HTTPException) as exc:
                await addon_svc.create_addon(db, admin_user, org.id, AddOnCreate(name="X", **bad))
            assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_regular_user_sees_options_only(self, db, org, admin_user, regular_user):
        await _addon(db, admin_user, org)
        await _addon(db, admin_user, org, name="Old kit", status=ConfigStatus.INACTIVE)
        options = await addon_svc.list_addon_options(db, regular_user, org.id)
        assert [o.name for o in options] == ["Lunch Meal"]
        with pytest.raises(HTTPException) as exc:
            await addon_svc.list_addons(db, regular_user, org.id)
        assert exc.value.status_code == 403


class TestAttachmentsAndSelections:
    @pytest.mark.asyncio
    async def test_attach_override_and_duplicates(self, db, org, admin_user, course):
        lunch = await _addon(db, admin_user, org, tax_rate=14)
        attachment = await _attach(db, admin_user, lunch, course, price_override=40)
        assert attachment.unit_price == 40
        assert attachment.unit_price_with_tax == 45.6
        with pytest.raises(HTTPException) as exc:
            await _attach(db, admin_user, lunch, course)
        assert exc.value.status_code == 409
        listed = await addon_svc.list_attachments(db, admin_user, "course", course.course_uuid)
        assert [a.name for a in listed] == ["Lunch Meal"]

    @pytest.mark.asyncio
    async def test_participant_selection_flow(self, db, org, admin_user, regular_user, course, mock_request):
        notebook = await _addon(db, admin_user, org, name="Training Notebook", price=10)
        lunch = await _addon(db, admin_user, org, name="Lunch Meal", price=50, tax_rate=14, stock=3)
        kit = await _addon(db, admin_user, org, name="Training Kit", price=100)
        required = await _attach(db, admin_user, notebook, course, is_required=True)
        lunch_att = await _attach(db, admin_user, lunch, course, max_quantity=2)
        await _attach(db, admin_user, kit, course, is_selectable=False)  # admin-only, hidden

        with patch.object(addon_svc, "check_resource_access", new=AsyncMock()):
            view = await addon_svc.get_target_addons(mock_request, db, regular_user, "course", course.course_uuid)
            assert {i.attachment.name for i in view.items} == {"Training Notebook", "Lunch Meal"}

            # Choosing lunch ×2 also records the required notebook.
            view = await addon_svc.set_my_selection(
                mock_request, db, regular_user, "course", course.course_uuid,
                MySelectionUpdate(items=[MySelectionItem(attachment_uuid=lunch_att.attachment_uuid, quantity=2)]),
            )
            chosen = {i.attachment.name: i.selected_quantity for i in view.items}
            assert chosen == {"Training Notebook": 1, "Lunch Meal": 2}
            assert view.total == 10 + 114.0

            # Over the per-target maximum, removing a required add-on, unknown add-on.
            for items in (
                [MySelectionItem(attachment_uuid=lunch_att.attachment_uuid, quantity=3)],
                [MySelectionItem(attachment_uuid=required.attachment_uuid, quantity=0)],
                [MySelectionItem(attachment_uuid="nope", quantity=1)],
            ):
                with pytest.raises(HTTPException) as exc:
                    await addon_svc.set_my_selection(
                        mock_request, db, regular_user, "course", course.course_uuid, MySelectionUpdate(items=items)
                    )
                assert exc.value.status_code == 400

            # Snapshot survives a later price change; quantity 0 cancels.
            await addon_svc.update_addon(db, admin_user, lunch.addon_uuid, AddOnUpdate(price=500))
            report = await addon_svc.list_selections(db, admin_user, org.id, target_uuid=course.course_uuid)
            assert report.total_amount == 124.0
            assert {s.addon_name for s in report.selections} == {"Training Notebook", "Lunch Meal"}
            assert report.selections[0].target_name == "Test Course"

            view = await addon_svc.set_my_selection(
                mock_request, db, regular_user, "course", course.course_uuid,
                MySelectionUpdate(items=[MySelectionItem(attachment_uuid=lunch_att.attachment_uuid, quantity=0)]),
            )
            assert {i.attachment.name: i.selected_quantity for i in view.items}["Lunch Meal"] == 0

        # A selected add-on cannot be deleted from the catalog.
        with pytest.raises(HTTPException) as exc:
            await addon_svc.delete_addon(db, admin_user, notebook.addon_uuid)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_stock_limit(self, db, org, admin_user, regular_user, course, mock_request):
        lunch = await _addon(db, admin_user, org, stock=1)
        att = await _attach(db, admin_user, lunch, course, max_quantity=5)
        with patch.object(addon_svc, "check_resource_access", new=AsyncMock()):
            with pytest.raises(HTTPException) as exc:
                await addon_svc.set_my_selection(
                    mock_request, db, regular_user, "course", course.course_uuid,
                    MySelectionUpdate(items=[MySelectionItem(attachment_uuid=att.attachment_uuid, quantity=2)]),
                )
            assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_inactive_attachment_not_offered(self, db, org, admin_user, regular_user, course, mock_request):
        lunch = await _addon(db, admin_user, org)
        att = await _attach(db, admin_user, lunch, course)
        await addon_svc.update_attachment(db, admin_user, att.attachment_uuid, AddOnAttachmentUpdate(status=ConfigStatus.INACTIVE))
        with patch.object(addon_svc, "check_resource_access", new=AsyncMock()):
            view = await addon_svc.get_target_addons(mock_request, db, regular_user, "course", course.course_uuid)
        assert view.items == []

    @pytest.mark.asyncio
    async def test_target_must_exist_and_type_known(self, db, org, admin_user):
        lunch = await _addon(db, admin_user, org)
        with pytest.raises(HTTPException) as exc:
            await addon_svc.create_attachment(
                db, admin_user, AddOnAttachmentCreate(addon_uuid=lunch.addon_uuid, target_type=AddOnTargetType.COURSE, target_uuid="course_missing")
            )
        assert exc.value.status_code == 404
        with pytest.raises(HTTPException) as exc:
            await addon_svc.list_attachments(db, admin_user, "planet", "x")
        assert exc.value.status_code == 400


class TestLegacyCourseAddOns:
    @pytest.mark.asyncio
    async def test_profile_add_ons_become_catalog_attachments(self, db, org, admin_user, course, mock_request):
        with patch.object(course_profiles_svc, "check_resource_access", new=AsyncMock()):
            profile = await course_profiles_svc.upsert_course_academic_profile(
                mock_request,
                course.course_uuid,
                CourseAcademicProfileUpsert(add_ons=[CourseAddOn(name="Snacks", price=5.0), CourseAddOn(name="Kit", price=None)]),
                admin_user,
                db,
            )
            assert {(a.name, a.price) for a in profile.add_ons} == {("Snacks", 5.0), ("Kit", 0.0)}
            catalog = await addon_svc.list_addons(db, admin_user, org.id)
            assert sorted(a.name for a in catalog) == ["Kit", "Snacks"]

            # Replace semantics: dropping "Kit" detaches it but keeps the catalog item.
            profile = await course_profiles_svc.upsert_course_academic_profile(
                mock_request, course.course_uuid, CourseAcademicProfileUpsert(add_ons=[CourseAddOn(name="snacks", price=7.0)]), admin_user, db
            )
            assert [(a.name, a.price) for a in profile.add_ons] == [("Snacks", 7.0)]
            assert len(await addon_svc.list_addons(db, admin_user, org.id)) == 2
