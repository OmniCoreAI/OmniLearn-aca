'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@services/calendar/calendar'
import {
  EVENT_STYLES,
  addDays,
  dayKey,
  eventHeadline,
  eventStart,
  eventsByDay,
  monthGrid,
  sameDay,
  startOfDay,
} from './calendarUtils'

const MAX_CHIPS = 3

export default function CalendarMonthGrid({
  month,
  events,
  selectedDay,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
}: {
  month: Date
  events: CalendarEvent[]
  selectedDay: Date
  selectedEventId: string | null
  onSelectDay: (_day: Date) => void
  onSelectEvent: (_event: CalendarEvent) => void
}) {
  const { t, i18n } = useTranslation()
  const days = useMemo(() => monthGrid(month), [month])
  const byDay = useMemo(() => eventsByDay(events, days[0]!, addDays(days[41]!, 1)), [events, days])
  const today = startOfDay(new Date())

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 7 + i).toLocaleDateString(i18n.language, { weekday: 'short' })
      ),
    [i18n.language]
  )

  return (
    <div className="flex h-full min-h-[560px] flex-col" role="grid" aria-label={t('calendar.month_view', 'Month view')}>
      <div className="grid grid-cols-7 border-b border-[hsl(var(--dash-border))]">
        {weekdays.map((w) => (
          <div key={w} className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
            {w}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === month.getMonth()
          const isToday = sameDay(day, today)
          const isSelected = sameDay(day, selectedDay)
          const dayEvents = (byDay.get(dayKey(day)) ?? []).sort(
            (a, b) => Number(b.all_day) - Number(a.all_day) || eventStart(a).getTime() - eventStart(b).getTime()
          )
          const extra = dayEvents.length - MAX_CHIPS
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectDay(day)
                }
              }}
              className={cn(
                'group flex min-h-0 cursor-pointer flex-col gap-1 overflow-hidden border-[hsl(var(--dash-border))]/70 p-1.5 outline-none transition-colors',
                i % 7 !== 6 && 'border-e',
                i < 35 && 'border-b',
                inMonth ? 'bg-transparent' : 'bg-[hsl(var(--dash-canvas))]/60',
                isSelected ? 'bg-[hsl(var(--dash-accent-soft))]/70' : 'hover:bg-[hsl(var(--dash-canvas))]',
                'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--dash-accent))]/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[13px] tabular-nums',
                    !inMonth && 'text-[hsl(var(--dash-muted))]/50',
                    inMonth && !isToday && 'text-[hsl(var(--dash-ink))]',
                    isToday && 'bg-[hsl(var(--dash-accent))] font-semibold text-white shadow-[0_4px_10px_hsl(var(--dash-accent)/0.35)]'
                  )}
                >
                  {day.getDate() === 1 && !isToday
                    ? day.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
                    : day.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="hidden text-[10px] font-medium text-[hsl(var(--dash-muted))] group-hover:inline">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="flex min-h-0 flex-col gap-0.5">
                {dayEvents.slice(0, MAX_CHIPS).map((e) => {
                  const style = EVENT_STYLES[e.type]
                  const continues = !sameDay(eventStart(e), day) && e.all_day
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onSelectEvent(e)
                      }}
                      title={eventHeadline(t, e)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-[3px] text-start text-[11px] leading-tight transition-shadow',
                        selectedEventId === e.id && 'ring-2 ring-[hsl(var(--dash-ink))]/25'
                      )}
                      style={{ background: style.bg, color: style.fg }}
                    >
                      {!e.all_day && (
                        <span className="shrink-0 font-semibold tabular-nums">
                          {eventStart(e).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                      {e.all_day && !continues && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: style.dot }} />
                      )}
                      <span className={cn('truncate', continues && 'opacity-70')}>{eventHeadline(t, e)}</span>
                    </button>
                  )
                })}
                {extra > 0 && (
                  <span className="px-1.5 text-[10px] font-medium text-[hsl(var(--dash-muted))]">
                    {t('calendar.more', '+{{count}} more', { count: extra })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
