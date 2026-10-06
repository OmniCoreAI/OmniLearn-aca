import { getAPIUrl } from '@services/config/config'
import { getOrgContentUrl } from '@services/media/media'
import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
} from '@services/utils/ts/requests'

/*
  Frontend service for the Instructor Management + Finance module.
  Instructors extend existing platform users; categories carry per-language
  rates; finance computes Hours x Rate. All endpoints are gated to
  superadmins / org admins / holders of the `instructors` right by the API.
*/

// ----------------------------- Categories -----------------------------

export async function getInstructorCategories(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-categories/org/${org_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createInstructorCategory(org_id: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-categories/?org_id=${org_id}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateInstructorCategory(category_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-categories/${category_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteInstructorCategory(category_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-categories/${category_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

// ----------------------------- Instructors -----------------------------

export async function getInstructors(org_id: number, access_token: string, entity_uuid?: string) {
  const query = entity_uuid ? `?entity_uuid=${encodeURIComponent(entity_uuid)}` : ''
  const result = await fetch(
    `${getAPIUrl()}instructors/org/${org_id}${query}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createInstructor(org_id: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/?org_id=${org_id}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateInstructor(instructor_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteInstructor(instructor_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

// ----------------------------- Finance -----------------------------

export async function computeInstructorRate(
  data: { instructor_uuid: string; hours: number; language?: string | null },
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}instructor-finance/compute`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function getInstructorWorkLogs(
  org_id: number,
  access_token: string,
  instructor_uuid?: string
) {
  const qs = instructor_uuid ? `?instructor_uuid=${instructor_uuid}` : ''
  const result = await fetch(
    `${getAPIUrl()}instructor-finance/org/${org_id}/worklogs${qs}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function createInstructorWorkLog(org_id: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-finance/worklogs?org_id=${org_id}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function updateInstructorWorkLog(worklog_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-finance/worklogs/${worklog_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteInstructorWorkLog(worklog_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-finance/worklogs/${worklog_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getInstructorFinanceSummary(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructor-finance/org/${org_id}/summary`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

// ----------------------------- Profiles, approval & courses -----------------------------

export async function getInstructor(instructor_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Active instructors for pickers (names only — no rates). */
export async function getInstructorOptions(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/org/${org_id}/options`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function approveInstructor(instructor_uuid: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}/approve`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export async function uploadInstructorImage(instructor_uuid: string, file: File, access_token: string) {
  const form = new FormData()
  form.append('image', file)
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}/image`,
    RequestBodyFormWithAuthHeader('PUT', form, null, access_token)
  )
  return errorHandling(result)
}

export async function getInstructorCourses(instructor_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}/courses`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function assignInstructorCourse(instructor_uuid: string, course_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}/courses/${course_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  return errorHandling(result)
}

export async function unassignInstructorCourse(instructor_uuid: string, course_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/${instructor_uuid}/courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export function getInstructorImageUrl(orgUUID: string, instructor: any): string | null {
  if (!instructor?.profile_image) return null
  return getOrgContentUrl(orgUUID, `instructors/${instructor.instructor_uuid}/images/${instructor.profile_image}`)
}

/** Courses and training programs the signed-in user is assigned to (any org member). */
export async function getMyAssignments(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/org/${org_id}/me/assignments`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}
