import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/** In-app notifications (the bell). */
export async function getInbox(org_id: number, access_token: string, limit = 30) {
  const result = await fetch(
    `${getAPIUrl()}inbox/org/${org_id}?limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function markNotificationRead(notification_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}inbox/${notification_uuid}/read`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token)
  )
  return errorHandling(result)
}

export async function markAllNotificationsRead(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}inbox/org/${org_id}/read-all`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token)
  )
  return errorHandling(result)
}
