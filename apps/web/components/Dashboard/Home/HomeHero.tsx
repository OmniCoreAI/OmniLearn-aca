'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  Buildings,
  CalendarDots,
  ChartLineUp,
  GearSix,
  Plus,
  ShieldStar,
  SlidersHorizontal,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility'
import useStaffRoleLabel from '@components/Hooks/useStaffRoleLabel'
import { useReport } from '@services/reports/reports'
import { getDeploymentMode } from '@services/config/config'
import { cn } from '@/lib/utils'
import { useHomeOverview } from './homeData'
import { useHomeRanges } from './homeReports'

type Action = { key: string; href: string; label: string; icon: React.ElementType }

function greetingFor(hour: number, t: (_k: string, _d: string) => string) {
  if (hour < 5 || hour >= 18) return t('dashboard.home.hero.evening', 'Good evening')
  if (hour < 12) return t('dashboard.home.hero.morning', 'Good morning')
  return t('dashboard.home.hero.afternoon', 'Good afternoon')
}

/** One number on the hero's glass strip. */
function HeroStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3 backdrop-blur-md">
      <p className="truncate text-[11px] font-medium text-white/55">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-white/50">{hint}</p> : null}
    </div>
  )
}

/**
 * The academy's command banner: who's here, what's waiting, how the academy is
 * doing this month, and the shortcuts people reach for most. Super admins get a
 * second row of platform controls.
 */
