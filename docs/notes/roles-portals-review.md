# Roles & portals review — workflow plan

Date: 2026-10-06 · Branch: `feature/academy-eaca-migration`

## 1. How this was tested

Hands-on, on the local dev stack (web 3002, API 1338, DB `omnilearn-db`), with one test account per role.
Credentials are in the git-ignored `.env.test.local`.

| Account | Role | How it was set up |
|---|---|---|
| `qa.admin@omnilearn-qa.com` | Academy Admin (1) | Seeded directly |
| `qa.instructor@…` (Ibrahim) | Instructor (3) | Admin → Instructors → **New Instructor → New user account** |
| `qa.coordinator@…` (Mona) | Entity Coordinator (2) | Entity "QA Ministry of Health" → **make coordinator (new user)** |
| `qa.trainee@…` (Tarek) | Trainee (4) | Entity → **add member (new user)** |

Assignments made as admin:

- **Course "aca"**: Ibrahim added as a contributor (Course → Contributors).
- **Postgraduate offering CP123**: Ibrahim set as lecturer (Offering → Edit → Teaching staff).
- **Training program "test"**: Ibrahim set as coordinator.
- **Course "aca"**: assigned to the whole entity (auto-enroll).
- **Training program "test"**: made available to the entity, so its coordinator can assign it.

Then I signed in as each account and walked its portal. The super-admin console (`/admin`) was reviewed from code only.

## 2. What works well

- **Instructor onboarding.**
  - The account is created from the Instructors page.
  - The admin sees a one-time temporary password.
  - The instructor must change it at first login.
- **Postgraduate teaching.**
  - Assigning a lecturer to an offering is smooth (search the registry, save).
  - The offering appears in the instructor's **My Teaching**, with students, grades to submit and status.
- **Entity coordinator workspace (`/dash/my-entity`).**
  - Has tabs for overview, members, import, groups, training, and progress & activity.
  - Coordinator rights come from what the academy allows for that entity.
  - Training the academy made "available" shows up there, ready to assign.
- **Trainee home.**
  - Assigned courses appear immediately under "Continue learning".
- **API scoping.**
  - Instructors, coordinators and trainees get 403 on users, entities, the academic overview, and updates to programs they don't own.

## 3. Findings

### 3.1 Bugs (fix first)

| # | Sev | Finding | Where |
|---|---|---|---|
| B1 | P0 | After the forced first-login password change, the user is sent to `/auth/login`, which doesn't exist. They get a 404 page that also shows the old **"learnhouse"** logo. | `components/Security/ForcePasswordChangeGate.tsx:58` (should be `/login`); the root not-found page branding |
| B2 | P1 | The draft/unpublished training programs list (`published=false`) is returned to trainees, coordinators and instructors. | `GET /training-programs/org/{id}/page/…` |
| B3 | P1 | The floating **"Getting Started 1/7 – Create your first course"** widget shows on every dashboard page, for every role, even though 6 courses exist. It also covers buttons: on Course → Contributors it hides **Add Selected**. The first-run modal is generic OmniLearn (playgrounds, boards…). | onboarding widget |
| B4 | P1 | A contributor added by an admin is saved as **PENDING**. Nobody is told, and the instructor sees nothing to accept. | Course → Contributors |
| B5 | — | ~~The Courses page header shows 0 courses.~~ Not a bug: stat numbers use a spring count-up that only runs in a visible tab, and the review screenshots came from a background pane. | — |
| B6 | P2 | Every role lands on the learner home (`/`) after login, including admin, instructor and coordinator. | login redirect |
| B7 | P3 | The tables `trainingprograminstructor` and `programinstructor` exist in the DB with no model or code. | DB cleanup |

### 3.2 Admin (Academy Admin)

