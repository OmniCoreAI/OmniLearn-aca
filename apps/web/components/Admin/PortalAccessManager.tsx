'use client'
import React, { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { Switch } from '@components/ui/switch'
import {
  getPortalNavigation,
  updatePortalNavigation,
  PortalNavigationResponse,
} from '@services/portal-navigation/portal-navigation'
import { DASH_NAV_ITEMS, SECTION_LABELS, DashNavSection } from '@/lib/dash-nav-items'

const SYSTEM_ROLES: { uuid: string; label: string }[] = [
  { uuid: 'role_global_admin', label: 'Academy Admin' },
  { uuid: 'role_global_maintainer', label: 'Organization Coordinator' },
  { uuid: 'role_global_instructor', label: 'Instructor' },
  { uuid: 'role_global_user', label: 'Trainee' },
]

const SECTION_ORDER: DashNavSection[] = ['overview', 'academic', 'teaching', 'manage']

export default function PortalAccessManager() {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const { data: rawResponse, isLoading } = useSWR(
    access_token ? ['admin-portal-navigation'] : null,
    () => getPortalNavigation(access_token)
  )
  const remote: PortalNavigationResponse | undefined = rawResponse?.data ?? rawResponse

  // Local editable copy — role_uuid -> Set of visible item ids.
  const [visibility, setVisibility] = useState<Record<string, Set<string>>>({})
  const [savingRole, setSavingRole] = useState<string | null>(null)

  useEffect(() => {
    if (!remote?.visibility) return
    const next: Record<string, Set<string>> = {}
    SYSTEM_ROLES.forEach((role) => {
      next[role.uuid] = new Set(remote.visibility[role.uuid] || [])
    })
    setVisibility(next)
  }, [remote])

  const itemsBySection = useMemo(() => {
    const grouped: Record<string, typeof DASH_NAV_ITEMS> = {}
    DASH_NAV_ITEMS.forEach((item) => {
      grouped[item.section] = grouped[item.section] || []
      grouped[item.section].push(item)
    })
    return grouped
  }, [])

  if (isLoading || !remote) {
    return <PageLoading />
  }

  const toggleItem = async (roleUuid: string, itemId: string, checked: boolean) => {
    const current = new Set(visibility[roleUuid] || [])
    if (checked) current.add(itemId)
    else current.delete(itemId)

    // Optimistic update
    setVisibility((prev) => ({ ...prev, [roleUuid]: current }))
    setSavingRole(roleUuid)

    try {
      await updatePortalNavigation(roleUuid, Array.from(current), access_token)
    } catch (err) {
      // Revert on failure
      setVisibility((prev) => ({
        ...prev,
        [roleUuid]: new Set(remote.visibility[roleUuid] || []),
      }))
      toast.error(`Failed to update visibility for ${roleUuid}`)
    } finally {
      setSavingRole(null)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="text-left py-3 pr-4 text-white/50 font-medium">Sidebar section</th>
            {SYSTEM_ROLES.map((role) => (
              <th key={role.uuid} className="text-center py-3 px-4 text-white/70 font-medium whitespace-nowrap">
                {role.label}
                {savingRole === role.uuid && (
                  <span className="ml-1.5 text-[10px] text-amber-400 align-middle">saving…</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTION_ORDER.map((section) => (
            <React.Fragment key={section}>
              <tr>
                <td
                  colSpan={SYSTEM_ROLES.length + 1}
                  className="pt-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30"
                >
                  {SECTION_LABELS[section].fallback}
                </td>
              </tr>
              {(itemsBySection[section] || []).map((item) => (
                <tr key={item.id} className="border-b border-white/[0.04]">
                  <td className="py-2.5 pr-4 text-white/80">{item.fallbackLabel}</td>
                  {SYSTEM_ROLES.map((role) => {
                    const checked = visibility[role.uuid]?.has(item.id) ?? false
                    return (
                      <td key={role.uuid} className="text-center py-2.5 px-4">
                        <Switch
                          checked={checked}
                          onCheckedChange={(v) => toggleItem(role.uuid, item.id, v)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
