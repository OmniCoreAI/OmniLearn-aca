"""Assignment notifications: the in-app inbox and who gets told about what."""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.academic.offerings import CourseOfferingUpdate
from src.db.academic.training_programs import TrainingProgram
from src.db.notification_inbox import Notification
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.services.academic import offerings as offerings_svc
from src.services.academic import training_programs as tp_svc
from src.services.notifications import inbox
from src.tests.conftest import register_instructor
from src.tests.services.test_academic_teaching import _open_offerings


async def _rows(db, user_id: int):
    return (await db.execute(select(Notification).where(Notification.user_id == user_id))).scalars().all()


async def _member(db, org, uid: int, username: str) -> PublicUser:
    now = str(datetime.now())
    db.add(User(id=uid, username=username, first_name=username.title(), last_name="T", email=f"{username}@test.com",
                password="x", user_uuid=f"user_{username}", creation_date=now, update_date=now))
    await db.commit()
    db.add(UserOrganization(user_id=uid, org_id=org.id, role_id=4, creation_date=now, update_date=now))
    await db.commit()
    return PublicUser(id=uid, username=username, first_name=username.title(), last_name="T",
                      email=f"{username}@test.com", user_uuid=f"user_{username}")


class TestInbox:
    @pytest.mark.asyncio
    async def test_push_list_and_mark_read(self, db, org, admin_user, regular_user):
        await inbox.push(db, org.id, [regular_user.id, regular_user.id], "teaching_assigned", "Hello", link="/dash")
        await inbox.push(db, org.id, [regular_user.id], "contributor_added", "Again")

        mine = await inbox.list_inbox(db, regular_user, org.id)
        assert [n.title for n in mine.items] == ["Again", "Hello"]  # newest first, no duplicates
        assert mine.unread == 2

        # Someone else can't read (or even see) another person's notification.
        with pytest.raises(HTTPException):
            await inbox.mark_read(db, admin_user, mine.items[0].notification_uuid)
        read = await inbox.mark_read(db, regular_user, mine.items[0].notification_uuid)
        assert read.read_at
        assert (await inbox.list_inbox(db, regular_user, org.id)).unread == 1
        assert await inbox.mark_all_read(db, regular_user, org.id) == 1
        assert (await inbox.list_inbox(db, regular_user, org.id)).unread == 0
        assert (await inbox.list_inbox(db, admin_user, org.id)).items == []


class TestAssignmentNotifications:
    @pytest.mark.asyncio
    async def test_new_lecturer_is_told_once_and_the_actor_never(self, db, org, admin_user, regular_user, mock_request):
        await register_instructor(db, org.id, admin_user.id, regular_user.id)
        taught, _ = await _open_offerings(db, org, admin_user, mock_request, instructor_uuid=regular_user.user_uuid)

        rows = await _rows(db, regular_user.id)
        assert [(r.type, r.payload["role"]) for r in rows] == [("teaching_assigned", "lecturer")]
        assert rows[0].link == f"/dash/postgraduate/teaching/offerings/{taught.offering_uuid.replace('offering_', '')}"

        # Re-saving the same lecturer is not a new assignment.
        await offerings_svc.update_offering(
            mock_request, taught.offering_uuid, CourseOfferingUpdate(instructor_uuid=regular_user.user_uuid), admin_user, db
        )
        assert len(await _rows(db, regular_user.id)) == 1
        # Assigning yourself doesn't notify you.
        await offerings_svc.update_offering(
            mock_request, taught.offering_uuid, CourseOfferingUpdate(teaching_assistant_uuid=admin_user.user_uuid), admin_user, db
        )
        assert await _rows(db, admin_user.id) == []

    @pytest.mark.asyncio
    async def test_training_program_coordinator_is_told(self, db, org, admin_user, regular_user):
        db.add(TrainingProgram(name="Bootcamp", org_id=org.id, trainingprogram_uuid="trainingprogram_boot",
                               creation_date="", update_date=""))
        await db.commit()
        with patch.object(tp_svc, "check_resource_access", new=AsyncMock()):
            await tp_svc.set_training_program_coordinator(
                MagicMock(), "trainingprogram_boot", regular_user.user_uuid, admin_user, db
            )
        rows = await _rows(db, regular_user.id)
        assert [(r.type, r.payload) for r in rows] == [
            ("coordination_assigned", {"role": "training_coordinator", "name": "Bootcamp"})
        ]
        assert rows[0].link == "/dash/training-programs/boot"

    @pytest.mark.asyncio
    async def test_assigned_training_lands_in_the_learner_inbox(self, db, org, admin_user):
        from src.services.notifications.events import _on_audience_covered

        learner = await _member(db, org, 70, "learner")
        db.add(TrainingProgram(name="Safety", org_id=org.id, trainingprogram_uuid="trainingprogram_safety",
                               published=True, creation_date="", update_date=""))
        await db.commit()
        await _on_audience_covered(db, org.id, "training_program", "trainingprogram_safety", [learner.id])
        rows = await _rows(db, learner.id)
        assert [(r.type, r.link, r.payload["name"]) for r in rows] == [("course_assigned", "/programs", "Safety")]