- **"Assign an instructor" means four different things in four places:**
  1. *Course → Contributors*: any user (not the Instructor registry). It is content-editing access and lands as PENDING.
  2. *Instructor profile → Courses* (`/instructors/{uuid}/courses`): links a registry instructor to a course.
  3. *Postgraduate offering → Teaching staff*: lecturer and TA from the registry. This one is the good model.
  4. *Training program*: only a **coordinator**, set from the list's edit form. The program page has **no trainers, sessions or staffing section**.
- The instructor profile's course list shows author and offering links, but **not** the training programs he coordinates.
- **The word "coordinator" means three things:**
  - Entity Coordinator: a role.
  - Postgraduate program/cohort coordinator: any user.
  - Training-program coordinator: any user, who gets MAINTAINER authorship.

  Example: a user with the Entity Coordinator role who is made a training-program coordinator gets the rights, but no sidebar entry to reach the program.
- **"Entity" has three names:** the sidebar says "Organizations", the coordinator sees "My organization", and the role is "Entity Coordinator". Meanwhile "Organization" also means the academy (tenant).

### 3.3 Instructor

- **The dashboard home is the academy-wide admin dashboard:**
  - It shows Total Students 0, Total Courses 0, a Revenue tab, Top Instructors, a "Create new course" button and the Getting Started widget.
  - None of his real work appears: the offering he teaches, the course he contributes to, or the program he coordinates.
- **My Teaching only covers postgraduate offerings.** It leaves out LMS courses he contributes to, training programs he trains or coordinates, and today's sessions.
- **Sidebar groups are collapsed by default**, so the sidebar looks almost empty (only Home and Calendar show).
- **Training Programs shows every program** (drafts, prices, ones he has nothing to do with) plus a **New Training Program** button. The API lets him create one: tested, 200.
- **No notification** when he is assigned to anything. The notification table stays empty.

### 3.4 Entity Coordinator

- **Dashboard home:** the same generic admin analytics, plus "Create new course", which he can't use. His real home is "My organization".
- **Entity-wide assignments enroll him as a learner.**
  - An entity-wide course assignment with auto-enroll also enrolls the coordinator.
  - He then shows up in his own progress stats ("2 members learning").
- **Training cards are thin.** A training program card shows only a name and type: no dates, seats, trainer or venue. That isn't enough to decide whom to assign.

### 3.5 Trainee

- **The header only has Courses and Library** (plus Trail and Boards icons). The profile menu only has Settings, Purchases and Sign out.
- **Working pages have no link to them:** `/calendar`, `/academics` (My academics), `/admissions` (open intakes), and certificates.
- **"Courses and programs open to you" shows only courses.** Not tested: whether an assigned training program appears.

### 3.6 Super admin (`/admin`)

- **It's the generic multi-tenant console:** organizations, users, analytics, developers, and the portal-access matrix.
- **Portal access is one global sidebar matrix per system role.** There is no per-person override and no "preview as role", so the only way to check a portal is to sign in as a real account (as done here).

## 4. Plan

### Phase 0 — Quick fixes (½–1 day)

- **B1:** redirect to `/login` after the password change, and replace the learnhouse 404 with an academy-branded page.
- **B2:** the training-program list returns drafts only to admins; others get published programs that are assigned or open to them.
- **B3:**
  - Show Getting Started only to admins, and only until its steps are actually done (6 courses exist → step 1 done).
  - Let it collapse to a pill so it never covers page actions.
  - Replace the first-run modal with academy content.
- **B4:** a contributor added by an admin is ACTIVE immediately. PENDING stays only for self-applications.
- **B5:** fix the course count.
- **B6:** after login, send each role to its workspace:
  - Admin → `/dash`
  - Instructor → My Teaching
  - Coordinator → My organization
  - Trainee → `/`

### Phase 1 — Role-aware homes & navigation (2–3 days)

- **`/dash` home per role:**
  - **Admin:** the academy KPIs, as today.
  - **Instructor:** "My work":
    - today's sessions
    - offerings, courses and programs I teach
    - grading queue
    - interviews
    - pending contributor invitations
  - **Coordinator:** an entity snapshot: members, assigned training, completion, overdue.
