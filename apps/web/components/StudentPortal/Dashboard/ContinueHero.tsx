'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpenText, Books, CalendarBlank, Clock, Compass, Fire, Medal, PlayCircle, Sparkle, Trophy } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import OrgLogo from '@components/Dashboard/Shared/OrgLogo'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory, getOrgThumbnailMediaDirectory } from '@services/media/media'
import type { LearnerCourse, LearnerOverview } from '@/hooks/queries/useLearnerOverview'
import { GoldButton, ProgressBar, coursePath, lessonPath, useFormats } from './ui'

/**
 * Welcome banner: the greeting and what the learner has achieved on one side,
 * "pick up where you left off" with the one gold call to action on the other.
 */
export default function ContinueHero({
  orgslug,
  overview,
  resume,
  allDone,
  loading,
}: {
  orgslug: string
  overview: LearnerOverview | undefined
  resume: LearnerCourse | null
  allDone: boolean
  loading: boolean
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const fmt = useFormats()
  const firstName = session?.data?.user?.first_name || session?.data?.user?.username || ''
  const backdrop = org?.thumbnail_image ? getOrgThumbnailMediaDirectory(org.org_uuid, org.thumbnail_image) : null
  const s = overview?.totals
  const libraryOn = org?.config?.config?.resolved_features?.folders?.enabled !== false

  const actions = [
    { key: 'browse', href: '/courses', label: t('student_portal.quick.browse', 'Browse courses'), Icon: Compass },
    { key: 'calendar', href: '/calendar', label: t('student_portal.quick.calendar', 'Calendar'), Icon: CalendarBlank },
    ...(libraryOn ? [{ key: 'library', href: '/library', label: t('student_portal.quick.library', 'Library'), Icon: Books }] : []),
    { key: 'certificates', href: '/certificates', label: t('student_portal.quick.certificates', 'Certificates'), Icon: Medal },
  ]

  return (
    <section
      aria-labelledby="welcome-title"
      className="@container relative isolate overflow-hidden rounded-[1.5rem] bg-[hsl(220_10%_8%)] text-white shadow-[0_24px_50px_-30px_hsl(220_30%_5%/0.8)]"
    >
      {/* Academy imagery: the academy's own picture when it has one, else its emblem over a soft gold glow. */}
      {backdrop ? (
        <img src={backdrop} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
      ) : (
        <>
          <div aria-hidden="true" className="absolute -top-28 start-10 -z-10 h-72 w-72 rounded-full bg-[hsl(43_90%_55%/0.18)] blur-3xl" />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />
          <OrgLogo
            org={org}
            alt=""
            className="pointer-events-none absolute -bottom-12 start-[30%] -z-10 hidden h-52 w-52 opacity-[0.07] grayscale @4xl:block"
            fallbackClassName="bg-transparent text-[9rem] text-white/30"
          />
        </>
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(220_12%_6%/0.25),hsl(220_12%_6%/0.85))] rtl:bg-[linear-gradient(270deg,hsl(220_12%_6%/0.25),hsl(220_12%_6%/0.85))]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.6)] to-transparent" />

      <div className="grid gap-4 p-4 sm:p-5 fit:p-4 @[44rem]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] @[44rem]:items-center @[44rem]:gap-5">
        {/* Greeting */}
        <div className="min-w-0 @[44rem]:ps-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center rounded-full bg-white/[0.07] px-3 py-1 text-[12px] font-semibold text-[hsl(43_85%_72%)] ring-1 ring-inset ring-white/10" suppressHydrationWarning>
              {fmt.date(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {s ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] font-semibold text-white/85 ring-1 ring-inset ring-white/10">
                <Fire size={14} weight="fill" className={s.streak_days > 0 ? 'text-[hsl(28_95%_62%)]' : 'text-white/40'} />
                {t('student_portal.hero.chip_streak', '{{count}}-day streak', { count: s.streak_days })}
              </p>
            ) : null}
          </div>
          <h1 id="welcome-title" className="mt-2.5 text-[1.65rem] font-bold leading-tight tracking-tight sm:text-[1.9rem] fit:mt-2 fit:text-[1.7rem]">
            {t('student_portal.hero.welcome', 'Welcome, {{name}}', { name: firstName })} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-[14px] text-white/65 fit:hidden">
            {resume
              ? t('student_portal.hero.subtitle', 'Let’s continue your learning journey')
              : t('student_portal.hero.subtitle_new', 'Your learning journey starts here')}
          </p>
          {/* Quick actions */}
          <nav aria-label={t('student_portal.quick.title', 'Quick actions')} className="mt-3.5 fit:mt-3">
            <ul className="flex flex-wrap gap-1.5">
              {actions.map(({ key, href, label, Icon }) => (
                <li key={key}>
                  <Link
                    href={getUriWithOrg(orgslug, href)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[12px] font-semibold text-white/90 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.16] hover:text-white"
                  >
                    <Icon size={15} weight="duotone" className="text-[hsl(43_85%_68%)]" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Pick up where you left off */}
        <div className="rounded-[1.25rem] bg-white p-3.5 text-[hsl(var(--dash-ink))] shadow-[0_24px_50px_-24px_hsl(220_30%_4%/0.8)]">
          {loading ? (
            <div className="flex gap-4">
              <div className="dash-shimmer h-20 w-28 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-3 py-1">
                <div className="dash-shimmer h-4 w-1/3 rounded" />
                <div className="dash-shimmer h-5 w-2/3 rounded" />
                <div className="dash-shimmer h-2 w-full rounded-full" />
              </div>
            </div>
          ) : resume ? (
            <ResumeCard orgslug={orgslug} course={resume} />
          ) : (
            <StartCard orgslug={orgslug} allDone={allDone} />
          )}
        </div>
      </div>
    </section>
  )
}

function ResumeCard({ orgslug, course }: { orgslug: string; course: LearnerCourse }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const fmt = useFormats()
  const next = course.next_lesson
  const href = getUriWithOrg(orgslug, next ? lessonPath(course.course_uuid, next.activity_uuid) : coursePath(course.course_uuid))
  const thumb = course.thumbnail_image ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image) : null
  const started = course.completed_lessons > 0

  return (
    <div className="@container">
      <div className="flex items-start gap-3.5">
        <Link
          href={getUriWithOrg(orgslug, coursePath(course.course_uuid))}
          className="group relative hidden h-[58px] w-[80px] shrink-0 overflow-hidden rounded-xl @xs:block"
          aria-label={course.name}
        >
          <CourseCover name={course.name} seed={course.course_uuid} src={thumb} size="xs" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-white transition-all group-hover:bg-black/35">
            <PlayCircle size={24} weight="fill" className="drop-shadow" />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-[hsl(38_80%_36%)]">
            {started ? t('student_portal.hero.resume_label', 'Pick up where you left off') : t('student_portal.hero.start_label', 'Start your course')}
          </p>
          <h2 className="mt-0.5 truncate text-[16px] font-bold leading-snug" dir="auto">
            {course.name}
          </h2>
          <p className="truncate text-[11.5px] font-medium tracking-wide text-[hsl(var(--dash-muted))]">
            {course.code ? <bdi dir="ltr">{course.code}</bdi> : null}
            {course.code && next ? ' · ' : null}
            {next ? (
              <>
                {t('student_portal.hero.next_lesson', 'Next lesson:')} <span className="font-semibold text-[hsl(var(--dash-ink))]" dir="auto">{next.name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 @sm:flex-row @sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <ProgressBar value={course.progress} className="h-2 flex-1" />
            <span className="shrink-0 text-[14px] font-bold tabular-nums">{fmt.number(course.progress)}%</span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[hsl(var(--dash-muted))]">
            <span className="inline-flex items-center gap-1">
              <BookOpenText size={13} />
              {t('student_portal.lessons_of', '{{done}} of {{total}} lessons', {
                done: fmt.number(course.completed_lessons),
                total: fmt.number(course.total_lessons),
              })}
            </span>
            {next ? (
              <span className="inline-flex items-center gap-1" title={t('student_portal.estimated', 'Estimated')}>
                <Clock size={13} />
                {t('student_portal.minutes', '{{count}} min', { count: next.est_minutes })}
              </span>
            ) : null}
          </p>
        </div>
        <GoldButton href={href} className="whitespace-nowrap px-5 py-2.5 text-[14px]">
          {started ? t('student_portal.hero.continue', 'Continue learning') : t('student_portal.hero.start', 'Start learning')}
          <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
        </GoldButton>
      </div>
    </div>
  )
}

function StartCard({ orgslug, allDone }: { orgslug: string; allDone: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <span
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            allDone ? 'bg-[hsl(268_60%_95%)] text-[hsl(268_50%_45%)]' : 'bg-[hsl(43_85%_92%)] text-[hsl(38_80%_36%)]'
          }`}
        >
          {allDone ? <Trophy size={24} weight="duotone" /> : <Sparkle size={24} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">
            {allDone ? t('student_portal.hero.all_done_title', 'You finished all your courses') : t('student_portal.empty.no_courses_title', 'You haven’t started a course yet')}
          </p>
          <p className="mt-0.5 text-[13px] text-[hsl(var(--dash-muted))]">
            {allDone
              ? t('student_portal.hero.all_done_desc', 'Great work! Find your next course and keep going.')
              : t('student_portal.empty.no_courses_desc', 'Discover the available courses and start your learning journey.')}
          </p>
        </div>
      </div>
      <GoldButton href={getUriWithOrg(orgslug, '/courses')} className="self-start px-5 py-2.5 text-[14px]">
        <Compass size={16} weight="bold" />
        {t('student_portal.empty.explore_courses', 'Explore courses')}
      </GoldButton>
    </div>
  )
}
