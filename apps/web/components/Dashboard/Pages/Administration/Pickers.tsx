'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getFacilityOptions } from '@services/administration/administration'
import { getInstructorOptions } from '@services/instructors/instructors'

/*
  Pickers that let any course editor select reusable entities created in
  Administration & Configuration. They only receive names/capacities — never
  costs or rates.
*/

export function useFacilityOptions() {
  const { orgId, access_token, ready } = useAdminContext()
  const { data = [] } = useQuery({
    queryKey: ['administration', 'facility-options', orgId],
    queryFn: () => getFacilityOptions(orgId, access_token),
    enabled: ready,
  })
  return data as { facility_uuid: string; name: string; capacity?: number; location_name?: string; facility_type_name?: string }[]
}

export function FacilitySelect({
  value,
  onChange,
  className,
  current,
  emptyLabel,
}: {
  value: string
  onChange: (_uuid: string) => void
  className?: string
  /** The currently attached facility (kept selectable even if now inactive). */
  current?: { facility_uuid: string; name: string } | null
  emptyLabel?: string
}) {
  const { t } = useTranslation()
  const options = useFacilityOptions()
  const all = current && !options.some((o) => o.facility_uuid === current.facility_uuid) ? [current as any, ...options] : options
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel ?? t('administration.facilities.no_facility', 'No room selected')}</option>
      {all.map((o: any) => (
        <option key={o.facility_uuid} value={o.facility_uuid}>
          {o.name}
          {o.capacity != null ? ` (${o.capacity})` : ''}
          {o.location_name ? ` — ${o.location_name}` : ''}
        </option>
      ))}
    </select>
  )
}

export function useInstructorOptions() {
  const { orgId, access_token, ready } = useAdminContext()
  const { data = [] } = useQuery({
    queryKey: ['instructors', 'options', orgId],
    queryFn: () => getInstructorOptions(orgId, access_token),
    enabled: ready,
  })
  return data as { instructor_uuid: string; user_uuid: string; name: string; category_name?: string; specializations: string[] }[]
}

/** Select an active instructor; the value is the instructor's *user* uuid. */
export function InstructorSelect({
  value,
  onChange,
  className,
  current,
  emptyLabel,
}: {
  value: string
  onChange: (_userUuid: string) => void
  className?: string
  current?: { user_uuid: string; name: string } | null
  /** Label of the empty choice (default "No instructor"). */
  emptyLabel?: string
}) {
  const { t } = useTranslation()
  const options = useInstructorOptions()
  const extra = current && current.user_uuid && !options.some((o) => o.user_uuid === current.user_uuid) ? [current] : []
  return (
    <select className={cn(className)} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel ?? t('administration.pickers.no_instructor', 'No instructor')}</option>
      {extra.map((c) => (
        <option key={c.user_uuid} value={c.user_uuid}>
          {c.name}
        </option>
      ))}
      {options.map((o) => (
        <option key={o.user_uuid} value={o.user_uuid}>
          {o.name}
          {o.category_name ? ` — ${o.category_name}` : ''}
          {o.specializations?.length ? ` (${o.specializations.slice(0, 2).join(', ')})` : ''}
        </option>
      ))}
    </select>
  )
}

/**
 * Run a save that may hit a facility double-booking (HTTP 409). The user is
 * asked whether to book anyway; if so the save is retried with allow_conflict.
 */
export async function saveWithConflictCheck<T>(
  save: (_allowConflict: boolean) => Promise<T>,
  confirmText: string,
  /** In-app confirmation (e.g. useActionDialog); falls back to the browser dialog. */
  confirmConflict?: (_message: string) => Promise<boolean>
): Promise<T | null> {
  try {
    return await save(false)
  } catch (err: any) {
    if (err?.status === 409 && String(err?.message || '').startsWith('Facility conflict')) {
      const go = confirmConflict
        ? await confirmConflict(String(err.message))
        : typeof window !== 'undefined' && window.confirm(`${err.message}\n\n${confirmText}`)
      return go ? await save(true) : null
    }
    throw err
  }
}
