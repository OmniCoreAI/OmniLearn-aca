import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests'

export async function createInviteCode(org_id: any, access_token: any, usergroup_id?: number) {
  const url = usergroup_id
    ? `${getAPIUrl()}orgs/${org_id}/invites?usergroup_id=${usergroup_id}`
    : `${getAPIUrl()}orgs/${org_id}/invites`
  const result = await fetch(
    url,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function deleteInviteCode(
  org_id: any,
  org_invite_code_uuid: string,
  access_token: any
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/${org_invite_code_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function changeSignupMechanism(
  org_id: any,
  signup_mechanism: string,
  access_token: any
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/signup_mechanism?signup_mechanism=${signup_mechanism}`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function validateInviteCode(
  org_id: any,
  invite_code: string,
  access_token: any
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/code/${invite_code}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function inviteBatchUsers(
  org_id: any,
  emails: string,
  invite_code_uuid: string | undefined,
  access_token: any
) {
  const params = new URLSearchParams({ emails })
  if (invite_code_uuid) {
    params.append('invite_code_uuid', invite_code_uuid)
  }
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/users/batch?${params.toString()}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function removeInvitedUser(
  org_id: any,
  email: string,
  access_token: any
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/users/${encodeURIComponent(email)}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

/*
  Admin-create a user directly (no email invite). The backend generates a
  one-time temporary password and returns it once; the user is forced to change
  it on first login.
*/
export type AdminCreateUserBody = {
  username: string
  email: string
  first_name?: string
  last_name?: string
  role_uuid?: string | null
  phone?: string | null
  national_id?: string | null
  gender?: 'male' | 'female' | 'other' | '' | null
  birth_date?: string | null
}

export async function adminCreateUser(
  org_id: any,
  body: AdminCreateUserBody,
  access_token: any
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/users`,
    RequestBodyWithAuthHeader('POST', body, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}
