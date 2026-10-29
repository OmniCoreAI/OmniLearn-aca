'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CalendarBlank, CaretDown, GearSix, Globe, IdentificationBadge, Lifebuoy, SignOut } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import NotificationBell from '@components/Objects/Notifications/NotificationBell'
import UserAvatar from '@components/Objects/UserAvatar'
import OrgLogo from '@components/Dashboard/Shared/OrgLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { AVAILABLE_LANGUAGES } from '@/lib/languages'
import { changeLanguage } from '@/lib/i18n'
import { getUriWithOrg } from '@services/config/config'
import StudentSearch from './StudentSearch'
import { useFormats } from './Dashboard/ui'

export const iconBtn =
  'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[hsl(var(--dash-ink))]/80 transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43_85%_55%)]/60 data-[state=open]:bg-[hsl(var(--dash-canvas))] data-[state=open]:text-[hsl(var(--dash-ink))]'

/** Arabic and English lead the language menu; the rest are listed compactly below. */
const PRIMARY_LANGUAGES = ['ar', 'en']

/**
 * Floating, fully rounded header: date · search · language, notifications and
 * the signed-in person. Used by the student portal and (with `roleLabel`,
 * `search` and `extraItems`) by the staff dashboard.
 */
export default function StudentTopBar({
  orgslug,
  compact,
  onHelp,
  onSignOut,
  roleLabel,
  search,
  extraItems,
  actions,
  className,
}: {
  orgslug: string
  compact: boolean
  onHelp: () => void
  onSignOut: () => void
  /** Shown under the name; defaults to "Student". */
  roleLabel?: string
  /** Replaces the student search (e.g. the dashboard's command palette trigger). */
  search?: React.ReactNode
  /** Extra account-menu items, placed after Settings. */
  extraItems?: React.ReactNode
  /** Extra round buttons placed before the language button (e.g. the dashboard's help and settings). */
  actions?: React.ReactNode
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const fmt = useFormats()
  const user = session?.data?.user
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || ''
  const current = i18n.language.split('-')[0]

  return (
    <header className={['sticky top-0 px-3 pt-2 sm:px-5', className].filter(Boolean).join(' ')} style={{ zIndex: 'var(--z-nav)' }}>
      <div className="rounded-[1.6rem] border border-white/80 bg-white/85 p-1.5 shadow-[0_10px_30px_-18px_hsl(220_30%_10%/0.25),0_1px_2px_hsl(220_30%_10%/0.05)] backdrop-blur-xl sm:ps-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {compact ? (
            <Link href={getUriWithOrg(orgslug, '/')} className="flex min-w-0 items-center gap-2.5 ps-1" aria-label={org?.name}>
              <OrgLogo org={org} className="h-9 w-9" fallbackClassName="text-sm" />
              <span className="truncate text-sm font-bold text-[hsl(var(--dash-ink))] max-[420px]:hidden">{org?.name}</span>
            </Link>
          ) : (
            <span
              className="hidden h-10 shrink-0 items-center gap-2 rounded-full bg-[hsl(var(--dash-canvas))] px-3.5 text-[12.5px] font-semibold text-[hsl(var(--dash-ink))]/75 xl:inline-flex"
              suppressHydrationWarning
            >
              <CalendarBlank size={16} weight="duotone" className="text-[hsl(38_75%_40%)]" />
              {fmt.date(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            {search ?? <StudentSearch orgslug={orgslug} className="w-full max-w-2xl" />}
          </div>
          <div className="flex-1 md:hidden" />

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={iconBtn} aria-label={t('common.language', 'Language')} title={t('common.language', 'Language')}>
                  <Globe size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="w-52">
                <DropdownMenuLabel icon={Globe}>{t('common.language', 'Language')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={current} onValueChange={(code) => changeLanguage(code)}>
                  {/* The academy's two languages first, then the rest in a short scrolling list. */}
                  {PRIMARY_LANGUAGES.map((code) => (
                    <DropdownMenuRadioItem key={code} value={code} className="font-semibold">
                      {AVAILABLE_LANGUAGES.find((l) => l.code === code)?.nativeName}
                    </DropdownMenuRadioItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="py-1 text-[11px]">{t('student_portal.other_languages', 'Other languages')}</DropdownMenuLabel>
                  <div className="max-h-44 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {AVAILABLE_LANGUAGES.filter((l) => !PRIMARY_LANGUAGES.includes(l.code)).map((language) => (
                      <DropdownMenuRadioItem key={language.code} value={language.code}>
                        {language.nativeName}
                      </DropdownMenuRadioItem>
                    ))}
                  </div>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <NotificationBell iconSize={21} triggerClassName={iconBtn} />

            <span className="mx-0.5 hidden h-7 w-px bg-[hsl(var(--dash-border))] sm:block" aria-hidden="true" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-2.5 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43_85%_55%)]/60 sm:ps-3"
                  aria-label={t('user.account_menu', 'Account menu')}
                >
                  <span className="hidden min-w-0 text-start leading-tight sm:block">
                    <span className="block max-w-[11rem] truncate text-[13.5px] font-bold capitalize text-[hsl(var(--dash-ink))]">{name}</span>
                    <span className="block text-[11px] font-medium text-[hsl(var(--dash-muted))]">{roleLabel ?? t('student_portal.role', 'Student')}</span>
                  </span>
                  <span className="hidden h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--dash-muted))] transition-all group-hover:bg-[hsl(var(--dash-canvas))] group-hover:text-[hsl(var(--dash-ink))] group-data-[state=open]:rotate-180 group-data-[state=open]:bg-[hsl(var(--dash-canvas))] group-data-[state=open]:text-[hsl(var(--dash-ink))] sm:inline-flex">
                    <CaretDown size={14} weight="bold" />
                  </span>
                  <span className="relative">
                    <UserAvatar width={36} rounded="rounded-full" shadow="shadow-none" />
                    <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="w-56">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <UserAvatar width={32} rounded="rounded-full" shadow="shadow-none" />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[13px] font-bold capitalize text-[hsl(var(--dash-ink))]">{name}</p>
                    <p className="truncate text-[11.5px] text-[hsl(var(--dash-muted))]">{user?.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild icon={IdentificationBadge}>
                  <Link href={getUriWithOrg(orgslug, '/account/general')}>{t('student_portal.nav.profile', 'Profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild icon={GearSix}>
                  <Link href={getUriWithOrg(orgslug, '/account/security')}>{t('student_portal.nav.settings', 'Settings')}</Link>
                </DropdownMenuItem>
                {extraItems}
                <DropdownMenuItem icon={Lifebuoy} onSelect={onHelp}>
                  {t('student_portal.nav.help', 'Help & support')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={SignOut} iconClassName="rtl:rotate-180" variant="destructive" onSelect={onSignOut}>
                  {t('user.sign_out', 'Sign out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Phones: search gets its own row. */}
        {search ? null : (
          <div className="px-0.5 pb-0.5 pt-1.5 md:hidden">
            <StudentSearch orgslug={orgslug} className="w-full" />
          </div>
        )}
      </div>
    </header>
  )
}
