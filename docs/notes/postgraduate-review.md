# Postgraduate Studies — Review, Restructuring & Roadmap

Status: Phase 1 (academic core) and Phase 2 (assessment & results) implemented on branch `feature/academy-eaca-migration`.
Scope reference: the "Postgraduate Studies Module — LMS Review, Restructuring & Best-Practice Specification" (§1–§44).

---

## 1. Summary

The existing module modelled postgraduate studies as **Program → Cohort → Semester → (LMS) Course** with a
1:1 academic profile per LMS course. That structure violated the single-source-of-truth principle at its core:

- **A course could belong to only one semester in the whole organization** (`uq_semestercourse_course`).
  Teaching "AI-501" to a second cohort meant cloning the entire LMS course (content, assignments,
  certificate) and re-typing its code, credits, instructor and schedule.
- **Semesters were owned by a cohort**, so "Fall 2026" existed once per cohort and the study plan was
  rebuilt for every intake. There was no curriculum and no academic calendar.
- **Enrollment was only user-group membership** — no student number, status, dates or per-course
  registration; any org user (including admins) could be "enrolled".

Phase 1 replaces this with a connected lifecycle:

```text
Program ─┬─ Curriculum (versioned) ── CurriculumItem ──► AcademicCourse (catalog, defined once)
         │                                                      │
         └─ Cohort (code, curriculum version, intake term)      │
               │                                                ▼
               ├─ CohortMembership (student no., status)   CourseOffering (course × term × cohort × section)
               │        │                                   ├─ instructor / TA / classroom / capacity / status
               │        └──────── Enrollment ──────────────►├─ OfferingSession (schedule)
               │                                            ├─ content course (term-specific materials)
AcademicYear ── AcademicTerm (org-wide calendar) ◄──────────┘   └─ roster group (access granted per enrollment)
```

---

## 2. Classification of the existing module

Legend: **A** Keep · **B** Modify · **C** Merge · **D** Remove · **E** Missing · **F** Reconsider.

### 2.1 Entities (backend)

| Existing item | Class | Finding | Resolution (Phase 1) |
|---|---|---|---|
| `Program` (name, level, status, coordinator, fees, dates, images) | A/B | Valid master entity. Missing department, faculty, min credits, duration, max duration; code free text. | Added `faculty`, `department`, `min_credits`, `duration_months`, `max_duration_months`; code normalised/validated (`[DEGREE]-[FIELD]`, unique per org). |
| `ProgramLevel` (phd / masters / diploma) | A | Matches the three required program types. | Kept. Degree prefix map DIP/MSC/PHD used for code suggestions. |
| Program status (draft/active/suspended/archived) + transition rules | A | Correct lifecycle, enforced server-side. | Kept. |
| `Program.in_plan` | F | Ambiguous ("study plan"? "budget plan"?). | Left untouched; flagged for a product decision (Phase 2 cleanup). |
| `Program.published` + `public` + `status` | C | Two overlapping visibility/lifecycle concepts. | Kept for now; recommend `status=active` ⇒ published (Phase 2). |
| `Cohort` | B | Free-text academic year, no code, no curriculum, no intake term; capacity/dates/coordinator duplicated from program. | Added generated `code` (`MSC-AI-2026`), `curriculum_id` (frozen version), `intake_term_id`. |
| `Semester` (owned by cohort) | F→D | Duplicates the calendar per cohort; mixes calendar and curriculum. | Replaced by org-wide `AcademicTerm` + `CurriculumItem(year_no, term_no)`. Table kept read-only ("Legacy semesters") until data is confirmed migrated. |
| `SemesterCourse` link (code, credits, order; course unique) | F→D | Root cause of course duplication; code/credits stored on a link. | Replaced by `AcademicCourse` (catalog) + `CourseOffering`. Data migrated. |
| `CourseAcademicProfile` (1 per LMS course: credits, instructor, classroom, capacity, status, add-ons, certificate) | F / C | Offering data attached to the course; `credit_hours` duplicated with the link; commerce add-ons in an academic record. | Offering data moved to `CourseOffering`; credits live only in the catalog. Profile kept for Training Programs (out of scope). |
| `CourseScheduleSession` (per profile) | B | Schedule belongs to a delivery, not a course; sessions could not be edited in the UI. | New `OfferingSession` per offering with full CRUD. |
| Enrollment = `UserGroupUser` in cohort group | F | No student record; no status; access leaked after unlinking a course. | `CohortMembership` (student number, status, dates) + `Enrollment` per offering (status lifecycle). Access now granted/revoked per enrollment through an offering roster group. |
| Cohort user group on delete | D (bug) | Group orphaned by `SET NULL` on cohort/program delete. | Deleted explicitly with the cohort/program (and offering roster groups). |
| `unlink_course_from_semester` | D (bug) | Left `UserGroupResource` grant → students kept access. | Grant is revoked on unlink. |
| `TrainingProgram` (+ course link) | C | Near copy of `Program`. | **Out of scope** (decision): left as-is; shared form helpers decoupled from the postgraduate page. |
| RBAC: `programs` rights bucket, cohort/semester delegate to program | A | Sound delegation model. | Kept. Program-scoped data (curricula, cohort offerings, students) delegates to the program; org master data (calendar, catalog, open offerings) requires org admin/maintainer. |
| Postgraduate roles (Supervisor, Examiner, Coordinator, Committee, Graduate Studies Admin) | E | Only 4 generic system roles; coordinator is a column, not a role. | Phase 5. |

