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
const RevenueChart = dynamic(() => import('./RevenueChart'), { ssr: false, loading: skeleton(320) })
const EnrollmentTrendsChart = dynamic(() => import('./EnrollmentTrendsChart'), { ssr: false, loading: skeleton(320) })
const LearningActivityHeatmap = dynamic(() => import('./LearningActivityHeatmap'), {
  ssr: false,
  loading: skeleton(320),
})
const NewCoursesWidget = dynamic(() => import('./NewCoursesWidget'), { ssr: false, loading: skeleton(320) })
const StudentsDemographic = dynamic(() => import('./StudentsDemographic'), { ssr: false, loading: skeleton(280) })
const TopCoursesDonut = dynamic(() => import('./TopCoursesDonut'), { ssr: false, loading: skeleton(280) })
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
    <div className="dash-ambient flex min-h-full w-full flex-col text-[hsl(var(--dash-ink))] min-[1280px]:flex-row fit:h-dvh fit:min-h-0 fit:overflow-hidden">
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

            <div className="grid grid-cols-12 gap-5 fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] fit:gap-3">
              <Cell className="@3xl:col-span-6 fit:col-span-6">
                <RevenueChart />
              </Cell>
              <Cell className="@3xl:col-span-6 fit:col-span-6">
                <EnrollmentTrendsChart />
              </Cell>
              <Cell className="@5xl:col-span-5 fit:col-span-5">
                <LearningActivityHeatmap />
              </Cell>
              <Cell className="@5xl:col-span-7 fit:col-span-7">
                <NewCoursesWidget />
              </Cell>
              <Cell className="@4xl:col-span-7 fit:col-span-7">
                <StudentsDemographic />
              </Cell>
              <Cell className="@4xl:col-span-5 fit:col-span-5">
                <TopCoursesDonut />
              </Cell>
            </div>
          </div>
        </AdminAuthorization>
      </main>

      <AdminAuthorization authorizationMode="component">
        <aside className="px-4 pb-6 sm:px-8 min-[1280px]:w-[318px] min-[1280px]:shrink-0 min-[1280px]:px-0 min-[1280px]:py-3 min-[1280px]:pe-3 fit:flex fit:h-dvh fit:flex-col">
          <div className="dash-glass flex flex-col rounded-[1.75rem] p-4 fit:min-h-0 fit:flex-1">
            <HomeRightRail />
          </div>
        </aside>
      </AdminAuthorization>
    </div>
  )
}
