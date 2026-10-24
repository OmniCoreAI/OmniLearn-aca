'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  ArrowUpRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Gear,
  PlusSquare,
  UserPlus,
  UserSwitch,
} from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import UserAvatar from '@components/Objects/UserAvatar'
import { cn } from '@/lib/utils'
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

/* ------------------------------------------------------------------ profile */

function ProfileCard() {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const org = useOrg() as any
  const user = session?.data?.user
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || ''
  const role = (session?.data?.roles ?? []).find((r: any) => r.org?.id === org?.id)?.role?.name

  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,hsl(0_0%_12%),hsl(0_0%_5%))] p-3 text-white fit:p-2.5">
      <span aria-hidden="true" className="absolute -end-8 -top-10 h-28 w-28 rounded-full bg-[hsl(var(--dash-accent))] opacity-30 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="rounded-xl ring-2 ring-[hsl(43_80%_60%)]/70">
          <UserAvatar width={40} rounded="rounded-xl" shadow="shadow-none" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <span className="mt-0.5 inline-flex max-w-full items-center truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[hsl(43_80%_70%)]">
            {role || t('dashboard.home.rail.admin', 'Admin')}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Link
            href="/account/general"
            aria-label={t('common.settings', 'Settings')}
            title={t('common.settings', 'Settings')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
          >
            <Gear size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- calendar */

const GOLD_FILL = 'bg-[linear-gradient(145deg,hsl(43_85%_62%),hsl(38_78%_46%))]'

/** Month grid trimmed to the weeks that contain the month (4–6 rows, not always 6). */
function monthWeeks(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return monthGrid(month).slice(0, Math.ceil((first.getDay() + daysInMonth) / 7) * 7)
}

function MonthCalendar({
  month,
  onMonth,
  selected,
  onSelect,
  byDay,
}: {
  month: Date
  onMonth: (_month: Date) => void
  selected: Date
  onSelect: (_day: Date) => void
  byDay: Map<string, CalendarEvent[]>
}) {
  const { t, i18n } = useTranslation()
  const today = startOfDay(new Date())
  const days = useMemo(() => monthWeeks(month), [month])
  const weekdayNames = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(i18n.language, { weekday: 'short' })),
    [i18n.language]
  )
  const monthEvents = useMemo(() => {
    const ids = new Set<string>()
    for (const d of days) {
      if (d.getMonth() !== month.getMonth()) continue
      for (const e of byDay.get(dayKey(d)) ?? []) ids.add(e.id)
    }
    return ids.size
  }, [days, byDay, month])
  const viewingThisMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const shift = (delta: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  return (
    <div className="shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight tracking-tight text-[hsl(var(--dash-ink))]">
            {month.toLocaleDateString(i18n.language, { month: 'long' })}
            <span className="ms-1.5 font-normal text-[hsl(var(--dash-muted))]">{month.getFullYear()}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[hsl(var(--dash-muted))]">
            {t('dashboard.home.rail.month_events', '{{count}} events this month', { count: monthEvents })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!viewingThisMonth ? (
            <button
              type="button"
              onClick={() => {
                onMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                onSelect(today)
              }}
              className="rounded-full bg-[hsl(var(--dash-ink))] px-3 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('dashboard.home.rail.today', 'Today')}
            </button>
          ) : null}
          <div className="inline-flex items-center rounded-full border border-[hsl(var(--dash-border))] bg-white p-0.5">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label={t('dashboard.home.rail.previous_month', 'Previous month')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
            >
              <CaretLeft size={13} weight="bold" className="rtl:rotate-180" />
            </button>
            <span aria-hidden="true" className="h-4 w-px bg-[hsl(var(--dash-border))]" />
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label={t('dashboard.home.rail.next_month', 'Next month')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
            >
              <CaretRight size={13} weight="bold" className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid">
        {weekdayNames.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className="truncate pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]"
          >
            {n}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const isToday = sameDay(day, today)
          const isSelected = sameDay(day, selected)
          const types = [...new Set((byDay.get(dayKey(day)) ?? []).map((e) => e.type))].slice(0, 3)
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={day.toLocaleDateString(i18n.language, { dateStyle: 'full' })}
              onClick={() => onSelect(day)}
              className={cn(
                'flex h-10 flex-col items-center justify-center gap-[3px] rounded-xl text-[13px] tabular-nums outline-none transition-all focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/60 fit:h-9',
                inMonth ? 'text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-muted))]/35',
                !isToday && !isSelected && 'hover:bg-white hover:shadow-[0_6px_14px_-8px_rgba(0,0,0,0.25)]',
                !isToday && !isSelected && inMonth && types.length > 0 && 'bg-white shadow-[0_1px_2px_hsl(220_30%_10%/0.06)]',
                isToday &&
                  cn(GOLD_FILL, 'font-semibold text-[hsl(var(--dash-ink))] shadow-[0_8px_18px_-8px_hsl(43_80%_40%/0.9)]'),
                isSelected &&
                  !isToday &&
                  'bg-[hsl(var(--dash-ink))] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.7)]'
              )}
            >
              <span className="leading-none">{day.getDate()}</span>
              <span className="flex h-1 items-center gap-[3px]">
                {types.map((type) => (
                  <span
                    key={type}
                    className="h-1 w-1 rounded-full"
                    style={{
                      background: isToday
                        ? 'hsl(var(--dash-ink))'
                        : isSelected
                          ? 'hsl(43 85% 62%)'
                          : inMonth
                            ? EVENT_STYLES[type].dot
                            : 'hsl(0 0% 80%)',
                    }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
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
        <Link
          href="/dash/calendar"
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-white hover:text-[hsl(var(--dash-ink))]"
        >
          {t('dashboard.home.rail.open_calendar', 'Calendar')}
          <ArrowUpRight size={12} className="rtl:-scale-x-100" />
        </Link>
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

export default function HomeRightRail() {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
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
      <ProfileCard />
      {/* One calendar card: month grid on top, the selected day's events below.
          In fit mode it gives up height before Recent Activities does — the
          agenda list scrolls instead. */}
      <section className="grid gap-4 rounded-[1.25rem] bg-[hsl(var(--dash-canvas))]/70 p-3.5 md:max-xl:grid-cols-2 fit:flex fit:min-h-0 fit:flex-col fit:gap-3 fit:p-3">
        <MonthCalendar
          month={month}
          onMonth={setMonth}
          selected={selected}
          onSelect={(d) => setSelected(startOfDay(d))}
          byDay={byDay}
        />
        <div className="border-t border-[hsl(var(--dash-border))]/70 pt-3 md:max-xl:border-s md:max-xl:border-t-0 md:max-xl:ps-4 md:max-xl:pt-0 fit:flex fit:min-h-0 fit:flex-col fit:pt-2.5">
          <DayAgenda selected={selected} byDay={byDay} upcoming={upcoming} isLoading={isLoading} />
        </div>
      </section>
      <RecentActivities />
    </div>
  )
}
