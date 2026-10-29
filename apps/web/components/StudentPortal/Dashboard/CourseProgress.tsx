'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpenText, CheckCircle, Compass, Play } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import type { LearnerCourse } from '@/hooks/queries/useLearnerOverview'
import { cn } from '@/lib/utils'
import { EmptyState, GoldButton, Panel, PanelHeader, Pill, ProgressBar, ViewAll, coursePath, lessonPath, useFormats } from './ui'

/** Every course the learner is enrolled in: progress, last activity and a way back in. */
export default function CourseProgress({
  orgslug,
  courses,
  nextUuid,
  loading,
}: {
  orgslug: string
  courses: LearnerCourse[] | undefined
  /** The course that needs the learner's next action (highlighted). */
  nextUuid: string | null
  loading: boolean
}) {
  const { t } = useTranslation()
  const list = courses ?? []

  return (
    <Panel aria-labelledby="courses-title" className="flex flex-col p-4 fit:h-full fit:min-h-0 fit:overflow-hidden">
      <PanelHeader
        id="courses-title"
        title={t('student_portal.courses.title', 'My course progress')}
        subtitle={list.length ? t('student_portal.courses.count', '{{count}} enrolled courses', { count: list.length }) : undefined}
        icon={<BookOpenText size={18} weight="duotone" />}
        action={list.length ? <ViewAll href={getUriWithOrg(orgslug, '/trail')} /> : null}
      />

      {loading ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-shimmer h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="my-auto"
          icon={<BookOpenText size={22} weight="duotone" />}
          title={t('student_portal.empty.no_courses_title', 'You haven’t started a course yet')}
          description={t('student_portal.empty.no_courses_desc', 'Discover the available courses and start your learning journey.')}
          action={
            <GoldButton href={getUriWithOrg(orgslug, '/courses')} className="px-5 py-2.5 text-sm">
              <Compass size={16} weight="bold" />
              {t('student_portal.empty.explore_courses', 'Explore courses')}
            </GoldButton>
          }
        />
      ) : (
        <ul className="-mx-1 mt-3 space-y-2 px-1 fit:min-h-0 fit:flex-1 fit:overflow-y-auto [scrollbar-width:thin]">
          {list.map((course) => (
            <CourseRow key={course.course_uuid} orgslug={orgslug} course={course} highlighted={course.course_uuid === nextUuid} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function CourseRow({ orgslug, course, highlighted }: { orgslug: string; course: LearnerCourse; highlighted: boolean }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const fmt = useFormats()
  const thumb = course.thumbnail_image ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image) : null
  const href = getUriWithOrg(
    orgslug,
    course.next_lesson ? lessonPath(course.course_uuid, course.next_lesson.activity_uuid) : coursePath(course.course_uuid)
  )
  const notStarted = course.completed_lessons === 0 && !course.completed
  const action = course.completed
    ? t('student_portal.courses.review', 'Review')
    : notStarted
      ? t('student_portal.courses.start', 'Start')
      : t('student_portal.courses.continue', 'Continue')

  return (
    <li
      className={cn(
        'group flex items-center gap-3 rounded-2xl border p-2.5 transition-colors',
        highlighted
          ? 'border-[hsl(43_80%_58%)] shadow-[0_0_0_3px_hsl(43_90%_55%/0.13)]'
          : 'border-[hsl(var(--dash-border))]/80 hover:border-[hsl(var(--dash-border))] hover:bg-[hsl(var(--dash-canvas))]/50'
      )}
    >
      <Link href={getUriWithOrg(orgslug, coursePath(course.course_uuid))} tabIndex={-1} aria-hidden="true" className="relative h-[52px] w-[68px] shrink-0 overflow-hidden rounded-xl">
        <CourseCover name={course.name} seed={course.course_uuid} src={thumb} size="xs" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link href={getUriWithOrg(orgslug, coursePath(course.course_uuid))} className="truncate text-[13.5px] font-bold text-[hsl(var(--dash-ink))] hover:underline" dir="auto">
            {course.name}
          </Link>
          {course.completed ? (
            <Pill tone="green" className="px-1.5 text-[10px]">
              <CheckCircle size={10} weight="fill" />
              {t('student_portal.courses.completed', 'Completed')}
            </Pill>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[hsl(var(--dash-muted))]" suppressHydrationWarning>
          {course.code ? (
            <>
              <bdi dir="ltr" className="font-medium tracking-wide">{course.code}</bdi>
              {' · '}
            </>
          ) : null}
          {course.total_lessons === 0
            ? t('student_portal.courses.no_lessons', 'No lessons published yet')
            : t('student_portal.lessons_fraction', '{{done}} / {{total}} lessons', {
                done: fmt.number(course.completed_lessons),
                total: fmt.number(course.total_lessons),
              })}
          {' · '}
          {fmt.ago(course.last_activity_at ?? course.started_at)}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={course.progress} tone={course.completed ? 'green' : 'gold'} className="h-1.5 flex-1" />
          <span className="w-9 shrink-0 text-end text-[12px] font-bold tabular-nums text-[hsl(var(--dash-ink))]">{fmt.number(course.progress)}%</span>
        </div>
      </div>
      <Link
        href={href}
        aria-label={`${action}: ${course.name}`}
        title={action}
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
          highlighted
            ? 'bg-[linear-gradient(135deg,hsl(43_90%_60%),hsl(39_82%_47%))] text-[hsl(220_10%_8%)] shadow-[0_6px_14px_-6px_hsl(43_85%_45%/0.9)]'
            : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))] group-hover:bg-[hsl(220_10%_10%)] group-hover:text-white'
        )}
      >
        {course.completed ? <ArrowRight size={15} weight="bold" className="rtl:rotate-180" /> : <Play size={14} weight="fill" />}
      </Link>
    </li>
  )
}
