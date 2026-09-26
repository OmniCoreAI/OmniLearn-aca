'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, GraduationCap, PlayCircle } from '@phosphor-icons/react'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import { useHomeOverview } from './homeData'

const SPARK_MONTHS = 7

export default function HomeStatCards() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useHomeOverview()
  const totals = data?.totals

  // Last N months per series, plus this-month vs last-month for the change chip.
  const series = useMemo(() => {
    const trend = (data?.enrollment_trend ?? []).slice(-SPARK_MONTHS)
    const pick = (k: 'members' | 'courses' | 'enrollments') => trend.map((r) => r[k] ?? 0)
    const pair = (values: number[]) => ({ current: values.at(-1) ?? 0, previous: values.at(-2) ?? 0 })
    const members = pick('members')
    const courses = pick('courses')
    const enrollments = pick('enrollments')
    return { members, courses, enrollments, dMembers: pair(members), dCourses: pair(courses), dEnroll: pair(enrollments) }
  }, [data])

  const thisMonth = (n: number) => t('dashboard.home.stats.this_month', '+{{count}} this month', { count: n })

  return (
    <DashStatCards
      variant="glass"
      density="fit"
      loading={isLoading}
      error={isError}
      stats={[
        {
          key: 'students',
          label: t('dashboard.home.stats.total_students', 'Total Students'),
          value: totals?.students ?? 0,
          hint: t('dashboard.home.stats.members_hint', '{{count}} members in total', { count: totals?.members ?? 0 }),
          icon: GraduationCap,
          href: '/dash/users/settings/users',
          tone: 'rose',
          trend: series.members,
          delta: { ...series.dMembers, label: thisMonth(series.dMembers.current) },
        },
        {
          key: 'courses',
          label: t('dashboard.home.stats.total_courses', 'Total Courses'),
          value: totals?.courses ?? 0,
          hint: t('dashboard.home.stats.published_hint', '{{count}} published', { count: totals?.published_courses ?? 0 }),
          icon: PlayCircle,
          href: '/dash/courses',
          tone: 'stone',
          trend: series.courses,
          delta: {
            ...series.dCourses,
            label: t('dashboard.home.stats.published_hint', '{{count}} published', { count: totals?.published_courses ?? 0 }),
          },
        },
        {
          key: 'enrollments',
          label: t('dashboard.home.stats.total_enrollments', 'Total Enrollments'),
          value: totals?.enrollments ?? 0,
          hint: t('dashboard.home.stats.last_30_days_hint', '+{{count}} in the last 30 days', { count: totals?.enrollments_30d ?? 0 }),
          icon: CheckSquare,
          href: '/dash/analytics',
          tone: 'gold',
          trend: series.enrollments,
          delta: { ...series.dEnroll, label: thisMonth(series.dEnroll.current) },
        },
      ]}
    />
  )
}
