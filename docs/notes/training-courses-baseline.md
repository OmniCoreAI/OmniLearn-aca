# Training Courses — Baseline Architecture (for Postgraduate reuse)

Purpose: document how the existing LMS course system (used today for Training Courses) works, so that
Postgraduate course delivery reuses the same Course entity, content structure, editor, assessments,
progress, certificates and permissions rather than re-implementing them.

Paths are relative to `apps/api/src` (backend) and `apps/web` (frontend) unless stated otherwise.

---

## 1. The Course entity

**Model:** `db/courses/courses.py` — table `course`.

| Field | Notes |
|---|---|
| `id`, `course_uuid` (`course_…`), `org_id` | Org-scoped (CASCADE). |
| `name`, `description`, `about`, `learnings`, `tags` | `learnings` and `tags` are free-text strings. |
| `thumbnail_type` (image / video / both), `thumbnail_image`, `thumbnail_video` | |
| `public`, `published` | Visibility and release. The only "status" a course has. |
| `open_to_contributors` | Allows users to apply as contributors. |
| `seo` (JSONB), `extra_metadata` (JSONB) | |
| `creation_date`, `update_date` | Stored as strings. |

**What the Course does *not* have:** no course code, credits, contact hours, level, category or type, no
lifecycle status beyond `published`, no instructor field (teaching staff are *authors/contributors*), no
term/schedule, and no enrollment record.

- **Categories:** there is no course-category entity. "Categories" in the codebase refer to *instructor*
  pay categories (`db/instructors`) and finance ledger categories.
- **"Training course" as a type:** exists only as a `TrainingProgram.training_type` value
  (`type_training_course`), not on the course itself.

**Creation:** `POST /courses/` (multipart form).
- UI: `components/Objects/Modals/Course/Create/CreateCourse.tsx`, with fields name, description, thumbnail
  (upload or Unsplash), learnings, tags and visibility. There are also AI-assisted and migration-wizard
  variants.
- The modal already supports an `onCreated(course_uuid)` hand-off used by the academic layer.
- The creator becomes the course's `CREATOR` author (`db/resource_authors.py`).

**Other course endpoints** (`routers/courses/courses.py`):
- Read, update and delete; list, count and search by org slug.
- `/{uuid}/meta` returns the full course tree (chapters and activities).
- `/{uuid}/clone` does a deep copy (chapters, activities, blocks and files; the copy is private and
  unpublished).
- Export/import.
- Course updates (announcements): `db/courses/course_updates.py`.
- Contributors: add, bulk add/remove, apply.
- `/{uuid}/rights` returns the permission map (§8).

## 2. Content structure

```text
Course
 └─ Chapter (ordered via CourseChapter.order)          db/courses/chapters.py, course_chapters.py
     └─ Activity (ordered via ChapterActivity.order)   db/courses/activities.py, chapter_activities.py
          ├─ Block (rich-content pieces for DYNAMIC pages)       db/courses/blocks.py
          └─ ActivityVersion (content history + restore)         db/courses/activity_versions.py
```

**Activity types** (`ActivityTypeEnum` / `ActivitySubTypeEnum`):

| Type | Subtypes | Used for |
|---|---|---|
| `TYPE_DYNAMIC` | page / markdown / embed | Lessons and lecture notes built in the block editor |
| `TYPE_VIDEO` | hosted upload / YouTube | Recorded lectures |
| `TYPE_DOCUMENT` | PDF / DOC | Readings, syllabus, handouts |
| `TYPE_ASSIGNMENT` | any | Assignments, quizzes and exams (§4) |
| `TYPE_SCORM` | 1.2 / 2004 | External packages |
| `TYPE_CUSTOM` | custom | |

- **Per-item gating:** `lock_type` on both chapters and activities: `public`, `authenticated`, or
  `restricted` to specific user groups (`/chapters/{uuid}/usergroups`, `/activities/{uuid}/usergroups`).
- **Publishing:** activities carry their own `published` flag.
- **Editor UI:** `/dash/courses/course/[courseuuid]/[subpage]`. The tabs are **general**, **content**
  (EditCourseStructure: drag-and-drop chapters and activities), **access**, **contributors**, **seo**,
  **certification** and **analytics**. Each tab is gated by the permission map (`useCourseRights`).
