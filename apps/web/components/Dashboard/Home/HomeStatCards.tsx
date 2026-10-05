'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, GraduationCap, PlayCircle, SealCheck } from '@phosphor-icons/react'
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
  const enrolled = totals?.enrollments ?? 0
  const completed = totals?.completions ?? 0
  const rate = enrolled ? completed / enrolled : 0

  return (
    <DashStatCards
      density="fit"
      className="fit:gap-3"
      loading={isLoading}
      error={isError}
      stats={[
        {
          key: 'students',
          label: t('dashboard.home.stats.total_students', 'Total Students'),
          value: totals?.students ?? 0,
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
          value: enrolled,
          icon: CheckSquare,
          href: '/dash/analytics',
          tone: 'gold',
          trend: series.enrollments,
          delta: { ...series.dEnroll, label: thisMonth(series.dEnroll.current) },
        },
        {
          key: 'completion',
          label: t('dashboard.home.stats.completion_rate', 'Completion Rate'),
          value: `${Math.round(rate * 100)}%`,
          hint: t('dashboard.home.stats.completed_of', '{{done}} of {{total}} completed', {
            done: completed,
            total: enrolled,
          }),
          icon: SealCheck,
          tone: 'sand',
          progress: rate,
        },
      ]}
    />
  )
}
