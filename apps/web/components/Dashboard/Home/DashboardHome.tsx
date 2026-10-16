'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { FadeIn } from '@components/Dashboard/Shared/DashMotion'
import { cn } from '@/lib/utils'
import useWorkspaceRole from '@components/Hooks/useWorkspaceRole'
import GlobalSearchBar from './GlobalSearchBar'
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility'
import HomeHero from './HomeHero'
import HomeKpis from './HomeKpis'

const skeleton = (minHeight: number) => {
  const Skeleton = () => (
    <div
      className="dash-shimmer h-full min-h-[var(--skeleton-h)] rounded-[var(--dash-radius)] fit:min-h-0"
      style={{ '--skeleton-h': `${minHeight}px` } as React.CSSProperties}
    />
  )
  return Skeleton
}

// Chart-heavy widgets load off the critical path (recharts is large).
const PerformanceChart = dynamic(() => import('./PerformanceChart'), { ssr: false, loading: skeleton(320) })
const TopCourses = dynamic(() => import('./TopCourses'), { ssr: false, loading: skeleton(320) })
const TopInstructors = dynamic(() => import('./TopInstructors'), { ssr: false, loading: skeleton(260) })
const LearningActivityHeatmap = dynamic(() => import('./LearningActivityHeatmap'), {
  ssr: false,
  loading: skeleton(260),
})
const FinanceSnapshot = dynamic(() => import('./FinanceSnapshot'), { ssr: false, loading: skeleton(300) })
const PeoplePulse = dynamic(() => import('./PeoplePulse'), { ssr: false, loading: skeleton(300) })
const EntityLeaderboard = dynamic(() => import('./EntityLeaderboard'), { ssr: false, loading: skeleton(300) })
const NeedsAttention = dynamic(() => import('./NeedsAttention'), { ssr: false, loading: skeleton(260) })
const HomeRightRail = dynamic(() => import('./HomeRightRail'), { ssr: false, loading: skeleton(600) })
const InstructorHome = dynamic(() => import('./InstructorHome'), { ssr: false, loading: skeleton(600) })
const CoordinatorHome = dynamic(() => import('./CoordinatorHome'), { ssr: false, loading: skeleton(600) })

/** Grid cell: full width when stacked, part of a 12-column row when there's room. */
function Cell({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={cn('col-span-12 min-h-0 min-w-0', className)}>{children}</div>
}

/**
 * The academy home scrolls; the calendar rail beside it stays in view. Instructors
 * and coordinators get their own workspace home instead.
 */
export default function DashboardHome() {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const role = useWorkspaceRole()
  const firstName = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const todayLabel = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  // Wait for the role so staff never flash the academy-wide dashboard.
  if (role === null) {
    return <div className="dash-shimmer m-6 h-[60vh] rounded-[var(--dash-radius)]" />
  }

  if (role === 'instructor' || role === 'coordinator') {
    return (
      <WorkspaceHome
        title={role === 'instructor' ? t('workspace.my_work', 'My work') : t('entities.portal.nav', 'My entity')}
        todayLabel={todayLabel}
        firstName={firstName}
      >
        {role === 'instructor' ? <InstructorHome /> : <CoordinatorHome />}
      </WorkspaceHome>
    )
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))] xl:flex-row">
      <main className="@container flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-7 fit:px-6 fit:py-4">
        <GlobalSearchBar className="sm:max-w-sm lg:hidden" />
        <AdminAuthorization authorizationMode="component">
          <AcademyOverview />
        </AdminAuthorization>
      </main>

      <AdminAuthorization authorizationMode="component">
        {/* The rail stays in view while the overview scrolls. */}
        <aside className="px-4 pb-6 sm:px-8 xl:sticky xl:top-[var(--dash-topbar-h,0px)] xl:w-[clamp(340px,25vw,420px)] xl:shrink-0 xl:self-start xl:px-0 xl:py-3 xl:pe-3 fit:flex fit:h-[calc(100dvh-var(--dash-topbar-h,0px))] fit:flex-col">
          {/* Scrolls only on screens too short for the rail's minimum heights. */}
          <div className="dash-card flex flex-col rounded-[1.75rem] p-4 fit:min-h-0 fit:flex-1 fit:overflow-y-auto [scrollbar-width:thin]">
            <HomeRightRail />
          </div>
        </aside>
      </AdminAuthorization>
    </div>
  )
}

/**
 * The academy-wide overview: a command banner, the vital signs, then one grid
 * that reads from "how are we trending and what needs doing" to money and
 * people, to who is doing well. Laptop widths pair cards side by side; wide
 * screens fit three across (the trend chart takes two). On large screens every
 * card has the same set height so neighbours line up; below that they stack
 * at their natural height.
 */
function AcademyOverview() {
  const { isItemVisible } = usePortalNavVisibility()
  const showFinance = isItemVisible('finance')
  const half = 'fit:h-[350px] @2xl:col-span-6 @5xl:col-span-4'
  return (
    <div className="flex flex-col gap-5">
      <FadeIn>
        <HomeHero />
      </FadeIn>
      <HomeKpis />

      <div className="grid grid-cols-12 gap-5">
        <Cell className="fit:h-[350px] @5xl:col-span-8">
          <PerformanceChart />
        </Cell>
        <Cell className={half}>
          <NeedsAttention />
        </Cell>
        {showFinance ? (
          <Cell className={half}>
            <FinanceSnapshot />
          </Cell>
        ) : null}
        <Cell className={half}>
          <PeoplePulse />
        </Cell>
        <Cell className={half}>
          <TopCourses />
        </Cell>
        <Cell className={half}>
          <EntityLeaderboard />
        </Cell>
        {/* Without the finance card the last row has two cards: they share it. */}
        <Cell className={cn(half, !showFinance && '@5xl:col-span-6')}>
          <TopInstructors />
        </Cell>
        <Cell className={cn(half, showFinance ? '@2xl:col-span-12' : '@5xl:col-span-6')}>
          <LearningActivityHeatmap />
        </Cell>
      </div>
    </div>
  )
}

/** Home for staff who work on their own assignments: a scrolling page plus the calendar rail. */
function WorkspaceHome({
  title,
  todayLabel,
  firstName,
  children,
}: {
  title: string
  todayLabel: string
  firstName: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-full w-full flex-col bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))] xl:flex-row">
      <main className="@container flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
        <FadeIn>
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--dash-accent))]">{todayLabel}</p>
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{title}</h1>
              <p className="mt-0.5 text-sm text-[hsl(var(--dash-muted))]">
                {t('dashboard.home.welcome_name', 'Hello {{name}}, welcome back!', {
                  name: firstName || t('dashboard.home.there', 'there'),
                })}
              </p>
            </div>
            <GlobalSearchBar className="sm:max-w-sm lg:hidden" />
          </header>
        </FadeIn>
        {children}
      </main>
      <aside className="px-4 pb-6 sm:px-8 xl:sticky xl:top-[var(--dash-topbar-h,0px)] xl:h-[calc(100dvh-var(--dash-topbar-h,0px))] xl:w-[clamp(340px,25vw,420px)] xl:shrink-0 xl:overflow-y-auto xl:px-0 xl:py-3 xl:pe-3">
        <div className="dash-card flex flex-col rounded-[1.75rem] p-4">
          <HomeRightRail showActivity={false} />
        </div>
      </aside>
    </div>
  )
}
