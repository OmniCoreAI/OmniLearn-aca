'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BookOpen, CalendarBlank, CheckCircle, Compass, PlayCircle, Sparkle } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTrail } from '@/hooks/queries/useTrail'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import CourseCover from '@components/Objects/Thumbnails/CourseCover'
import {
  EVENT_STYLES,
  addDays,
  eventStart,
  formatTimeRange,
  kindLabel,
  startOfDay,
  useCalendarEvents,
} from '@components/Calendar/calendarUtils'

type Run = {
  course: { course_uuid: string; name: string; thumbnail_image?: string }
  course_total_steps: number
  steps: unknown[]
}

const progressOf = (run: Run) =>
  run.course_total_steps > 0 ? Math.min(100, Math.round((run.steps.length / run.course_total_steps) * 100)) : 0

const strip = (uuid: string) => uuid.replace('course_', '')

/** Dark, gold-accented banner. Signed-in learners get their name and stats. */
function HeroShell({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <section className={`relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,hsl(0_0%_12%),hsl(0_0%_5%))] text-white ${padded ? 'px-6 py-8 sm:px-10 sm:py-10' : ''}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.5)] to-transparent" />
      <div className="relative">{children}</div>
    </section>
  )
}

function HeroButton({
  href,
  children,
  variant = 'gold',
  className = '',
}: {
  href: string
  children: React.ReactNode
  variant?: 'gold' | 'ghost'
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`${
        variant === 'gold'
          ? 'bg-[hsl(43_80%_56%)] text-[hsl(0_0%_8%)] shadow-[0_8px_24px_-10px_hsl(43_80%_50%/0.7)] hover:-translate-y-0.5 hover:bg-[hsl(43_85%_60%)]'
          : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]'
      } inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${className}`}
    >
      {children}
    </Link>
  )
}

function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
        {title}
        {count ? (
          <span className="rounded-full bg-[hsl(var(--dash-ink))]/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">{count}</span>
        ) : null}
      </h2>
      {action}
    </div>
  )
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[hsl(var(--dash-muted))] transition-colors hover:bg-white hover:text-[hsl(var(--dash-ink))]"
    >
      {children}
      <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
    </Link>
  )
}

export function GuestHero({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  return (
    <HeroShell>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(43_80%_64%)]">
        {t('learner.home.official_portal', 'Official learning portal')}
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        {t('learner.home.welcome_to', 'Welcome to {{org}}', { org: org?.name ?? '' })}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
        {org?.description || t('learner.home.guest_subtitle', 'Explore our courses and programs, and track your progress in one place.')}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <HeroButton href={getUriWithOrg(orgslug, '/login')}>
          {t('auth.login', 'Log in')}
          <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
        </HeroButton>
        <HeroButton href={getUriWithOrg(orgslug, '/courses')} variant="ghost">
          <Compass size={16} weight="bold" />
          {t('learner.home.browse_courses', 'Browse courses')}
        </HeroButton>
      </div>
    </HeroShell>
  )
}

/**
 * Personal home for signed-in learners: welcome banner with stats and the
 * course to resume, the courses they're taking, and what's coming up.
 */
export default function LearnerHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const user = session?.data?.user
  const { data: trail, isLoading: trailLoading } = useTrail(org?.id)

  const today = useMemo(() => startOfDay(new Date()), [])
  const horizon = useMemo(() => addDays(today, 30), [today])
  const { data: feed, isLoading: feedLoading } = useCalendarEvents(today, horizon)

  const runs: Run[] = useMemo(() => trail?.runs ?? [], [trail])
  const inProgress = runs.filter((r) => progressOf(r) < 100)
  const completed = runs.length - inProgress.length
  const upcoming = useMemo(
    () => (feed?.events ?? []).filter((e) => eventStart(e) >= new Date() || (e.end && new Date(e.end) >= today)),
    [feed, today]
  )
  const weekEnd = addDays(today, 7)
  const thisWeek = upcoming.filter((e) => eventStart(e) < weekEnd).length
  const firstName = user?.first_name || user?.username || ''
  const resume = inProgress[0]
  const nextEvent = upcoming[0]

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 5 || hour >= 18
      ? t('learner.home.greeting_evening', 'Good evening, {{name}}', { name: firstName })
      : hour < 12
        ? t('learner.home.greeting_morning', 'Good morning, {{name}}', { name: firstName })
        : t('learner.home.greeting_afternoon', 'Good afternoon, {{name}}', { name: firstName })
  const dateLabel = now.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  // "Today", "tomorrow", "in 3 days" in the UI language.
  const relative = useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
    return (d: Date) => {
      // Events that started earlier but are still running count as today.
      const days = Math.max(0, Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000))
      const text = rtf.format(days, 'day')
      return text.charAt(0).toLocaleUpperCase(i18n.language) + text.slice(1)
    }
  }, [i18n.language, today])

  const thumbOf = (run: Run) =>
    run.course.thumbnail_image ? getCourseThumbnailMediaDirectory(org?.org_uuid, run.course.course_uuid, run.course.thumbnail_image) : null
  const lessonsLine = (run: Run) =>
    run.course_total_steps === 0
      ? t('learner.home.no_lessons_yet', 'No lessons yet')
      : run.steps.length === 0
        ? t('learner.home.not_started', 'Not started · {{total}} lessons', { total: run.course_total_steps, count: run.course_total_steps })
        : t('learner.home.lessons_of', '{{done}} of {{total}} lessons', { done: run.steps.length, total: run.course_total_steps, count: run.course_total_steps })

  const stats = [
    { label: t('learner.home.in_progress', 'In progress'), value: inProgress.length, icon: PlayCircle },
    { label: t('learner.home.completed', 'Completed'), value: completed, icon: CheckCircle },
    { label: t('learner.home.this_week', 'This week'), value: thisWeek, icon: CalendarBlank },
  ]

  return (
    <div className="space-y-8">
      <HeroShell padded={false}>
        <div className="grid gap-6 px-6 pt-7 sm:px-9 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(43_80%_64%)]" suppressHydrationWarning>
              {org?.name}
              <span className="text-white/25">·</span>
              <span className="normal-case tracking-normal text-white/60">{dateLabel}</span>
            </p>
            <h1 className="mt-2.5 text-3xl font-semibold tracking-tight sm:text-[2.25rem] sm:leading-[1.15]" suppressHydrationWarning>
              {greeting}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
              {inProgress.length > 0
                ? t('learner.home.subtitle_progress', 'Pick up where you left off — you have {{count}} course in progress.', {
                    count: inProgress.length,
                  })
                : t('learner.home.subtitle_start', 'Find a course and start learning today.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {resume ? (
                <HeroButton href={getUriWithOrg(orgslug, `/course/${strip(resume.course.course_uuid)}`)}>
                  {t('learner.home.continue', 'Continue learning')}
                  <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
                </HeroButton>
              ) : (
                <HeroButton href={getUriWithOrg(orgslug, '/courses')}>
                  {t('learner.home.browse_courses', 'Browse courses')}
                  <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
                </HeroButton>
              )}
              {resume ? (
                <HeroButton href={getUriWithOrg(orgslug, '/courses')} variant="ghost">
                  <Compass size={16} weight="bold" />
                  {t('learner.home.browse_courses', 'Browse courses')}
                </HeroButton>
              ) : (
                <HeroButton href={getUriWithOrg(orgslug, '/calendar')} variant="ghost">
                  <CalendarBlank size={16} weight="bold" />
                  {t('calendar.my_calendar', 'My calendar')}
                </HeroButton>
              )}
            </div>
          </div>

          {/* Resume card: the course to pick up, else a nudge to explore. */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur">
            {resume ? (
              <div className="flex gap-4">
                <Link
                  href={getUriWithOrg(orgslug, `/course/${strip(resume.course.course_uuid)}`)}
                  className="group relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:w-36"
                >
                  <CourseCover name={resume.course.name} seed={resume.course.course_uuid} src={thumbOf(resume)} size="sm" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                    <PlayCircle size={30} weight="fill" />
                  </span>
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{t('learner.home.resume_title', 'Pick up where you left off')}</p>
                  <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">{resume.course.name}</p>
                  <div className="mt-auto pt-2">
                    {resume.course_total_steps > 0 ? (
                      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[hsl(43_80%_56%)] transition-[width] duration-700" style={{ width: `${progressOf(resume)}%` }} />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-white/55">
                      <span className="truncate">{lessonsLine(resume)}</span>
                      {resume.course_total_steps > 0 ? <span className="font-semibold tabular-nums text-white">{progressOf(resume)}%</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-[hsl(43_80%_64%)]">
                  <Sparkle size={24} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t('learner.home.start_title', 'Start something new')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/55">{t('learner.home.start_desc', 'Browse the catalog and enroll in a course — your progress will show up here.')}</p>
                </div>
              </div>
            )}
            <HeroButton
              href={resume ? getUriWithOrg(orgslug, `/course/${strip(resume.course.course_uuid)}`) : getUriWithOrg(orgslug, '/courses')}
              className="mt-3.5 w-full py-2"
            >
              {resume ? <PlayCircle size={16} weight="fill" /> : <Compass size={16} weight="bold" />}
              {resume ? t('learner.home.resume', 'Resume') : t('learner.home.browse_courses', 'Browse courses')}
            </HeroButton>
          </div>
        </div>

        {/* Stats strip */}
        <dl className="mt-7 grid grid-cols-2 border-t border-white/10 bg-white/[0.02] sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 px-6 py-4 sm:px-9 ${i > 0 ? 'sm:border-s sm:border-white/10' : ''} ${i % 2 === 1 ? 'border-s border-white/10 sm:border-s' : ''} ${i < 2 ? 'max-sm:border-b max-sm:border-white/10' : ''}`}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[hsl(43_80%_64%)] ring-1 ring-inset ring-white/10">
                <Icon size={18} weight="duotone" />
              </span>
              <div className="min-w-0">
                <dd className="text-xl font-semibold leading-none tabular-nums">{trailLoading ? '–' : value}</dd>
                <dt className="mt-1 truncate text-[11px] text-white/55">{label}</dt>
              </div>
            </div>
          ))}
          <Link
            href={getUriWithOrg(orgslug, '/calendar')}
            className="group flex min-w-0 items-center gap-3 border-s border-white/10 px-6 py-4 transition-colors hover:bg-white/[0.04] sm:px-9"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(43_80%_56%)] text-[hsl(0_0%_8%)]">
              <CalendarBlank size={18} weight="bold" />
            </span>
            <div className="min-w-0">
              <dd className="truncate text-sm font-semibold leading-tight">{nextEvent ? nextEvent.title : t('learner.home.all_clear', 'All clear')}</dd>
              <dt className="mt-1 truncate text-[11px] text-white/55" suppressHydrationWarning>
                {nextEvent
                  ? `${relative(eventStart(nextEvent))} · ${formatTimeRange(nextEvent, i18n.language, t)}`
                  : t('learner.home.nothing_upcoming', 'Nothing scheduled in the next 30 days.')}
              </dt>
            </div>
            <ArrowRight size={14} weight="bold" className="ms-auto shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </dl>
      </HeroShell>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <SectionHeader
            title={t('learner.home.continue', 'Continue learning')}
            count={inProgress.length}
            action={<SectionLink href={getUriWithOrg(orgslug, '/trail')}>{t('learner.home.view_progress', 'View progress')}</SectionLink>}
          />
          {trailLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-[98px] animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          ) : inProgress.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-[hsl(var(--dash-border))] bg-white px-6 py-10 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                <BookOpen size={20} weight="duotone" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('learner.home.no_progress_title', 'Nothing in progress')}</p>
              <p className="mt-1 max-w-xs text-xs text-[hsl(var(--dash-muted))]">{t('learner.home.no_progress', 'Courses you start will appear here with your progress.')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {inProgress.slice(0, 4).map((run) => {
                const pct = progressOf(run)
                const hasLessons = run.course_total_steps > 0
                return (
                  <Link
                    key={run.course.course_uuid}
                    href={getUriWithOrg(orgslug, `/course/${strip(run.course.course_uuid)}`)}
                    className="group flex gap-3.5 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--dash-border))] hover:shadow-[0_14px_30px_-16px_hsl(0_0%_8%/0.3)]"
                  >
                    <div className="relative h-[72px] w-[104px] shrink-0 overflow-hidden rounded-xl">
                      <CourseCover name={run.course.name} seed={run.course.course_uuid} src={thumbOf(run)} size="sm" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                        <PlayCircle size={26} weight="fill" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-[hsl(var(--dash-ink))]">{run.course.name}</p>
                      <div>
                        {hasLessons ? (
                          <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                            <div className="h-full rounded-full bg-[hsl(var(--dash-accent))] transition-[width] duration-700" style={{ width: `${pct}%` }} />
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-[hsl(var(--dash-muted))]">{lessonsLine(run)}</span>
                          {hasLessons ? <span className="font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{pct}%</span> : null}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            title={t('learner.home.coming_up', 'Coming up')}
            count={upcoming.length}
            action={<SectionLink href={getUriWithOrg(orgslug, '/calendar')}>{t('calendar.my_calendar', 'My calendar')}</SectionLink>}
          />
          <div className="rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-2">
            {feedLoading ? (
              <div className="space-y-2 p-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-[hsl(var(--dash-canvas))]" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                  <CalendarBlank size={20} weight="duotone" />
                </span>
                <p className="mt-3 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('learner.home.all_clear', 'All clear')}</p>
                <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">{t('learner.home.nothing_upcoming', 'Nothing scheduled in the next 30 days.')}</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {upcoming.slice(0, 5).map((e) => {
                  const style = EVENT_STYLES[e.type]
                  const start = eventStart(e)
                  const isToday = startOfDay(start).getTime() <= today.getTime()
                  return (
                    <li key={e.id}>
                      <Link
                        href={getUriWithOrg(orgslug, '/calendar')}
                        className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                      >
                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl" style={{ background: style.bg, color: style.fg }}>
                          <span className="text-base font-semibold leading-none">{start.getDate()}</span>
                          <span className="mt-0.5 text-[9px] font-semibold uppercase">{start.toLocaleDateString(i18n.language, { month: 'short' })}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[hsl(var(--dash-ink))]">{e.title}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[hsl(var(--dash-muted))]">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: style.fg }} />
                            <span className="truncate">
                              {kindLabel(t, e)} · {formatTimeRange(e, i18n.language, t)}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isToday ? 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
                          }`}
                          suppressHydrationWarning
                        >
                          {relative(start)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
