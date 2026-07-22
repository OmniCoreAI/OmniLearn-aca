'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useAdminOrgCourses } from '@/hooks/queries/useCourses'
import { MagnifyingGlass, Plus, CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/**
 * Content-completeness heuristic for a course:
 * chapters present (up to 60%) + published state (40%).
 * Replaces the old hardcoded 72%/28% placeholder.
 */
function courseCompleteness(course: any): number {
  const chapters = course.chapters?.length ?? course.chapter_count ?? 0
  const chapterScore = Math.min(chapters / 5, 1) * 60
  const publishScore = course.published ? 40 : 0
  return Math.round(chapterScore + publishScore)
}

export default function CoursesTable() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgslug = org?.slug
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all')

  const { data: coursesData, isLoading } = useAdminOrgCourses(orgslug)

  const courses: any[] = useMemo(() => coursesData ?? [], [coursesData])

  const filtered = useMemo(() => {
    return courses.filter((course) => {
      const matchesQuery =
        !query ||
        course.name?.toLowerCase().includes(query.toLowerCase()) ||
        course.description?.toLowerCase().includes(query.toLowerCase())
      const matchesStatus =
        status === 'all' ||
        (status === 'published' && course.published) ||
        (status === 'draft' && !course.published)
      return matchesQuery && matchesStatus
    })
  }, [courses, query, status])

  return (
    <section className="overflow-hidden rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]">
      <div className="flex flex-col gap-4 border-b border-[hsl(var(--dash-border))] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-base font-semibold text-[hsl(var(--dash-ink))]">
          {t('dashboard.home.courses')}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dash/courses?new=true"
            className="dash-lift inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-accent))] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] hover:brightness-110"
          >
            <Plus size={14} weight="bold" />
            {t('dashboard.home.create_course')}
          </Link>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="appearance-none rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] py-2 pl-3 pr-8 text-xs text-[hsl(var(--dash-ink))] outline-none transition-shadow focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/25"
            >
              <option value="all">{t('dashboard.home.all_status', 'All status')}</option>
              <option value="published">{t('dashboard.home.published')}</option>
              <option value="draft">{t('dashboard.home.draft')}</option>
            </select>
            <CaretDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--dash-muted))]"
            />
          </div>
          <div className="relative min-w-[180px] flex-1 sm:flex-none">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dash-muted))]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('dashboard.home.search_courses', 'Search course...')}
              className="w-full rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] py-2 pl-8 pr-3 text-xs text-[hsl(var(--dash-ink))] outline-none transition-shadow placeholder:text-[hsl(var(--dash-muted))] focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/25"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--dash-border))] text-[11px] uppercase tracking-wide text-[hsl(var(--dash-muted))]">
              <th className="px-5 py-3 font-medium">{t('dashboard.home.course_title', 'Course title')}</th>
              <th className="px-3 py-3 font-medium">{t('dashboard.home.status', 'Status')}</th>
              <th className="px-3 py-3 font-medium">{t('dashboard.home.chapters', 'Chapters')}</th>
              <th className="px-3 py-3 font-medium">{t('dashboard.home.progress', 'Progress')}</th>
              <th className="px-5 py-3 font-medium text-right">{t('dashboard.home.action', 'Action')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-[hsl(var(--dash-border))]/70">
                  <td colSpan={5} className="px-5 py-4">
                    <div className="dash-shimmer h-4 w-full rounded" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-[hsl(var(--dash-muted))]">
                  {t('dashboard.home.no_courses_yet')}
                </td>
              </tr>
            ) : (
              filtered.slice(0, 8).map((course: any) => {
                const courseId = course.course_uuid?.replace('course_', '')
                const chapters = course.chapters?.length ?? course.chapter_count ?? 0
                const progress = courseCompleteness(course)
                return (
                  <tr
                    key={course.course_uuid}
                    className="border-b border-[hsl(var(--dash-border))]/70 transition-colors last:border-0 hover:bg-[hsl(var(--dash-canvas))]/70"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dash/courses/course/${courseId}/general`}
                        className="font-medium text-[hsl(var(--dash-ink))] transition-colors hover:text-[hsl(var(--dash-accent))]"
                      >
                        {course.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          course.published
                            ? 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]'
                            : 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]'
                        )}
                      >
                        {course.published
                          ? t('dashboard.home.published')
                          : t('dashboard.home.draft')}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-[hsl(var(--dash-muted))]">
                      {chapters || '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                          <div
                            className="h-full rounded-full bg-[hsl(var(--dash-accent))] transition-[width] duration-700 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-[hsl(var(--dash-muted))]">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/dash/courses/course/${courseId}/general`}
                        className="inline-flex rounded-full border border-[hsl(var(--dash-border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--dash-ink))] transition-colors hover:border-[hsl(var(--dash-accent))]/40 hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
                      >
                        {t('dashboard.home.open', 'Open')}
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
