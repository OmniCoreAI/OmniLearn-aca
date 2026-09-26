'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Plus } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'
import { EmptyState, HomeCard } from './HomeCard'
import { HOME_COLORS, HomeUser, useHomeOverview, userAvatarUrl, userDisplayName } from './homeData'

function LearnerStack({ learners, total }: { learners: HomeUser[]; total: number }) {
  const extra = total - learners.length
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {learners.map((u) => {
          const url = userAvatarUrl(u)
          const name = userDisplayName(u)
          return url ? (
            <img
              key={u.user_uuid}
              src={url}
              alt={name}
              title={name}
              className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <span
              key={u.user_uuid}
              title={name}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold uppercase ring-2 ring-white"
              style={{ background: HOME_COLORS.goldSoft, color: HOME_COLORS.goldDeep }}
            >
              {name.slice(0, 2)}
            </span>
          )
        })}
      </div>
      {extra > 0 && <span className="ms-2 text-xs font-medium text-[hsl(var(--dash-ink))]">+{extra}</span>}
    </div>
  )
}

export default function NewCoursesWidget() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const { data, isLoading } = useHomeOverview()
  const courses = data?.recent_courses ?? []

  return (
    <HomeCard
      title={t('dashboard.home.new_courses.title', 'New Courses')}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 fit:min-h-0 fit:flex-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-shimmer h-[250px] rounded-2xl fit:h-auto" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState className="h-[250px] flex-col gap-3">
          <span>{t('dashboard.home.no_courses_yet', 'No courses yet')}</span>
          <Link
            href="/dash/courses?new=true"
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-3.5 py-1.5 text-xs font-medium text-white"
          >
            <Plus size={12} weight="bold" />
            {t('dashboard.home.create_your_first_course', 'Create your first course')}
          </Link>
        </EmptyState>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3 fit:min-h-0 fit:flex-1 fit:gap-3" staggerDelay={0.05}>
          {courses.map((course) => {
            const thumb = course.thumbnail_image
              ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
              : null
            const id = course.course_uuid.replace('course_', '')
            return (
              <StaggerItem key={course.course_uuid} className="fit:min-h-0">
                <Link href={`/dash/courses/course/${id}/general`} className="group flex h-full min-h-0 flex-col">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[hsl(var(--dash-canvas))] fit:aspect-auto fit:min-h-[36px] fit:flex-1 fit:rounded-xl">
                    <CourseCover
                      name={course.name}
                      seed={course.course_uuid}
                      src={thumb}
                      size="sm"
                      className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute start-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-[hsl(var(--dash-ink))] backdrop-blur">
                      {course.published
                        ? t('dashboard.home.published', 'Published')
                        : t('dashboard.home.draft', 'Draft')}
                    </span>
                  </div>
                  <h3 title={course.name} className="mt-3 shrink-0 line-clamp-2 min-h-[2.5rem] fit:mt-2 fit:line-clamp-1 fit:min-h-0 text-sm font-medium leading-5 text-[hsl(var(--dash-ink))] group-hover:underline">
                    {course.name}
                  </h3>
                  <p className="mt-1 shrink-0 truncate text-[11px] text-[hsl(var(--dash-muted))] fit:mt-0">
                    {t('dashboard.home.new_courses.lessons', '{{count}} lessons', { count: course.lessons })}
                    <span className="fit:hidden">
                      <span className="mx-1.5">•</span>
                      {t('dashboard.home.new_courses.completed', '{{count}} completed', { count: course.completions })}
                    </span>
                    <span className="hidden fit:inline">
                      <span className="mx-1.5">•</span>
                      <span className="font-semibold" style={{ color: HOME_COLORS.goldDeep }}>{course.enrollments}</span>{' '}
                      {t('dashboard.home.new_courses.enrolled', 'enrolled')}
                    </span>
                  </p>
                  <div className="mt-3 flex min-h-7 shrink-0 items-center justify-between gap-2 fit:hidden">
                    {course.enrollments > 0 ? (
                      <LearnerStack learners={course.learners ?? []} total={course.enrollments} />
                    ) : (
                      <span className="text-[11px] text-[hsl(var(--dash-muted))]">
                        {t('dashboard.home.new_courses.no_learners', 'No learners yet')}
                      </span>
                    )}
                    <span className="text-base font-semibold" style={{ color: HOME_COLORS.goldDeep }}>
                      {course.enrollments}
                      <span className="ms-1 text-[10px] font-medium text-[hsl(var(--dash-muted))]">
                        {t('dashboard.home.new_courses.enrolled', 'enrolled')}
                      </span>
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </HomeCard>
  )
}
