'use client'
import useSWR from 'swr'
import { useMemo } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getPortalNavigation, PortalNavigationResponse } from '@services/portal-navigation/portal-navigation'
import { DASH_NAV_ITEM_IDS } from '@/lib/dash-nav-items'

const SYSTEM_ROLE_UUIDS = new Set([
  'role_global_admin',
  'role_global_maintainer',
  'role_global_instructor',
  'role_global_user',
])

interface UsePortalNavVisibilityReturn {
  loading: boolean
  /** null means "no restriction — fall back to isAdmin all-or-nothing" (custom/unknown role, or data not loaded yet). */
  visibleItemIds: Set<string> | null
  isItemVisible: (_itemId: string) => boolean
}

/**
 * Computes which dashboard sidebar items the current user can see in the
 * current org, based on the super-admin-configured per-system-role
 * visibility map. Falls back to the existing isAdmin all-or-nothing
 * behavior for superadmins and for orgs using custom (non-system) roles.
 */
function usePortalNavVisibility(): UsePortalNavVisibilityReturn {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { isAdmin, userRoles, loading: adminStatusLoading } = useAdminStatus() as any
  const access_token = session?.data?.tokens?.access_token
  const isSuperadmin = session?.data?.user?.is_superadmin === true

  const { data: rawResponse, isLoading } = useSWR(
    access_token ? ['portal-navigation'] : null,
    () => getPortalNavigation(access_token)
  )
  const data: PortalNavigationResponse | undefined = rawResponse?.data ?? rawResponse

  const visibleItemIds = useMemo(() => {
    if (isSuperadmin) return new Set(DASH_NAV_ITEM_IDS)
    if (!data?.visibility || !org?.id) return null

    const roleUuidsHeld: string[] = (userRoles || [])
      .filter((r: any) => r.org?.id === org.id)
      .map((r: any) => r.role?.role_uuid)
      .filter(Boolean)

    const knownRoleUuids = roleUuidsHeld.filter((uuid) => SYSTEM_ROLE_UUIDS.has(uuid))

    // No known system role held (custom role, or no role at all) — fall
    // back to the pre-existing all-or-nothing behavior.
    if (knownRoleUuids.length === 0) return null

    const union = new Set<string>()
    knownRoleUuids.forEach((uuid) => {
      const items = data.visibility[uuid] || []
      items.forEach((id: string) => union.add(id))
    })
    return union
  }, [data, org?.id, userRoles, isSuperadmin])

  const isItemVisible = (itemId: string) => {
    if (visibleItemIds === null) return isAdmin === true
    return visibleItemIds.has(itemId)
  }

  return {
    loading: adminStatusLoading || isLoading,
    visibleItemIds,
    isItemVisible,
  }
}

export default usePortalNavVisibility
