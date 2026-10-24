# Administration & Configuration — engineering note

Internal note on how the "Administration & Configuration" layer is built and what it reuses. User-facing docs: `docs/content/platform/administration/`.

## Principles

- **Create once, select everywhere.** Instructors, rooms, add-ons, entities, templates and certificate designs are records that other screens pick from; free-text fields stay only as fallbacks.
- **No parallel systems.** Access, enrollment, email delivery and certificate rendering keep using the existing mechanisms; the new layer feeds them.
- **Entities are not tenants.** `organization` remains the academy (tenant). Entities (الجهات) live inside it.

## Layout

| Layer | Location |
| --- | --- |
| Models | `apps/api/src/db/administration/` (`lookups`, `settings`, `facilities`, `addons`, `entities`, `audience`, `notifications`, `imports`, `certificates`) |
| Services | `apps/api/src/services/administration/`, `apps/api/src/services/notifications/` |
| Routers | `apps/api/src/routers/administration/` → `/lookups`, `/admin-settings`, `/administration`, `/locations`, `/facilities`, `/addons`, `/entities`, `/positions`, `/audience`, `/notifications`, `/imports`, `/certificate-templates` |
| Migrations | `ad0a1b2c3d4e` … `ad7b8c9d0e1f` (one per phase) |
| Web | `apps/web/app/orgs/[orgslug]/dash/administration/**`, `dash/my-entity`, `components/Dashboard/Pages/{Administration,Entities,Communication}`, `components/Certificates/TemplateCertificate.tsx` |

## Authorization

- `services/administration/authz.py`: `authorize_admin(bucket, action)` — superadmin, Academy Admin (role 1) or a role granting the `configuration` / `entities` / `communications` / `instructors` bucket. Pickers (`/…/options`) only need org membership and never return costs or rates.
- `ACADEMY_ADMIN_ROLE_IDS` replaces the old admin-or-maintainer set everywhere; `ADMIN_OR_MAINTAINER_ROLE_IDS` is kept as a deprecated alias equal to it (external/EE imports).
- `services/administration/entities.py::require_entity_access(entity, capability)` — academy staff, or role 2 **and** an active `EntityMember.is_coordinator` on that entity **and** the capability enabled in `Entity.coordinator_permissions`.

## What was reused

| Need | Reused mechanism |
| --- | --- |
| Assign courses to entities/groups/positions/people | `UserGroup` + `UserGroupResource`. `AudienceAssignment` rows are materialized by `services/administration/audience.py::sync_resource_audience`: usergroup/cohort/entity → their group is linked; position/user → one locked system group per resource (`managed_key = audience:<type>:<uuid>`). Programs link to the program and every course in it. |
| Entity membership | Each entity owns a locked "all members" system group (`managed_key = entity:<uuid>`). |
| Group types / inactive groups | `usergroup.group_type` (`general`, `department`, `cohort`, `system`) and `status`; membership checks in `rbac.check_usergroup_access` and `resource_access` ignore inactive groups. |
| Auto-enroll | `services/admin/admin.py::enroll_users_in_course` (extracted from the bulk-enroll API). |
| Accounts created by the academy/imports | `services/orgs/users.py::provision_org_user`; password setup reuses the reset-code flow (`create_password_setup_code`, `reset_code_type = password_setup`, 7-day TTL). |
| Email sending | `services/email/utils.py::send_email` (new optional `sender_name`). Existing security emails go through `dispatcher.send_event_email`, which sends the original email unchanged when no template exists. |
| Background delivery | Same fire-and-forget pattern as `services/webhooks/dispatch.py`. |
| SMS HTTP gateway | `services/utils/ssrf_guard.py` like outgoing webhooks. |
| Certificate PDF | html2canvas + jsPDF, now through one renderer (`TemplateCertificate`). |
| Settings | `AdminSetting` with a registered pydantic schema per key (`finance_defaults`, `notifications`). |

## Notable behaviours

- **Booking conflicts** (`facilities.check_session_booking`): 409 with the conflicting sessions unless `allow_conflict`.
- **Rates**: instructor override → category language rate → category base rate; work logs snapshot the rate.
- **Notifications**: template lookup is resource override (course, then its program) → org default in the recipient language → built-in. `NotificationLog.dedupe_key` is unique; reminders use `training_reminder:<session>:<h>h` / `exam_reminder:<assignment>:<h>h`. The scanner runs every 10 minutes behind a Redis `SET NX` lock. In tests, delivery is inline and never reaches providers unless a transport is patched.
- **Imports**: validation stores every row; commit processes rows one by one, and a failing row is rolled back on its own. Formula-looking cells are neutralized in the failed-rows export.
- **Certificates**: template = course choice → program → org default → legacy pattern. `certificateuser.serial_no` comes from `{YYYY}{YY}{MM}{SEQ:n}` formats, with the sequence restarting per prefix and per org.

## Upgrade notes

- Role 2 is now the entity-scoped **Entity Coordinator**. Migration `ad4e5f6a7b8c` rewrites its rights (Trainee + dashboard), resets its saved sidebar to `home` + `my-entity`, and logs how many memberships hold it. Move academy staff to role 1 first.
- Migrations call `grant_saved_nav_items` so admins with a saved sidebar configuration still see the new pages.
- `openpyxl` is a new API dependency (Excel import).
