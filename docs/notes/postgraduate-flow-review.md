# Postgraduate Studies — Flow & UX Review

Scope: the Postgraduate section on branch `feature/academy-eaca-migration` (Phase 1 academic core, Phase 2
assessment & results, Phase 3 admissions), reviewed from four sides: **admin / graduate-studies coordinator**,
**lecturer (doctor)**, **trainee (student)** and **applicant**.
Companion to `postgraduate-review.md` (data model and roadmap).

Severity: **P0** loses data or breaks a flow · **P1** gives an inconsistent or wrong result · **P2** UX / polish.
Status: **Fixed** = done in this change (Phase 0) · **Phase n** = on the roadmap below.

---

## 1. Executive summary

The back office is solid for administrators: codes are generated, transitions are enforced server-side, and there
are audit trails for grades and admissions. But **the module only works for admins.** Lecturers and trainees exist
in the data model (instructor/TA, registrations, transcripts) and the API already serves them, yet:

- a lecturer **cannot open any postgraduate page** (the Instructor role's default navigation excludes the section,
  and the route guard redirects to `/dash`);
- a trainee has **no "My studies" view** (`GET /academic-records/me` exists but no screen uses it);
- an applicant has **no application portal** (the applicant API is ready, the screens are not).

On top of that, several rules contradicted each other and could corrupt records. For example, generating
offerings re-registered students an admin had dropped, a result could be "completed" without a grade (so it was
missing from the transcript but still unlocked prerequisites), and deleting a program erased approved grades.
**Those integrity problems are fixed in this change (§3).** The role-based workspaces are the next phases (§4).

---

## 2. Findings

### 2.1 Cross-cutting

| # | Sev | Finding | Status |
|---|---|---|---|
| X1 | P0 | Lecturers cannot reach any postgraduate page: `postgraduate` is not in the Instructor default nav (`security/rbac/nav_items.py`), and `AdminAuthorization` redirects. The gradebook API allows instructors, but the UI never gets them there. | Phase 1 |
| X2 | P0 | Trainees have no student view: Trainee nav defaults to nothing, and `getMyAcademicRecord` is never called. | Phase 2 |
| X3 | P0 | Deleting a program or cohort cascaded to memberships, registrations with **approved grades**, applications and their audit trail, behind one confirm. Offerings, catalog courses and terms were already protected, so the rules were inconsistent. | **Fixed** |
| X4 | P1 | Deleting a user account (`user.id ON DELETE CASCADE`) deletes their academic records too. Transcripts normally outlive accounts. | Needs a data-retention decision |
| X5 | P1 | The UI ignores roles. Approve/Return, offering status buttons, delete icons and status selects are shown to everyone, so a lecturer sees "Approve" and gets a 403. | Phase 1 |
| X6 | P1 | No notifications: decisions, grades submitted/returned/approved, instructor assignment and results all happen silently. | Phase 4 |
| X7 | P2 | 19 native `window.confirm/prompt` dialogs, including for reasons stored in the audit trail. | Partly fixed (student status); Phase 4 |
| X8 | P2 | Pickers are inconsistent. Students are limited to the Trainee role in the UI only, instructors can be *any* user, and the Instructor registry (categories, rates, work logs) is not used for offerings. | Phase 1 |

### 2.2 Admin / coordinator

