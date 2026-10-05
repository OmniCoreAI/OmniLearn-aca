'use client'

import type React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import {
  BookOpen,
  CalendarCheck,
  ChalkboardTeacher,
  Exam,
  FlagBanner,
  HourglassMedium,
  UsersThree,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { CalendarEvent, CalendarEventType, getCalendarEvents } from '@services/calendar/calendar'

/* ---------------------------------------------------------------- styles */

/** Per-type colors. Literal values: they're used in inline styles and SVG-free chips alike. */
export const EVENT_STYLES: Record<
  CalendarEventType,
  { dot: string; bg: string; fg: string; icon: React.ElementType }
> = {
  // Brand gold, bronze, ink and flag red first; slate, emerald and indigo keep
  // the remaining types distinguishable. dot = the event colour, bg = its tint,
  // fg = readable text on that tint.
  lecture: { dot: 'hsl(43 85% 48%)', bg: 'hsl(43 90% 92%)', fg: 'hsl(36 80% 28%)', icon: ChalkboardTeacher },
  class: { dot: 'hsl(24 80% 52%)', bg: 'hsl(24 90% 93%)', fg: 'hsl(20 75% 32%)', icon: BookOpen },
  exam: { dot: 'hsl(0 0% 12%)', bg: 'hsl(220 12% 90%)', fg: 'hsl(0 0% 10%)', icon: Exam },
  deadline: { dot: 'hsl(351 82% 48%)', bg: 'hsl(351 85% 94%)', fg: 'hsl(351 80% 34%)', icon: HourglassMedium },
  term: { dot: 'hsl(220 12% 50%)', bg: 'hsl(220 16% 92%)', fg: 'hsl(220 18% 28%)', icon: FlagBanner },
  program: { dot: 'hsl(158 55% 36%)', bg: 'hsl(158 45% 91%)', fg: 'hsl(158 60% 22%)', icon: CalendarCheck },
  interview: { dot: 'hsl(228 60% 55%)', bg: 'hsl(228 70% 94%)', fg: 'hsl(228 55% 32%)', icon: UsersThree },
}

export const EVENT_TYPES = Object.keys(EVENT_STYLES) as CalendarEventType[]

export function typeLabel(t: TFunction, type: CalendarEventType) {
  const labels: Record<CalendarEventType, string> = {
    lecture: t('calendar.types.lecture', 'Lectures'),
    class: t('calendar.types.class', 'Class sessions'),
    exam: t('calendar.types.exam', 'Exams'),
    deadline: t('calendar.types.deadline', 'Deadlines'),
    term: t('calendar.types.term', 'Academic dates'),
    program: t('calendar.types.program', 'Programs'),
    interview: t('calendar.types.interview', 'Admissions'),
  }
  return labels[type]
}

/** Short, human label for what the event is ("Lecture", "Registration closes", …). */
export function kindLabel(t: TFunction, e: CalendarEvent) {
  const kinds: Record<string, string> = {
    lecture: t('calendar.kinds.lecture', 'Lecture'),
    seminar: t('calendar.kinds.seminar', 'Seminar'),
    lab: t('calendar.kinds.lab', 'Lab'),
    tutorial: t('calendar.kinds.tutorial', 'Tutorial'),
    exam: t('calendar.kinds.exam', 'Exam'),
    class: t('calendar.kinds.class', 'Class session'),
    assignment: t('calendar.kinds.assignment', 'Assignment due'),
    term_start: t('calendar.kinds.term_start', 'Term starts'),
    term_end: t('calendar.kinds.term_end', 'Term ends'),
    registration_start: t('calendar.kinds.registration_start', 'Registration opens'),
    registration_end: t('calendar.kinds.registration_end', 'Registration closes'),
    add_drop_end: t('calendar.kinds.add_drop_end', 'Add/drop ends'),
    grade_deadline: t('calendar.kinds.grade_deadline', 'Grades due'),
    exam_period: t('calendar.kinds.exam_period', 'Exam period'),
    interview: t('calendar.kinds.interview', 'Admission interview'),
    entrance_test: t('calendar.kinds.entrance_test', 'Entrance test'),
  }
  if (e.kind && kinds[e.kind]) return kinds[e.kind]!
  if (e.type === 'program') return t('calendar.kinds.program', 'Training program')
  return e.kind ? e.kind.replace(/_/g, ' ') : typeLabel(t, e.type)
}

/** Title shown on chips: term milestones read better as "Registration closes · Fall 2026". */
export function eventHeadline(t: TFunction, e: CalendarEvent) {
  return e.type === 'term' ? `${kindLabel(t, e)} · ${e.title}` : e.title
}

export function statusLabel(t: TFunction, status: string | null) {
  if (!status) return null
  const labels: Record<string, string> = {
    SUBMITTED: t('calendar.status.submitted', 'Submitted'),
    GRADED: t('calendar.status.graded', 'Graded'),
    LATE: t('calendar.status.late', 'Late'),
    PENDING: t('calendar.status.pending', 'In progress'),
    NOT_SUBMITTED: t('calendar.status.not_submitted', 'Not submitted'),
    published: t('calendar.status.published', 'Published'),
    draft: t('calendar.status.draft', 'Draft'),
    scheduled: t('calendar.status.scheduled', 'Scheduled'),
    completed: t('calendar.status.completed', 'Completed'),
    cancelled: t('calendar.status.cancelled', 'Cancelled'),
  }
  return labels[status] ?? status.replace(/_/g, ' ').toLowerCase()
}

/* ---------------------------------------------------------------- dates */

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export const eventStart = (e: CalendarEvent) => new Date(e.start)
export const eventEnd = (e: CalendarEvent) => (e.end ? new Date(e.end) : new Date(e.start))

/** The 6×7 Sunday-first grid covering `month`. */
export function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** Map of dayKey → events touching that day (multi-day events appear on every day they span). */
export function eventsByDay(events: CalendarEvent[], from: Date, to: Date) {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    let day = startOfDay(eventStart(e) < from ? from : eventStart(e))
    const last = startOfDay(eventEnd(e))
    while (day <= last && day < to) {
      const key = dayKey(day)
      map.set(key, [...(map.get(key) ?? []), e])
      day = addDays(day, 1)
    }
  }
  return map
}

