'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import {
  addMonths,
  addWeeks,
  addDays,
  format,
  getDate,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
  endOfMonth,
  endOfWeek,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { cn } from '@/lib/utils'

// Adapted from the 21st.dev GlassCalendar. Changes from the original:
// - Weekly / Monthly tabs work: a week shows 7 days, a month shows the
//   whole month as a scrolling strip.
// - The settings button and the "Add a note..." / "New Event" footer became
//   the `headerAction` and `footer` slots, so the page passes in actions it
//   really has. Without them, nothing is rendered.
// - Labels and weekday names follow `locale`/`labels` (i18n), spacing uses
//   logical properties and the chevrons flip in RTL.
// - `dayMarkers` puts up to three dots under a day (e.g. event colours), and
//   `onRangeChange` tells the parent which days are in view so it can load data.
// - `expanded` lays days out as a calendar grid (a full month, or one week row)
//   with a single weekday header, instead of the scrolling strip.

export type GlassCalendarView = 'week' | 'month'

interface Day {
  date: Date
  isToday: boolean
  isSelected: boolean
}

export interface GlassCalendarLabels {
  weekly?: string
  monthly?: string
  previousWeek?: string
  nextWeek?: string
  previousMonth?: string
  nextMonth?: string
}

const DEFAULT_LABELS: Required<GlassCalendarLabels> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  previousWeek: 'Previous week',
  nextWeek: 'Next week',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
}

export interface GlassCalendarRange {
  view: GlassCalendarView
  /** First day of the month in view (for a week, the month holding most of it). */
  month: Date
  /** First and last day shown. */
  start: Date
  end: Date
}

export interface GlassCalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  selectedDate?: Date
  onDateSelect?: (_date: Date) => void
  /** Called whenever the days in view change (and once on mount). */
  onRangeChange?: (_range: GlassCalendarRange) => void
  defaultView?: GlassCalendarView
  onViewChange?: (_view: GlassCalendarView) => void
  /** BCP 47 locale for month and weekday names; defaults to the browser's. */
  locale?: string
  labels?: GlassCalendarLabels
  /** Up to three CSS colours shown as dots under the day. */
  dayMarkers?: (_date: Date) => string[]
  /** Full month grid instead of the scrolling strip. */
  expanded?: boolean
  /** Rendered where the original had its settings button. */
  headerAction?: React.ReactNode
  /** Rendered under a divider where the original had its note / event buttons. */
  footer?: React.ReactNode
  className?: string
}

