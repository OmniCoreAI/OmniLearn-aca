'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarBlank, CaretLeft, CaretRight, ListBullets, SquaresFour } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarEventType } from '@services/calendar/calendar'
import CalendarMonthGrid from './CalendarMonthGrid'
import { CalendarEventDetail, CalendarEventRow } from './CalendarEventCard'
import {
  EVENT_STYLES,
  EVENT_TYPES,
  addDays,
  dayKey,
  eventStart,
  eventsByDay,
  monthGrid,
  sameDay,
  startOfDay,
  typeLabel,
  useCalendarEvents,
} from './calendarUtils'

type View = 'month' | 'list'

/**
 * Role-aware events calendar shared by the dashboard (/dash/calendar) and the
 * learner portal (/calendar). What it shows is decided server-side from the
 * caller's role; `context` only changes where "Open" links point.
 */
export default function EventsCalendar({
  context,
  orgslug,
  className,
}: {
  context: 'dash' | 'portal'
  orgslug: string
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [view, setView] = useState<View>('month')
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [hidden, setHidden] = useState<Set<CalendarEventType>>(new Set())

  // Fetch the whole visible grid (it spills into neighbouring months) plus a
  // little extra so "Up next" can look past the month end.
  const grid = useMemo(() => monthGrid(month), [month])
  const rangeStart = grid[0]!
  const rangeEnd = useMemo(() => addDays(grid[41]!, 15), [grid])
  const { data, isLoading, isError } = useCalendarEvents(rangeStart, rangeEnd)

  const allEvents = useMemo(() => data?.events ?? [], [data])
  const events = useMemo(() => allEvents.filter((e) => !hidden.has(e.type)), [allEvents, hidden])
  const counts = useMemo(() => {
    const c: Partial<Record<CalendarEventType, number>> = {}
    for (const e of allEvents) c[e.type] = (c[e.type] ?? 0) + 1
    return c
  }, [allEvents])

  const byDay = useMemo(() => eventsByDay(events, rangeStart, rangeEnd), [events, rangeStart, rangeEnd])
  const dayEvents = byDay.get(dayKey(selectedDay)) ?? []
  const upNext = useMemo(
    () => events.filter((e) => eventStart(e) >= new Date() || (e.end && new Date(e.end) >= today)).slice(0, 5),
    [events, today]
  )
  const monthEvents = useMemo(
    () =>
      events.filter((e) => {
        const s = eventStart(e)
        return s.getMonth() === month.getMonth() && s.getFullYear() === month.getFullYear()
      }),
    [events, month]
  )

  const goMonth = (delta: number) => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
    setSelectedEvent(null)
  }
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(today)
    setSelectedEvent(null)
  }
  const toggleType = (type: CalendarEventType) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })

  const scopeText =
    data?.scope === 'all'
      ? t('calendar.scope.all', 'Everything scheduled across the academy')
      : data?.scope === 'teaching'
        ? t('calendar.scope.teaching', 'Your teaching schedule — sessions, deadlines and interviews you run')
        : t('calendar.scope.learning', 'Your lectures, exams and upcoming deadlines')

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', className)}>
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
            <CalendarBlank size={22} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
              {t('calendar.title', 'Calendar')}
            </h1>
            <p className="truncate text-xs text-[hsl(var(--dash-muted))]">{data ? scopeText : ' '}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3.5 py-1.5 text-xs font-medium text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]"
          >
            {t('calendar.today', 'Today')}
          </button>
          <div className="flex items-center rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))]">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              aria-label={t('dashboard.home.rail.previous_month', 'Previous month')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
            >
              <CaretLeft size={14} weight="bold" className="rtl:rotate-180" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold text-[hsl(var(--dash-ink))]">
              {month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label={t('dashboard.home.rail.next_month', 'Next month')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
            >
              <CaretRight size={14} weight="bold" className="rtl:rotate-180" />
            </button>
          </div>
          <div className="flex rounded-full bg-[hsl(var(--dash-canvas))] p-0.5" role="tablist">
            {(
              [
                ['month', SquaresFour, t('calendar.view_month', 'Month')],
                ['list', ListBullets, t('calendar.view_list', 'List')],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  view === key
                    ? 'bg-[hsl(var(--dash-surface))] text-[hsl(var(--dash-ink))] shadow-sm'
                    : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Type filters */}
      <div className="flex flex-wrap items-center gap-2">
        {EVENT_TYPES.filter((type) => counts[type]).map((type) => {
          const off = hidden.has(type)
          const style = EVENT_STYLES[type]
          return (
            <button
              key={type}
              type="button"
              aria-pressed={!off}
              onClick={() => toggleType(type)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                off
                  ? 'border-dashed border-[hsl(var(--dash-border))] text-[hsl(var(--dash-muted))] opacity-60'
                  : 'border-transparent'
              )}
              style={off ? undefined : { background: style.bg, color: style.fg }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: off ? 'transparent' : style.dot, boxShadow: off ? `inset 0 0 0 1.5px ${style.dot}` : undefined }} />
              {typeLabel(t, type)}
              <span className="tabular-nums opacity-70">{counts[type]}</span>
            </button>
          )
        })}
        {isError && (
          <span className="text-xs text-[hsl(var(--dash-warn))]">
            {t('calendar.load_error', 'Could not load the calendar. Try again later.')}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative min-h-0 overflow-hidden rounded-[var(--dash-radius)] bg-[hsl(var(--dash-surface))] p-3 shadow-[0_1px_2px_hsl(0_0%_8%/0.04),0_0_0_1px_hsl(var(--dash-border)/0.6)]">
          {isLoading && !data ? (
            <div className="dash-shimmer h-full min-h-[560px] rounded-2xl" />
          ) : view === 'month' ? (
            <CalendarMonthGrid
              month={month}
              events={events}
              selectedDay={selectedDay}
              selectedEventId={selectedEvent?.id ?? null}
              onSelectDay={(d) => {
                setSelectedDay(d)
                setSelectedEvent(null)
              }}
              onSelectEvent={(e) => {
                setSelectedDay(startOfDay(eventStart(e)))
                setSelectedEvent(e)
              }}
            />
          ) : (
            <div className="h-full min-h-[560px] overflow-y-auto p-1">
              {monthEvents.length === 0 ? (
                <EmptyNote>{t('calendar.empty_month', 'Nothing scheduled this month.')}</EmptyNote>
              ) : (
                <ol className="space-y-5">
                  {groupByDay(monthEvents).map(([key, list]) => {
                    const d = eventStart(list[0]!)
                    return (
                      <li key={key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
                        <div className={cn('pt-1 text-center', sameDay(d, today) && 'text-[hsl(var(--dash-accent))]')}>
                          <p className="text-2xl font-semibold leading-none">{d.getDate()}</p>
                          <p className="mt-1 text-[11px] uppercase text-[hsl(var(--dash-muted))]">
                            {d.toLocaleDateString(i18n.language, { weekday: 'short' })}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {list.map((e) => (
                            <CalendarEventRow
                              key={e.id}
                              event={e}
                              active={selectedEvent?.id === e.id}
                              onClick={() => {
                                setSelectedDay(startOfDay(eventStart(e)))
                                setSelectedEvent(e)
                              }}
                            />
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )}
        </section>

        {/* Side panel: event detail, or the selected day + what's next */}
        <aside className="flex min-h-0 flex-col rounded-[var(--dash-radius)] bg-[hsl(var(--dash-surface))] p-4 shadow-[0_1px_2px_hsl(0_0%_8%/0.04),0_0_0_1px_hsl(var(--dash-border)/0.6)]">
          {selectedEvent ? (
            <CalendarEventDetail
              event={selectedEvent}
              context={context}
              orgslug={orgslug}
              onBack={() => setSelectedEvent(null)}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pe-1">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                  {sameDay(selectedDay, today) ? t('calendar.today', 'Today') : t('calendar.selected_day', 'Selected day')}
                </p>
                <h2 className="mt-0.5 text-base font-semibold text-[hsl(var(--dash-ink))]">
                  {selectedDay.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <div className="mt-3 space-y-2">
                  {dayEvents.length === 0 ? (
                    <EmptyNote>{t('calendar.empty_day', 'Nothing scheduled for this day.')}</EmptyNote>
                  ) : (
                    dayEvents.map((e) => <CalendarEventRow key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)
                  )}
                </div>
              </section>
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                  {t('calendar.up_next', 'Up next')}
                </p>
                <div className="space-y-2">
                  {upNext.length === 0 ? (
                    <EmptyNote>{t('calendar.empty_upcoming', 'No upcoming events.')}</EmptyNote>
                  ) : (
                    upNext.map((e) => (
                      <CalendarEventRow
                        key={e.id}
                        event={e}
                        showDate
                        onClick={() => {
                          setMonth(new Date(eventStart(e).getFullYear(), eventStart(e).getMonth(), 1))
                          setSelectedDay(startOfDay(eventStart(e)))
                          setSelectedEvent(e)
                        }}
                      />
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-[hsl(var(--dash-canvas))] px-4 py-5 text-center text-xs text-[hsl(var(--dash-muted))]">
      {children}
    </p>
  )
}

function groupByDay(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const key = dayKey(eventStart(e))
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return [...groups.entries()]
}
