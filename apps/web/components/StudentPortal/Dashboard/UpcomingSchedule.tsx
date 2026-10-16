'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { isRTL } from '@/lib/i18n'
import { CalendarCheck, CalendarDots, CaretLeft, CaretRight, MapPin } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import {
  EVENT_STYLES,
  addDays,
  dayKey,
  eventHref,
  eventsByDay,
  eventStart,
  kindLabel,
  monthGrid,
  sameDay,
  startOfDay,
  useCalendarEvents,
} from '@components/Calendar/calendarUtils'
import type { CalendarEvent } from '@services/calendar/calendar'
import { cn } from '@/lib/utils'
import { EmptyState, Panel, PanelHeader, ViewAll, useFormats } from './ui'

const VISIBLE = 8

/** The learner's month at a glance, and what's next as a timeline. Picking a day narrows the list to it. */
export default function UpcomingSchedule({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const fmt = useFormats()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [picked, setPicked] = useState<Date | null>(null)
  const rtl = isRTL(i18n.language)

  // Only the weeks the month touches (5 most months, sometimes 4 or 6).
  const grid = useMemo(() => {
    const days = monthGrid(month)
    const inMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return days.slice(0, Math.ceil((month.getDay() + inMonth) / 7) * 7)
  }, [month])
  const { data: monthData } = useCalendarEvents(grid[0], addDays(grid[grid.length - 1], 1))
  const { data: soonData, isLoading } = useCalendarEvents(today, addDays(today, 30))

  const byDay = useMemo(
    () => eventsByDay((monthData?.events ?? []) as CalendarEvent[], grid[0], addDays(grid[grid.length - 1], 1)),
    [monthData, grid]
  )

  const list = useMemo(() => {
    if (picked) return byDay.get(dayKey(picked)) ?? []
    const now = new Date()
    return (soonData?.events ?? [])
      .filter((e) => eventStart(e) >= now || (e.end && new Date(e.end) >= now))
      .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
      .slice(0, VISIBLE)
  }, [picked, byDay, soonData])

  // Weekday initials from the grid's first row (it starts on Sunday).
  const weekdays = grid.slice(0, 7).map((d) => fmt.date(d, { weekday: 'narrow' }))
  const PrevIcon = rtl ? CaretRight : CaretLeft
  const NextIcon = rtl ? CaretLeft : CaretRight

  return (
    <Panel aria-labelledby="upcoming-title" className="flex flex-col p-4 fit:h-full fit:min-h-0 fit:overflow-hidden">
      <PanelHeader
        id="upcoming-title"
        title={t('student_portal.upcoming.calendar_title', 'Calendar')}
        icon={<CalendarDots size={18} weight="duotone" />}
        action={<ViewAll href={getUriWithOrg(orgslug, '/calendar')} />}
      />

      {/* Month */}
      <div className="mt-3 shrink-0 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-2.5 py-2 fit:mt-2.5 fit:py-1.5">
        <div className="mb-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label={t('student_portal.upcoming.prev_month', 'Previous month')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[hsl(var(--dash-ink))]/70 shadow-sm hover:text-[hsl(var(--dash-ink))]"
          >
            <PrevIcon size={14} weight="bold" />
          </button>
          <p className="text-[13.5px] font-bold text-[hsl(var(--dash-ink))]">{fmt.date(month, { month: 'long', year: 'numeric' })}</p>
          <button
            type="button"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label={t('student_portal.upcoming.next_month', 'Next month')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[hsl(var(--dash-ink))]/70 shadow-sm hover:text-[hsl(var(--dash-ink))]"
          >
            <NextIcon size={14} weight="bold" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center" role="grid" aria-label={fmt.date(month, { month: 'long', year: 'numeric' })}>
          {weekdays.map((w, i) => (
            <span key={i} className="pb-1 text-[10.5px] font-semibold text-[hsl(var(--dash-muted))]">
              {w}
            </span>
          ))}
          {grid.map((d) => {
            const inMonth = d.getMonth() === month.getMonth()
            const isToday = sameDay(d, today)
            const isPicked = picked && sameDay(d, picked)
            const events = byDay.get(dayKey(d)) ?? []
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setPicked(isPicked ? null : d)}
                aria-pressed={!!isPicked}
                aria-label={`${fmt.date(d, { weekday: 'long', day: 'numeric', month: 'long' })}${events.length ? ` · ${events.length}` : ''}`}
                className="group flex flex-col items-center py-px"
              >
                <span
                  className={cn(
                    'relative inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors',
                    isToday
                      ? 'bg-[linear-gradient(135deg,hsl(43_90%_60%),hsl(39_82%_47%))] text-[hsl(220_10%_8%)] shadow-[0_6px_14px_-6px_hsl(43_85%_45%/0.9)]'
                      : isPicked
                        ? 'bg-[hsl(220_10%_10%)] text-white'
                        : inMonth
                          ? 'text-[hsl(var(--dash-ink))] group-hover:bg-white'
                          : 'text-[hsl(var(--dash-muted))]/45 group-hover:bg-white'
                  )}
                >
                  {fmt.number(d.getDate())}
                  {events.length ? (
                    <span className="absolute bottom-[3px] start-1/2 flex -translate-x-1/2 gap-px rtl:translate-x-1/2" aria-hidden="true">
                      {events.slice(0, 3).map((e) => (
                        <span key={e.id} className="h-[3px] w-[3px] rounded-full" style={{ background: isToday || isPicked ? 'currentColor' : (EVENT_STYLES[e.type] ?? EVENT_STYLES.term).dot }} />
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Upcoming / picked day */}
      <div className="mt-3 flex shrink-0 items-center justify-between">
        <h3 className="text-[14px] font-bold text-[hsl(var(--dash-ink))]">
          {picked ? fmt.date(picked, { weekday: 'long', day: 'numeric', month: 'long' }) : t('student_portal.upcoming.title', 'Upcoming')}
        </h3>
        {picked ? (
          <button type="button" onClick={() => setPicked(null)} className="text-[12px] font-semibold text-[hsl(38_80%_36%)] hover:underline">
            {t('student_portal.upcoming.show_upcoming', 'Show upcoming')}
          </button>
        ) : null}
      </div>

      {isLoading && !picked ? (
        <div className="mt-3 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="dash-shimmer h-14 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          className="py-5"
          icon={<CalendarCheck size={22} weight="duotone" />}
          title={picked ? t('student_portal.upcoming.nothing_that_day', 'Nothing on this day') : t('student_portal.empty.no_events_title', 'No upcoming events')}
          description={picked ? undefined : t('student_portal.empty.no_events_desc', 'You’re on track — no lectures or exams are scheduled.')}
        />
      ) : (
        <ol className="relative -mx-1 mt-2.5 px-1 fit:min-h-[64px] fit:flex-1 fit:overflow-y-auto [scrollbar-width:thin]">
          {list.map((e, i) => {
            const style = EVENT_STYLES[e.type] ?? EVENT_STYLES.term
            const start = eventStart(e)
            const href = eventHref(e, 'portal', orgslug) ?? getUriWithOrg(orgslug, '/calendar')
            const last = i === list.length - 1
            return (
              <li key={e.id} className="relative flex gap-3">
                <div className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-[hsl(var(--dash-canvas))] py-1.5 text-center">
                  <span className="text-[16px] font-bold leading-none tabular-nums text-[hsl(var(--dash-ink))]">{fmt.number(start.getDate())}</span>
                  <span className="mt-1 text-[10px] font-medium text-[hsl(var(--dash-muted))]">{fmt.date(start, { month: 'short' })}</span>
                </div>
                <div className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
                  <span className="relative z-[1] mt-2 h-2.5 w-2.5 rounded-full ring-[3px] ring-white" style={{ background: style.dot }} />
                  {!last ? <span className="absolute bottom-0 top-4 w-px bg-[hsl(var(--dash-border))]" /> : null}
                </div>
                <Link href={href} className={cn('group min-w-0 flex-1 rounded-xl px-2 py-1 transition-colors hover:bg-[hsl(var(--dash-canvas))]', !last && 'mb-2.5')}>
                  <p className="flex items-center gap-2 text-[11.5px] font-semibold text-[hsl(var(--dash-muted))]">
                    <span className="tabular-nums">{e.all_day ? t('calendar.all_day', 'All day') : fmt.time(start)}</span>
                    <span className="rounded-md px-1.5 py-px text-[10.5px] font-bold" style={{ background: style.bg, color: style.fg }}>
                      {kindLabel(t, e)}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[13.5px] font-bold text-[hsl(var(--dash-ink))] group-hover:underline" dir="auto">
                    {e.title}
                  </p>
                  {e.subtitle || e.location ? (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-[hsl(var(--dash-muted))]">
                      {e.location && !e.subtitle ? <MapPin size={12} className="shrink-0" /> : null}
                      <span className="truncate" dir="auto">{e.subtitle || e.location}</span>
                    </p>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