export function formatTimeRange(e: CalendarEvent, locale: string, t: TFunction) {
  if (e.all_day) {
    if (e.end && !sameDay(eventStart(e), eventEnd(e))) {
      const f = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      return `${f(eventStart(e))} – ${f(eventEnd(e))}`
    }
    return t('calendar.all_day', 'All day')
  }
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  if (e.end && !sameDay(eventStart(e), eventEnd(e))) {
    // Timed but spanning days: the times alone ("7:56 PM – 7:56 PM") hide the span.
    const stamp = (d: Date) =>
      d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    return `${stamp(eventStart(e))} – ${stamp(eventEnd(e))}`
  }
  return e.end ? `${time(eventStart(e))} – ${time(eventEnd(e))}` : time(eventStart(e))
}

/* ---------------------------------------------------------------- links */

const strip = (uuid: string | undefined, prefix: string) => (uuid ? uuid.replace(`${prefix}_`, '') : '')

/** Where "Open" goes: staff pages inside /dash, learner pages in the portal. */
export function eventHref(e: CalendarEvent, context: 'dash' | 'portal', orgslug: string): string | null {
  const r = e.refs
  if (context === 'dash') {
    if (r.offering_uuid) return `/dash/postgraduate/offerings/${strip(r.offering_uuid, 'offering')}`
    if (r.assignment_uuid) return `/dash/assignments/${strip(r.assignment_uuid, 'assignment')}?subpage=editor`
    if (r.application_uuid) return `/dash/postgraduate/admissions/${strip(r.application_uuid, 'application')}`
    if (r.trainingprogram_uuid) return `/dash/training-programs/${strip(r.trainingprogram_uuid, 'trainingprogram')}`
    if (r.course_uuid) return `/dash/courses/course/${strip(r.course_uuid, 'course')}/general`
    if (r.term_uuid) return '/dash/postgraduate/calendar'
    return null
  }
  const portal = (path: string) => getUriWithOrg(orgslug, path)
  if (r.application_uuid) return portal(`/admissions/${strip(r.application_uuid, 'application')}`)
  if (r.course_uuid && r.activity_uuid)
    return portal(`/course/${strip(r.course_uuid, 'course')}/activity/${strip(r.activity_uuid, 'activity')}`)
  if (r.course_uuid) return portal(`/course/${strip(r.course_uuid, 'course')}`)
  if (r.offering_uuid || r.term_uuid) return portal('/academics')
  return null
}

/* ---------------------------------------------------------------- data */

/** Events for [start, end). Keyed by range so month navigation caches per month. */
export function useCalendarEvents(start: Date, end: Date, enabled = true) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgId = org?.id
  return useQuery({
    queryKey: ['calendar-events', orgId, dayKey(start), dayKey(end)],
    queryFn: () => getCalendarEvents(orgId, token, start, end),
    enabled: enabled && !!token && !!orgId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}
