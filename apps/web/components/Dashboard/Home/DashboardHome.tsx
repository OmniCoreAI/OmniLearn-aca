'use client'
import React from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { CalendarBlank } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import HeroBanner from './HeroBanner'
import GlobalSearchBar from './GlobalSearchBar'
import QuezStatCards from './QuezStatCards'
import UpcomingCourseCards from './UpcomingCourseCards'
import CoursesTable from './CoursesTable'
import MembersWidget from './MembersWidget'
import { FadeIn } from '@components/Dashboard/Shared/DashMotion'

// Code-split: keep Recharts and the assignments fan-out off the critical path
const ActivityChart = dynamic(() => import('./ActivityChart'), {
  ssr: false,
  loading: () => (
    <div className="dash-shimmer h-[300px] rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))]" />
  ),
})
const EventsWidget = dynamic(() => import('./EventsWidget'), {
  ssr: false,
  loading: () => (
    <div className="dash-shimmer h-[280px] rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))]" />
  ),
})

function formatRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 14)
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

export default function DashboardHome() {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const org = useOrg() as any

  const firstName =
    session?.data?.user?.first_name ||
    session?.data?.user?.username ||
    ''

  return (
    <div className="min-h-full w-full bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <FadeIn>
          {/* Global search bar (Skillio-style top bar) */}
          <div className="flex items-center gap-3">
            <GlobalSearchBar className="max-w-2xl" />
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3.5 py-2.5 text-xs font-medium text-[hsl(var(--dash-ink))] shadow-[0_1px_2px_hsl(245_25%_13%/0.04)] md:inline-flex">
              <CalendarBlank size={14} className="text-[hsl(var(--dash-muted))]" />
              {formatRange()}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.03}>
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-[hsl(var(--dash-ink))] sm:text-[2rem]">
                {t('dashboard.home.hi_name', 'Hi, {{name}}!', {
                  name: firstName || t('dashboard.home.there', 'there'),
                })}{' '}
                <span aria-hidden="true">👋</span>
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-[hsl(var(--dash-muted))]">
                {org?.name
                  ? t(
                      'dashboard.home.week_activity',
                      'Your academic workspace for {{org}} — keep classes, people, and progress moving.',
                      { org: org.name }
                    )
                  : t(
                      'dashboard.home.week_activity_generic',
                      'Your academic workspace — keep classes, people, and progress moving.'
                    )}
              </p>
            </div>
          </header>
        </FadeIn>

        <AdminAuthorization authorizationMode="component">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Main column */}
            <div className="min-w-0 space-y-6">
              <FadeIn delay={0.05}>
                <HeroBanner orgName={org?.name} />
              </FadeIn>

              <QuezStatCards />

              <FadeIn delay={0.1}>
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[hsl(var(--dash-ink))]">
                      {t('dashboard.home.continue_building', 'Continue building')}
                    </h2>
                    <Link
                      href="/dash/courses"
                      className="text-xs font-medium text-[hsl(var(--dash-accent))] hover:underline"
                    >
                      {t('dashboard.home.view_all', 'View All')}
                    </Link>
                  </div>
                  <UpcomingCourseCards />
                </section>
              </FadeIn>

              <FadeIn delay={0.15}>
                <ActivityChart />
              </FadeIn>

              <FadeIn delay={0.2}>
                <CoursesTable />
              </FadeIn>
            </div>

            {/* Right rail */}
            <div className="min-w-0 space-y-6">
              <FadeIn delay={0.1}>
                <EventsWidget />
              </FadeIn>
              <FadeIn delay={0.15}>
                <MembersWidget />
              </FadeIn>
            </div>
          </div>
        </AdminAuthorization>
      </div>
    </div>
  )
}
