'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpenText, CheckCircle, Image as ImageIcon, Play, Stack, Video } from '@phosphor-icons/react'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import CourseShare from '@components/Objects/Courses/CourseShare/CourseShare'
import UserAvatar from '@components/Objects/UserAvatar'
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media'
import { GoldButton, Pill, ProgressBar, useFormats } from '@components/StudentPortal/Dashboard/ui'
import { cn } from '@/lib/utils'
import type { CourseOutline } from './useCourseOutline'

const authorName = (u: any) => (u?.first_name || u?.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u?.username ?? '')

/** The course cover: uploaded image or video (with a switch when both exist), else the generated cover. */
function CourseMedia({ course, org }: { course: any; org: any }) {
  const { t } = useTranslation()
  const [active, setActive] = useState<'image' | 'video'>('image')
  const imageSrc = course.thumbnail_image ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image) : null
  const videoSrc = course.thumbnail_video ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_video) : null
  const both = course.thumbnail_type === 'both' && !!imageSrc && !!videoSrc
  const showVideo = !!videoSrc && (course.thumbnail_type === 'video' || (both && active === 'video'))

  return (
    <div className="relative h-full min-h-[200px] w-full overflow-hidden rounded-2xl bg-[hsl(220_14%_92%)] ring-1 ring-inset ring-black/5">
      {showVideo ? (
        <video src={videoSrc!} className="absolute inset-0 h-full w-full bg-black object-contain" controls autoPlay muted preload="metadata" playsInline />
      ) : (
        <>
          {/* Falls back to the generated cover if the image fails to load. */}
          <CourseCover name={course.name} seed={course.course_uuid} size="lg" src={imageSrc} className="absolute inset-0" />
          {imageSrc ? (
            // Hidden img with fetchpriority="high" so the browser fetches this LCP image immediately.
            <img src={imageSrc} alt="" aria-hidden="true" fetchPriority="high" className="pointer-events-none absolute h-0 w-0 opacity-0" />
          ) : null}
        </>
      )}
      {both ? (
        <div className="absolute end-3 top-3 z-10 flex gap-1 rounded-full bg-black/35 p-1 backdrop-blur-sm">
          {(['image', 'video'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setActive(kind)}
              aria-pressed={active === kind}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                active === kind ? 'bg-white text-[hsl(var(--dash-ink))]' : 'text-white/85 hover:bg-white/15 hover:text-white'
              )}
            >
              {kind === 'image' ? <ImageIcon size={12} weight="bold" /> : <Video size={12} weight="bold" />}
              {kind === 'image' ? t('courses.image') : t('activities.video')}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function CourseHero({
  course,
  org,
  outline,
  shareUrl,
  signedIn,
  isStarted,
  hasOffers,
  isActionLoading,
  onStart,
}: {
  course: any
  org: any
  outline: CourseOutline
  shareUrl: string
  signedIn: boolean
  isStarted: boolean
  hasOffers: boolean
  isActionLoading: boolean
  onStart: () => void
}) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const authors = (course.authors ?? []).filter((a: any) => a.authorship_status === 'ACTIVE')
  const description = (course.description ?? '').trim()

  const status = !signedIn
    ? null
    : outline.isComplete
      ? { tone: 'green' as const, label: t('course_page.status_completed', 'Completed') }
      : isStarted
        ? { tone: 'blue' as const, label: t('course_page.status_in_progress', 'In progress') }
        : { tone: 'neutral' as const, label: t('course_page.status_not_started', 'Not started') }

  let cta: React.ReactNode = null
  if (outline.total > 0) {
    if (isStarted && outline.next) {
      cta = (
        <GoldButton href={outline.next.href}>
          <Play size={16} weight="fill" />
          {outline.done > 0 ? t('course_page.continue', 'Continue learning') : t('course_page.start_first', 'Start the first lesson')}
        </GoldButton>
      )
    } else if (isStarted && outline.firstOpen) {
      cta = (
        <GoldButton href={outline.firstOpen.href}>
          <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
          {t('course_page.review', 'Review the course')}
        </GoldButton>
      )
    } else if (!isStarted && hasOffers) {
      cta = (
        <a
          href="#course-actions"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--dash-ink))] px-6 py-3 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
        >
          {t('course_page.see_options', 'See enrollment options')}
        </a>
      )
    } else if (!isStarted) {
      cta = (
        <button
          type="button"
          onClick={onStart}
          disabled={isActionLoading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(43_90%_62%),hsl(39_82%_47%))] px-6 py-3 text-[15px] font-bold text-[hsl(220_10%_8%)] shadow-[0_12px_28px_-12px_hsl(43_85%_45%/0.85),inset_0_1px_0_hsl(0_0%_100%/0.35)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43_85%_50%)] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:opacity-70"
        >
          {isActionLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Play size={16} weight="fill" />
          )}
          {t('course_page.start', 'Start course')}
        </button>
      )
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[hsl(var(--dash-border))]/80 bg-white p-3 shadow-[0_1px_2px_hsl(220_30%_10%/0.04),0_18px_40px_-26px_hsl(220_30%_10%/0.22)] sm:p-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] lg:gap-7">
        {/* Cover: first on phones, at the reading end on wide screens. */}
        <div className="aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[300px]">
          <CourseMedia course={course} org={org} />
        </div>

        <div className="flex min-w-0 flex-col px-2 pb-2 sm:px-3 lg:py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="gold">
              <BookOpenText size={12} weight="bold" />
              {t('course_page.badge', 'Course')}
            </Pill>
            {status ? <Pill tone={status.tone}>{status.label}</Pill> : null}
          </div>

          <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-[hsl(var(--dash-ink))] sm:text-[30px]" dir="auto">
            {course.name}
          </h1>
          {description ? (
            <p className="mt-2 line-clamp-3 max-w-2xl text-[14.5px] leading-relaxed text-[hsl(var(--dash-muted))]" dir="auto">
              {description}
            </p>
          ) : null}

          <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[hsl(var(--dash-ink))]/75">
            <li className="inline-flex items-center gap-1.5">
              <Stack size={16} className="text-[hsl(var(--dash-muted))]" />
              {t('course_page.chapters_count', '{{count}} chapters', { count: outline.chapters.length })}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <BookOpenText size={16} className="text-[hsl(var(--dash-muted))]" />
              {t('course_page.lessons_count', '{{count}} lessons', { count: outline.total })}
            </li>
            {authors.length ? (
              <li className="inline-flex min-w-0 items-center gap-2">
                <span className="flex -space-x-2 rtl:space-x-reverse">
                  {authors.slice(0, 3).map((a: any) => (
                    <span key={a.user.user_uuid} className="rounded-full ring-2 ring-white">
                      <UserAvatar
                        width={24}
                        rounded="rounded-full"
                        avatar_url={a.user.avatar_image ? getUserAvatarMediaDirectory(a.user.user_uuid, a.user.avatar_image) : ''}
                        predefined_avatar={a.user.avatar_image ? undefined : 'empty'}
                      />
                    </span>
                  ))}
                </span>
                <span className="truncate">
                  {authors.length > 2
                    ? t('course_page.by_many', 'By {{name}} and {{count}} more', { name: authorName(authors[0].user), count: authors.length - 1 })
                    : t('course_page.by', 'By {{names}}', { names: authors.map((a: any) => authorName(a.user)).join(t('course_page.and', ' & ')) })}
                </span>
              </li>
            ) : null}
          </ul>

          {signedIn && isStarted && outline.total > 0 ? (
            <div className="mt-5 max-w-xl rounded-2xl bg-[hsl(var(--dash-canvas))] px-4 py-3 lg:hidden">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-semibold text-[hsl(var(--dash-ink))]">{t('course_page.your_progress', 'Your progress')}</span>
                <span className="font-bold tabular-nums text-[hsl(var(--dash-ink))]">{fmt.number(outline.pct)}%</span>
              </div>
              <ProgressBar value={outline.pct} tone={outline.isComplete ? 'green' : 'gold'} className="mt-2" />
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[hsl(var(--dash-muted))]">
                {outline.isComplete ? <CheckCircle size={14} weight="fill" className="text-[hsl(152_55%_40%)]" /> : null}
                {outline.isComplete
                  ? t('course_page.completed_all', 'You have completed every lesson in this course.')
                  : t('course_page.lessons_done', '{{done}} of {{total}} lessons completed', { done: fmt.number(outline.done), total: fmt.number(outline.total) })}
              </p>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
            {cta}
            <CourseShare courseName={course.name} courseUrl={shareUrl} className="py-3" />
          </div>
          {isStarted && outline.next ? (
            <Link
              href={outline.next.href}
              className="mt-3 inline-flex max-w-full items-center gap-1.5 self-start text-[12.5px] text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
            >
              <span className="shrink-0">{t('course_page.next_up', 'Next up')}:</span>
              <span className="truncate font-semibold text-[hsl(var(--dash-ink))]/85" dir="auto">
                {outline.next.activity.name}
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
