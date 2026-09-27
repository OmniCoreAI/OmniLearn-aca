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

// ----------------------------- Entities (الجهات) -----------------------------

export interface CoordinatorPermissions {
  can_manage_members: boolean
  can_import_users: boolean
  can_manage_groups: boolean
  can_assign_training: boolean
  can_add_instructors: boolean
}

export const COORDINATOR_CAPABILITIES: (keyof CoordinatorPermissions)[] = [
  'can_manage_members',
  'can_import_users',
  'can_manage_groups',
  'can_assign_training',
  'can_add_instructors',
]

export const getEntities = (org_id: number, token: string, params: { q?: string; status?: string } = {}) =>
  call('GET', `entities/org/${org_id}${qs(params)}`, token)
export const getEntityOptions = (org_id: number, token: string) => call('GET', `entities/org/${org_id}/options`, token)
export const getMyEntities = (org_id: number, token: string) => call('GET', `entities/org/${org_id}/mine`, token)
export const getEntity = (uuid: string, token: string) => call('GET', `entities/${uuid}`, token)
export const createEntity = (org_id: number, data: any, token: string) =>
  call('POST', `entities/${qs({ org_id })}`, token, data)
export const updateEntity = (uuid: string, data: any, token: string) => call('PUT', `entities/${uuid}`, token, data)
export const deleteEntity = (uuid: string, token: string) => call('DELETE', `entities/${uuid}`, token)
export async function uploadEntityLogo(uuid: string, file: File, token: string) {
  const formData = new FormData()
  formData.append('logo', file)
  const result = await fetch(`${getAPIUrl()}entities/${uuid}/logo`, RequestBodyFormWithAuthHeader('PUT', formData, null, token))
  return errorHandling(result)
}

export const getEntityMembers = (
  uuid: string,
  token: string,
  params: { q?: string; status?: string; position_uuid?: string; group_uuid?: string; page?: number; limit?: number } = {}
) => call('GET', `entities/${uuid}/members${qs(params)}`, token)
export const addEntityMember = (uuid: string, data: any, token: string) => call('POST', `entities/${uuid}/members`, token, data)
export const updateEntityMember = (uuid: string, member_uuid: string, data: any, token: string) =>
  call('PUT', `entities/${uuid}/members/${member_uuid}`, token, data)
export const removeEntityMember = (uuid: string, member_uuid: string, token: string) =>
  call('DELETE', `entities/${uuid}/members/${member_uuid}`, token)

export const assignEntityCoordinator = (uuid: string, data: any, token: string) =>
  call('POST', `entities/${uuid}/coordinators`, token, data)
export const removeEntityCoordinator = (uuid: string, member_uuid: string, token: string) =>
  call('DELETE', `entities/${uuid}/coordinators/${member_uuid}`, token)

export const getEntityGroups = (uuid: string, token: string) => call('GET', `entities/${uuid}/groups`, token)
export const createEntityGroup = (uuid: string, data: any, token: string) => call('POST', `entities/${uuid}/groups`, token, data)
export const updateEntityGroup = (uuid: string, group_uuid: string, data: any, token: string) =>
  call('PUT', `entities/${uuid}/groups/${group_uuid}`, token, data)
export const setEntityGroupMembers = (uuid: string, group_uuid: string, member_uuids: string[], token: string) =>
  call('PUT', `entities/${uuid}/groups/${group_uuid}/members`, token, { member_uuids })
export const deleteEntityGroup = (uuid: string, group_uuid: string, token: string) =>
  call('DELETE', `entities/${uuid}/groups/${group_uuid}`, token)
export const getEntityLearning = (uuid: string, token: string) => call('GET', `entities/${uuid}/learning`, token)

// ----------------------------- Positions -----------------------------

export const getPositions = (org_id: number, token: string, entity_uuid?: string) =>
  call('GET', `positions/org/${org_id}${qs({ entity_uuid })}`, token)
export const createPosition = (org_id: number, data: any, token: string) =>
  call('POST', `positions/${qs({ org_id })}`, token, data)
export const updatePosition = (uuid: string, data: any, token: string) => call('PUT', `positions/${uuid}`, token, data)
export const deletePosition = (uuid: string, token: string) => call('DELETE', `positions/${uuid}`, token)

// ----------------------------- Audience assignment -----------------------------

export type AudienceResourceType = 'course' | 'training_program'
export type AudienceType = 'user' | 'usergroup' | 'entity' | 'position' | 'cohort'

export const getResourceAudience = (resource_type: AudienceResourceType, resource_uuid: string, token: string) =>
  call('GET', `audience/resource/${resource_type}/${resource_uuid}`, token)
export const resyncResourceAudience = (resource_type: AudienceResourceType, resource_uuid: string, token: string) =>
  call('POST', `audience/resource/${resource_type}/${resource_uuid}/sync`, token)