- **Learner player:** `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/…` (course page and activity
  pages).

## 3. Course materials

- All materials (videos, documents, dynamic pages, SCORM) are activities inside the course's chapters.
  Files are stored per course and activity, on S3 or local disk; clone copies the files.
- A standalone Library (`db/folders`, `db/media`) holds shared media and can be embedded.

**Implication for Postgraduate:** one LMS course is one content container. Reusable materials (syllabus,
references, standard notes) therefore live in one course. Term-specific materials (this term's lectures,
assignments, exams) need their own course, or they would mix across cohorts. That is why Phase 1 models
each offering as: catalog template course, cloned once per offering.

## 4. Assessments (assignments, quizzes, exams)

Model: `db/courses/assignments.py`. Router: `routers/courses/assignments.py`.

**Assignment**
- Linked to course, chapter and activity (`TYPE_ASSIGNMENT`).
- `due_date`, `published`, retries.
- Grading type: `ALPHABET | NUMERIC | PERCENTAGE | PASS_FAIL | GPA_SCALE`.
- Optional "show correct answers".

**AssignmentTask**
- Types: `FILE_SUBMISSION | QUIZ | FORM | CODE | SHORT_ANSWER | NUMBER_ANSWER | CUSTOM`.
- Each task has `max_grade_value` and optional reference files.

**Submissions**
- `AssignmentTaskSubmission` holds a per-task grade.
- `AssignmentUserSubmission` holds the overall grade, status, feedback and `attempt_number`.

**Endpoints** cover tasks, per-task submissions, my/others' submissions, manual grading
(`/{uuid}/submissions/{user_id}/grade`), mark done, retry, and a course-level list (`/course/{course_uuid}`).

**Quizzes and exams** are assignments with `QUIZ` tasks (auto-graded) or mixed tasks. There is no separate
exam entity, and no exam schedule, venue or invigilation.

**Missing for Postgraduate:**
- No assessment **weights**, no course-level **gradebook** and no final course grade.
- No grade scale and no GPA.
- `TrailStep.grade` is a free string.
- These belong to Phase 2.

## 5. Enrollment

There is **no enrollment table** in the course system. Two things together play that role.

**1. Access** decides who *may* open the course (`security/rbac/resource_access.py`, read rules):
1. `public && published` → everyone.
2. Author or contributor.
3. Org admin or maintainer.
4. Role permission, public courses only.
5. Member of a **UserGroup linked to the course** (`UserGroupResource`) **and the course is `published`**.
6. EE: when a linked user group belongs to a `PaymentsOffer`, access requires payment (paywall, HTTP 402).

**2. Trail** records who *started* the course:
- `POST /trail/add_course/{course_uuid}` creates a `TrailRun` for the user and course, with status
  `IN_PROGRESS | COMPLETED | PAUSED | CANCELLED`.
- The "enrollment" analytics count these runs.

## 6. Progress & completion

- `TrailStep` (one per user and activity) holds `complete`, `teacher_verified`, `grade` and `data`.
- Activities are marked done via `/trail/add_activity/{activity_uuid}`. Assignments mark done on
  grading or submission.
- **Completion rule** (`services/courses/certifications.py::is_course_fully_completed`): every activity in
  the course has a completed step for the user. It is binary; there is no pass mark and no weighting.

## 7. Certificates

- `Certifications`: one per course, with a JSON `config` holding template, fields and signatures.
- `CertificateUser`: one per user, with a verification uuid.
- **Automatic issue:** `check_course_completion_and_create_certificate` runs when the last activity is
  completed.
- Endpoints: CRUD on the certification, `/user/course/{uuid}`, `/certificate/{uuid}` (public
  verification) and `/user/all`.
- Certificates belong to a **course only**. Nothing exists at program or degree level.

## 8. Permissions

**Org roles** (`services/setup/setup.py`) store rights JSON per resource bucket (`courses` carries
create/read/update/delete plus `*_own` variants):

| Role | Access |
|---|---|
| Academy Admin | Everything |
| Organization Coordinator (maintainer) | Admin-level on the org's resources |
| Instructor | Create; update/delete own |
| Trainee | Read |

