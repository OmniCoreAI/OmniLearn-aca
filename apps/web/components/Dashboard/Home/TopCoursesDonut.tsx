'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { EmptyState, HomeCard } from './HomeCard'
import { HOME_COLORS, useHomeOverview } from './homeData'

const SEGMENT_COLORS = [HOME_COLORS.gold, HOME_COLORS.rose, HOME_COLORS.stone]

export default function TopCoursesDonut() {
  const { t } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const total = data?.totals.enrollments ?? 0
  const top = (data?.top_courses ?? []).slice(0, 3).filter((c) => c.enrollments > 0)

  const segments: { name: string; value: number; color: string }[] = top.map((c, i) => ({
    name: c.name,
    value: c.enrollments,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length]!,
  }))
  const rest = total - top.reduce((s, c) => s + c.enrollments, 0)
  if (rest > 0) segments.push({ name: 'rest', value: rest, color: HOME_COLORS.stoneSoft })

  return (
    <HomeCard
      title={t('dashboard.home.top_courses.title', 'Top Courses')}
      action={
        <Link
          href="/dash/courses"
          className="rounded-full px-2 py-1 text-xs font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
        >
          {t('dashboard.home.view_all', 'View All')}
        </Link>
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:min-h-0 fit:flex-1" />
      ) : top.length === 0 ? (
        <EmptyState className="h-[220px]">
          {t('dashboard.home.top_courses.empty', 'Your most popular courses will be ranked here.')}
        </EmptyState>
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)] fit:min-h-0 fit:flex-1">
          <div className="mx-auto aspect-square h-[180px] fit:h-full fit:max-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  innerRadius="64%"
                  outerRadius="96%"
                  paddingAngle={3}
                  cornerRadius={10}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  animationDuration={600}
                >
                  {segments.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 space-y-4 fit:space-y-1.5">
            {top.map((course, i) => (
              <li key={course.course_uuid} className="flex min-w-0 gap-3">
                <span
                  className="w-1.5 shrink-0 rounded-full"
                  style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p title={course.name} className="truncate text-sm fit:text-[13px] font-medium text-[hsl(var(--dash-ink))]">{course.name}</p>
                  <p className="mt-0.5 flex items-baseline gap-x-2 truncate text-[11px] fit:mt-0 text-[hsl(var(--dash-muted))]">
                    <span className="text-sm font-semibold text-[hsl(var(--dash-ink))] fit:text-[13px]">
                      {total ? Math.round((course.enrollments / total) * 100) : 0}%
                    </span>
                    <span>{t('dashboard.home.new_courses.lessons', '{{count}} lessons', { count: course.lessons })}</span>
                    <span>
                      {t('dashboard.home.top_courses.students', '{{count}} students', { count: course.enrollments })}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HomeCard>
  )
}
