import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

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

export async function getInstructors(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}instructors/org/${org_id}`,
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
