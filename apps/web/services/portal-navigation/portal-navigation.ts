import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests'

/*
  Portal navigation service matching available endpoints:
  - GET portal-navigation
  - PUT portal-navigation/{role_uuid}
*/

export type PortalNavigationResponse = {
  items: { id: string; section: string }[]
  visibility: Record<string, string[]>
}

export async function getPortalNavigation(access_token?: string) {
  const result = await fetch(
    `${getAPIUrl()}portal-navigation`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function updatePortalNavigation(
  role_uuid: string,
  item_ids: string[],
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}portal-navigation/${role_uuid}`,
    RequestBodyWithAuthHeader('PUT', { item_ids }, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}
