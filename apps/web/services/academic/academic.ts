import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  RequestBodyFormWithAuthHeader,
  errorHandling,
} from '@services/utils/ts/requests'

/*
  Frontend service for the Academic Management layer (Postgraduate Studies +
  Training Programs). These endpoints sit ABOVE the existing Course module and
  never duplicate course logic — course creation still uses the standard course
  workflow; here we only manage the academic hierarchy and course links.
*/

// ----------------------------- Programs -----------------------------

export async function getPrograms(
  org_id: number,
  access_token: string,
  page: number = 1,
  limit: number = 100
) {
  const result = await fetch(
    `${getAPIUrl()}programs/org/${org_id}/page/${page}/limit/${limit}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getProgram(program_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createProgram(org_id: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}programs/?org_id=${org_id}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateProgram(program_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteProgram(program_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function setProgramCoordinator(
  program_uuid: string,
  coordinator_uuid: string | null,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}/coordinator`,
    RequestBodyWithAuthHeader('PUT', { coordinator_uuid: coordinator_uuid ?? '' }, null, access_token)
  )
  return errorHandling(result)
}

export async function uploadProgramImage(
  program_uuid: string,
  kind: 'thumbnail' | 'banner',
  file: File,
  access_token: string
) {
  const formData = new FormData()
  formData.append(`${kind}_file`, file)
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}/${kind}`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token)
  )
  return errorHandling(result)
}

// Reuses the existing org-users listing for coordinator picking + enrollment.
export async function getOrgUsers(
  org_id: number,
  access_token: string,
  search: string = '',
  limit: number = 50
) {
  const params = new URLSearchParams({
    page: '1',
    limit: String(limit),
    search,
  })
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/users?${params.toString()}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

// ----------------------------- Cohorts -----------------------------

export async function getProgramCohorts(program_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}/cohorts`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getCohort(cohort_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createCohort(program_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}programs/${program_uuid}/cohorts`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateCohort(cohort_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteCohort(cohort_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function enrollUserInCohort(cohort_uuid: string, user_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}/enroll`,
    RequestBodyWithAuthHeader('POST', { user_id }, null, access_token)
  )
  return errorHandling(result)
}

export async function unenrollUserFromCohort(
  cohort_uuid: string,
  user_id: number,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}/enroll/${user_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getCohortMembers(cohort_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}/members`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

// ----------------------------- Semesters -----------------------------

export async function getCohortSemesters(cohort_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}/semesters`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getSemester(semester_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createSemester(cohort_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}cohorts/${cohort_uuid}/semesters`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateSemester(semester_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteSemester(semester_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

// ----------------------- Semester <-> Courses -----------------------
// Courses are linked directly to a Semester; the academic metadata (code,
// credit hours, order) lives on the link, so the core Course stays untouched.

export async function getSemesterCourses(semester_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}/courses`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function linkCourseToSemester(
  semester_uuid: string,
  course_uuid: string,
  access_token: string,
  order: number = 0,
  code: string | null = null,
  credit_hours: number | null = null
) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}/courses`,
    RequestBodyWithAuthHeader('POST', { course_uuid, order, code, credit_hours }, null, access_token)
  )
  return errorHandling(result)
}

export async function updateSemesterCourse(
  semester_uuid: string,
  course_uuid: string,
  data: { order?: number; code?: string | null; credit_hours?: number | null },
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}/courses/${course_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function unlinkCourseFromSemester(
  semester_uuid: string,
  course_uuid: string,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}semesters/${semester_uuid}/courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

// --------------------- Course Academic Profile ---------------------
// The academic/offering attributes attached to the Course itself (1:1), so they
// show up wherever the course is used — postgraduate semesters AND training
// programs. Access reuses the course's own permissions.

export async function getCourseAcademicProfile(course_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/academic-profile`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function upsertCourseAcademicProfile(
  course_uuid: string,
  data: any,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/academic-profile`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function getCourseSessions(course_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/academic-profile/sessions`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createCourseSession(course_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/academic-profile/sessions`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateCourseSession(
  course_uuid: string,
  session_uuid: string,
  data: any,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/academic-profile/sessions/${session_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteCourseSession(
  course_uuid: string,
  session_uuid: string,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/academic-profile/sessions/${session_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

// -------------------------- Training Programs --------------------------

export async function getTrainingPrograms(
  org_id: number,
  access_token: string,
  page: number = 1,
  limit: number = 100
) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/org/${org_id}/page/${page}/limit/${limit}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getTrainingProgram(tp_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createTrainingProgram(org_id: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/?org_id=${org_id}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateTrainingProgram(tp_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteTrainingProgram(tp_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function setTrainingProgramCoordinator(
  tp_uuid: string,
  coordinator_uuid: string | null,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}/coordinator`,
    RequestBodyWithAuthHeader('PUT', { coordinator_uuid: coordinator_uuid ?? '' }, null, access_token)
  )
  return errorHandling(result)
}

export async function getTrainingProgramCourses(tp_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}/courses`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function linkCourseToTrainingProgram(
  tp_uuid: string,
  course_uuid: string,
  access_token: string,
  order: number = 0
) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}/courses`,
    RequestBodyWithAuthHeader('POST', { course_uuid, order }, null, access_token)
  )
  return errorHandling(result)
}

export async function unlinkCourseFromTrainingProgram(
  tp_uuid: string,
  course_uuid: string,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}training-programs/${tp_uuid}/courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}
