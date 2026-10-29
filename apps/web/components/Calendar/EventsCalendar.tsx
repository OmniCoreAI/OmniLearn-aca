'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, type UseTranslationOptions } from 'react-i18next'
import type { Locale } from 'date-fns'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  EventCalendar,
  useEventCalendarNavigation,
  type EventCalendarApi,
  type EventCalendarClassNames,
  type EventCalendarRenderEventProps,
} from '@/components/ui/reui-event-calendar'
import { EventCalendarContent } from '@/components/ui/reui-event-calendar-utils/event-calendar-content'
import type { EventCalendarI18nOverrides } from '@/components/ui/reui-event-calendar-utils/event-calendar-i18n'
import type {
  CalendarView,
  EventCalendarDateRange,
  CalendarEvent as GridEvent,
} from '@/components/ui/reui-event-calendar-utils/event-calendar-types'
import type { CalendarEvent, CalendarEventType } from '@services/calendar/calendar'
import { CalendarEventDetail, CalendarEventRow } from './CalendarEventCard'
import {
  EVENT_STYLES,
  EVENT_TYPES,
  addDays,
  dayKey,
  eventEnd,
  eventHeadline,
  eventStart,
  eventsByDay,
  formatTimeRange,
  kindLabel,
  sameDay,
  startOfDay,
  typeLabel,
  useCalendarEvents,
} from './calendarUtils'

const VIEWS: CalendarView[] = ['month', 'week', 'day', 'agenda']

/**
 * Brand theme for the vendored calendar: its primitives read the shadcn
 * `--color-*` tokens, so re-pointing them here recolors today, selection and
 * focus in EACA gold without touching the vendored code.
 */
const CALENDAR_THEME = [
  '[--color-primary:hsl(var(--dash-accent))]',
  '[--color-primary-foreground:hsl(var(--dash-ink))]',
  '[--color-foreground:hsl(var(--dash-ink))]',
  '[--color-muted-foreground:hsl(var(--dash-muted))]',
  // Hairlines that read on frosted glass without boxing every cell in.
  '[--color-border:hsl(222_25%_60%/0.18)]',
  '[--ec-month-bar-h:1.5rem]',
].join(' ')

const TODAY_CLASS = 'bg-[linear-gradient(180deg,hsl(43_90%_60%/0.16),hsl(43_90%_60%/0.04))] border-b-0'
const SELECTED_DAY_CLASS = 'bg-white/60 shadow-[inset_0_0_0_1.5px_hsl(var(--dash-accent)/0.55)]'

/**
 * Month cells show the day number at the top (the upstream default puts it at
 * the bottom, Notion-style): the cell stacks in reverse, the number row gets a
 * fixed 1.75rem, and the bar overlay starts below it (1.75rem + the content's
 * 0.125rem top padding) so multi-day bars line up with the reserved lanes.
 */
const CALENDAR_CLASSES: EventCalendarClassNames = {
  monthHeader: 'bg-white/35',
  monthDayHeader: 'px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]',
  monthCell: 'flex-col-reverse transition-colors hover:bg-white/45',
  monthCellFooter: 'h-7 shrink-0 justify-start px-2 pb-0 pt-1.5',
  monthCellContent: 'pt-0.5',
  monthBarOverlay: 'pt-[1.875rem]',
  monthDayNumber: 'size-6 text-[12.5px] font-medium tabular-nums',
  // Grid chips (not list rows): a solid colour bar on the leading edge over a
  // fading tint of the event colour, so types read at a glance on glass.
  event: cn(
    'rounded-md text-[11.5px]',
    'not-data-[view=agenda]:rounded-lg not-data-[view=agenda]:border-s-[3px] not-data-[view=agenda]:border-(--ec-event-color)',
    'not-data-[view=agenda]:bg-linear-to-r not-data-[view=agenda]:from-(--ec-event-color)/25 not-data-[view=agenda]:to-(--ec-event-color)/8',
    'not-data-[view=agenda]:font-medium not-data-[view=agenda]:shadow-[0_1px_2px_hsl(222_40%_18%/0.06)]',
    'not-data-[view=agenda]:hover:from-(--ec-event-color)/35 not-data-[view=agenda]:data-selected:from-(--ec-event-color)/45'
  ),
  moreIndicator: 'text-[11px] font-medium text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]',
  timeGridHeader: 'bg-white/35',
  timeGutterLabel: 'text-[11px] tabular-nums',
  agendaDayHeader: 'bg-white/40 text-[13px]',
  agendaItem: 'py-1',
}