- **Sidebar:**
  - Expand the groups the role actually uses.
  - Hide "Create new course" for roles that can't create.
- **Learner header:**
  - Add My learning, Programs, Calendar and Certificates.
  - Show My academics only for postgraduate students or applicants.

### Phase 2 — One staffing model (3–4 days)

- **The Instructor registry is the single source for teaching staff everywhere.**
- **Course: two separate concepts.**
  - **Teaching staff** (instructor/assistant from the registry): delivery.
  - **Contributors**: content-editing access.
- **Training program detail:** add a **Staff** section:
  - coordinator
  - trainers per course/session (registry, with availability and rate)
  - venue
  - schedule
- **Instructor profile → "Assignments":** every course, offering, program and session, in one list.
- **Access follows the assignment, not just the role.** Anyone assigned (trainer, coordinator, lecturer) sees that item in their workspace, even if their role's sidebar doesn't include the whole section.

### Phase 3 — Scoped visibility & permissions (2 days)

- **Training programs:**
  - Learners see only published programs that are assigned or open to them.
  - Instructors see only programs they're assigned to.
  - Creation is admin-only (decision D1).
- **Entity-wide assignments skip coordinators** unless the academy ticks "include coordinators" (D2).
- **Super admin: "Preview as role".** A read-only view of any role's sidebar and home, to check portal-access changes without real accounts.

### Phase 4 — Assignment notifications & tasks (2–3 days)

- **In-app notification and email (Communication templates already exist) when:**
  - an instructor is assigned to an offering, course or program
  - a coordinator is appointed
  - a trainee is assigned training (with due date)
  - a contributor invitation is sent
- **"Needs attention" per role**, not just the admin's: grades to submit, invitations to accept, members not started, overdue training.

### Phase 5 — Terminology, cleanup & tests (1–2 days)

- **One name for entity / الجهة in every screen and locale** (D3).
- **Drop the orphan tables** (B7).
- **Add a QA seed script** that creates the four personas and their assignments.
- **Add Playwright e2e tests** that sign in as each role and assert what each portal shows and hides.

## 5. Decisions

- **D1 — answered:** creating courses and (training) programs is admin-only.
- **D2 — answered:** entity coordinators are not learners in their entity's assignments.
- **D3 — open:** the English name for الجهة.
- **D4 — answered:** Phase 0 + 1 first.

## 6. Delivered (2026-10-06): Phase 0 + Phase 1

**Phase 0**

- **B1:**
  - Every `/auth/login` link now points to `/login`, including the redirect after the forced password change and the OAuth/SSO error links.
  - The 404 page is academy-styled; the learnhouse logo is gone.
- **B2:** the training-program list shows drafts only to academy admins and the program's own staff (coordinator, active authors).
- **B3:** the generic SaaS onboarding (Getting Started bar and welcome modal) is removed from the dashboard and the editor.
- **B4:** contributors added by a course owner or admin are ACTIVE immediately. Adding someone who had applied approves the application.
- **B6:** after sign-in, staff (dashboard access) land on `/dash` and learners on `/`, via `/redirect_from_auth?to=`.
- **D1:** the Instructor role can't create courses, programs or training programs. The role seed is refreshed at API startup.
- **D2:** coordinators are kept out of the entity's members group, so entity-wide assignments don't enroll them. They are also excluded from progress stats, and rejoin the group if they stop being coordinator.

**Phase 1**

- **`/dash` home by role (`useWorkspaceRole`):**
  - **Instructor — "My work":**
    - KPIs
    - needs-attention list: grades to submit, returned gradebooks, interviews
    - teaching now
    - my courses
    - my training programs
    - the calendar rail
  - **Coordinator — "My organization":**
    - entity KPIs (learners, learning now, completion, training to assign)
    - quick actions that deep-link to `/dash/my-entity?tab=…`
    - available training with its assignment status
    - members who haven't started
  - **Admins and custom roles:** the academy dashboard, unchanged.
