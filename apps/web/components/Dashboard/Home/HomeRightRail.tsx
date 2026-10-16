'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  ArrowUpRight,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  PlusSquare,
  UserPlus,
  UserSwitch,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { cn } from '@/lib/utils'
import { GlassCalendar, type GlassCalendarRange } from '@/components/ui/glass-calendar'
import { HOME_COLORS, HomeActivity, parseTimestamp, useHomeOverview, userDisplayName } from './homeData'
import type { CalendarEvent } from '@services/calendar/calendar'
import {
  EVENT_STYLES,
  addDays,
  dayKey,
  eventHref,
  eventStart,
  eventsByDay,
  formatTimeRange,
  kindLabel,
  monthGrid,
  sameDay,
  startOfDay,
  useCalendarEvents,
} from '@components/Calendar/calendarUtils'

/* ------------------------------------------------------------------ helpers */

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "2 hours ago" / "in 3 days" in the UI language. */
function relativeTime(date: Date, locale: string) {
  const seconds = (date.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--dash-muted))]">{children}</h3>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------------- calendar */

/** Event dot colours, lifted where the light-theme colour vanishes on the dark glass. */
const GLASS_DOT: Partial<Record<CalendarEvent['type'], string>> = { exam: 'hsl(0 0% 88%)', term: 'hsl(220 14% 72%)' }