### 2.2 Screens & navigation (frontend)

| Existing screen / item | Class | Finding | Resolution |
|---|---|---|---|
| Programs list (`/dash/postgraduate`) | A/B | Fine; 4th badge silently dropped; code free text. | Kept; all badges render; code suggestion + validation hint; new fields in the form; section tabs added. |
| Program detail = cohort grid only | B | Program attributes invisible after creation. | Now an overview (code, level, faculty, department, credits, duration, coordinator, active curriculum) + **Curricula** + **Cohorts**. |
| Cohort detail = semester grid + enrollment modal | F | Semesters per cohort; enrollment hidden in a modal; cohort info not shown. | Overview stats, **Course offerings** grouped by term with "Generate from curriculum", **Students** table (student no., status transitions). Legacy semesters shown read-only only when present. |
| Semester detail (link courses, edit code/credits, academic profile) | D | Duplicated course metadata per semester; 409 on reuse. | Superseded by catalog + offerings. Page kept only for legacy data. |
| `AttachCourseModal` "Create & attach" | D | Created a new LMS course per semester. | Not used by new flows (offerings clone the catalog template once per offering, never per student). |
| `EnrollmentPanel` (any org user) | B | Staff could be enrolled; no student number. | Student pickers are limited to the Trainee role; admission creates a student record. |
| Mobile menu | D (bug) | Ignored role visibility — everyone saw Postgraduate/Finance/etc. | Uses the same `isItemVisible` as the desktop sidebar. |
| Shared `Field`/`inputCls`/`SubmitRow` exported from a page file | B | Five unrelated screens imported from `postgraduate/client.tsx`. | Moved to `components/Dashboard/Pages/Academic/AcademicForm.tsx`. |
| Arabic terminology | B | "القاعة" used for both the Teaching nav section and the classroom field; "مكتمل" for both *full* and *completed*. | Teaching → "التدريس"; full → "ممتلئ". Academic courses consistently "المقررات". |
| Hardcoded English in `AcademicCard` | B | "Edit/Delete/Open/Program". | Translated. |
| Finance and News under "Academic" nav | F | Not academic processes. | Flagged; not moved (nav reorganisation is a product decision). |

### 2.3 Fields that are now system-generated

