'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, CaretLeft, CaretRight, CheckCircle, Gear, PlusSquare, UserPlus, UserSwitch } from '@phosphor-icons/react'
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
  eventStart,
  eventsByDay,
  formatTimeRange,
  kindLabel,
  monthGrid,
  sameDay,
  startOfDay,
  useCalendarEvents,
} from '@components/Calendar/calendarUtils'

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{children}</h3>
      {action}
    </div>
  )
}

function ProfileHeader() {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const org = useOrg() as any
  const user = session?.data?.user
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || ''
  const role = (session?.data?.roles ?? []).find((r: any) => r.org?.id === org?.id)?.role?.name

  return (
    <div className="flex items-center gap-3">
      <UserAvatar width={42} rounded="rounded-xl" shadow="shadow-none" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[hsl(var(--dash-ink))]">{name}</p>
        <p className="truncate text-xs text-[hsl(var(--dash-muted))]">
          {role || t('dashboard.home.rail.admin', 'Admin')}
        </p>
      </div>
      <Link
        href="/account/general"
        aria-label={t('common.settings', 'Settings')}
        title={t('common.settings', 'Settings')}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--dash-border))] text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))]"
      >
        <Gear size={18} />
      </Link>
    </div>
  )
}

/** Month picker with per-type event dots. Days are buttons; the selected day drives the agenda below. */
function MiniCalendar({
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
  const days = useMemo(() => monthGrid(month), [month])
  const weekdayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 7 + i).toLocaleDateString(i18n.language, { weekday: 'narrow' })
      ),
    [i18n.language]
  )
  const viewingThisMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const shift = (delta: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  return (
    <section className="rounded-2xl bg-[linear-gradient(160deg,hsl(var(--dash-accent-soft)),hsl(var(--dash-surface))_70%)] p-3 shadow-[inset_0_0_0_1px_hsl(var(--dash-border)/0.7)]">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight text-[hsl(var(--dash-ink))]">
            {month.toLocaleDateString(i18n.language, { month: 'long' })}
            <span className="ms-1.5 font-normal text-[hsl(var(--dash-muted))]">{month.getFullYear()}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!viewingThisMonth && (
            <button
              type="button"
              onClick={() => {
                onMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                onSelect(today)
              }}
              className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--dash-ink))] shadow-sm hover:bg-white"
            >
              {t('dashboard.home.rail.today', 'Today')}
            </button>
          )}
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t('dashboard.home.rail.previous_month', 'Previous month')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-[hsl(var(--dash-ink))] shadow-sm hover:bg-white"
          >
            <CaretLeft size={12} weight="bold" className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t('dashboard.home.rail.next_month', 'Next month')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-[hsl(var(--dash-ink))] shadow-sm hover:bg-white"
          >
            <CaretRight size={12} weight="bold" className="rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center" role="grid">
        {weekdayNames.map((n, i) => (
          <span key={`${n}-${i}`} className="pb-1 text-[10px] font-semibold uppercase text-[hsl(var(--dash-muted))]">
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
              aria-label={day.toLocaleDateString(i18n.language, { dateStyle: 'full' })}
              onClick={() => onSelect(day)}
              className="group flex h-[34px] flex-col items-center justify-center"
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] tabular-nums transition-all',
                  inMonth ? 'text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-muted))]/35',
                  !isToday && !isSelected && 'group-hover:bg-white group-hover:shadow-sm',
                  isToday && 'bg-[hsl(var(--dash-accent))] font-semibold text-white shadow-[0_4px_10px_hsl(var(--dash-accent)/0.4)]',
                  isSelected && !isToday && 'bg-[hsl(var(--dash-ink))] font-semibold text-white'
                )}
              >
                {day.getDate()}
              </span>
              <span className="mt-[2px] flex h-1 items-center gap-[2px]">
                {types.map((type) => (
                  <span
                    key={type}
                    className="h-1 w-1 rounded-full"
                    style={{ background: inMonth ? EVENT_STYLES[type].dot : 'hsl(0 0% 80%)' }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Agenda for the selected day; falls back to what's next when the day is empty. */
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
  const dayEvents = byDay.get(dayKey(selected)) ?? []
  const showingDay = dayEvents.length > 0
  const list = (showingDay ? dayEvents : upcoming).slice(0, 2)
  const isToday = sameDay(selected, new Date())

  return (
    <section>
      <SectionTitle
        action={
          <Link
            href="/dash/calendar"
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
          >
            {t('dashboard.home.rail.open_calendar', 'Calendar')}
            <ArrowUpRight size={12} className="rtl:-scale-x-100" />
          </Link>
        }
      >
        {showingDay
          ? isToday
            ? t('dashboard.home.rail.today_schedule', "Today's schedule")
            : selected.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
          : t('dashboard.home.rail.up_next', 'Up next')}
      </SectionTitle>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="dash-shimmer h-14 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl bg-[hsl(var(--dash-canvas))] px-4 py-4 text-center text-xs text-[hsl(var(--dash-muted))]">
          {t('dashboard.home.rail.nothing_scheduled', 'Nothing scheduled')}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => {
            const style = EVENT_STYLES[e.type]
            const start = eventStart(e)
            return (
              <li key={e.id}>
                <Link
                  href={`/dash/calendar`}
                  className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))] p-2.5 transition-colors hover:bg-[hsl(var(--dash-accent-soft))]"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    <span className="text-base font-semibold leading-none">{start.getDate()}</span>
                    <span className="mt-0.5 text-[9px] uppercase">
                      {start.toLocaleDateString(i18n.language, { weekday: 'short' })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold" style={{ color: style.fg }}>
                      {kindLabel(t, e)}
                    </span>
                    <span className="block truncate text-[13px] font-medium text-[hsl(var(--dash-ink))]">
                      {e.title}
                    </span>
                    <span className="block truncate text-[10px] text-[hsl(var(--dash-muted))]">
                      {formatTimeRange(e, i18n.language, t)}
                      {e.location ? ` · ${e.location}` : e.subtitle ? ` · ${e.subtitle}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const ACTIVITY_META: Record<HomeActivity['type'], { icon: React.ElementType; bg: string; fg: string }> = {
  course_created: { icon: PlusSquare, bg: HOME_COLORS.stoneSoft, fg: HOME_COLORS.ink },
  enrollment: { icon: UserSwitch, bg: HOME_COLORS.roseSoft, fg: HOME_COLORS.red },
  completion: { icon: CheckCircle, bg: HOME_COLORS.goldSoft, fg: HOME_COLORS.goldDeep },
  member_joined: { icon: UserPlus, bg: HOME_COLORS.stoneSoft, fg: HOME_COLORS.ink },
}

function RecentActivities() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const items = data?.recent_activity ?? []

  const describe = (a: HomeActivity) => {
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
          body: t('dashboard.home.activity_feed.enrollment_body', '{{user}} enrolled in "{{course}}".', {
            user,
            course,
          }),
        }
      case 'completion':
        return {
          title: t('dashboard.home.activity_feed.completion', 'Course Completed'),
          body: t('dashboard.home.activity_feed.completion_body', '{{user}} completed "{{course}}".', {
            user,
            course,
          }),
        }
      case 'member_joined':
        return {
          title: t('dashboard.home.activity_feed.member_joined', 'New Member'),
          body: t('dashboard.home.activity_feed.member_joined_body', '{{user}} joined the academy.', { user }),
        }
    }
  }

  return (
    <section className="flex min-h-0 flex-col fit:flex-1">
      <SectionTitle>{t('dashboard.home.activity_feed.title', 'Recent Activities')}</SectionTitle>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-shimmer h-12 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-[hsl(var(--dash-canvas))] px-4 py-4 text-center text-xs text-[hsl(var(--dash-muted))]">
          {t('dashboard.home.activity_feed.empty', 'Nothing has happened yet.')}
        </p>
      ) : (
        // In fit mode this list is the only thing that scrolls in the rail.
        <ol className="space-y-3 fit:-me-2 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pe-2 [scrollbar-width:thin]">
          {items.map((a, i) => {
            const meta = ACTIVITY_META[a.type]
            const Icon = meta.icon
            const text = describe(a)
            const when = parseTimestamp(a.timestamp)
            return (
              <li key={`${a.type}-${a.timestamp}-${i}`} className="flex gap-3">
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: meta.bg, color: meta.fg }}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 text-xs leading-relaxed">
                  {when && (
                    <p className="text-[10px] text-[hsl(var(--dash-muted))]">
                      {when.toLocaleString(i18n.language, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                  <p className="text-[hsl(var(--dash-ink))]/80">
                    <span className="font-semibold text-[hsl(var(--dash-ink))]">{text.title}</span>
                    {' – '}
                    {text.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

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
    <div className="flex flex-col gap-6 fit:min-h-0 fit:flex-1 fit:gap-4">
      <ProfileHeader />
      <div className="grid gap-6 md:max-[1279px]:grid-cols-2 fit:gap-4">
        <MiniCalendar month={month} onMonth={setMonth} selected={selected} onSelect={(d) => setSelected(startOfDay(d))} byDay={byDay} />
        <DayAgenda selected={selected} byDay={byDay} upcoming={upcoming} isLoading={isLoading} />
      </div>
      <RecentActivities />
    </div>
  )
}
