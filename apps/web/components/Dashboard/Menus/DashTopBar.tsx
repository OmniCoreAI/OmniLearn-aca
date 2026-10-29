'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Book, ChatCircleDots, GearSix, Globe, House, MagnifyingGlass, Question, ShieldStar, ShoppingBag } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { signOut } from '@components/Contexts/AuthContext'
import useStaffRoleLabel from '@components/Hooks/useStaffRoleLabel'
import { useCommandPalette } from '@components/Dashboard/CommandPalette/CommandPaletteContext'
import { FeedbackModal } from '@components/Objects/Modals/FeedbackModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { DiscordIcon } from '@components/Objects/Icons/DiscordIcon'
import StudentTopBar, { iconBtn } from '@components/StudentPortal/StudentTopBar'
import { getDeploymentMode, getUriWithOrg } from '@services/config/config'

/** The dashboard's search: looks like the portal search, opens the ⌘K command palette. */
function CommandSearch() {
  const { t } = useTranslation()
  const { setOpen } = useCommandPalette()
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
  }, [])
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('dashboard.search.trigger', 'Search')}
      className="group flex h-10 w-full max-w-2xl items-center gap-2 rounded-full border border-transparent bg-[hsl(var(--dash-canvas))] px-3.5 text-start transition-all hover:border-[hsl(var(--dash-border))]"
    >
      <MagnifyingGlass size={17} className="shrink-0 text-[hsl(var(--dash-muted))] group-hover:text-[hsl(var(--dash-ink))]" />
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-[hsl(var(--dash-muted))]">{t('dashboard.search.trigger', 'Search')}</span>
      <kbd className="hidden shrink-0 items-center rounded-lg border border-[hsl(var(--dash-border))] bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[hsl(var(--dash-muted))] sm:inline-flex" dir="ltr">
        {isMac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  )
}

/** Height of the dashboard top bar; pages that fill the screen subtract it via --dash-topbar-h. */
export const DASH_TOPBAR_HEIGHT = 62

/** The portal's rounded top bar, for staff on the dashboard. */
export default function DashTopBar() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const [helpOpen, setHelpOpen] = useState(false)
  const isSuperadmin = session?.data?.user?.is_superadmin === true
  const [consoleAvailable, setConsoleAvailable] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsoleAvailable(getDeploymentMode() !== 'oss')
  }, [])

  const roleLabel = useStaffRoleLabel()

  return (
    <>
      <StudentTopBar
        orgslug={org?.slug}
        compact={false}
        roleLabel={roleLabel}
        search={<CommandSearch />}
        // The control center (help, settings) sits here beside language and
        // notifications; sign-out is in the account menu.
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={iconBtn} aria-label={t('common.help', 'Help')} title={t('common.help', 'Help')}>
                  <Question size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="w-56">
                <DropdownMenuLabel icon={Question}>{t('common.help', 'Help')}</DropdownMenuLabel>
                <DropdownMenuItem asChild icon={Book}>
                  <a href="https://docs.omnilearn.app" target="_blank" rel="noopener noreferrer">
                    {t('common.help_menu.documentation', 'Documentation')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild icon={Globe}>
                  <a href="https://omnilearn.app" target="_blank" rel="noopener noreferrer">
                    {t('common.help_menu.website', 'Website')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild icon={DiscordIcon}>
                  <a href="https://discord.gg/omnilearn" target="_blank" rel="noopener noreferrer">
                    {t('common.help_menu.discord', 'Discord')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={ChatCircleDots} onSelect={() => setHelpOpen(true)}>
                  {t('common.help_menu.report_feedback', 'Report feedback')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/account/general"
              className={iconBtn}
              aria-label={t('user.user_settings', 'User settings')}
              title={t('user.user_settings', 'User settings')}
            >
              <GearSix size={20} />
            </Link>
          </>
        }
        onHelp={() => setHelpOpen(true)}
        onSignOut={() => signOut({ redirect: true, callbackUrl: getUriWithOrg(org?.slug, '/login') })}
        extraItems={
          <>
            <DropdownMenuItem asChild icon={House}>
              {/* "/" sends staff back to the dashboard, so the learning site opens at the catalog. */}
              <Link href={getUriWithOrg(org?.slug, '/courses')}>{t('student_portal.nav.learning_site', 'Learning site')}</Link>
            </DropdownMenuItem>
            {/* Was only in the sidebar's old account card. */}
            <DropdownMenuItem asChild icon={ShoppingBag}>
              <Link href={getUriWithOrg(org?.slug, '/account/purchases')}>{t('account.purchases', 'Purchases')}</Link>
            </DropdownMenuItem>
            {isSuperadmin && consoleAvailable ? (
              <DropdownMenuItem asChild icon={ShieldStar}>
                <Link href="/admin">{t('student_portal.nav.superadmin_console', 'Superadmin console')}</Link>
              </DropdownMenuItem>
            ) : null}
          </>
        }
      />
      <FeedbackModal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        theme="light"
        userName={session?.data?.user?.username}
        userEmail={session?.data?.user?.email}
      />
    </>
  )
}