| # | Sev | Finding | Status |
|---|---|---|---|
| AD1 | P0 | "Generate from curriculum" re-registered students an admin had dropped or withdrawn in *every* running offering. | **Fixed** |
| AD2 | P1 | Returning from deferred/suspended did not restore courses and skipped the capacity check. Withdrawal was applied straight from a `<select>`, with no confirmation and no reason. | **Fixed** |
| AD3 | P1 | Deferred and suspended students kept program (cohort group) access. | **Fixed** |
| AD4 | P1 | Re-adding a student with a withdrawn record silently returned the old record with "success". | **Fixed** |
| AD5 | P1 | An offering could be completed with grades still open (students stuck "registered"). Cancelling kept every registration and content access. | **Fixed** |
| AD6 | P1 | Registration, add/drop and grade-deadline periods are stored on terms but never enforced. | Phase 2 |
| AD7 | P1 | Prerequisite minimum grade was stored but ignored. Curriculum `min_passing_grade` is still unused. | **Fixed** (prerequisites); curriculum minimum → Phase 4 progression |
| AD8 | P1 | A replaced instructor kept maintainer rights on the content course. | **Fixed** |
| AD9 | P1 | Changing a section could create a duplicate offering code (DB error). | **Fixed** |
| AD10 | P2 | Program `status`, `published`, `public` and `in_plan` overlap. The form offers statuses the server then rejects. Program capacity and dates duplicate the cohort's. | Phase 4 |
| AD11 | P2 | Tabs don't follow the setup order, and there is no overview or readiness checklist (why is "Generate" disabled?). | Phase 4 |
| AD12 | P2 | The legacy Semester page is still a second way to attach courses. | Phase 4 |
| AD13 | P2 | The Students tab is org-admin only, so program coordinators can't use it. | Phase 1 |

### 2.3 Lecturer / doctor

| # | Sev | Finding | Status |
|---|---|---|---|
| L1 | P0 | No "My teaching" view (my offerings, rosters, schedule, grading to do). | Phase 1 |
| L2 | P1 | Two ways to finish a course. Without a scheme, staff could set completed/failed directly, skipping approval. Those rows had no grade, so they were **missing from the transcript and CGPA but still counted as a passed prerequisite**. | **Fixed** |
| L3 | P1 | Students could be registered after grades were submitted or approved and would never be graded. There's no amend/appeal flow for approved grades. | **Fixed** (registration closes); amend flow → Phase 4 |
| L4 | P1 | No separation of duties: an instructor with program rights could approve their own grades. | **Fixed** |
| L5 | P1 | Interview panel members (usually doctors) cannot record their own evaluation. | Phase 1 |
| L6 | P2 | No attendance and no room/lecturer clash detection. Session hours don't feed instructor work logs. | Phase 4 |
| L7 | P2 | The approve error said "Scores changed since submission" when it meant "incomplete". | **Fixed** |

### 2.4 Trainee / student

| # | Sev | Finding | Status |
|---|---|---|---|
| S1 | P0 | No "My studies": program, student number, status, courses, timetable, results, transcript, credits remaining. | Phase 2 |
| S2 | P1 | Electives are "opt-in" but only admins can register students. There's no self-registration window. | Phase 2 |
| S3 | P1 | Auto-registration into *planned* offerings whose course is still unpublished: the course list shows nothing, with no explanation. | Phase 2 |
| S4 | P2 | Results appear the moment they are approved: no release date, no notification. | Phase 2/4 |

### 2.5 Applicant

| # | Sev | Finding | Status |
|---|---|---|---|
| AP1 | P0 | No applicant portal. Applicants must already be org members, and staff can only pick existing trainees. | Phase 3 |
| AP2 | P1 | Accepting ignored cohort capacity, so the failure surfaced only at "Enroll". The waitlist has no ranking or promotion. | **Fixed** (capacity); waitlist promotion → Phase 3 |
| AP3 | P1 | No "applicant accepts the offer" step before enrollment. | Phase 3 |
| AP4 | P1 | A withdrawn applicant could never apply to the same intake again. | **Fixed** |
| AP5 | P1 | Eligibility is recalculated live, so changing requirements rewrites decided applications. | Phase 3 |
| AP6 | P2 | Tests and interviews can be scheduled while "submitted", but a decision needs "under review". The extra step isn't explained. | Phase 4 |

---

## 3. What changed in this delivery (Phase 0 — flow integrity)

