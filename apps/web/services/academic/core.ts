import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
} from '@services/utils/ts/requests'

/*
  Academic core: calendar (years/terms), course catalog, versioned curricula,
  course offerings (sessions + enrollments) and student records.

  Single source of truth: a catalog course is created once and offered to
  many cohorts/terms through offerings — never duplicated per batch.
*/

async function call(method: string, path: string, access_token: string, body: any = null) {
  const result = await fetch(
    `${getAPIUrl()}${path}`,
    RequestBodyWithAuthHeader(method, body, null, access_token)
  )
  return errorHandling(result)
}

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

// ----------------------------- Calendar -----------------------------

export const getAcademicYears = (org_id: number, token: string) =>
  call('GET', `academic-years${qs({ org_id })}`, token)
export const createAcademicYear = (org_id: number, data: any, token: string) =>
  call('POST', `academic-years${qs({ org_id })}`, token, data)
export const updateAcademicYear = (uuid: string, data: any, token: string) =>
  call('PUT', `academic-years/${uuid}`, token, data)
export const deleteAcademicYear = (uuid: string, token: string) =>
  call('DELETE', `academic-years/${uuid}`, token)

export const getTerms = (org_id: number, token: string, academic_year_uuid?: string) =>
  call('GET', `terms${qs({ org_id, academic_year_uuid })}`, token)
export const createTerm = (org_id: number, data: any, token: string) =>
  call('POST', `terms${qs({ org_id })}`, token, data)
export const updateTerm = (uuid: string, data: any, token: string) =>
  call('PUT', `terms/${uuid}`, token, data)
export const deleteTerm = (uuid: string, token: string) => call('DELETE', `terms/${uuid}`, token)

// ----------------------------- Catalog -----------------------------

export const getAcademicCourses = (org_id: number, token: string, q?: string) =>
  call('GET', `academic-courses${qs({ org_id, q })}`, token)
export const getAcademicCourse = (uuid: string, token: string) =>
  call('GET', `academic-courses/${uuid}`, token)
export const createAcademicCourse = (org_id: number, data: any, token: string) =>
  call('POST', `academic-courses${qs({ org_id })}`, token, data)
export const updateAcademicCourse = (uuid: string, data: any, token: string) =>
  call('PUT', `academic-courses/${uuid}`, token, data)
export const deleteAcademicCourse = (uuid: string, token: string) =>
  call('DELETE', `academic-courses/${uuid}`, token)
export const setCoursePrerequisites = (
  uuid: string,
  prerequisites: { prerequisite_uuid: string; min_grade?: string | null }[],
  token: string
) => call('PUT', `academic-courses/${uuid}/prerequisites`, token, prerequisites)

// ----------------------------- Curricula -----------------------------

export const getProgramCurricula = (program_uuid: string, token: string) =>
  call('GET', `programs/${program_uuid}/curricula`, token)
export const createCurriculum = (program_uuid: string, data: any, token: string) =>
  call('POST', `programs/${program_uuid}/curricula`, token, data)
export const getCurriculum = (uuid: string, token: string) => call('GET', `curricula/${uuid}`, token)
export const updateCurriculum = (uuid: string, data: any, token: string) =>
  call('PUT', `curricula/${uuid}`, token, data)
export const deleteCurriculum = (uuid: string, token: string) => call('DELETE', `curricula/${uuid}`, token)
export const cloneCurriculum = (uuid: string, data: any, token: string) =>
  call('POST', `curricula/${uuid}/clone`, token, data)
export const addCurriculumItem = (uuid: string, data: any, token: string) =>
  call('POST', `curricula/${uuid}/items`, token, data)
export const updateCurriculumItem = (uuid: string, item_uuid: string, data: any, token: string) =>
  call('PUT', `curricula/${uuid}/items/${item_uuid}`, token, data)
export const removeCurriculumItem = (uuid: string, item_uuid: string, token: string) =>
  call('DELETE', `curricula/${uuid}/items/${item_uuid}`, token)

// ----------------------------- Offerings -----------------------------

export const getOfferings = (
  org_id: number,
  token: string,
  filters: { term_uuid?: string; cohort_uuid?: string; academic_course_uuid?: string } = {}
) => call('GET', `offerings${qs({ org_id, ...filters })}`, token)
export const getOffering = (uuid: string, token: string) => call('GET', `offerings/${uuid}`, token)
export const createOffering = (org_id: number, data: any, token: string) =>
  call('POST', `offerings${qs({ org_id })}`, token, data)
export const updateOffering = (uuid: string, data: any, token: string) =>
  call('PUT', `offerings/${uuid}`, token, data)
export const deleteOffering = (uuid: string, token: string) => call('DELETE', `offerings/${uuid}`, token)

export const getOfferingSessions = (uuid: string, token: string) =>
  call('GET', `offerings/${uuid}/sessions`, token)
export const createOfferingSession = (uuid: string, data: any, token: string) =>
  call('POST', `offerings/${uuid}/sessions`, token, data)