/** Toolbar rendered inside the calendar so it can read the live title/range. */
function CalendarToolbar({
  view,
  views,
  viewNames,
  onView,
}: {
  view: CalendarView
  views: CalendarView[]
  viewNames: Partial<Record<CalendarView, string>>
  onView: (_view: CalendarView) => void
}) {
  const { t } = useTranslation()
  const nav = useEventCalendarNavigation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={nav.today}
          disabled={nav.isToday}
          className="glass-chip rounded-full px-3.5 py-1.5 text-xs font-medium text-[hsl(var(--dash-ink))] transition-colors hover:bg-white disabled:opacity-50"
        >
          {t('calendar.today', 'Today')}
        </button>
        <div className="glass-chip flex items-center rounded-full p-0.5">
          <button
            type="button"
            onClick={nav.prev}
            aria-label={t('calendar.previous', 'Previous')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--dash-ink))] transition-colors hover:bg-white"
          >
            <CaretLeft size={15} weight="bold" className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={nav.next}
            aria-label={t('calendar.next', 'Next')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--dash-ink))] transition-colors hover:bg-white"
          >
            <CaretRight size={15} weight="bold" className="rtl:rotate-180" />
          </button>
        </div>
        <h2 className="truncate text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]" aria-live="polite">
          {nav.title}
        </h2>
      </div>
      <div className="glass-chip flex rounded-full p-0.5" role="tablist" aria-label={t('calendar.select_view', 'Select view')}>
        {views.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onView(v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
              view === v
                ? 'bg-[hsl(var(--dash-ink))] text-white shadow-[0_4px_12px_-4px_hsl(0_0%_8%/0.45)]'
                : 'text-[hsl(var(--dash-muted))] hover:bg-white/70 hover:text-[hsl(var(--dash-ink))]'
            )}
          >
            {viewNames[v]}
          </button>
        ))}
      </div>
    </div>
  )
}
// Events are edited on their own pages; the calendar only navigates to them.
const READ_ONLY = { drag: false, resize: false, selectSlot: false }
// Below `sm` a month cell fits about one event row, so phones open on the list.
const NARROW_QUERY = '(max-width: 639px)'
// Non-English bundles load lazily; binding the store's "added" event gives `t`
// a new identity when one arrives, so memos over translated text refresh.
// Supported at runtime, though missing from react-i18next's option type.
const I18N_OPTIONS = { bindI18nStore: 'added' } as UseTranslationOptions<undefined>

/** date-fns locales for the app's languages, loaded on demand (English is built in). */
const DATE_LOCALES: Record<string, () => Promise<Locale>> = {
  ar: () => import('date-fns/locale/ar').then((m) => m.ar),
  bn: () => import('date-fns/locale/bn').then((m) => m.bn),
  de: () => import('date-fns/locale/de').then((m) => m.de),
  es: () => import('date-fns/locale/es').then((m) => m.es),
  fa: () => import('date-fns/locale/fa-IR').then((m) => m.faIR),
  fr: () => import('date-fns/locale/fr').then((m) => m.fr),
  hi: () => import('date-fns/locale/hi').then((m) => m.hi),
  id: () => import('date-fns/locale/id').then((m) => m.id),
  it: () => import('date-fns/locale/it').then((m) => m.it),
  ja: () => import('date-fns/locale/ja').then((m) => m.ja),
  ko: () => import('date-fns/locale/ko').then((m) => m.ko),
  nl: () => import('date-fns/locale/nl').then((m) => m.nl),
  pl: () => import('date-fns/locale/pl').then((m) => m.pl),
  pt: () => import('date-fns/locale/pt').then((m) => m.pt),
  ru: () => import('date-fns/locale/ru').then((m) => m.ru),
  sk: () => import('date-fns/locale/sk').then((m) => m.sk),
  th: () => import('date-fns/locale/th').then((m) => m.th),
  tr: () => import('date-fns/locale/tr').then((m) => m.tr),
  uk: () => import('date-fns/locale/uk').then((m) => m.uk),
  vi: () => import('date-fns/locale/vi').then((m) => m.vi),
  zh: () => import('date-fns/locale/zh-CN').then((m) => m.zhCN),
}

export function useDateLocale(language: string) {
  const code = language.split('-')[0]!
  const [loaded, setLoaded] = useState<{ code: string; locale: Locale } | null>(null)
  useEffect(() => {
    const load = DATE_LOCALES[code]
    if (!load) return
    let cancelled = false
    load().then((locale) => {
      if (!cancelled) setLoaded({ code, locale })
    })
    return () => {
      cancelled = true
    }
  }, [code])
  return loaded?.code === code ? loaded.locale : undefined
}

