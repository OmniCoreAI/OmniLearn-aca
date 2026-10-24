'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { cn } from '@/lib/utils'
import { EmptyState, HomeCard } from './HomeCard'
import { HOME_COLORS, useHomeOverview } from './homeData'

const LIMIT = 5

/**
 * Ranked list rather than a donut: a bar per course compares five items at a
 * glance, and every row shows its completion rate too.
 */
export default function TopCourses() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const { data, isLoading } = useHomeOverview()
  const courses = (data?.top_courses ?? []).filter((c) => c.enrollments > 0).slice(0, LIMIT)
  const max = Math.max(1, ...courses.map((c) => c.enrollments))

  return (
    <HomeCard
      title={t('dashboard.home.top_courses.title', 'Top Courses')}
      subtitle={t('dashboard.home.top_courses.ranked', 'Ranked by enrollments')}
      action={
        <Link
          href="/dash/courses"
          className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
        >
          {t('dashboard.home.view_all', 'View All')}
        </Link>
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : courses.length === 0 ? (
        <EmptyState className="h-[220px]">
          {t('dashboard.home.top_courses.empty', 'Your most popular courses will be ranked here.')}
        </EmptyState>
      ) : (
        <ol className="space-y-1 fit:-me-1.5 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pe-1.5 [scrollbar-width:thin]">
          {courses.map((c, i) => {
            const pct = c.enrollments ? Math.round((c.completions / c.enrollments) * 100) : 0
            const thumb = c.thumbnail_image
              ? getCourseThumbnailMediaDirectory(org?.org_uuid, c.course_uuid, c.thumbnail_image)
              : null
            return (
              <li key={c.course_uuid}>
                <Link
                  href={`/dash/courses/course/${c.course_uuid.replace('course_', '')}/general`}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                >
                  <span
                    className={cn(
                      'w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums',
                      i === 0 ? 'text-[hsl(var(--dash-accent))]' : 'text-[hsl(var(--dash-muted))]'
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="h-9 w-12 shrink-0 overflow-hidden rounded-lg">
                    <CourseCover name={c.name} seed={c.course_uuid} src={thumb} size="xs" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]" title={c.name}>
                      {c.name}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(c.enrollments / max) * 100}%`,
                          background: i === 0 ? `linear-gradient(90deg, ${HOME_COLORS.gold}, ${HOME_COLORS.goldDeep})` : HOME_COLORS.ink,
                          opacity: i === 0 ? 1 : 0.75 - i * 0.1,
                        }}
                      />
                    </span>
                  </span>
                  <span className="w-12 shrink-0 text-end">
                    <span className="block text-[13px] font-semibold tabular-nums text-[hsl(var(--dash-ink))]">
                      {c.enrollments.toLocaleString()}
                    </span>
                    <span className="block text-[10px] tabular-nums text-[hsl(var(--dash-muted))]">
                      {t('dashboard.home.top_courses.done', '{{pct}}% done', { pct })}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </HomeCard>
  )
}