export const updateOfferingSession = (uuid: string, session_uuid: string, data: any, token: string) =>
  call('PUT', `offerings/${uuid}/sessions/${session_uuid}`, token, data)
export const deleteOfferingSession = (uuid: string, session_uuid: string, token: string) =>
  call('DELETE', `offerings/${uuid}/sessions/${session_uuid}`, token)

export const getOfferingEnrollments = (uuid: string, token: string) =>
  call('GET', `offerings/${uuid}/enrollments`, token)
export const enrollInOffering = (
  uuid: string,
  user_uuid: string,
  token: string,
  override_prerequisites = false
) => call('POST', `offerings/${uuid}/enrollments${qs({ override_prerequisites })}`, token, { user_uuid })
export const updateEnrollmentStatus = (uuid: string, enrollment_uuid: string, status: string, token: string) =>
  call('PUT', `offerings/${uuid}/enrollments/${enrollment_uuid}`, token, { status })

export const generateCohortOfferings = (
  cohort_uuid: string,
  data: { term_uuid: string; year_no: number; term_no: number },
  token: string
) => call('POST', `cohorts/${cohort_uuid}/generate-offerings`, token, data)

// ----------------------------- Students -----------------------------

export const getCohortStudents = (cohort_uuid: string, token: string) =>
  call('GET', `cohorts/${cohort_uuid}/students`, token)
export const addCohortStudent = (cohort_uuid: string, user_uuid: string, token: string) =>
  call('POST', `cohorts/${cohort_uuid}/students`, token, { user_uuid })
export const updateCohortStudent = (cohort_uuid: string, membership_uuid: string, status: string, token: string) =>
  call('PUT', `cohorts/${cohort_uuid}/students/${membership_uuid}`, token, { status })
export const removeCohortStudent = (cohort_uuid: string, membership_uuid: string, token: string) =>
  call('DELETE', `cohorts/${cohort_uuid}/students/${membership_uuid}`, token)
export const getOrgStudents = (
  org_id: number,
  token: string,
  filters: { program_uuid?: string; status?: string; q?: string } = {}
) => call('GET', `academic-students${qs({ org_id, ...filters })}`, token)
export const getMyAcademicRecord = (org_id: number, token: string) =>
  call('GET', `academic-records/me${qs({ org_id })}`, token)

// ----------------------------- Helpers -----------------------------

/** Strip / restore the uuid prefix used in dashboard URLs. */
export const stripPrefix = (uuid: string, prefix: string) => uuid?.replace(`${prefix}_`, '') || ''
export const withPrefix = (id: string, prefix: string) =>
  id?.startsWith(`${prefix}_`) ? id : `${prefix}_${id}`

export const PROGRAM_DEGREE_PREFIX: Record<string, string> = {
  diploma: 'DIP',
  masters: 'MSC',
  phd: 'PHD',
}

