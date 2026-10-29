import { RequestBodyWithAuthHeader } from "@services/utils/ts/requests"
import { getAPIUrl } from "@services/config/config"
import { getResponseMetadata } from "@services/utils/ts/requests"

/** The API needs at least this many characters (shorter queries return 422). */
export const SEARCH_MIN_LENGTH = 3

export async function searchOrgContent(
  org_slug: string,
  query: string,
  page: number = 1,
  limit: number = 10,
  next: any,
  access_token?: any,
) {
  if (query.trim().length < SEARCH_MIN_LENGTH) {
    return { success: true, status: 200, HTTPmessage: 'OK', data: { courses: [], folders: [], users: [], playgrounds: [], total_courses: 0, total_folders: 0, total_users: 0, total_playgrounds: 0 } }
  }
  const url = `${getAPIUrl()}search/org_slug/${org_slug}?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  const result: any = await fetch(
    url,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  )
  return getResponseMetadata(result)
}