| Field | Rule |
|---|---|
| Program code | Normalised upper-case, letters/digits/dashes, unique per org; UI suggests `[DEGREE]-[FIELD]`. |
| Cohort code | `<PROGRAM_CODE>-<YEAR>` from intake term / start date; suffixed `-2` for a second intake in the same year. |
| Term code | `FALL-2026`, `SPRING-2027`, `SUMMER-2027` (custom terms: validated code). |
| Offering code | `<COURSE>-<TERM>[-<COHORT>]-<SECTION>`. |
| Student number | `<COHORT_CODE>-<seq>` (e.g. `MSC-AI-2026-001`), unique per org. |
| Curriculum version | Validated `YYYY.n`. |

### 2.4 Workflow rules now enforced server-side

- Curriculum: `draft → active → retired`; cannot activate an empty curriculum; **structure frozen once a cohort
  follows it** (clone to a new version instead) — protects historical records (§44 versioning).
- Offering: `planned → open → in_progress → completed`, `cancel` from any active state; cannot delete an offering
  with final results.
- Enrollment: `registered → dropped | withdrawn | completed | failed`; `dropped/withdrawn → registered`.
  Capacity enforced. **Course prerequisites enforced** (completed enrollment in each prerequisite), with an
  explicit administrative override.
- Student record: `active ↔ deferred | suspended`, `→ withdrawn`, `active → completed → graduated`.
  Deferral/suspension/withdrawal automatically withdraws current registrations and revokes content access.
- Admission auto-registers the student in the cohort's current **required** offerings (electives are opt-in).
- Course prerequisites reject self-references and cycles. Admission prerequisites are deliberately a separate
  concept (Phase 3).

---

## 3. Spec coverage matrix

| Spec § | Area | Status |
|---|---|---|
| 4–5 | Program management & codes | **Done** (Phase 1) |
| 6 | Cohorts separate from programs | **Done** |
| 7 | Curriculum (versioned, required/elective, credits, min grade) | **Done** |
| 8 | Reusable course catalog | **Done** (outcomes, prerequisites, level, type, contact hours) |
| 9 | Course offering / section | **Done** |
| 10 | Materials: reusable on course, term-specific on offering | **Done** (catalog template LMS course → cloned once per offering) |
| 12 | Course prerequisites as structured rules | **Done** (course level) |
| 15 | Semester/term calendar with periods | **Done** (registration, add/drop, exams, grade deadline) |
| 16 | Unified student academic record | **Partial** — record, status, current courses; GPA/credits in Phase 2 |
| 40 | Navigation | **Partial** — Programs · Course Catalog · Course Offerings · Students · Academic Calendar |
| 11, 13, 14 | Admissions, eligibility, entrance tests, interviews, decisions | **Done** (Phase 3) |
| 17–20 | Assessment components, gradebook, results, GPA/CGPA, transcript | **Done** (Phase 2); exam scheduling/venues/invigilation still open |
| 21, 30 | Progression rules / program requirements engine | Phase 4 |
| 22–28 | Research & thesis: topics, supervisors, proposal, reviews, milestones, examiners, defense, outcomes | Phase 5 |
| 29, 31 | Configurable per-program workflows | Phase 4–5 (workflow engine) |
| 32 | Postgraduate roles | Phase 5 |
| 33 | Role-specific dashboards | Phase 2+ (`GET /academic-records/me` already feeds a student view) |
| 34 | Event-driven notifications | Cross-cutting (no notification subsystem exists yet) |
| 35 | Audit trail | Cross-cutting (no audit model in this codebase; `auditlog` is EE-only) |
| 36 | Structured documents | Phase 3/5 (reuse `Media` + folders) |
| 37 | Reports & analytics | Phase 6 |

---

## 4. Roadmap

1. **Phase 2 — Assessment & results.** Grade scales (configurable), assessment components with weights on the
   offering, gradebook computed from existing `Assignment` submissions, final course grade → sets enrollment
   `completed/failed`, semester GPA / CGPA, credits attempted/earned, transcript. Remove `semester*` tables once
   production data is confirmed migrated. Decide `in_plan` / `published` vs `status`.
2. **Phase 3 — Admissions.** Program admission requirements (structured rules), applications with document
   verification, entrance tests (reuse assignments; legacy `ExamType 13 AcceptanceTest`), interviews, decisions
   (accepted/rejected/waitlisted) → `CohortMembership`. Audit trail on decisions.