function GlassMonthCalendar({
  selected,
  onSelect,
  onRange,
  range,
  byDay,
}: {
  selected: Date
  onSelect: (_day: Date) => void
  onRange: (_range: GlassCalendarRange) => void
  range: GlassCalendarRange | null
  byDay: Map<string, CalendarEvent[]>
}) {
  const { t, i18n } = useTranslation()
  const today = startOfDay(new Date())
  const rangeEvents = useMemo(() => {
    if (!range) return 0
    const ids = new Set<string>()
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      for (const e of byDay.get(dayKey(d)) ?? []) ids.add(e.id)
    }
    return ids.size
  }, [range, byDay])
  const showingToday = sameDay(selected, today) && !!range && range.start <= today && today <= range.end

  return (
    // The glass needs something to blur: a dark backdrop with the brand's gold,
    // red and orange glowing in it, showing around and through a frosted panel.
    <div className="relative isolate shrink-0 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(150deg,hsl(0_0%_16%),hsl(0_0%_5%))] p-2">
      <span aria-hidden="true" className="absolute -end-12 -top-14 -z-10 h-52 w-52 rounded-full bg-[hsl(43_90%_55%)] opacity-80 blur-2xl" />
      <span aria-hidden="true" className="absolute -bottom-16 -start-12 -z-10 h-56 w-56 rounded-full bg-[hsl(351_85%_52%)] opacity-70 blur-2xl" />
      <span aria-hidden="true" className="absolute start-[30%] top-[38%] -z-10 h-32 w-32 rounded-full bg-[hsl(24_90%_55%)] opacity-60 blur-2xl" />
      <span aria-hidden="true" className="absolute end-[12%] bottom-[18%] -z-10 h-20 w-20 rounded-full bg-[hsl(330_80%_60%)] opacity-50 blur-xl" />
      <GlassCalendar
        expanded
        defaultView="month"
        className={cn(
          'max-w-none rounded-[1.4rem] [--glass-pad:1.25rem] fit:[--glass-pad:1rem]',
          // Frosted panel: light sheen, strong blur, bright edge.
          'border-white/25 bg-transparent bg-[linear-gradient(155deg,rgba(255,255,255,0.22),rgba(255,255,255,0.07)_42%,rgba(255,255,255,0.03))] backdrop-blur-2xl backdrop-saturate-150',
          'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-1px_0_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.8)]'
        )}
        selectedDate={selected}
        onDateSelect={onSelect}
        onRangeChange={onRange}
        locale={i18n.language}
        labels={{
          weekly: t('dashboard.home.rail.weekly', 'Weekly'),
          monthly: t('dashboard.home.rail.monthly', 'Monthly'),
          previousWeek: t('dashboard.home.rail.previous_week', 'Previous week'),
          nextWeek: t('dashboard.home.rail.next_week', 'Next week'),
          previousMonth: t('dashboard.home.rail.previous_month', 'Previous month'),
          nextMonth: t('dashboard.home.rail.next_month', 'Next month'),
        }}
        dayMarkers={(day) =>
          [...new Set((byDay.get(dayKey(day)) ?? []).map((e) => e.type))].map((type) => GLASS_DOT[type] ?? EVENT_STYLES[type].dot)
        }
        headerAction={
          showingToday ? null : (
            <button
              type="button"
              onClick={() => onSelect(new Date(today))}
              className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/25"
            >
              {t('dashboard.home.rail.today', 'Today')}
            </button>
          )
        }
        footer={
          <>
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-white/70">
              <CalendarBlank size={16} weight="duotone" className="shrink-0" />
              <span className="truncate">
                {range?.view === 'month'
                  ? t('dashboard.home.rail.month_events', '{{count}} events this month', { count: rangeEvents })
                  : t('dashboard.home.rail.week_events', '{{count}} events this week', { count: rangeEvents })}
              </span>
            </span>
            <Link
              href="/dash/calendar"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-black/20 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-black/30 hover:text-white"
            >
              {t('dashboard.home.rail.open_calendar', 'Calendar')}
              <ArrowUpRight size={13} className="rtl:-scale-x-100" />
            </Link>
          </>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------- agenda */

const AGENDA_LIMIT = 3

function DayAgenda({
  selected,
  byDay,
  upcoming,
  isLoading,
}: {
  selected: Date
  byDay: Map<string, CalendarEvent[]>
  upcoming: CalendarEvent[]
  isLoading: boolean
}) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const dayEvents = byDay.get(dayKey(selected)) ?? []
  const showingDay = dayEvents.length > 0
  const source = showingDay ? dayEvents : upcoming
  const list = source.slice(0, AGENDA_LIMIT)
  const more = source.length - list.length
  const isToday = sameDay(selected, new Date())
  const dateLabel = selected.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="fit:flex fit:min-h-0 fit:flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[13px] font-semibold text-[hsl(var(--dash-ink))]">
            {showingDay
              ? isToday
                ? t('dashboard.home.rail.today_schedule', "Today's schedule")
                : dateLabel
              : t('dashboard.home.rail.up_next', 'Up next')}
          </span>
          {showingDay && isToday ? (
            <span className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{dateLabel}</span>
          ) : null}
        </p>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="dash-shimmer h-14 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--dash-border))] bg-white/70 px-3 py-3 text-xs text-[hsl(var(--dash-muted))]">
          <CalendarBlank size={18} weight="duotone" className="shrink-0" />
          {t('dashboard.home.rail.nothing_scheduled', 'Nothing scheduled')}
        </div>
      ) : (
        <ul className="space-y-1.5 fit:-me-1.5 fit:min-h-0 fit:overflow-y-auto fit:pe-1.5 [scrollbar-width:thin]">
          {list.map((e) => {
            const style = EVENT_STYLES[e.type]
            const Icon = style.icon
            const start = eventStart(e)
            return (
              <li key={e.id}>
                <Link
                  href={eventHref(e, 'dash', org?.slug ?? '') ?? '/dash/calendar'}
                  className="group flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-2 transition-all hover:-translate-y-px hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.3)]"
                >
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    <Icon size={18} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.fg }}>
                      {kindLabel(t, e)}
                    </span>
                    <span className="block truncate text-[13px] font-semibold leading-snug text-[hsl(var(--dash-ink))]">
                      {e.title}
                    </span>
                    <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
                      {formatTimeRange(e, i18n.language, t)}
                      {e.location ? ` · ${e.location}` : e.subtitle ? ` · ${e.subtitle}` : ''}
                    </span>
                  </span>
                  {showingDay ? (
                    <CaretRight
                      size={12}
                      weight="bold"
                      className="shrink-0 text-[hsl(var(--dash-muted))] opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
                    />
                  ) : (
                    <span className="flex w-9 shrink-0 flex-col items-center rounded-lg bg-[hsl(var(--dash-canvas))] py-1">
                      <span className="text-sm font-semibold leading-none tabular-nums text-[hsl(var(--dash-ink))]">
                        {start.getDate()}
                      </span>
                      <span className="mt-0.5 text-[9px] uppercase text-[hsl(var(--dash-muted))]">
                        {start.toLocaleDateString(i18n.language, { month: 'short' })}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
          {more > 0 ? (
            <li>
              <Link
                href="/dash/calendar"
                className="block rounded-xl px-2 py-1 text-center text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-white hover:text-[hsl(var(--dash-ink))]"
              >
                {t('dashboard.home.rail.more_events', '+{{count}} more', { count: more })}
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}

/* --------------------------------------------------------- recent activity */

const ACTIVITY_META: Record<HomeActivity['type'], { icon: React.ElementType; color: string }> = {
  course_created: { icon: PlusSquare, color: HOME_COLORS.ink },
  enrollment: { icon: UserSwitch, color: HOME_COLORS.red },
  completion: { icon: CheckCircle, color: HOME_COLORS.goldDeep },
  member_joined: { icon: UserPlus, color: 'hsl(222 38% 50%)' },
}

function describeActivity(a: HomeActivity, t: TFunction) {
  const user = userDisplayName(a.user) || t('dashboard.home.activity_feed.someone', 'Someone')
  const course = a.course?.name ?? ''
  switch (a.type) {
    case 'course_created':
      return {
        title: t('dashboard.home.activity_feed.course_created', 'New Course Added'),
        body: t('dashboard.home.activity_feed.course_created_body', '"{{course}}" was created.', { course }),
      }
    case 'enrollment':
      return {
        title: t('dashboard.home.activity_feed.enrollment', 'New Enrollment'),
        body: t('dashboard.home.activity_feed.enrollment_body', '{{user}} enrolled in "{{course}}".', { user, course }),
      }
    case 'completion':
      return {
        title: t('dashboard.home.activity_feed.completion', 'Course Completed'),
        body: t('dashboard.home.activity_feed.completion_body', '{{user}} completed "{{course}}".', { user, course }),
      }
    case 'member_joined':
      return {
        title: t('dashboard.home.activity_feed.member_joined', 'New Member'),
        body: t('dashboard.home.activity_feed.member_joined_body', '{{user}} joined the academy.', { user }),
      }
  }
}

function RecentActivities() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const items = data?.recent_activity ?? []

  return (
    <section className="flex min-h-0 flex-col fit:min-h-[8.5rem] fit:flex-1">
      <SectionTitle>{t('dashboard.home.activity_feed.title', 'Recent Activities')}</SectionTitle>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-shimmer h-12 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/50 px-4 py-4 text-center text-xs text-[hsl(var(--dash-muted))]">
          {t('dashboard.home.activity_feed.empty', 'Nothing has happened yet.')}
        </p>
      ) : (
        // In fit mode this timeline is the only thing that scrolls in the rail.
        <ol className="relative fit:-me-2 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pe-2 [scrollbar-width:thin]">
          <span
            aria-hidden="true"
            className="absolute bottom-3 start-[15px] top-3 w-px bg-[linear-gradient(to_bottom,hsl(var(--dash-border)),transparent)]"
          />
          {items.map((a, i) => {
            const meta = ACTIVITY_META[a.type]
            const Icon = meta.icon
            const text = describeActivity(a, t)
            const when = parseTimestamp(a.timestamp)
            return (
              <li key={`${a.type}-${a.timestamp}-${i}`} className="relative flex gap-3 pb-3.5 last:pb-0">
                <span
                  className="relative z-[1] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--dash-border))] bg-white shadow-[0_1px_2px_hsl(220_30%_10%/0.06)]"
                  style={{ color: meta.color }}
                >
                  <Icon size={15} weight="duotone" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5 text-xs leading-relaxed">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-[hsl(var(--dash-ink))]">{text.title}</span>
                    {when ? (
                      <time
                        dateTime={when.toISOString()}
                        title={when.toLocaleString(i18n.language)}
                        className="shrink-0 text-[10px] text-[hsl(var(--dash-muted))]"
                      >
                        {relativeTime(when, i18n.language)}
                      </time>
                    ) : null}
                  </p>
                  <p className="line-clamp-2 text-[hsl(var(--dash-ink))]/70">{text.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/* --------------------------------------------------------------------- rail */

/** `showActivity` is off for workspace homes: the activity feed is academy-wide. */
export default function HomeRightRail({ showActivity = true }: { showActivity?: boolean }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [range, setRange] = useState<GlassCalendarRange | null>(null)
  const [selected, setSelected] = useState(today)

  // Load the visible 6-week grid plus two weeks so "Up next" can look ahead.
  const grid = useMemo(() => monthGrid(month), [month])
  const rangeEnd = useMemo(() => addDays(grid[41]!, 14), [grid])
  const { data, isLoading } = useCalendarEvents(grid[0]!, rangeEnd)
  const events = useMemo(() => data?.events ?? [], [data])
  const byDay = useMemo(() => eventsByDay(events, grid[0]!, rangeEnd), [events, grid, rangeEnd])
  const upcoming = useMemo(
    () => events.filter((e) => eventStart(e) >= selected || (e.end && new Date(e.end) >= selected)),
    [events, selected]
  )

  return (
    <div className="flex flex-col gap-5 fit:min-h-0 fit:flex-1 fit:gap-3">
      {/* The glass calendar spans the rail; the selected day's events sit below
          it (beside it on tablet widths). In fit mode this wrapper dissolves
          (`contents`) so the calendar and agenda are rail rows of their own: the
          calendar keeps its height, the agenda gives up height before Recent
          Activities does (its list scrolls). A wrapper that shrank instead let
          the calendar spill over the rows below it. */}
      <div className="grid gap-4 md:max-xl:grid-cols-2 fit:contents">
        <GlassMonthCalendar
          selected={selected}
          onSelect={(d) => setSelected(startOfDay(d))}
          onRange={(r) => {
            setRange(r)
            setMonth((m) => (m.getTime() === r.month.getTime() ? m : r.month))
          }}
          range={range}
          byDay={byDay}
        />
        <section className="rounded-[1.25rem] bg-[hsl(var(--dash-canvas))]/70 p-3.5 fit:flex fit:min-h-[6.75rem] fit:shrink fit:flex-col fit:overflow-hidden fit:p-3">
          <DayAgenda selected={selected} byDay={byDay} upcoming={upcoming} isLoading={isLoading} />
        </section>
      </div>
      {showActivity ? <RecentActivities /> : null}
    </div>
  )
}