export default function HomeHero() {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const roleLabel = useStaffRoleLabel()
  const { rights } = useAdminStatus() as any
  const { isItemVisible } = usePortalNavVisibility()
  const { last30 } = useHomeRanges()
  const { data: overview } = useHomeOverview()
  const { data: people, isLoading: peopleLoading } = useReport('people', last30)
  const isSuperadmin = session?.data?.user?.is_superadmin === true
  const firstName = session?.data?.user?.first_name || session?.data?.user?.username || ''

  // Time of day and the console flag differ between server and browser: set after mount.
  const [hour, setHour] = useState<number | null>(null)
  const [consoleAvailable, setConsoleAvailable] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHour(new Date().getHours())
    setConsoleAvailable(getDeploymentMode() !== 'oss')
  }, [])

  const waiting = Object.values(overview?.attention ?? {}).reduce((sum, n) => sum + (n || 0), 0)
  const num = new Intl.NumberFormat(`${i18n.language.split('-')[0]}-u-nu-latn`)
  const totals = people?.totals
  const signedInRate = totals?.members ? Math.round((totals.signed_in / totals.members) * 100) : 0
  const loadingValue = <span className="inline-block h-5 w-12 animate-pulse rounded bg-white/15 align-middle" />

  const actions: Action[] = [
    rights?.courses?.action_create && {
      key: 'course',
      href: '/dash/courses?new=true',
      label: t('dashboard.home.hero.new_course', 'New course'),
      icon: Plus,
    },
    isItemVisible('users') && {
      key: 'users',
      href: '/dash/users/settings/add',
      label: t('dashboard.home.hero.add_users', 'Add users'),
      icon: UserPlus,
    },
    isItemVisible('facilities') && {
      key: 'halls',
      href: '/dash/administration/facilities/calendar',
      label: t('dashboard.home.hero.book_hall', 'Book a hall'),
      icon: CalendarDots,
    },
    isItemVisible('reports') && {
      key: 'reports',
      href: '/dash/reports',
      label: t('dashboard.home.hero.reports', 'Reports'),
      icon: ChartLineUp,
    },
  ].filter(Boolean) as Action[]

  const platform: Action[] = isSuperadmin
    ? ([
        consoleAvailable && {
          key: 'console',
          href: '/admin',
          label: t('student_portal.nav.superadmin_console', 'Superadmin console'),
          icon: ShieldStar,
        },
        {
          key: 'roles',
          href: '/dash/administration/roles',
          label: t('dashboard.home.hero.roles', 'Roles & permissions'),
          icon: SlidersHorizontal,
        },
        {
          key: 'administration',
          href: '/dash/administration',
          label: t('dashboard.home.hero.administration', 'Administration'),
          icon: Buildings,
        },
        {
          key: 'settings',
          href: '/dash/org/settings/general',
          label: t('dashboard.home.hero.academy_settings', 'Academy settings'),
          icon: GearSix,
        },
      ].filter(Boolean) as Action[])
    : []

  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,hsl(0_0%_11%),hsl(0_0%_4%))] p-5 text-white shadow-[0_24px_48px_-28px_hsl(0_0%_0%/0.7)] sm:p-6">
      {/* Brand glows and a faint grid give the glass something to sit on. */}
      <span aria-hidden="true" className="absolute -end-16 -top-24 -z-10 h-72 w-72 rounded-full bg-[hsl(43_88%_55%)] opacity-40 blur-3xl" />
      <span aria-hidden="true" className="absolute -bottom-28 start-1/4 -z-10 h-64 w-64 rounded-full bg-[hsl(351_84%_50%)] opacity-30 blur-3xl" />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
      />

      <div className="flex flex-col gap-5 @4xl:flex-row @4xl:items-start @4xl:justify-between">
        <div className="min-w-0 @4xl:max-w-[46%]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                isSuperadmin ? 'bg-[hsl(43_85%_55%)]/15 text-[hsl(43_90%_70%)] ring-1 ring-[hsl(43_85%_55%)]/30' : 'bg-white/10 text-white/80'
              )}
            >
              {isSuperadmin ? <ShieldStar size={13} weight="fill" /> : <UsersThree size={13} weight="fill" />}
              {roleLabel}
            </span>
            {/* The top bar shows the date on wide screens. */}
            <span className="text-[11px] font-medium text-white/50 xl:hidden" suppressHydrationWarning>
              {new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
            {hour === null ? t('dashboard.home.title', 'Dashboard') : greetingFor(hour, t)}
            {firstName ? <span className="text-[hsl(43_90%_68%)]">{`${t('dashboard.home.hero.name_separator', ', ')}${firstName}`}</span> : null}
          </h1>
          <p className="mt-1.5 text-sm text-white/65">
            {waiting
              ? t('dashboard.home.hero.waiting', '{{count}} items are waiting on your team today.', { count: waiting })
              : t('dashboard.home.hero.clear', 'Nothing is waiting on your team — a good day to plan ahead.')}
          </p>

          {actions.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {actions.map((a, i) => (
                <Link
                  key={a.key}
                  href={a.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all hover:-translate-y-px',
                    i === 0
                      ? 'bg-white text-[hsl(var(--dash-ink))] shadow-[0_8px_20px_-10px_rgba(255,255,255,0.6)] hover:bg-white/90'
                      : 'border border-white/15 bg-white/[0.06] text-white/90 backdrop-blur-md hover:bg-white/[0.12]'
                  )}
                >
                  <a.icon size={15} weight="bold" />
                  {a.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {/* This month at a glance (last 30 days vs the 30 before). */}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 @2xl:grid-cols-4 @4xl:max-w-[30rem] @4xl:grid-cols-2">
          <HeroStat
            label={t('dashboard.home.hero.members', 'Members')}
            value={peopleLoading ? loadingValue : num.format(totals?.members ?? 0)}
            hint={t('dashboard.home.hero.new_members', '+{{count}} in 30 days', { count: totals?.new_members ?? 0 })}
          />
          <HeroStat
            label={t('dashboard.home.hero.active_learners', 'Active learners')}
            value={peopleLoading ? loadingValue : num.format(totals?.active_learners ?? 0)}
            hint={t('dashboard.home.hero.last_30', 'Last 30 days')}
          />
          <HeroStat
            label={t('dashboard.home.hero.signed_in', 'Signed in')}
            value={peopleLoading ? loadingValue : `${signedInRate}%`}
            hint={t('dashboard.home.hero.never_signed_in', '{{count}} never signed in', { count: totals?.never_signed_in ?? 0 })}
          />
          <HeroStat
            label={t('dashboard.home.hero.entities', 'Entities')}
            value={peopleLoading ? loadingValue : num.format(totals?.entities ?? 0)}
            hint={t('dashboard.home.hero.unassigned', '{{count}} members unassigned', { count: people?.unassigned_members ?? 0 })}
          />
        </div>
      </div>

      {platform.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="me-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(43_90%_68%)]">
            <ShieldStar size={13} weight="fill" />
            {t('dashboard.home.hero.platform', 'Platform')}
          </span>
          {platform.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.1] hover:text-white"
            >
              <a.icon size={14} weight="duotone" />
              {a.label}
              <ArrowUpRight size={11} className="opacity-0 transition-opacity group-hover:opacity-70 rtl:-scale-x-100" />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
