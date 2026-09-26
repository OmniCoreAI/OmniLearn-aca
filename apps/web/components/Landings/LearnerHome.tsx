'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarBlank, CheckCircle, Compass, PlayCircle } from '@phosphor-icons/react'
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
function HeroShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,hsl(0_0%_11%),hsl(0_0%_4%))] px-6 py-8 text-white sm:px-10 sm:py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      />
      <div
        aria-hidden="true"
        className="absolute -end-24 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--dash-accent))] opacity-25 blur-3xl"
      />
      <div aria-hidden="true" className="absolute -bottom-32 start-1/3 h-64 w-64 rounded-full bg-[hsl(351_84%_44%)] opacity-10 blur-3xl" />
      <div className="relative">{children}</div>
    </section>
  )
}

function HeroButton({
  href,
  children,
  variant = 'gold',
}: {
  href: string
  children: React.ReactNode
  variant?: 'gold' | 'ghost'
}) {
  return (
    <Link
      href={href}
      className={
        variant === 'gold'
          ? 'inline-flex items-center gap-2 rounded-full bg-[hsl(43_80%_56%)] px-5 py-2.5 text-sm font-semibold text-[hsl(0_0%_8%)] shadow-[0_8px_24px_-8px_hsl(43_80%_50%/0.6)] transition-transform hover:-translate-y-0.5'
          : 'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10'
      }
    >
      {children}
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
 * Personal home for signed-in learners: welcome banner with stats, the
 * courses they're taking, and what's coming up on their calendar.
 */
export default function LearnerHome({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const user = session?.data?.user
  const { data: trail } = useTrail(org?.id)

  const today = useMemo(() => startOfDay(new Date()), [])
  const horizon = useMemo(() => addDays(today, 30), [today])
  const { data: feed } = useCalendarEvents(today, horizon)

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

  const stats = [
    { label: t('learner.home.in_progress', 'In progress'), value: inProgress.length, icon: PlayCircle },
    { label: t('learner.home.completed', 'Completed'), value: completed, icon: CheckCircle },
    { label: t('learner.home.this_week', 'This week'), value: thisWeek, icon: CalendarBlank },
  ]

  return (
    <div className="space-y-8">
      <HeroShell>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(43_80%_64%)]">{org?.name}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t('learner.home.welcome_back', 'Welcome back, {{name}}', { name: firstName })}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              {inProgress.length > 0
                ? t('learner.home.subtitle_progress', 'Pick up where you left off — you have {{count}} course in progress.', {
                    count: inProgress.length,
                  })
                : t('learner.home.subtitle_start', 'Find a course and start learning today.')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {inProgress[0] ? (
                <HeroButton href={getUriWithOrg(orgslug, `/course/${strip(inProgress[0].course.course_uuid)}`)}>
                  {t('learner.home.continue', 'Continue learning')}
                  <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
                </HeroButton>
              ) : (
                <HeroButton href={getUriWithOrg(orgslug, '/courses')}>
                  {t('learner.home.browse_courses', 'Browse courses')}
                  <ArrowRight size={16} weight="bold" className="rtl:rotate-180" />
                </HeroButton>
              )}
              <HeroButton href={getUriWithOrg(orgslug, '/calendar')} variant="ghost">
                <CalendarBlank size={16} weight="bold" />
                {t('calendar.my_calendar', 'My calendar')}
              </HeroButton>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-[380px]">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Icon size={18} className="text-[hsl(43_80%_64%)]" />
                <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-0.5 truncate text-[11px] text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </HeroShell>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
              {t('learner.home.continue', 'Continue learning')}
            </h2>
            <Link
              href={getUriWithOrg(orgslug, '/trail')}
              className="text-xs font-medium text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
            >
              {t('learner.home.view_progress', 'View progress')}
            </Link>
          </div>
          {inProgress.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] bg-white px-6 py-10 text-center text-sm text-[hsl(var(--dash-muted))]">
              {t('learner.home.no_progress', 'Courses you start will appear here with your progress.')}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {inProgress.slice(0, 4).map((run) => {
                const pct = progressOf(run)
                const thumb = run.course.thumbnail_image
                  ? getCourseThumbnailMediaDirectory(org?.org_uuid, run.course.course_uuid, run.course.thumbnail_image)
                  : null
                return (
                  <Link
                    key={run.course.course_uuid}
                    href={getUriWithOrg(orgslug, `/course/${strip(run.course.course_uuid)}`)}
                    className="group flex items-center gap-4 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_hsl(0_0%_8%/0.25)]"
                  >
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl">
                      <CourseCover name={run.course.name} seed={run.course.course_uuid} src={thumb} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[hsl(var(--dash-ink))]">{run.course.name}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                        <div className="h-full rounded-full bg-[hsl(var(--dash-accent))]" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-[hsl(var(--dash-muted))]">
                        {t('learner.home.lessons_done', '{{done}} of {{total}} lessons · {{pct}}%', {
                          done: run.steps.length,
                          total: run.course_total_steps,
                          pct,
                        })}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
              {t('learner.home.coming_up', 'Coming up')}
            </h2>
            <Link
              href={getUriWithOrg(orgslug, '/calendar')}
              className="text-xs font-medium text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
            >
              {t('calendar.my_calendar', 'My calendar')}
            </Link>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-2">
            {upcoming.length === 0 ? (
              <p className="px-4 py-9 text-center text-sm text-[hsl(var(--dash-muted))]">
                {t('learner.home.nothing_upcoming', 'Nothing scheduled in the next 30 days.')}
              </p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--dash-border))]/50">
                {upcoming.slice(0, 4).map((e) => {
                  const style = EVENT_STYLES[e.type]
                  const start = eventStart(e)
                  return (
                    <li key={e.id}>
                      <Link
                        href={getUriWithOrg(orgslug, '/calendar')}
                        className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          <span className="text-base font-semibold leading-none">{start.getDate()}</span>
                          <span className="mt-0.5 text-[9px] uppercase">
                            {start.toLocaleDateString(i18n.language, { month: 'short' })}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.fg }}>
                            {kindLabel(t, e)}
                          </span>
                          <span className="block truncate text-sm font-medium text-[hsl(var(--dash-ink))]">{e.title}</span>
                          <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
                            {formatTimeRange(e, i18n.language, t)}
                            {e.subtitle ? ` · ${e.subtitle}` : ''}
                          </span>
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