const ScrollbarHide = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  `}</style>
)

/** The month a week "belongs" to: the one holding most of its days. */
const weekMonth = (weekStart: Date) => startOfMonth(addDays(weekStart, 3))

export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  (
    {
      className,
      selectedDate: propSelectedDate,
      onDateSelect,
      onRangeChange,
      defaultView = 'week',
      onViewChange,
      locale,
      labels: labelOverrides,
      dayMarkers,
      expanded = false,
      headerAction,
      footer,
      ...props
    },
    ref
  ) => {
    const labels = { ...DEFAULT_LABELS, ...labelOverrides }
    const [view, setView] = React.useState<GlassCalendarView>(defaultView)
    const [internalSelected, setInternalSelected] = React.useState(() => propSelectedDate || new Date())
    const selectedDate = propSelectedDate ?? internalSelected
    // The date whose week (or month) is on screen.
    const [cursor, setCursor] = React.useState(selectedDate)
    const stripRef = React.useRef<HTMLDivElement>(null)

    // A new selectedDate object from the parent (e.g. a "Today" button) brings
    // that day into view, even when it was already selected.
    React.useEffect(() => {
      if (propSelectedDate) setCursor(propSelectedDate)
    }, [propSelectedDate])

    const weekStart = startOfWeek(cursor)
    const visibleMonth = view === 'week' ? weekMonth(weekStart) : startOfMonth(cursor)
    const visibleMonthTime = visibleMonth.getTime()
    const rangeStartTime = (view === 'week' ? weekStart : visibleMonth).getTime()
    React.useEffect(() => {
      const start = new Date(rangeStartTime)
      const end = view === 'week' ? addDays(start, 6) : addDays(addMonths(start, 1), -1)
      onRangeChange?.({ view, month: new Date(visibleMonthTime), start, end })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, rangeStartTime, visibleMonthTime])

    // Plain values so the memo below re-runs on a new date, not a new Date object.
    const weekStartTime = weekStart.getTime()
    const selectedTime = selectedDate.getTime()
    const days = React.useMemo(() => {
      const list: Day[] = []
      if (view === 'week') {
        for (let i = 0; i < 7; i++) {
          const date = addDays(weekStart, i)
          list.push({ date, isToday: isToday(date), isSelected: isSameDay(date, selectedDate) })
        }
      } else if (expanded) {
        // Whole weeks around the month, so the grid lines up under the weekdays.
        const last = endOfWeek(endOfMonth(cursor))
        for (let date = startOfWeek(startOfMonth(cursor)); date <= last; date = addDays(date, 1)) {
          list.push({ date, isToday: isToday(date), isSelected: isSameDay(date, selectedDate) })
        }
      } else {
        const start = startOfMonth(cursor)
        const totalDays = getDaysInMonth(cursor)
        for (let i = 0; i < totalDays; i++) {
          const date = new Date(start.getFullYear(), start.getMonth(), i + 1)
          list.push({ date, isToday: isToday(date), isSelected: isSameDay(date, selectedDate) })
        }
      }
      return list
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, expanded, weekStartTime, visibleMonthTime, selectedTime])

    // Month strip: scroll the selected day (or today) to the middle. Done by
    // delta so it works in RTL and never scrolls the page vertically.
    React.useEffect(() => {
      if (view !== 'month' || expanded) return
      const strip = stripRef.current
      const target =
        strip?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
        strip?.querySelector<HTMLElement>('[aria-current="date"]')
      if (!strip || !target) return
      const s = strip.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      strip.scrollBy({ left: t.left + t.width / 2 - (s.left + s.width / 2) })
    }, [view, expanded, visibleMonthTime])

    const handleDateClick = (date: Date) => {
      setInternalSelected(date)
      onDateSelect?.(date)
    }
    const handlePrev = () => setCursor(view === 'week' ? subWeeks(weekStart, 1) : subMonths(startOfMonth(cursor), 1))
    const handleNext = () => setCursor(view === 'week' ? addWeeks(weekStart, 1) : addMonths(startOfMonth(cursor), 1))
    const changeView = (next: GlassCalendarView) => {
      if (next === view) return
      if (next === 'week') {
        // Open the selected day's week if it's in this month, else the month's first week.
        setCursor(isSameMonth(selectedDate, cursor) ? selectedDate : startOfMonth(cursor))
      } else {
        setCursor(visibleMonth)
      }
      setView(next)
      onViewChange?.(next)
    }

    const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(visibleMonth)
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    const fullDateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })
    const showYear = visibleMonth.getFullYear() !== new Date().getFullYear()

    const renderDay = (day: Day) => {
      const markers = dayMarkers?.(day.date).slice(0, 3) ?? []
      return (
        <div
          key={format(day.date, 'yyyy-MM-dd')}
          className={cn('flex flex-col items-center gap-2', view === 'week' ? 'min-w-0 flex-1' : 'shrink-0')}
        >
          <span className="text-xs font-bold text-white/50">{weekdayFormat.format(day.date)}</span>
          <button
            type="button"
            onClick={() => handleDateClick(day.date)}
            aria-pressed={day.isSelected}
            aria-current={day.isToday ? 'date' : undefined}
            aria-label={fullDateFormat.format(day.date)}
            className={cn(
              'relative flex items-center justify-center rounded-full text-sm font-semibold tabular-nums outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/70',
              // A week fills the row and shrinks its days to fit narrow cards.
              view === 'week' ? 'aspect-square w-full max-w-10' : 'h-10 w-10',
              day.isSelected
                ? 'bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-lg'
                : 'text-white hover:bg-white/20'
            )}
          >
            {day.isToday && !day.isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-pink-400" />}
            {getDate(day.date)}
          </button>
          {dayMarkers ? (
            <span aria-hidden="true" className="flex h-1 items-center gap-[3px]">
              {markers.map((color, i) => (
                <span key={`${color}-${i}`} className="h-1 w-1 rounded-full" style={{ background: color }} />
              ))}
            </span>
          ) : null}
        </div>
      )
    }

    const renderGridDay = (day: Day) => {
      const markers = dayMarkers?.(day.date).slice(0, 3) ?? []
      const outside = view === 'month' && !isSameMonth(day.date, visibleMonth)
      return (
        <button
          key={format(day.date, 'yyyy-MM-dd')}
          type="button"
          role="gridcell"
          onClick={() => handleDateClick(day.date)}
          aria-selected={day.isSelected}
          aria-pressed={day.isSelected}
          aria-current={day.isToday ? 'date' : undefined}
          aria-label={fullDateFormat.format(day.date)}
          className={cn(
            'relative mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-2xl text-[15px] font-semibold tabular-nums outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/70',
            day.isSelected
              ? 'bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/30'
              : cn('hover:bg-white/15', outside ? 'text-white/30' : 'text-white'),
            day.isToday && !day.isSelected && 'bg-white/10 ring-1 ring-inset ring-white/30'
          )}
        >
          {getDate(day.date)}
          {markers.length > 0 || (day.isToday && !day.isSelected) ? (
            <span aria-hidden="true" className="absolute bottom-[14%] flex h-1 items-center gap-[3px]">
              {day.isToday && !day.isSelected && markers.length === 0 ? (
                <span className="h-1 w-1 rounded-full bg-pink-400" />
              ) : (
                markers.map((color, i) => (
                  <span
                    key={`${color}-${i}`}
                    className="h-1 w-1 rounded-full"
                    style={{ background: day.isSelected ? 'rgba(255,255,255,0.9)' : outside ? `color-mix(in srgb, ${color} 40%, transparent)` : color }}
                  />
                ))
              )}
            </span>
          ) : null}
        </button>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          // --glass-pad is the padding; the month strip bleeds into it to scroll edge to edge.
          'w-full max-w-[360px] overflow-hidden rounded-3xl p-[var(--glass-pad)] shadow-2xl [--glass-pad:1.25rem]',
          'border border-white/10 bg-black/20 backdrop-blur-xl',
          'text-white',
          className
        )}
        {...props}
      >
        <ScrollbarHide />
        {/* Header: tabs and the optional action */}
        <div className="mb-6 flex items-center justify-between gap-2">
          <div role="tablist" className="flex items-center gap-1 rounded-lg bg-black/20 p-1">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => changeView(v)}
                className={cn(
                  'rounded-md px-4 py-1 text-xs font-bold transition-colors',
                  view === v ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'
                )}
              >
                {v === 'week' ? labels.weekly : labels.monthly}
              </button>
            ))}
          </div>
          {headerAction}
        </div>

        {/* Month and navigation */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <motion.p
            key={format(visibleMonth, 'yyyy-MM')}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 truncate text-4xl font-bold tracking-tight"
          >
            {monthName}
            {showYear ? <span className="ms-2 text-xl font-semibold text-white/50">{visibleMonth.getFullYear()}</span> : null}
          </motion.p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              aria-label={view === 'week' ? labels.previousWeek : labels.previousMonth}
              className="rounded-full p-1 text-white/70 transition-colors hover:bg-black/20"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label={view === 'week' ? labels.nextWeek : labels.nextMonth}
              className="rounded-full p-1 text-white/70 transition-colors hover:bg-black/20"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* Days */}
        {expanded ? (
          <div role="grid" className="grid grid-cols-7 gap-x-1 gap-y-1.5 text-center">
            {days.slice(0, 7).map((day) => (
              <span key={`h-${day.date.getDay()}`} className="pb-1 text-xs font-bold text-white/50">
                {weekdayFormat.format(day.date)}
              </span>
            ))}
            {days.map(renderGridDay)}
          </div>
        ) : view === 'week' ? (
          <div className="flex justify-between gap-1">{days.map(renderDay)}</div>
        ) : (
          <div ref={stripRef} className="scrollbar-hide -mx-[var(--glass-pad)] overflow-x-auto px-[var(--glass-pad)]">
            <div className="flex gap-4">{days.map(renderDay)}</div>
          </div>
        )}

        {footer ? (
          <>
            <div className="mt-6 h-px bg-white/20" />
            <div className="mt-4 flex items-center justify-between gap-4">{footer}</div>
          </>
        ) : null}
      </div>
    )
  }
)
GlassCalendar.displayName = 'GlassCalendar'
