'use client'
import React from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import QuezStatCards from './QuezStatCards'
import UpcomingCourseCards from './UpcomingCourseCards'
import CoursesTable from './CoursesTable'

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
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3.5 py-2 text-xs font-medium text-[hsl(var(--dash-ink))] shadow-[0_1px_2px_hsl(220_18%_14%/0.04)]">
            <CalendarBlank size={14} className="text-[hsl(var(--dash-muted))]" />
            {formatRange()}
          </div>
        </header>

        <AdminAuthorization authorizationMode="component">
          <div className="space-y-6">
            <QuezStatCards />

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[hsl(var(--dash-ink))]">
                {t('dashboard.home.upcoming_class', 'Upcoming class')}
              </h2>
              <UpcomingCourseCards />
            </section>

            <CoursesTable />
          </div>
        </AdminAuthorization>
      </div>
    </div>
  )
}
