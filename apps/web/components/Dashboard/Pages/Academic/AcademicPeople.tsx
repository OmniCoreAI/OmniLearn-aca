'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, X, UserPlus, Users } from 'lucide-react'
import {
  getOrgUsers,
  getCohortMembers,
  enrollUserInCohort,
  unenrollUserFromCohort,
} from '@services/academic/academic'

const inputCls =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]'

function displayName(u: any): string {
  const full = `${u?.first_name || ''} ${u?.last_name || ''}`.trim()
  return full || u?.username || u?.email || '—'
}

/**
 * Search + select a single organization member as a coordinator.
 * Reuses the existing org-users endpoint; emits the selected user_uuid.
 */
export function CoordinatorPicker({
  orgId,
  access_token,
  value,
  selectedLabel,
  onChange,
}: {
  orgId: number
  access_token: string
  value: string | null
  selectedLabel?: string
  onChange: (uuid: string | null, label?: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['academic', 'org-users', orgId, search],
    queryFn: () => getOrgUsers(orgId, access_token, search),
    enabled: !!orgId && !!access_token && open,
    staleTime: 15_000,
  })
  const items = (data?.items || []) as any[]

  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
        <span className="text-sm text-gray-800">{selectedLabel || value}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-gray-400 hover:text-red-600"
          aria-label={t('academic.clear_coordinator')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          className="flex-1 text-sm focus:outline-none"
          placeholder={t('academic.search_users')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto bg-white rounded-lg nice-shadow border border-gray-100 py-1">
          {items.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">{t('academic.no_users_found')}</div>
          )}
          {items.map((it) => (
            <button
              key={it.user.user_uuid}
              type="button"
              onClick={() => {
                onChange(it.user.user_uuid, displayName(it.user))
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {displayName(it.user)}
              <span className="text-gray-400 text-xs"> · @{it.user.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Manage cohort enrollment: capacity meter, current members with unenroll,
 * and a searchable list of org members to enroll.
 */
export function EnrollmentPanel({
  cohortUuid,
  orgId,
  access_token,
  capacity,
}: {
  cohortUuid: string
  orgId: number
  access_token: string
  capacity?: number | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: members = [] } = useQuery({
    queryKey: ['academic', 'cohort-members', cohortUuid],
    queryFn: () => getCohortMembers(cohortUuid, access_token),
    enabled: !!access_token,
  })
  const { data: orgUsers } = useQuery({
    queryKey: ['academic', 'org-users', orgId, search],
    queryFn: () => getOrgUsers(orgId, access_token, search),
    enabled: !!orgId && !!access_token,
    staleTime: 15_000,
  })

  const memberIds = new Set((members as any[]).map((m) => m.id))
  const candidates = ((orgUsers?.items || []) as any[]).filter((it) => !memberIds.has(it.user.id))
  const atCapacity = capacity != null && (members as any[]).length >= capacity

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohort-members', cohortUuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohorts'] })
  }

  const enroll = async (userId: number) => {
    setBusy(true)
    try {
      await enrollUserInCohort(cohortUuid, userId, access_token)
      toast.success(t('academic.enrolled'))
      refresh()
    } catch {
      toast.error(t('academic.enroll_failed'))
    } finally {
      setBusy(false)
    }
  }

  const unenroll = async (userId: number) => {
    setBusy(true)
    try {
      await unenrollUserFromCohort(cohortUuid, userId, access_token)
      toast.success(t('academic.unenrolled'))
      refresh()
    } catch {
      toast.error(t('academic.unenroll_failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Users className="w-4 h-4" />
        <span>
          {(members as any[]).length}
          {capacity != null ? ` / ${capacity}` : ''} {t('academic.enrolled_members')}
        </span>
        {atCapacity && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {t('academic.full')}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {(members as any[]).map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg"
          >
            <span className="text-sm text-gray-800">
              {displayName(m)} <span className="text-gray-400 text-xs">· @{m.username}</span>
            </span>
            <button
              onClick={() => unenroll(m.id)}
              disabled={busy}
              className="text-gray-400 hover:text-red-600 disabled:opacity-40"
              aria-label={t('academic.unenroll')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg mb-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            className="flex-1 text-sm focus:outline-none"
            placeholder={t('academic.search_users')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-48 overflow-auto space-y-1">
          {candidates.map((it) => (
            <div
              key={it.user.user_uuid}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-700">
                {displayName(it.user)} <span className="text-gray-400 text-xs">· @{it.user.username}</span>
              </span>
              <button
                onClick={() => enroll(it.user.id)}
                disabled={busy || atCapacity}
                className="flex items-center gap-1 text-xs font-bold text-black disabled:opacity-40"
              >
                <UserPlus className="w-3.5 h-3.5" /> {t('academic.enroll')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
