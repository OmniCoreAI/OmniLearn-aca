'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { FadeIn } from '@components/Dashboard/Shared/DashMotion'
import { cn } from '@/lib/utils'
import GlobalSearchBar from './GlobalSearchBar'
import HomeStatCards from './HomeStatCards'

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
const NeedsAttention = dynamic(() => import('./NeedsAttention'), { ssr: false, loading: skeleton(260) })
const HomeRightRail = dynamic(() => import('./HomeRightRail'), { ssr: false, loading: skeleton(600) })

/** Grid cell: full width when stacked, part of a 12-column row when there's room. */
function Cell({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={cn('col-span-12 min-h-0 min-w-0', className)}>{children}</div>
}

/**
 * Two layouts: on laptop-size viewports and up (the `fit` variant) the whole
 * page fills exactly one screen — chart rows share the leftover height and the
 * right rail scrolls internally — while smaller screens keep a scrolling stack.
 */
export default function DashboardHome() {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const firstName = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const todayLabel = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex min-h-full bg-[hsl(var(--dash-canvas))] w-full flex-col text-[hsl(var(--dash-ink))] xl:flex-row fit:h-dvh fit:min-h-0 fit:overflow-hidden">
      <main className="@container flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8 fit:min-h-0 fit:gap-3 fit:px-6 fit:py-3.5">
        <FadeIn>
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--dash-accent))]">
                {todayLabel}
              </p>
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-[hsl(var(--dash-ink))] fit:text-2xl">
                {t('dashboard.home.title', 'Dashboard')}
              </h1>
              <p className="mt-0.5 text-sm text-[hsl(var(--dash-muted))] fit:text-xs">
                {t('dashboard.home.welcome_name', 'Hello {{name}}, welcome back!', {
                  name: firstName || t('dashboard.home.there', 'there'),
                })}
              </p>
            </div>
            <GlobalSearchBar className="sm:max-w-sm fit:h-10" />
          </header>
        </FadeIn>

        <AdminAuthorization authorizationMode="component">
          <div className="flex flex-col gap-5 fit:min-h-0 fit:flex-1 fit:gap-3">
            <HomeStatCards />

            {/* Row 1: the trend story beside the course ranking. Row 2: people, engagement, to-dos. */}
            <div className="grid grid-cols-12 gap-5 fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] fit:gap-3">
              <Cell className="@3xl:col-span-8 fit:col-span-8">
                <PerformanceChart />
              </Cell>
              <Cell className="@3xl:col-span-4 fit:col-span-4">
                <TopCourses />
              </Cell>
              <Cell className="@2xl:col-span-6 @3xl:col-span-4 fit:col-span-4">
                <TopInstructors />
              </Cell>
              <Cell className="@2xl:col-span-6 @3xl:col-span-4 fit:col-span-4">
                <LearningActivityHeatmap />
              </Cell>
              <Cell className="@3xl:col-span-4 fit:col-span-4">
                <NeedsAttention />
              </Cell>
            </div>
          </div>
        </AdminAuthorization>
      </main>

      <AdminAuthorization authorizationMode="component">
        <aside className="px-4 pb-6 sm:px-8 xl:w-[clamp(320px,23vw,400px)] xl:shrink-0 xl:px-0 xl:py-3 xl:pe-3 fit:flex fit:h-dvh fit:flex-col">
          <div className="dash-card flex flex-col rounded-[1.75rem] p-4 fit:min-h-0 fit:flex-1">
            <HomeRightRail />
          </div>
        </aside>
      </AdminAuthorization>
    </div>
  )
}
