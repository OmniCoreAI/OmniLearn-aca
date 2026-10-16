'use client'

import React, { useEffect, useState } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import { signOut } from '@components/Contexts/AuthContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility'
import useStaffRoleLabel from '@components/Hooks/useStaffRoleLabel'
import { FeedbackModal } from '@components/Objects/Modals/FeedbackModal'
import { getUriWithOrg } from '@services/config/config'
import StudentSidebar from './StudentSidebar'
import StudentTopBar from './StudentTopBar'
import StudentBottomNav from './StudentBottomNav'

const COLLAPSE_KEY = 'student-sidebar-collapsed'

/**
 * Layout of the student portal: dark sidebar on the reading-start side, a
 * compact top bar, and on phones a bottom navigation instead of the sidebar.
 * Desktop shows the full sidebar, tablets an icon rail.
 */
export default function StudentPortalShell({ orgslug, children }: { orgslug: string; children: React.ReactNode }) {
  const session = useLHSession() as any
  const { hasAnyPortalAccess } = usePortalNavVisibility()
  const staffRoleLabel = useStaffRoleLabel()
  const isPhone = useMediaQuery('(max-width: 767px)')
  const isWide = useMediaQuery('(min-width: 1440px)')
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinnedCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true')
    } catch {
      // Storage unavailable (private mode): keep the default.
    }
  }, [])

  const toggle = () => {
    const next = !pinnedCollapsed
    setPinnedCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, String(next))
    } catch {
      // Not persisted; the choice still applies for this visit.
    }
  }

  const collapsed = !isWide || pinnedCollapsed
  // Same staff rule as the dashboard guard: whoever has a dashboard gets the link back to it.
  const showStaffLink = hasAnyPortalAccess
  const logOut = () => signOut({ redirect: true, callbackUrl: getUriWithOrg(orgslug, '/login') })

  return (
    <div className="flex min-h-dvh bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]">
      {!isPhone && (
        <StudentSidebar
          orgslug={orgslug}
          collapsed={collapsed}
          onToggle={isWide ? toggle : undefined}
          onHelp={() => setHelpOpen(true)}
          onSignOut={logOut}
          showStaffLink={showStaffLink}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentTopBar
          orgslug={orgslug}
          compact={isPhone}
          roleLabel={showStaffLink ? staffRoleLabel : undefined}
          onHelp={() => setHelpOpen(true)}
          onSignOut={logOut}
        />
        <main className="relative flex-1 pb-28 md:pb-6" style={{ zIndex: 'var(--z-content)' }}>
          {children}
        </main>
      </div>
      {isPhone && (
        <StudentBottomNav orgslug={orgslug} onHelp={() => setHelpOpen(true)} onSignOut={logOut} showStaffLink={showStaffLink} />
      )}
      <FeedbackModal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        theme="light"
        userName={session?.data?.user?.username}
        userEmail={session?.data?.user?.email}
      />
    </div>
  )
}
