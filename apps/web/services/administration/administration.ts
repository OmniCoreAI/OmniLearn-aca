import { getAPIUrl } from '@services/config/config'
import { RequestBodyFormWithAuthHeader, RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

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

// ----------------------------- Locations & facilities -----------------------------

export const getLocations = (org_id: number, token: string) => call('GET', `locations/org/${org_id}`, token)
export const createLocation = (org_id: number, data: any, token: string) =>
  call('POST', `locations/${qs({ org_id })}`, token, data)
export const updateLocation = (uuid: string, data: any, token: string) => call('PUT', `locations/${uuid}`, token, data)
export const deleteLocation = (uuid: string, token: string) => call('DELETE', `locations/${uuid}`, token)

export const getFacilities = (org_id: number, token: string) => call('GET', `facilities/org/${org_id}`, token)
export const getFacilityOptions = (org_id: number, token: string) =>
  call('GET', `facilities/org/${org_id}/options`, token)
export const getFacility = (uuid: string, token: string) => call('GET', `facilities/${uuid}`, token)
export const getFacilityBookings = (uuid: string, token: string, since?: string, until?: string) =>
  call('GET', `facilities/${uuid}/bookings${qs({ since, until })}`, token)
export const createFacility = (org_id: number, data: any, token: string) =>
  call('POST', `facilities/${qs({ org_id })}`, token, data)
export const updateFacility = (uuid: string, data: any, token: string) => call('PUT', `facilities/${uuid}`, token, data)
export const deleteFacility = (uuid: string, token: string) => call('DELETE', `facilities/${uuid}`, token)

export async function uploadFacilityImage(uuid: string, file: File, token: string) {
  const form = new FormData()
  form.append('image', file)
  const result = await fetch(`${getAPIUrl()}facilities/${uuid}/image`, RequestBodyFormWithAuthHeader('PUT', form, null, token))
  return errorHandling(result)
}

// ----------------------------- Add-ons -----------------------------

export type AddOnTargetType = 'course' | 'training_program' | 'cohort' | 'offering'

export const getAddOns = (org_id: number, token: string) => call('GET', `addons/org/${org_id}`, token)
export const getAddOnOptions = (org_id: number, token: string) => call('GET', `addons/org/${org_id}/options`, token)
export const createAddOn = (org_id: number, data: any, token: string) => call('POST', `addons/${qs({ org_id })}`, token, data)
export const updateAddOn = (uuid: string, data: any, token: string) => call('PUT', `addons/${uuid}`, token, data)
export const deleteAddOn = (uuid: string, token: string) => call('DELETE', `addons/${uuid}`, token)
export const getAddOnSelections = (
  org_id: number,
  token: string,
  params: { target_uuid?: string; addon_uuid?: string; include_cancelled?: boolean } = {}
) => call('GET', `addons/org/${org_id}/selections${qs(params)}`, token)

export async function uploadAddOnImage(uuid: string, file: File, token: string) {
  const form = new FormData()
  form.append('image', file)
  const result = await fetch(`${getAPIUrl()}addons/${uuid}/image`, RequestBodyFormWithAuthHeader('PUT', form, null, token))
  return errorHandling(result)
}

export const getTargetAttachments = (target_type: AddOnTargetType, target_uuid: string, token: string) =>
  call('GET', `addons/targets/${target_type}/${target_uuid}/attachments`, token)
export const createAddOnAttachment = (data: any, token: string) => call('POST', 'addons/attachments', token, data)
export const updateAddOnAttachment = (uuid: string, data: any, token: string) =>
  call('PUT', `addons/attachments/${uuid}`, token, data)
export const deleteAddOnAttachment = (uuid: string, token: string) => call('DELETE', `addons/attachments/${uuid}`, token)

/** Participant view: add-ons offered on a target + my current choice. */
export const getTargetAddOns = (target_type: AddOnTargetType, target_uuid: string, token: string) =>
  call('GET', `addons/targets/${target_type}/${target_uuid}`, token)
export const setMyAddOnSelection = (
  target_type: AddOnTargetType,
  target_uuid: string,
  items: { attachment_uuid: string; quantity: number }[],
  token: string
) => call('PUT', `addons/targets/${target_type}/${target_uuid}/my-selection`, token, { items })