export const createAudienceAssignment = (data: any, token: string) => call('POST', 'audience/', token, data)
export const deleteAudienceAssignment = (uuid: string, token: string) => call('DELETE', `audience/${uuid}`, token)
export const getAudienceOptions = (org_id: number, token: string, params: { q?: string; entity_uuid?: string } = {}) =>
  call('GET', `audience/org/${org_id}/options${qs(params)}`, token)

// ----------------------------- Communication -----------------------------

export type NotificationChannel = 'email' | 'sms'

export const getNotificationCatalog = (org_id: number, token: string) =>
  call('GET', `notifications/catalog/org/${org_id}`, token)
export const getNotificationTemplates = (org_id: number, token: string, params: { channel?: NotificationChannel; event_key?: string } = {}) =>
  call('GET', `notifications/templates/org/${org_id}${qs(params)}`, token)
export const createNotificationTemplate = (org_id: number, data: any, token: string) =>
  call('POST', `notifications/templates${qs({ org_id })}`, token, data)
export const updateNotificationTemplate = (uuid: string, data: any, token: string) =>
  call('PUT', `notifications/templates/${uuid}`, token, data)
export const duplicateNotificationTemplate = (uuid: string, token: string) =>
  call('POST', `notifications/templates/${uuid}/duplicate`, token)
export const deleteNotificationTemplate = (uuid: string, token: string) => call('DELETE', `notifications/templates/${uuid}`, token)
export const testNotificationTemplate = (uuid: string, to: string | undefined, token: string) =>
  call('POST', `notifications/templates/${uuid}/test`, token, { to: to || undefined })
export const previewNotification = (org_id: number, data: any, token: string) =>
  call('POST', `notifications/preview/org/${org_id}`, token, data)
export const getNotificationLog = (
  org_id: number,
  token: string,
  params: { channel?: string; status?: string; event_key?: string; q?: string; page?: number; limit?: number } = {}
) => call('GET', `notifications/log/org/${org_id}${qs(params)}`, token)
export const getNotificationOverrides = (resource_type: AudienceResourceType, resource_uuid: string, token: string) =>
  call('GET', `notifications/overrides/${resource_type}/${resource_uuid}`, token)
export const setNotificationOverride = (data: any, token: string) => call('PUT', 'notifications/overrides', token, data)
export const deleteNotificationOverride = (uuid: string, token: string) => call('DELETE', `notifications/overrides/${uuid}`, token)

export interface NotificationSettings {
  events: Record<string, { email: boolean; sms: boolean }>
  reminders_enabled: boolean
  session_reminder_hours: number[]
  exam_reminder_hours: number[]
  default_language: 'en' | 'ar' | null
  sender_name: string | null
}

// ----------------------------- Imports & coordinator follow-up -----------------------------

/** Fetch an authenticated file (xlsx…) and hand it to the browser as a download. */
export async function downloadAuthed(path: string, token: string, filename: string) {
  const result = await fetch(`${getAPIUrl()}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  })
  if (!result.ok) {
    let message = 'Download failed'
    try {
      message = (await result.json())?.detail || message
    } catch {
      /* not JSON */
    }
    throw new Error(message)
  }
  const blob = await result.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadImportTemplate = (entity_uuid: string, token: string) =>
  downloadAuthed(`imports/users/template${qs({ entity_uuid })}`, token, 'members-import-template.xlsx')
export async function validateImportFile(entity_uuid: string, file: File, token: string) {
  const form = new FormData()
  form.append('file', file)
  const result = await fetch(
    `${getAPIUrl()}imports/users/validate${qs({ entity_uuid })}`,
    RequestBodyFormWithAuthHeader('POST', form, null, token)
  )
  return errorHandling(result)
}
export const getImportJobs = (entity_uuid: string, token: string) => call('GET', `imports/entity/${entity_uuid}`, token)
export const getImportJob = (job_uuid: string, token: string) => call('GET', `imports/${job_uuid}`, token)
export const getImportRows = (job_uuid: string, token: string, params: { status?: string; page?: number; limit?: number } = {}) =>
  call('GET', `imports/${job_uuid}/rows${qs(params)}`, token)
export const commitImport = (job_uuid: string, options: any, token: string) =>
  call('POST', `imports/${job_uuid}/commit`, token, options)
export const downloadFailedRows = (job_uuid: string, token: string) =>
  downloadAuthed(`imports/${job_uuid}/failed.xlsx`, token, 'failed-rows.xlsx')

export const getEntityProgress = (uuid: string, token: string, group_uuid?: string) =>
  call('GET', `entities/${uuid}/progress${qs({ group_uuid })}`, token)
export const getEntityInstructors = (uuid: string, token: string) => call('GET', `entities/${uuid}/instructors`, token)
export const inviteEntityInstructor = (uuid: string, data: any, token: string) =>
  call('POST', `entities/${uuid}/instructors/invite`, token, data)