/**
 * Feed event → calendar event. The feed's all-day `end` is the inclusive last
 * day; the calendar wants an exclusive midnight. With `collapseSpans` (the list
 * view) a multi-day all-day event is listed once, on its first day, with its
 * date range on the row, instead of repeating on every day it covers.
 */
function toGridEvent(e: CalendarEvent, title: string, collapseSpans: boolean): GridEvent<CalendarEvent> {
  const color = EVENT_STYLES[e.type].dot
  const start = eventStart(e)
  if (e.all_day) {
    const first = startOfDay(start)
    const last = collapseSpans ? first : startOfDay(eventEnd(e))
    return { id: e.id, title, start: first, end: addDays(last < first ? first : last, 1), allDay: true, color, data: e }
  }
  const end = eventEnd(e)
  return { id: e.id, title, start, end: end < start ? start : end, color, data: e }
}

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
  const { t, i18n } = useTranslation(undefined, I18N_OPTIONS)
  const locale = useDateLocale(i18n.language)
  const today = useMemo(() => startOfDay(new Date()), [])
  const apiRef = useRef<EventCalendarApi<CalendarEvent> | null>(null)
  const [view, setView] = useState<CalendarView>(() =>
    typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches ? 'agenda' : 'month'
  )
  const [range, setRange] = useState<EventCalendarDateRange | null>(null)
  const [selectedDay, setSelectedDay] = useState(today)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [hidden, setHidden] = useState<Set<CalendarEventType>>(new Set())

  // Fetch what the calendar shows (reported through onRangeChange) plus a
  // little extra so "Up next" can look past its end.
  const rangeStart = useMemo(() => startOfDay(range?.start ?? today), [range, today])
  const rangeEnd = useMemo(() => addDays(startOfDay(range?.end ?? today), 15), [range, today])
  const { data, isLoading, isError } = useCalendarEvents(rangeStart, rangeEnd, !!range)

  const allEvents = useMemo(() => data?.events ?? [], [data])
  const events = useMemo(() => allEvents.filter((e) => !hidden.has(e.type)), [allEvents, hidden])
  const counts = useMemo(() => {
    const c: Partial<Record<CalendarEventType, number>> = {}
    for (const e of allEvents) c[e.type] = (c[e.type] ?? 0) + 1
    return c
  }, [allEvents])

  const gridEvents = useMemo(
    () => events.map((e) => toGridEvent(e, eventHeadline(t, e), view === 'agenda')),
    [events, t, view]
  )
  const byDay = useMemo(() => eventsByDay(events, rangeStart, rangeEnd), [events, rangeStart, rangeEnd])
  const dayEvents = byDay.get(dayKey(selectedDay)) ?? []
  const upNext = useMemo(
    () => events.filter((e) => eventStart(e) >= new Date() || (e.end && new Date(e.end) >= today)).slice(0, 5),
    [events, today]
  )

  // Memoized: the calendar treats a new i18n object as a settings change.
  const calendarI18n = useMemo<EventCalendarI18nOverrides>(
    () => ({
      labels: {
        today: t('calendar.today', 'Today'),
        previous: t('calendar.previous', 'Previous'),
        next: t('calendar.next', 'Next'),
        allDay: t('calendar.all_day', 'All day'),
        noEvents: t('calendar.empty_period', 'Nothing scheduled in this period.'),
        selectView: t('calendar.select_view', 'Select view'),
        goToDate: t('calendar.go_to_date', 'Go to date'),
        more: (count: number) => t('calendar.more', '+{{count}} more', { count }),
      },
      viewNames: {
        month: t('calendar.view_month', 'Month'),
        week: t('calendar.view_week', 'Week'),
        day: t('calendar.view_day', 'Day'),
        agenda: t('calendar.view_list', 'List'),
      },
    }),
    [t]
  )

  // List rows show the feed's own time label, so a collapsed multi-day event
  // reads "3 Jan – 14 Jan" rather than "All day".
  const renderAgendaEvent = useCallback(
    ({ occurrence }: EventCalendarRenderEventProps<CalendarEvent>) => {
      const e = occurrence.event.data
      if (!e) return <span className="truncate text-sm">{occurrence.event.title}</span>
      const style = EVENT_STYLES[e.type]
      const detail = [e.subtitle, e.location].filter(Boolean).join(' · ')
      return (
        <>
          <span className="w-28 shrink-0 truncate text-xs tabular-nums text-muted-foreground sm:w-44">
            {formatTimeRange(e, i18n.language, t)}
          </span>
          <span
            className="hidden shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold sm:inline-flex"
            style={{ background: style.bg, color: style.fg }}
          >
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: style.dot }} />
            {kindLabel(t, e)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-[hsl(var(--dash-ink))]">{occurrence.event.title}</span>
            {detail && <span className="truncate text-[11px] text-muted-foreground">{detail}</span>}
          </span>
        </>
      )
    },
    [i18n.language, t]
  )
  const dayClassName = useCallback(
    (day: Date) => (sameDay(day, selectedDay) ? SELECTED_DAY_CLASS : undefined),
    [selectedDay]
  )

  const selectEvent = (e: CalendarEvent) => {
    setSelectedDay(startOfDay(eventStart(e)))
    setSelectedEvent(e)
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

  const viewNames = useMemo<Partial<Record<CalendarView, string>>>(
    () => ({
      month: t('calendar.view_month', 'Month'),
      week: t('calendar.view_week', 'Week'),
      day: t('calendar.view_day', 'Day'),
      agenda: t('calendar.view_list', 'List'),
    }),
    [t]
  )

  return (
    <div className={cn('flex min-h-0 flex-col gap-4', className)}>
      {/* Header: title + scope on the left, type filters on the right */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,hsl(43_85%_60%),hsl(38_76%_42%))] text-white shadow-[0_10px_22px_-10px_hsl(43_80%_35%/0.9)]">
            <CalendarBlank size={22} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
              {t('calendar.title', 'Calendar')}
            </h1>
            <p className="truncate text-xs text-[hsl(var(--dash-muted))]">{data ? scopeText : ' '}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('calendar.filters', 'Filter by type')}>
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
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                  off
                    ? 'border border-dashed border-[hsl(var(--dash-muted))]/40 text-[hsl(var(--dash-muted))] opacity-70 hover:opacity-100'
                    : 'glass-chip hover:bg-white'
                )}
                style={off ? undefined : { color: style.fg }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: off ? 'transparent' : style.dot,
                    boxShadow: off ? `inset 0 0 0 1.5px ${style.dot}` : undefined,
                  }}
                />
                {typeLabel(t, type)}
                <span
                  className="min-w-5 rounded-full px-1.5 text-center text-[10px] font-semibold tabular-nums"
                  style={off ? undefined : { background: style.bg }}
                >
                  {counts[type]}
                </span>
              </button>
            )
          })}
          {isError && (
            <span className="text-xs text-[hsl(var(--dash-warn))]">
              {t('calendar.load_error', 'Could not load the calendar. Try again later.')}
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="glass-panel relative flex min-h-0 flex-col overflow-hidden rounded-[1.5rem]">
          <EventCalendar<CalendarEvent>
            events={gridEvents}
            views={VIEWS}
            view={view}
            onViewChange={setView}
            loading={!data && (isLoading || !range)}
            interactions={READ_ONLY}
            locale={locale}
            i18n={calendarI18n}
            renderAgendaEvent={renderAgendaEvent}
            dayClassName={dayClassName}
            todayClassName={TODAY_CLASS}
            classNames={CALENDAR_CLASSES}
            scrollToHour={8}
            apiRef={apiRef}
            onRangeChange={(info) => setRange(info.range)}
            onEventClick={(occurrence) => {
              if (occurrence.event.data) selectEvent(occurrence.event.data)
            }}
            onSlotClick={(slot) => {
              setSelectedDay(startOfDay(slot.date))
              setSelectedEvent(null)
            }}
            className={cn('min-h-[520px] flex-1', CALENDAR_THEME)}
          >
            <CalendarToolbar view={view} views={VIEWS} viewNames={viewNames} onView={setView} />
            <EventCalendarContent />
          </EventCalendar>
        </section>

        {/* Side panel: event detail, or the selected day + what's next */}
        <aside className="glass-panel flex min-h-0 flex-col rounded-[1.5rem] p-4">
          {selectedEvent ? (
            <CalendarEventDetail
              event={selectedEvent}
              context={context}
              orgslug={orgslug}
              onBack={() => {
                setSelectedEvent(null)
                apiRef.current?.clearSelection()
              }}
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
                          apiRef.current?.goTo(eventStart(e))
                          selectEvent(e)
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
    <p className="rounded-2xl border border-dashed border-white/90 bg-white/40 px-4 py-5 text-center text-xs text-[hsl(var(--dash-muted))]">
      {children}
    </p>
  )
}