3. **Phase 4 — Progression & requirements engine.** Per-program requirement rules (min credits/CGPA, core/elective
   credits, qualifying exam, thesis), evaluated into standing (warning, probation, eligible for thesis/graduation).
   Generic workflow engine (draft → submitted → under review → revision → approved) reused by later phases.
4. **Phase 5 — Research & thesis.** Supervisor records & capacity, assignments (primary/co/advisor), proposals with
   versions, reviewer assignment & recommendations, committee decisions, milestones, thesis submission, examiner
   nomination/approval, defense scheduling & outcome; new roles (Supervisor, Examiner, Program Coordinator,
   Graduate Studies Admin, Academic Committee). Different default workflows for Diploma / Master's / PhD.
5. **Phase 6 — Graduation & reporting.** Eligibility, clearance, degree award, graduation records; academic,
   program, research and administrative reports.
6. **Cross-cutting.** Audit log model (user, action, before/after, related entity) for grades, admissions, status,
   supervisors, approvals; event-driven notifications (email first); document categories.

---

## 5. Legacy EACA mapping notes

See `docs/notes/academy-eaca-migration.md`. Relevant to this model:

- `GENTalentBuilders` → `Program`; `ScientificDegree` (int, unresolved until the `.bak` is restored) → `program_level`.
- `GENTalents` / `GENClassrooms` → `Cohort` (+ `CourseOffering` per classroom delivery).
- `GENTypes` → `AcademicCourse` (catalog); `GENType_Course` (`PassMark`, `IsMandatory`) → `CoursePrerequisite.min_grade`.
- `ProsecutionId = 1` / `GroupTypeId = 4` identify postgraduate records.
- `Contacts_Courses.CourseStatus` / `TalentCourseStatus` → `Enrollment.status`; `StudentStatus` → `CohortMembership.status`.
- `ExamType 13 AcceptanceTest` → Phase 3 entrance tests.

---

## 6. Implementation reference (Phase 1)

- Models: `apps/api/src/db/academic/{calendar,catalog,curricula,offerings}.py`; `programs.py`, `cohorts.py` extended.
- Services: `apps/api/src/services/academic/{common,calendar,catalog,curricula,offerings,students}.py`.
- API: `apps/api/src/routers/academic/core.py` — `/academic-years`, `/terms`, `/academic-courses`,
  `/programs/{uuid}/curricula`, `/curricula/...`, `/offerings/...`, `/cohorts/{uuid}/students`,
  `/cohorts/{uuid}/generate-offerings`, `/academic-students`, `/academic-records/me`.
- Migration: `apps/api/migrations/versions/i7d8e9f0g1h2_academic_core.py` (schema + idempotent conversion of
  legacy semester links into catalog courses, terms, offerings, memberships and enrollments).
- Tests: `apps/api/src/tests/services/test_academic_core.py`.
- UI: `apps/web/app/orgs/[orgslug]/dash/postgraduate/**`, `apps/web/services/academic/core.ts`,
  `apps/web/components/Dashboard/Pages/Academic/{AcademicUI,AcademicForm,OfferingsTable}.tsx`.

---

## 7. Phase 2 — Assessment & results (implemented)

Defaults chosen (configurable): 4.0 scale with C/60 minimum pass; instructor submits, coordinator approves or
returns; a retaken course replaces the earlier attempt in credits and CGPA (the earlier attempt stays listed).

- **Grade scales** (`gradescale`): bands of letter / minimum score / points / passing. One org default (created
  on first use as "Standard 4.0"); a program can select its own (`program.grade_scale_id`). Bands of a scale
  with approved results cannot be changed.
- **Assessment components** (`assessmentcomponent`) per offering: name, type, weight (total ≤ 100, must be 100
  to submit), max score, due date, and linked LMS assignments of the content course.