- **New API `GET /instructors/org/{org_id}/me/assignments`:** the caller's courses (profile, offering, active authorship) and training programs (coordinator or staff).
- **Sidebar:** "Create new course" only shows for roles allowed to create courses.
- **Learner header:**
  - **My learning** (`/trail`) and **My calendar** are always added, even to menus saved before they existed.
  - **My academics** appears for postgraduate students, applicants, or while admissions are open.
  - The unlabeled Signpost icon was replaced.

**Not done yet in Phase 1:** a learner "Programs" page, which needs the scoped visibility from Phase 3.

## 7. Delivered (2026-10-06): Phase 2 — one staffing model

- **One rule for teaching staff (`resolve_teaching_staff`).** Course instructors, offering lecturers and TAs, and session instructors must be **active instructors in the registry**. Anyone else gets a 400 that points to Administration → Instructors.
  - Re-saving an unchanged assignment still works after that instructor goes inactive.
  - The lecturer picker no longer falls back to "any staff" when the registry is empty; it links to Instructors instead.
- **Session instructor.** A course session can have its own instructor (guest or substitute). Otherwise the course instructor teaches it. Model, API, Delivery tab picker, and a "Taught by" label. Migration `ad8c9d0e1f2a` adds the column where it is missing.
- **Calendar.**
  - Guest instructors see only their own session; the course's deadlines stay hidden from them.
  - A session shows its own instructor.
  - Teaching assistants now count as teaching the offering.
- **Training program → Staff section.**
  - The coordinator picker has moved onto the program page.
  - Each course's trainer is the course instructor, picked from the registry.
  - Each course shows its session count, next date and guest sessions.
  - A badge counts courses without a trainer.
  - Admins can edit; everyone else sees it read-only.
- **Assignments API.**
  - `GET /instructors/org/{org}/me/assignments` and `GET /instructors/{uuid}/assignments` return:
    - courses
    - offerings (lecturer or assistant)
    - training programs (coordinator, **trainer** via a linked course, or staff)
    - upcoming sessions (course or guest)
  - The instructor profile has a new **Programs & schedule** tab.
- **Access follows assignment.** Anyone who coordinates a training program, or teaches an offering, gets Training Programs or My Teaching in the sidebar, and the route guard allows it, whatever their role's defaults.
- **Contributors tab.** It now explains that contributors edit content, and links to Delivery & Resources for choosing who teaches.

**Spun off:** deleting a training program leaves its authorship rows behind (7 orphans in dev).

## 8. Delivered (2026-10-06): Phase 3 — scoped visibility

- **Training programs, management list.**
  - Academy admins see everything.
  - Everyone else sees only the programs they run or teach (coordinator, creator / maintainer, trainer of a linked course), whatever the status.
  - Training Programs left the Instructor role's default sidebar; it now comes from assignment.
- **Training programs, learner catalog.**
  - `GET /training-programs/org/{org}/catalog` lists published programs that are public, open (no audience restriction), or assigned to the learner, with their published courses and an `assigned` flag.
  - "Available" (coordinator-assignable) programs don't grant access until assigned.
- **Learner Programs page (`/programs`).**
  - Cards with type, dates, venue, price and courses, plus All / Assigned-to-me filters.
  - Header item **Programs**, shown only when there is something to show.
  - With more than four header items, the bar shows icons only below 1280px (labels stay as tooltips), so it never wraps.
- **Postgraduate programs list.** Academy admins see all; others see only programs they coordinate or author, or where they coordinate a cohort. Applicants keep using the admissions catalog.
- **Roles & portals (Administration).** Per role: where they land after sign-in, their home page, the learner header (for trainees), the sidebar toggles, and a live sidebar preview including the assignment-based extras. Academy admins can look; only a superadmin can change toggles (they are platform-wide).
  - Built here because `/admin` (the super-admin console with Portal access) shows "Not available in OSS mode" in this deployment.
