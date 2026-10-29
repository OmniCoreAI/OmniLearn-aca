'use client'
import { useMemo } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'

/**
 * Which dashboard home the viewer gets in the current org.
 *
 * - `academy`: superadmins, Academy Admins and custom roles (the academy-wide dashboard)
 * - `instructor`: the Instructor system role (their own teaching work)
 * - `coordinator`: the Entity Coordinator system role (their entity)
 *
 * When someone holds several roles the most powerful one wins.
 */
export type WorkspaceRole = 'academy' | 'instructor' | 'coordinator'

export default function useWorkspaceRole(): WorkspaceRole | null {
  const org = useOrg() as any
  const session = useLHSession() as any
  const isSuperadmin = session?.data?.user?.is_superadmin === true
  const roles: any[] | undefined = session?.data?.roles

  return useMemo(() => {
    if (!org?.id || session?.status !== 'authenticated') return null
    if (isSuperadmin) return 'academy'
    const held = new Set(
      (roles || []).filter((r) => r?.org?.id === org.id).map((r) => r?.role?.role_uuid as string)
    )
    if (held.has('role_global_admin')) return 'academy'
    if (held.has('role_global_instructor')) return 'instructor'
    if (held.has('role_global_maintainer')) return 'coordinator'
    return 'academy'
  }, [org?.id, session?.status, isSuperadmin, roles])
}
