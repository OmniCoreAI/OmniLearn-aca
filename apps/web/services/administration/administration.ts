import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
  Administration & Configuration: reusable, org-level configuration entities
  (lookups, settings, facilities, add-ons, entities, templates…). Every entity
  is created once here and selected everywhere else — never re-typed.
*/

export async function call(method: string, path: string, access_token: string, body: any = null) {
  const result = await fetch(`${getAPIUrl()}${path}`, RequestBodyWithAuthHeader(method, body, null, access_token))
  return errorHandling(result)
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

// ----------------------------- Overview -----------------------------

export const getAdminOverview = (org_id: number, token: string) =>
  call('GET', `administration/overview/${org_id}`, token)

// ----------------------------- Lookups -----------------------------

export type LookupKind =
  | 'facility_type'
  | 'equipment'
  | 'addon_category'
  | 'entity_type'
  | 'location_type'
  | 'course_category'

export const LOOKUP_KINDS: LookupKind[] = [
  'course_category',
  'facility_type',
  'equipment',
  'location_type',
  'addon_category',
  'entity_type',
]

export const getLookups = (org_id: number, token: string, kind?: LookupKind) =>
  call('GET', `lookups/org/${org_id}${qs({ kind })}`, token)
export const getLookupOptions = (org_id: number, kind: LookupKind, token: string) =>
  call('GET', `lookups/org/${org_id}/options${qs({ kind })}`, token)
export const createLookup = (org_id: number, data: any, token: string) =>
  call('POST', `lookups/${qs({ org_id })}`, token, data)
export const updateLookup = (uuid: string, data: any, token: string) => call('PUT', `lookups/${uuid}`, token, data)
export const deleteLookup = (uuid: string, token: string) => call('DELETE', `lookups/${uuid}`, token)
export const reorderLookups = (org_id: number, items: { lookup_uuid: string; sort_order: number }[], token: string) =>
  call('PUT', `lookups/org/${org_id}/reorder`, token, items)

// ----------------------------- Settings -----------------------------

export const getAdminSetting = (org_id: number, key: string, token: string) =>
  call('GET', `admin-settings/org/${org_id}/${key}`, token)
export const putAdminSetting = (org_id: number, key: string, value: any, token: string) =>
  call('PUT', `admin-settings/org/${org_id}/${key}`, token, value)

export interface FinanceDefaults {
  default_currency: string
  currencies: string[]
  tax_rates: { name: string; rate: number; is_default: boolean }[]
}
