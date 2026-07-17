'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getOrgCourses } from '@services/courses/courses'
import { Clock, Play } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export default function UpcomingCourseCards() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug

  const { data: coursesData, isLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'upcoming-cards', 3],
    queryFn: () => getOrgCourses(orgslug, null, token, true),
    enabled: !!token && !!orgslug,
    staleTime: 60_000,
  })

  const courses: any[] = (coursesData ?? []).slice(0, 3)

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-[var(--dash-radius)] bg-[hsl(var(--dash-surface))]"
          />
        ))}
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-[var(--dash-radius)] border border-dashed border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-6 py-10 text-center">
        <p className="text-sm text-[hsl(var(--dash-muted))]">
          {t('dashboard.home.no_courses_yet')}
        </p>
        <Link
          href="/dash/courses?new=true"
          className="mt-3 inline-flex text-sm font-medium text-[hsl(var(--dash-accent))] hover:underline"
        >
          {t('dashboard.home.create_your_first_course')}
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {courses.map((course: any, index: number) => {
        const courseId = course.course_uuid?.replace('course_', '')
        const featured = index === 0
        const chapters = course.chapters?.length ?? course.chapter_count ?? 0

        return (
          <div
            key={course.course_uuid}
            className={cn(
              'flex flex-col justify-between rounded-[var(--dash-radius)] p-5 shadow-[0_1px_2px_hsl(220_18%_14%/0.04)]',
              featured
                ? 'bg-[hsl(var(--dash-accent))] text-white'
                : 'border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))]'
            )}
          >
            <div>
              <div className="mb-3 flex items-center gap-3 text-xs">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                    featured ? 'bg-white/15 text-white' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
                  )}
                >
                  <Clock size={12} weight="bold" />
                  {chapters
                    ? `${chapters} ${t('dashboard.home.chapter', 'chapter')}${chapters === 1 ? '' : 's'}`
                    : course.published
                      ? t('dashboard.home.published')
                      : t('dashboard.home.draft')}
                </span>
              </div>
              <h3
                className={cn(
                  'line-clamp-2 text-base font-semibold leading-snug tracking-tight',
                  featured ? 'text-white' : 'text-[hsl(var(--dash-ink))]'
                )}
              >
                {course.name}
              </h3>
              {course.description ? (
                <p
                  className={cn(
                    'mt-2 line-clamp-2 text-xs leading-relaxed',
                    featured ? 'text-white/75' : 'text-[hsl(var(--dash-muted))]'
                  )}
                >
                  {course.description}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold',
                      featured
                        ? 'border-[hsl(var(--dash-accent))] bg-white/20 text-white'
                        : 'border-white bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]'
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                ))}
              </div>
              <Link
                href={`/dash/courses/course/${courseId}/general`}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                  featured
                    ? 'bg-[hsl(var(--dash-warn))] text-white hover:brightness-105'
                    : 'border border-[hsl(var(--dash-accent))]/30 text-[hsl(var(--dash-accent))] hover:bg-[hsl(var(--dash-accent-soft))]'
                )}
              >
                {featured ? (
                  <>
                    <Play size={12} weight="fill" />
                    {t('dashboard.home.open_course', 'Open course')}
                  </>
                ) : (
                  t('dashboard.home.upcoming_course', 'Upcoming')
                )}
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