- **Scores** (`componentscore`): synced from GRADED assignment submissions (average percentage × max) or entered
  manually; manual overrides survive re-syncs; every change is appended to `history` (who, when, from, to, note).
- **Workflow** on `courseoffering.grade_status`: `open → submitted → approved`, or `submitted → returned → …`.
  Scheme and scores lock while submitted/approved. Approval writes `final_score`, `letter_grade`,
  `grade_points`, `result_passed` on each enrollment and sets it to completed/failed. Offerings with a scheme
  no longer allow manual completed/failed.
- **Transcript** (`GET /academic-students/{membership}/transcript`, also in `/academic-records/me`): per term
  courses, term GPA, running CGPA, credits attempted/earned/remaining against the program minimum.
- **UI**: offering page "Assessment & gradebook" (scheme, editable score grid, sync, submit/approve/return);
  Settings tab (grade scales); program grade-scale selector; transcript modal from cohort and Students pages.
- Migration `j8e9f0g1h2i3_academic_grading.py`; tests `tests/services/test_academic_grading.py`.

Still open from the original Phase 2 list: removal of the legacy `semester*` tables and the `in_plan` /
`published` vs `status` decision (both need a product decision), a student-facing results page (API ready via
`/academic-records/me`), and exam scheduling (venue, invigilators, attendance).

---

## 8. Phase 3 — Admissions (implemented)

- **Admission requirements** per program (`admissionrequirement`), separate from course prerequisites:
  degree level, minimum GPA (normalised to 4.0), language test score, years of experience, required document,
  entrance test, interview, or other (staff-checked). Each is mandatory or optional.
- **Entrance tests** (`entrancetest`): code, passing/max score, duration, attempt limit, optional linked LMS
  assignment for online tests (score pulled from the graded submission).
- **Intakes**: `cohort.admission_status` (open / closed). Applicants can only apply to open intakes; staff can
  create applications on behalf of an applicant at any time.
- **Applications** (`admissionapplication`, number `APP-<COHORT>-0001`): draft → submitted → under review →
  accepted / waitlisted / rejected → enrolled, or withdrawn. One application per applicant per intake.
- **Eligibility engine**: every requirement is evaluated automatically (met / not met / pending with a reason);
  staff can set a result manually, which requires a reason. Accepting requires all mandatory requirements met,
  or an explicit exception with a reason (recorded as `decision_override`). Rejecting requires a reason.
- **Documents** (`applicationdocument`): stored under `orgs/{org}/admissions/{application}/`, which both content
  routers now refuse to serve; files are only streamed by the authenticated admissions endpoint to the applicant
  or program staff. Staff verify or reject (with reason).
- **Entrance test attempts**, **interviews** (panel, score, recommendation) and a full **audit trail**
  (`applicationevent`: who, when, from/to status, note).
- **Enrollment**: an accepted application becomes a cohort student record through the existing admission
  service (student number, auto-registration in required offerings).
- **UI**: Admissions tab (list with eligibility, filters, staff-created applications), application page
  (background, requirement checklist, documents, tests, interviews, decision, enroll, audit trail), and program
  page "Admission requirements" with entrance tests; cohort form admissions switch.
- **Student & applicant portal** (learner side, top menu "My academics", signed-in users only):
  `/academics` (programs with student number and status, current courses linking to their content course,
  results & transcript, own applications) and `/admissions` (open intakes with requirements, apply, continue),
  `/admissions/{id}` (status steps, background, requirement checklist, private document upload, tests and
  interviews schedule, submit / withdraw). Applicants never see panel notes, interview scores or
  recommendations, staff identities, or internal audit entries.
- Migration `k9f0g1h2i3j4_academic_admissions.py`; tests `tests/services/test_academic_admissions.py`.

---

## 9. Flow & UX review (Phase 0 fixes)

A persona-by-persona review (admin, lecturer, trainee, applicant) with the integrity fixes it produced and the
role-workspace roadmap is in `docs/notes/postgraduate-flow-review.md`. Migration
`l0g1h2i3j4k5_membership_status_history.py` adds the student status reason and history.