**Course authorship** (`ResourceAuthor`): `CREATOR | MAINTAINER | CONTRIBUTOR | REPORTER`, with an
active/pending status. Authorship grants editing.

**Permission map** (`GET /courses/{uuid}/rights`), used by the editor tabs: `read`, `create`, `update`,
`delete`, `create_content`, `update_content`, `delete_content`, `manage_contributors`, `manage_access`,
`grade_assignments`, `mark_activities_done`, `create_certifications`.

**Dashboard sections** are gated per system role by portal navigation (`security/rbac/nav_items.py`,
`portal_role_nav_config`).

## 9. Reporting

**Course analytics tab** (`components/Dashboard/Analytics/Course/*`) is built on Tinybird pipes
(`db/tinybird/endpoints/course_*.pipe`):
- enrollment trend, active learners, learner progress
- completion velocity, time to completion
- drop-off and funnel, retention
- certification rate, top learners, peak hours

**Finance** (`services/finance/reporting.py`):
- Per-course profit: revenue, costs, attendees, certified attendees.
- Courses are classified `postgraduate` vs `training` by looking them up through the academic links.

---

## 10. Reuse map: Training Courses → Postgraduate

| Baseline capability | Reused by Postgraduate as | Status |
|---|---|---|
| Course entity, editor, chapters/activities, blocks, versions | The **offering's content course** (and the catalog **template course**). Same editor at `/dash/courses/course/…`. | Reused (Phase 1) |
| Clone | Template → one content course per offering (never per student) | Reused (Phase 1) |
| Materials (video, PDF, dynamic, SCORM) | Unchanged, inside the content course | Reused |
| Assignments, quizzes, auto/manual grading | Offering assessments. Gradebook weights and final grade on top. | Reused; weights and gradebook in Phase 2 |
| UserGroup + UserGroupResource access | Offering **roster group** linked to the content course, membership per registered enrollment | Reused (Phase 1) |
| Trail / TrailStep progress | Student progress inside an offering | Reusable as-is |
| Completion rule | Input to the enrollment result, not sufficient by itself (a postgraduate pass needs a grade) | Phase 2 |
| Certificates | Course certificates stay optional. Degree award belongs to Graduation. | Phase 6 |
| Authorship / contributors | Offering instructor and TA become course **maintainers** | Fixed (§11) |
| Course analytics | Works per content course | Reused |
| Finance classification | Recognises offering content courses | Fixed (§11) |

The postgraduate academic records (catalog course, curriculum, offering, enrollment) **wrap** the LMS Course.
They do not replace or duplicate its content, editor or assessments. The catalog course holds only what the
LMS Course lacks: code, credits, level, type and prerequisites.

## 11. Gaps found in Phase 1 while mapping onto the baseline

Items 1–4 are **fixed**: `services/academic/offerings.py::_sync_content_course`, `services/finance/reporting.py::_course_program` and the offering page's "Create content course" action. Tests: `TestContentCourseReuse` in `tests/services/test_academic_core.py`.

1. **Registered students cannot open an offering's content course yet.** Clones are unpublished, and
   user-group access requires `published=True` (§5, rule 5).
   - **Fix:** when an offering moves to *open* or *in progress*, set its content course `published=True`
     while keeping `public=False`. It stays reachable only through the roster group.
2. **The offering instructor and TA get no editing rights** on the content course.
   - `CourseAcademicProfile` did this with `ensure_coordinator_authorship` (maintainer authorship).
   - **Fix:** apply the same when an instructor or TA is set on an offering.
3. **Finance reporting ignores offerings.** `_course_program` only follows the legacy
   `SemesterCourse` / `TrainingProgramCourse` links.
   - **Fix:** also resolve `CourseOffering.content_course_id` to its cohort's program.
4. **Offering creation lacks a "create content course" option.** A catalog course without a template
   yields an offering with no content course.
   - **Fix:** create an empty course through the standard course service, with the same `CreateCourse`
     modal and its `onCreated` hand-off.
5. **Completion/grades → enrollment result.** Phase 2 derives `completed` / `failed` from the
   gradebook instead of setting it by hand.