| Area | Rule now enforced | Where |
|---|---|---|
| Auto-registration | Generation and admission only register students into offerings where they have **no** registration yet; dropped/withdrawn registrations are never revived. | `services/academic/offerings.py` `auto_enroll_member` |
| Student status | Deferral, suspension and withdrawal **require a reason** (stored in `status_reason` plus a `status_history` log). They withdraw current registrations and remove program access. Returning to active **checks capacity** and **restores** the registrations the pause withdrew, plus any new required offerings. | `services/academic/students.py`, migration `l0g1h2i3j4k5` |
| Re-admission | Admitting a student who already has an inactive record in the cohort → 409 ("change its status instead"). | `students.admit_user` |
| Offering lifecycle | **Completed** requires approved grades (or no registered students). **Cancelled** withdraws registrations, revokes content access, hides the content course unless another live offering uses it, and is refused once results are approved. | `offerings.update_offering` |
| Single results path | Completed/failed can no longer be set by hand; results come only from gradebook approval (a single 100% component works for pass/fail-style courses). Older grade-less results now appear on the transcript as credits, outside the GPA. | `offerings.update_enrollment`, `grading.build_transcript` |
| Registration lock | No new or re-registrations once an offering's grades are submitted or approved. | `offerings.enroll_user`, `update_enrollment` |
| Prerequisites | A prerequisite's minimum grade is checked against the scale the course was graded with (error lists e.g. `ST-101 (min B)`). | `offerings.missing_prerequisites` |
| Staff rights | Replacing an instructor or TA (or swapping the content course) removes the old maintainer rights, unless that person still teaches an offering using the course. | `offerings._release_staff_authorship`, `authors.revoke_maintainer_authorship` |
| Sections | Changing a section cannot collide with an existing offering. | `offerings.update_offering` |
| Separation of duties | The offering's instructor or TA cannot approve its grades (403). | `grading.approve_grades` |
| Admissions | Accepting counts active students plus outstanding offers against capacity ("waitlist instead"). A withdrawn application can be reopened as a draft (same number, history kept). A rejection stays final for that intake. | `admissions.decide`, `admissions.create_application` |
| Deletion | A program or cohort with official results or admission decisions cannot be deleted; archive it instead. | `cohorts.assert_cohort_deletable` |
| UI | Student status changes open a dialog showing the consequence and asking for a reason, and the reason appears in the table. The offering page no longer offers manual completed/failed, and confirms cancel/complete. Delete errors show the server's explanation. The transcript marks ungraded results. EN/AR strings added. | `postgraduate/**`, `TranscriptView.tsx`, `locales/*.json` |

Tests: `tests/services/test_academic_{core,grading,admissions}.py` (+17 tests for the rules above).

---

## 4. Target experience and roadmap

**One module, four workspaces.** Each persona sees only what they act on.

| Workspace | Who | Content |
|---|---|---|
| Graduate Studies Office | Admin, coordinator | Today's tabs plus an **Overview**: KPIs (open intakes, applications by stage, offerings without instructor, grades awaiting approval, students on hold) and a **setup checklist** (calendar → grade scale → catalog → program & curriculum → cohort → admissions → offerings). |
| My Teaching | Lecturer, TA | My offerings this term, rosters, sessions, gradebook with submit, "returned to you" inbox, my interview panels. |
| My Studies | Student | Program card (student no., status, credits progress, CGPA), current courses with links, timetable, results, transcript download, elective registration while the window is open. |
| Apply | Applicant | Open intakes → step-by-step application (profile → documents → review & submit) → status tracker (tests, interviews, decision) → accept/decline offer. |

**Phases:**

1. **Phase 1 — Role-aware UI and My Teaching.** A `postgraduate-teaching` nav item on by default for
   Instructors. `GET /offerings/mine`. `can_manage` on offering reads, so admin-only controls hide. The instructor
   picker uses the Instructor registry. Panel members record their own interviews. Program coordinators can use the
   Students tab.
2. **Phase 2 — My Studies.** A learner-side page using `/academic-records/me` and the transcript. Elective
   self-registration gated by the term's registration window. Drop until add/drop ends, then withdraw. Results
   release date.
3. **Phase 3 — Apply.** Applicant portal. An `offer_accepted` step before enrollment. Eligibility snapshot at
   decision time. Waitlist ranking and promotion when a seat frees up.
4. **Phase 4 — Admin polish.** Overview and checklist, tabs in setup order, one shared confirm/reason dialog
   replacing every `window.confirm/prompt`, a program form showing only allowed next statuses (merging
   `published/public` into status), a grade amendment flow with reason, attendance and clash detection,
   notifications, and retiring the legacy semester pages.

Open product decisions: account deletion vs academic-record retention (X4), the meaning of `in_plan`, and
whether rejected applicants may re-apply to the same intake (currently no).