/** Suggested program code in the recommended "[DEGREE]-[FIELD]" form. */
export function suggestProgramCode(level: string, field: string): string {
  const prefix = PROGRAM_DEGREE_PREFIX[level] || 'PG'
  const cleaned = (field || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned ? `${prefix}-${cleaned}` : prefix
}

export function displayName(u: any): string {
  const full = `${u?.first_name || ''} ${u?.last_name || ''}`.trim()
  return full || u?.username || u?.email || '—'
}

/** LMS content courses of the org (used as catalog templates / offering content). */
export const getOrgLmsCourses = (orgslug: string, token: string) =>
  call('GET', `courses/org_slug/${orgslug}/page/1/limit/500?include_unpublished=true`, token)

// ----------------------------- Grading (Phase 2) -----------------------------

export const getGradeScales = (org_id: number, token: string) =>
  call('GET', `grade-scales${qs({ org_id })}`, token)
export const createGradeScale = (org_id: number, data: any, token: string) =>
  call('POST', `grade-scales${qs({ org_id })}`, token, data)
export const updateGradeScale = (uuid: string, data: any, token: string) =>
  call('PUT', `grade-scales/${uuid}`, token, data)
export const deleteGradeScale = (uuid: string, token: string) => call('DELETE', `grade-scales/${uuid}`, token)

export const createComponent = (offering_uuid: string, data: any, token: string) =>
  call('POST', `offerings/${offering_uuid}/components`, token, data)
export const updateComponent = (offering_uuid: string, component_uuid: string, data: any, token: string) =>
  call('PUT', `offerings/${offering_uuid}/components/${component_uuid}`, token, data)
export const deleteComponent = (offering_uuid: string, component_uuid: string, token: string) =>
  call('DELETE', `offerings/${offering_uuid}/components/${component_uuid}`, token)

export const getGradebook = (offering_uuid: string, token: string) =>
  call('GET', `offerings/${offering_uuid}/gradebook`, token)
export const syncGradebook = (offering_uuid: string, token: string) =>
  call('POST', `offerings/${offering_uuid}/gradebook/sync`, token)
export const setScores = (
  offering_uuid: string,
  updates: { enrollment_uuid: string; component_uuid: string; score: number | null; note?: string }[],
  token: string
) => call('PUT', `offerings/${offering_uuid}/gradebook/scores`, token, updates)
export const gradeAction = (
  offering_uuid: string,
  action: 'submit' | 'approve' | 'return',
  note: string | null,
  token: string
) => call('POST', `offerings/${offering_uuid}/grades/${action}`, token, { note })

export const getStudentTranscript = (membership_uuid: string, token: string) =>
  call('GET', `academic-students/${membership_uuid}/transcript`, token)

/** Assignments (incl. quizzes/exams) of an LMS course, used as gradebook sources. */
export const getCourseAssignments = (course_uuid: string, token: string) =>
  call('GET', `assignments/course/${course_uuid}`, token)

// ----------------------------- Admissions (Phase 3) -----------------------------

export const getAdmissionRequirements = (program_uuid: string, token: string) =>
  call('GET', `programs/${program_uuid}/admission-requirements`, token)
export const createAdmissionRequirement = (program_uuid: string, data: any, token: string) =>
  call('POST', `programs/${program_uuid}/admission-requirements`, token, data)
export const updateAdmissionRequirement = (uuid: string, data: any, token: string) =>
  call('PUT', `admission-requirements/${uuid}`, token, data)
export const deleteAdmissionRequirement = (uuid: string, token: string) =>
  call('DELETE', `admission-requirements/${uuid}`, token)

export const getEntranceTests = (program_uuid: string, token: string) =>
  call('GET', `programs/${program_uuid}/entrance-tests`, token)
export const createEntranceTest = (program_uuid: string, data: any, token: string) =>
  call('POST', `programs/${program_uuid}/entrance-tests`, token, data)
export const updateEntranceTest = (uuid: string, data: any, token: string) =>
  call('PUT', `entrance-tests/${uuid}`, token, data)
export const deleteEntranceTest = (uuid: string, token: string) => call('DELETE', `entrance-tests/${uuid}`, token)

export const getApplications = (
  org_id: number,
  token: string,
  filters: { program_uuid?: string; cohort_uuid?: string; status?: string; q?: string } = {}
) => call('GET', `admissions/applications${qs({ org_id, ...filters })}`, token)
export const getApplication = (uuid: string, token: string) => call('GET', `admissions/applications/${uuid}`, token)
export const createApplication = (data: any, token: string) => call('POST', 'admissions/applications', token, data)
export const updateApplication = (uuid: string, profile: any, token: string) =>
  call('PUT', `admissions/applications/${uuid}`, token, { profile })
export const applicationAction = (
  uuid: string,
  action: 'submit' | 'review' | 'enroll' | 'withdraw',
  token: string,
  body: any = null
) => call('POST', `admissions/applications/${uuid}/${action}`, token, body ?? (action === 'withdraw' ? {} : null))
export const decideApplication = (
  uuid: string,
  data: { decision: string; note?: string | null; override_requirements?: boolean },
  token: string
) => call('POST', `admissions/applications/${uuid}/decision`, token, data)
export const overrideCheck = (uuid: string, requirement_uuid: string, data: any, token: string) =>
  call('PUT', `admissions/applications/${uuid}/checks/${requirement_uuid}`, token, data)
export const reviewDocument = (uuid: string, document_uuid: string, data: any, token: string) =>
  call('PUT', `admissions/applications/${uuid}/documents/${document_uuid}`, token, data)
export const scheduleEntranceTest = (uuid: string, data: any, token: string) =>
  call('POST', `admissions/applications/${uuid}/tests`, token, data)
export const recordEntranceTest = (uuid: string, attempt_uuid: string, data: any, token: string) =>
  call('PUT', `admissions/applications/${uuid}/tests/${attempt_uuid}`, token, data)
export const scheduleInterview = (uuid: string, data: any, token: string) =>
  call('POST', `admissions/applications/${uuid}/interviews`, token, data)
export const updateInterview = (uuid: string, interview_uuid: string, data: any, token: string) =>
  call('PUT', `admissions/applications/${uuid}/interviews/${interview_uuid}`, token, data)

export async function uploadApplicationDocument(uuid: string, document_type: string, file: File, token: string) {
  const form = new FormData()
  form.append('document_type', document_type)
  form.append('file', file)
  const result = await fetch(
    `${getAPIUrl()}admissions/applications/${uuid}/documents`,
    RequestBodyFormWithAuthHeader('POST', form, null, token)
  )
  return errorHandling(result)
}

/** Documents are private: fetch with the session token and open as a blob. */
export async function openApplicationDocument(uuid: string, document_uuid: string, token: string) {
  const result = await fetch(`${getAPIUrl()}admissions/applications/${uuid}/documents/${document_uuid}/file`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!result.ok) throw new Error('Could not open the document')
  const url = URL.createObjectURL(await result.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const DOCUMENT_TYPES = [
  'degree_certificate',
  'transcript',
  'national_id',
  'passport',
  'language_certificate',
  'cv',
  'recommendation_letter',
  'statement_of_purpose',
  'experience_letter',
  'photo',
  'other',
]
