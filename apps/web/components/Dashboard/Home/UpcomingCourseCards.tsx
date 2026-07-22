'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'
import { useAdminOrgCourses } from '@/hooks/queries/useCourses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { Play, BookOpen } from '@phosphor-icons/react'
import { Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'

export default function UpcomingCourseCards() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgslug = org?.slug

  const { data: coursesData, isLoading } = useAdminOrgCourses(orgslug)

  const courses: any[] = (coursesData ?? []).slice(0, 3)

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="dash-shimmer h-56 rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))]"
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
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course: any) => {
        const courseId = course.course_uuid?.replace('course_', '')
        const chapters = course.chapters?.length ?? course.chapter_count ?? 0
        const thumbnail = course.thumbnail_image
          ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
          : '/empty_thumbnail.png'

        return (
          <StaggerItem key={course.course_uuid}>
            <Link
              href={`/dash/courses/course/${courseId}/general`}
              className="dash-lift group flex h-full flex-col overflow-hidden rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[hsl(var(--dash-accent-soft))]">
                <div
                  role="img"
                  aria-label={course.name || ''}
                  className="h-full w-full bg-cover bg-center transition-transform duration-500 ease-out group-hover:scale-105"
                  style={{ backgroundImage: `url(${thumbnail})` }}
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--dash-ink))]/0 transition-colors duration-300 group-hover:bg-[hsl(var(--dash-ink))]/25">
                  <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/95 text-[hsl(var(--dash-accent))] opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                    <Play size={20} weight="fill" />
                  </span>
                </div>
                {!course.published && (
                  <span className="absolute left-3 top-3 rounded-full bg-[hsl(var(--dash-warn-soft))] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-warn))]">
                    {t('dashboard.home.draft')}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                  <BookOpen size={12} weight="bold" />
                  {chapters
                    ? `${chapters} ${t('dashboard.home.chapter', 'chapter')}${chapters === 1 ? '' : 's'}`
                    : t('dashboard.home.course', 'Course')}
                </p>
                <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-[hsl(var(--dash-ink))] group-hover:text-[hsl(var(--dash-accent))]">
                  {course.name}
                </h3>
                {course.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">
                    {course.description}
                  </p>
                ) : null}
              </div>
            </Link>
          </StaggerItem>
        )
      })}
    </Stagger>
  )
}
