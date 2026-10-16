'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Certificate, CheckSquare, CurrencyCircleDollar, GraduationCap, Lightning, PlayCircle, SealCheck } from '@phosphor-icons/react'
import DashStatCards, { type DashStat } from '@components/Dashboard/Shared/DashStatCards'
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility'
import { useReport } from '@services/reports/reports'
import { useReportFormats } from '@components/Dashboard/Reports/ReportKit'
import { useHomeOverview } from './homeData'
import { useHomeRanges } from './homeReports'

const SPARK_MONTHS = 7

/**
 * The academy's vital signs. Totals come from the home overview; the "last 30
 * days" figures come from the reports API, which also returns the previous 30
 * days for the change chips.
 */
export default function HomeKpis() {
  const { t } = useTranslation()
  const { isItemVisible } = usePortalNavVisibility()
  const showFinance = isItemVisible('finance')
  const { last30 } = useHomeRanges()
  const overview = useHomeOverview()
  const learning = useReport('learning', last30)
  const people = useReport('people', last30)
  const finance = useReport('financial', last30, showFinance)
  const fmt = useReportFormats(finance.data?.currency)

  const totals = overview.data?.totals
  const spark = useMemo(() => {
    const trend = (overview.data?.enrollment_trend ?? []).slice(-SPARK_MONTHS)
    return {
      members: trend.map((r) => r.members ?? 0),
      enrollments: trend.map((r) => r.enrollments ?? 0),
      completions: trend.map((r) => r.completions ?? 0),
    }
  }, [overview.data])

  const last30Label = t('dashboard.home.kpi.last_30', 'last 30 days')
  const l = learning.data
  const p = people.data
  const f = finance.data

  const stats: DashStat[] = [
    {
      key: 'students',
      label: t('dashboard.home.stats.total_students', 'Total Students'),
      value: totals?.students ?? 0,
      icon: GraduationCap,
      href: '/dash/users/settings/users',
      tone: 'rose',
      trend: spark.members,
      delta: p ? { current: p.totals.new_members, previous: p.previous.new_members, label: t('dashboard.home.kpi.new_members', '+{{count}} new', { count: p.totals.new_members }) } : undefined,
    },
    {
      key: 'active',
      label: t('dashboard.home.kpi.active_learners', 'Active learners'),
      value: p?.totals.active_learners ?? 0,
      icon: Lightning,
      href: '/dash/reports/people',
      tone: 'gold',
      delta: p ? { current: p.totals.active_learners, previous: p.previous.active_learners, label: last30Label } : undefined,
    },
    {
      key: 'enrollments',
      label: t('dashboard.home.kpi.enrollments', 'New enrollments'),
      value: l?.totals.enrollments ?? 0,
      icon: CheckSquare,
      href: '/dash/reports/learning',
      tone: 'stone',
      trend: spark.enrollments,
      delta: l ? { current: l.totals.enrollments, previous: l.previous.enrollments, label: last30Label } : undefined,
    },
    {
      key: 'completion',
      label: t('dashboard.home.stats.completion_rate', 'Completion Rate'),
      value: `${Math.round(l?.overall_completion_rate ?? 0)}%`,
      hint: t('dashboard.home.kpi.of_enrolled', 'of {{count}} enrollments', { count: l?.total_enrolled ?? 0 }),
      icon: SealCheck,
      href: '/dash/reports/learning',
      tone: 'sand',
      progress: (l?.overall_completion_rate ?? 0) / 100,
    },
    {
      key: 'certificates',
      label: t('dashboard.home.kpi.certificates', 'Certificates issued'),
      value: l?.totals.certificates ?? 0,
      icon: Certificate,
      href: '/dash/reports/learning',
      tone: 'gold',
      trend: spark.completions,
      delta: l ? { current: l.totals.certificates, previous: l.previous.certificates, label: last30Label } : undefined,
    },
    showFinance
      ? {
          key: 'revenue',
          label: t('dashboard.home.kpi.net_revenue', 'Net revenue'),
          value: fmt.money(f?.totals.net_revenue ?? 0),
          icon: CurrencyCircleDollar,
          href: '/dash/reports/financial',
          tone: 'rose',
          delta: f ? { current: f.totals.net_revenue, previous: f.previous.net_revenue, label: last30Label } : undefined,
          hint: last30Label,
        }
      : {
          key: 'courses',
          label: t('dashboard.home.stats.total_courses', 'Total Courses'),
          value: totals?.courses ?? 0,
          hint: t('dashboard.home.stats.published_hint', '{{count}} published', { count: totals?.published_courses ?? 0 }),
          icon: PlayCircle,
          href: '/dash/courses',
          tone: 'rose',
        },
  ]

  return (
    <DashStatCards
      className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 @6xl:grid-cols-6"
      loading={overview.isLoading || learning.isLoading || people.isLoading}
      error={overview.isError}
      stats={stats}
    />
  )
}
