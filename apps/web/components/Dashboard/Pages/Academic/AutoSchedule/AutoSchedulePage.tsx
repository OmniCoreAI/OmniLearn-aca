'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation, type UseTranslationOptions } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarCheck, CaretLeft, CaretRight, GraduationCap, MagicWand } from '@phosphor-icons/react'
import { ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EventCalendar, useEventCalendarNavigation } from '@/components/ui/reui-event-calendar'
import { EventCalendarContent } from '@/components/ui/reui-event-calendar-utils/event-calendar-content'
import type { CalendarView, EventCalendarResource, CalendarEvent as GridEvent } from '@/components/ui/reui-event-calendar-utils/event-calendar-types'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { useDateLocale } from '@components/Calendar/EventsCalendar'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CALENDAR_CLASSES, CALENDAR_THEME, TODAY_CLASS } from '@components/Dashboard/Pages/Administration/HallBooking/HallCalendar'
import { parseMinuteString } from '@components/Dashboard/Pages/Administration/HallBooking/hallTime'
import { pickCurrentTerm } from '@components/Dashboard/Menus/postgradNavItems'
import { getUriWithOrg } from '@services/config/config'
import {
  applyTermSchedule,
  getOfferings,
  getTerms,
  planTermSchedule,
  type AutoScheduleApplyResult,
  type AutoSchedulePlan,
  type PlannedMeeting,
} from '@services/academic/core'

// The academy's week starts on Saturday (matches the API).
const WEEKDAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']
const DEFAULT_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu']
const LIVE = ['planned', 'open', 'in_progress']
const DURATIONS = [60, 90, 120, 150, 180]
const I18N_OPTIONS = { bindI18nStore: 'added' } as UseTranslationOptions<undefined>
const PREVIEW_VIEWS: CalendarView[] = ['week', 'resource']
const READ_ONLY = { drag: false, resize: false, selectSlot: false }
const COLORS = [
  'hsl(43 85% 48%)', 'hsl(228 60% 55%)', 'hsl(158 55% 36%)', 'hsl(24 80% 52%)', 'hsl(280 45% 52%)',
  'hsl(195 70% 40%)', 'hsl(351 70% 50%)', 'hsl(90 45% 38%)', 'hsl(0 0% 25%)', 'hsl(320 55% 48%)',
]

type Row = { meetings: number; duration: number }

function colorFor(uuid: string) {
  let h = 0
  for (const ch of uuid) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/** Localized weekday name for a planner day key (sat … fri). */
function weekdayName(key: string, locale: string, style: 'long' | 'short' = 'long') {
  // 6 Jan 2024 was a Saturday.
  const d = new Date(2024, 0, 6 + WEEKDAYS.indexOf(key))
  return d.toLocaleDateString(locale, { weekday: style })
}

function unplacedText(t: TFunction, reason: string, params: Record<string, any>) {
  switch (reason) {
    case 'no_room':
      return t('academic.auto.reason_no_room', 'No active room seats {{size}}', params)
    case 'no_slot':
      return t('academic.auto.reason_no_slot', 'No clash-free time left — the teacher, cohort or suitable rooms are fully booked')
    case 'too_many_meetings':
      return t('academic.auto.reason_too_many_meetings', '{{meetings}} meetings a week but only {{days}} teaching days', params)
    case 'too_long':
      return t('academic.auto.reason_too_long', 'A {{minutes}}-minute meeting does not fit the teaching day', params)
    case 'already_scheduled':
      return t('academic.auto.reason_already_scheduled', 'Already has {{sessions}} sessions', params)
    default:
      return t('academic.auto.reason_not_schedulable', 'Its status does not allow scheduling')
  }
}

function PreviewToolbar({ view, onView }: { view: CalendarView; onView: (_v: CalendarView) => void }) {
  const { t } = useTranslation()
  const nav = useEventCalendarNavigation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="glass-chip flex items-center rounded-full p-0.5">
          <button type="button" onClick={nav.prev} aria-label={t('calendar.previous', 'Previous')} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white">
            <CaretLeft size={15} weight="bold" className="rtl:rotate-180" />
          </button>
          <button type="button" onClick={nav.next} aria-label={t('calendar.next', 'Next')} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white">
            <CaretRight size={15} weight="bold" className="rtl:rotate-180" />
          </button>
        </div>
        <h3 className="truncate text-base font-semibold text-[hsl(var(--dash-ink))]" aria-live="polite">
          {nav.title}
        </h3>
      </div>
      <div className="glass-chip flex rounded-full p-0.5" role="tablist">
        {PREVIEW_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onView(v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
              view === v ? 'bg-[hsl(var(--dash-ink))] text-white' : 'text-[hsl(var(--dash-muted))] hover:bg-white/70'
            )}
          >
            {v === 'week' ? t('calendar.view_week', 'Week') : t('administration.halls.view_rooms', 'Rooms')}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Term auto-scheduling: pick a term and the teaching pattern, get a clash-free
 * weekly timetable (OR-Tools, server-side) as a draft, review it, then create
 * the sessions.
 */
export default function AutoSchedulePage({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation(undefined, I18N_OPTIONS)
  const locale = useDateLocale(i18n.language)
  const { orgId, access_token, ready } = useAcademicContext()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()

  const [termChoice, setTermChoice] = useState<string | null>(null)
  const [days, setDays] = useState<string[]>(DEFAULT_DAYS)
  const [dayStart, setDayStart] = useState('08:00')
  const [dayEnd, setDayEnd] = useState('18:00')
  const [meetings, setMeetings] = useState(2)
  const [duration, setDuration] = useState(90)
  const [sameTime, setSameTime] = useState(true)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [rows, setRows] = useState<Record<string, Partial<Row>>>({})
  const [plan, setPlan] = useState<AutoSchedulePlan | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [planning, setPlanning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<AutoScheduleApplyResult | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [view, setView] = useState<CalendarView>('week')

  const { data: terms = [] } = useQuery({ queryKey: ['academic', 'terms', orgId], queryFn: () => getTerms(orgId, access_token), enabled: ready })
  const current = useMemo(() => pickCurrentTerm(terms as any[]), [terms])
  const term = termChoice ?? current?.term_uuid ?? (terms as any[])[0]?.term_uuid ?? ''
  const termRow = (terms as any[]).find((x) => x.term_uuid === term)
  const { data: offerings = [], isLoading } = useQuery({
    queryKey: ['academic', 'offerings', orgId, term],
    queryFn: () => getOfferings(orgId, access_token, { term_uuid: term }),
    enabled: ready && !!term,
  })
  const live = useMemo(() => (offerings as any[]).filter((o) => LIVE.includes(o.status)), [offerings])
  // Unscheduled offerings are selected by default.
  const chosen = useMemo(
    () => selected ?? new Set(live.filter((o) => !o.session_count).map((o) => o.offering_uuid)),
    [selected, live]
  )
  const changeTerm = (uuid: string) => {
    setTermChoice(uuid)
    setSelected(null)
    setRows({})
    setPlan(null)
    setApplied(null)
  }

  const toggleDay = (d: string) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : WEEKDAYS.filter((w) => w === d || prev.includes(w))))
  const toggleOffering = (uuid: string) =>
    setSelected(() => {
      const next = new Set(chosen)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })

  const generate = async () => {
    if (!term || !chosen.size || !days.length) return
    setPlanning(true)
    setApplied(null)
    try {
      const result = await planTermSchedule(
        term,
        {
          offerings: [...chosen].map((uuid) => ({
            offering_uuid: uuid,
            meetings_per_week: rows[uuid]?.meetings,
            duration_minutes: rows[uuid]?.duration,
          })),
          days,
          day_start: dayStart,
          day_end: dayEnd,
          meetings_per_week: meetings,
          duration_minutes: duration,
          same_time: sameTime,
          time_limit_seconds: 20,
        },
        access_token
      )
      setPlan(result)
      setExcluded(new Set())
    } catch (err: any) {
      toast.error(err?.message || t('academic.auto.plan_failed', 'Could not build a timetable'))
    } finally {
      setPlanning(false)
    }
  }

  const included = useMemo(() => (plan?.meetings || []).filter((m) => !excluded.has(m.offering_uuid)), [plan, excluded])
  const sessionsToCreate = included.reduce((n, m) => n + m.dates.length, 0)
  const skippedCount = included.reduce((n, m) => n + m.skipped.length, 0)
  const placedOfferings = useMemo(() => new Set((plan?.meetings || []).map((m) => m.offering_uuid)), [plan])
  const byOffering = useMemo(() => {
    const map = new Map<string, PlannedMeeting[]>()
    for (const m of plan?.meetings || []) map.set(m.offering_uuid, [...(map.get(m.offering_uuid) || []), m])
    return [...map.entries()]
  }, [plan])

  const apply = async () => {
    if (!plan || !included.length) return
    const ok = await confirm({
      title: t('academic.auto.apply_title', 'Create {{count}} sessions?', { count: sessionsToCreate }),
      message: t('academic.auto.apply_message', 'Each meeting becomes a session on every teaching week, with its room booked. Dates listed as skipped are left out.'),
      confirmText: t('academic.auto.apply', 'Create sessions'),
      tone: 'info',
    })
    if (!ok) return
    setApplying(true)
    try {
      const result = await applyTermSchedule(
        plan.term_uuid,
        included.map(({ offering_uuid, day, start, end, facility_uuid }) => ({ offering_uuid, day, start, end, facility_uuid })),
        access_token
      )
      setApplied(result)
      setPlan(null)
      setSelected(null)
      toast.success(t('academic.auto.applied', '{{count}} sessions created', { count: result.created }))
      queryClient.invalidateQueries({ queryKey: ['academic', 'offerings'] })
      queryClient.invalidateQueries({ queryKey: ['halls'] })
    } catch (err: any) {
      toast.error(err?.message || t('academic.auto.apply_failed', 'Could not create the sessions'))
    } finally {
      setApplying(false)
    }
  }

  // Preview: every session the plan would create, on its real date.
  const gridEvents = useMemo<GridEvent<PlannedMeeting>[]>(
    () =>
      included.flatMap((m) =>
        m.dates.flatMap((d) => {
          const start = parseMinuteString(`${d}T${m.start}`)
          const end = parseMinuteString(`${d}T${m.end}`)
          return start && end
            ? [{ id: `${m.offering_uuid}-${d}-${m.start}`, title: `${m.offering_code} · ${m.facility_name}`, start, end, resourceId: m.facility_uuid, color: colorFor(m.offering_uuid), readOnly: true, data: m }]
            : []
        })
      ),
    [included]
  )
  const resources = useMemo<EventCalendarResource[]>(() => {
    const seen = new Map<string, string>()
    for (const m of included) seen.set(m.facility_uuid, m.facility_name)
    return [...seen].map(([id, title]) => ({ id, title }))
  }, [included])
  const firstDate = useMemo(() => {
    const dates = included.flatMap((m) => m.dates).sort()
    return dates.length ? parseMinuteString(dates[0]) : null
  }, [included])

  const dayChip = (d: string) => (
    <button
      key={d}
      type="button"
      aria-pressed={days.includes(d)}
      onClick={() => toggleDay(d)}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        days.includes(d) ? 'bg-[hsl(var(--dash-ink))] text-white' : 'border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
      )}
    >
      {weekdayName(d, i18n.language, 'short')}
    </button>
  )

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_offerings', 'Course Offerings'), href: getUriWithOrg(orgslug, '/dash/postgraduate/offerings') },
          { label: t('academic.auto.title', 'Auto-schedule') },
        ]}
      />
      <AcademicHeader
        title={t('academic.auto.title', 'Auto-schedule')}
        subtitle={t('academic.auto.subtitle', 'Build a clash-free weekly timetable for a term: days, times and rooms for every offering, with no room, teacher or cohort booked twice.')}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Settings */}
        <section className="dash-card space-y-5 self-start rounded-[1.25rem] p-5">
          <Field label={t('academic.term', 'Term')}>
            <select className={inputCls} value={term} onChange={(e) => changeTerm(e.target.value)}>
              {(terms as any[]).map((x) => (
                <option key={x.term_uuid} value={x.term_uuid}>
                  {x.name || x.code}
                </option>
              ))}
            </select>
          </Field>
          {termRow && (!termRow.start_date || !termRow.end_date) ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('academic.auto.term_needs_dates', 'Set this term’s start and end dates first.')}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[hsl(var(--dash-ink))]">{t('academic.auto.days', 'Teaching days')}</p>
            <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map(dayChip)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('academic.auto.day_start', 'From')}>
              <input type="time" step={900} className={inputCls} value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
            </Field>
            <Field label={t('academic.auto.day_end', 'Until')}>
              <input type="time" step={900} className={inputCls} value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
            </Field>
            <Field label={t('academic.auto.meetings', 'Meetings a week')}>
              <select className={inputCls} value={meetings} onChange={(e) => setMeetings(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('academic.auto.duration', 'Each meeting')}>
              <select className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((n) => (
                  <option key={n} value={n}>
                    {t('academic.auto.minutes', '{{count}} min', { count: n })}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sameTime} onChange={(e) => setSameTime(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--dash-ink))]" />
            {t('academic.auto.same_time', 'Same time on every meeting day')}
          </label>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm font-medium text-[hsl(var(--dash-ink))]">{t('academic.auto.offerings', 'Offerings to schedule')}</p>
              <span className="text-xs tabular-nums text-[hsl(var(--dash-muted))]">
                {chosen.size}/{live.length}
              </span>
            </div>
            <div className="max-h-[340px] space-y-1 overflow-y-auto pe-1">
              {isLoading ? (
                <div className="dash-shimmer h-24 rounded-xl" />
              ) : live.length === 0 ? (
                <p className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-4 text-center text-xs text-[hsl(var(--dash-muted))]">
                  {t('academic.auto.no_offerings', 'No planned or running offerings in this term.')}
                </p>
              ) : (
                live.map((o) => (
                  <div key={o.offering_uuid} className={cn('rounded-xl border px-3 py-2', chosen.has(o.offering_uuid) ? 'border-[hsl(var(--dash-accent))]/50 bg-[hsl(var(--dash-accent-soft))]/40' : 'border-[hsl(var(--dash-border))]')}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" checked={chosen.has(o.offering_uuid)} onChange={() => toggleOffering(o.offering_uuid)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--dash-ink))]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{o.code}</span>
                        <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
                          {[o.course_name, o.cohort_name, o.capacity ? t('administration.facilities.capacity_n', '{{count}} people', { count: o.capacity }) : null].filter(Boolean).join(' · ')}
                        </span>
                        {o.session_count ? (
                          <span className="mt-0.5 block text-[11px] font-medium text-amber-700">
                            {t('academic.auto.has_sessions', 'Already has {{count}} sessions', { count: o.session_count })}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {chosen.has(o.offering_uuid) ? (
                      <div className="mt-1.5 flex gap-1.5 ps-6">
                        <select
                          aria-label={t('academic.auto.meetings', 'Meetings a week')}
                          className="rounded-lg border border-[hsl(var(--dash-border))] bg-white px-1.5 py-0.5 text-[11px]"
                          value={rows[o.offering_uuid]?.meetings ?? ''}
                          onChange={(e) => setRows((r) => ({ ...r, [o.offering_uuid]: { ...r[o.offering_uuid], meetings: e.target.value ? Number(e.target.value) : undefined } }))}
                        >
                          <option value="">{t('academic.auto.per_week_default', '{{count}}× / week', { count: meetings })}</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {t('academic.auto.per_week', '{{count}}× / week', { count: n })}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label={t('academic.auto.duration', 'Each meeting')}
                          className="rounded-lg border border-[hsl(var(--dash-border))] bg-white px-1.5 py-0.5 text-[11px]"
                          value={rows[o.offering_uuid]?.duration ?? ''}
                          onChange={(e) => setRows((r) => ({ ...r, [o.offering_uuid]: { ...r[o.offering_uuid], duration: e.target.value ? Number(e.target.value) : undefined } }))}
                        >
                          <option value="">{t('academic.auto.minutes', '{{count}} min', { count: duration })}</option>
                          {DURATIONS.map((n) => (
                            <option key={n} value={n}>
                              {t('academic.auto.minutes', '{{count}} min', { count: n })}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <AcademicPrimaryButton onClick={generate} disabled={planning || !chosen.size || !days.length || !term} className="w-full justify-center py-2.5 text-sm disabled:opacity-50">
            {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <MagicWand size={16} weight="bold" />}
            {planning ? t('academic.auto.planning', 'Finding a clash-free timetable…') : t('academic.auto.generate', 'Build timetable')}
          </AcademicPrimaryButton>
        </section>

        {/* Result */}
        <section className="min-w-0 space-y-4">
          {applied ? (
            <div className="dash-card rounded-[1.25rem] p-5">
              <p className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--dash-ink))]">
                <CalendarCheck size={20} weight="duotone" className="text-emerald-600" />
                {t('academic.auto.applied_title', '{{count}} sessions created for {{offerings}} offerings', { count: applied.created, offerings: applied.offerings })}
              </p>
              {applied.skipped.length ? (
                <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">{t('academic.auto.applied_skipped', '{{count}} dates were left out because something else was booked.', { count: applied.skipped.length })}</p>
              ) : null}
              {applied.already_scheduled.length ? (
                <p className="mt-1 text-xs text-amber-800">{t('academic.auto.applied_already', 'Left alone (scheduled meanwhile): {{codes}}', { codes: applied.already_scheduled.join(', ') })}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={getUriWithOrg(orgslug, '/dash/administration/facilities/calendar')} className="rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                  {t('administration.halls.calendar', 'Hall calendar')}
                </Link>
                <Link href={getUriWithOrg(orgslug, '/dash/postgraduate/offerings')} className="rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-xs font-medium hover:bg-[hsl(var(--dash-canvas))]">
                  {t('academic.tab_offerings', 'Course Offerings')}
                </Link>
              </div>
            </div>
          ) : null}

          {!plan && !applied ? (
            <div className="dash-card flex min-h-[320px] flex-col items-center justify-center rounded-[1.25rem] p-8 text-center">
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-ink))]">
                <MagicWand size={24} weight="duotone" />
              </span>
              <p className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('academic.auto.empty_title', 'Your timetable will appear here')}</p>
              <p className="mt-1 max-w-md text-xs text-[hsl(var(--dash-muted))]">
                {t('academic.auto.empty_desc', 'Nothing is saved until you review the draft and create the sessions. Recurring bookings are avoided; a one-off booking only removes the dates it hits.')}
              </p>
            </div>
          ) : null}

          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  [t('academic.auto.stat_placed', 'Offerings placed'), `${placedOfferings.size}/${placedOfferings.size + plan.unplaced.length}`],
                  [t('academic.auto.stat_sessions', 'Sessions to create'), String(sessionsToCreate)],
                  [t('academic.auto.stat_skipped', 'Dates skipped'), String(skippedCount)],
                  [t('academic.auto.stat_weeks', 'Teaching weeks'), String(plan.weeks)],
                ].map(([label, value]) => (
                  <div key={label} className="dash-card rounded-[1.1rem] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{label}</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[hsl(var(--dash-muted))]">
                {plan.status === 'optimal'
                  ? t('academic.auto.status_optimal', 'Best possible timetable for these rules (found in {{seconds}} s).', { seconds: (plan.solve_ms / 1000).toFixed(1) })
                  : plan.status === 'feasible'
                    ? t('academic.auto.status_feasible', 'Clash-free timetable found in {{seconds}} s; a slightly better one may exist.', { seconds: (plan.solve_ms / 1000).toFixed(1) })
                    : plan.status === 'timeout'
                      ? t('academic.auto.status_timeout', 'No timetable found in time. Try fewer offerings or more days and hours.')
                      : null}{' '}
                {t('academic.auto.teaching_window', 'Teaching weeks: {{start}} → {{end}}.', { start: plan.teaching_start, end: plan.teaching_end })}
              </p>

              {plan.unplaced.length ? (
                <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50/70 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                    <TriangleAlert className="h-4 w-4" />
                    {t('academic.auto.unplaced', 'Not scheduled ({{count}})', { count: plan.unplaced.length })}
                  </p>
                  <ul className="space-y-1 text-xs text-amber-900">
                    {plan.unplaced.map((u) => (
                      <li key={u.offering_uuid}>
                        <span className="font-semibold">{u.offering_code}</span>
                        {u.course_name ? ` · ${u.course_name}` : ''} — {unplacedText(t, u.reason, u.params)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {included.length ? (
                <div className="glass-panel relative flex flex-col overflow-hidden rounded-[1.5rem]">
                  <EventCalendar<PlannedMeeting>
                    key={`${plan.term_uuid}-${plan.solve_ms}-${plan.sessions_to_create}`}
                    events={gridEvents}
                    views={PREVIEW_VIEWS}
                    view={view}
                    onViewChange={setView}
                    defaultDate={firstDate ?? undefined}
                    resources={resources}
                    interactions={READ_ONLY}
                    locale={locale}
                    weekStartsOn={6}
                    dayStartHour={7}
                    dayEndHour={21}
                    scrollToHour={8}
                    classNames={CALENDAR_CLASSES}
                    todayClassName={TODAY_CLASS}
                    className={cn('min-h-[520px]', CALENDAR_THEME)}
                  >
                    <PreviewToolbar view={view} onView={setView} />
                    <EventCalendarContent />
                  </EventCalendar>
                </div>
              ) : null}

              {byOffering.length ? (
                <div className="dash-card overflow-hidden rounded-[1.25rem]">
                  <ul className="divide-y divide-[hsl(var(--dash-border))]">
                    {byOffering.map(([uuid, ms]) => {
                      const off = excluded.has(uuid)
                      const skipped = ms.flatMap((m) => m.skipped.map((s) => ({ ...s, day: m.day })))
                      return (
                        <li key={uuid} className={cn('px-4 py-3', off && 'opacity-50')}>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              type="checkbox"
                              checked={!off}
                              aria-label={t('academic.auto.include', 'Include')}
                              onChange={() =>
                                setExcluded((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(uuid)) next.delete(uuid)
                                  else next.add(uuid)
                                  return next
                                })
                              }
                              className="h-4 w-4 accent-[hsl(var(--dash-ink))]"
                            />
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorFor(uuid) }} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{ms[0].offering_code}</p>
                              <p className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{[ms[0].course_name, ms[0].cohort_name].filter(Boolean).join(' · ')}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {ms.map((m) => (
                                <span key={m.day} className="rounded-full bg-[hsl(var(--dash-canvas))] px-2.5 py-1 text-[11.5px] font-medium tabular-nums">
                                  {weekdayName(m.day, i18n.language, 'short')} {m.start}–{m.end}
                                </span>
                              ))}
                            </div>
                            <div className="w-44 text-end text-xs leading-tight">
                              <p className="truncate font-medium">{ms[0].facility_name}</p>
                              <p className="text-[11px] text-[hsl(var(--dash-muted))]">
                                {ms[0].size != null && ms[0].facility_capacity != null
                                  ? t('academic.auto.fit', '{{size}} in {{capacity}} seats', { size: ms[0].size, capacity: ms[0].facility_capacity })
                                  : ms[0].size == null
                                    ? t('academic.auto.size_unknown', 'Class size unknown — larger room chosen')
                                    : t('academic.auto.sessions_n', '{{count}} sessions', { count: ms.reduce((n, m) => n + m.dates.length, 0) })}
                              </p>
                            </div>
                          </div>
                          {skipped.length ? (
                            <div className="mt-2 ps-7">
                              <button
                                type="button"
                                onClick={() => setOpenRow(openRow === uuid ? null : uuid)}
                                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-800 hover:underline"
                              >
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openRow === uuid && 'rotate-180')} />
                                {t('academic.auto.skipped_n', '{{count}} dates skipped', { count: skipped.length })}
                              </button>
                              {openRow === uuid ? (
                                <ul className="mt-1.5 space-y-1 text-[11.5px] text-[hsl(var(--dash-muted))]">
                                  {skipped.map((s) => (
                                    <li key={`${s.date}-${s.day}`}>
                                      <span className="font-medium tabular-nums text-[hsl(var(--dash-ink))]">{s.date}</span> — <span dir="auto">{s.reasons.join('; ')}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--dash-border))] bg-white/70 px-4 py-3">
                    <p className="text-xs text-[hsl(var(--dash-muted))]">
                      {t('academic.auto.apply_hint', 'Untick an offering to leave it out. Every date is checked again when you create the sessions.')}
                    </p>
                    <button
                      type="button"
                      onClick={apply}
                      disabled={applying || !included.length}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck size={16} weight="bold" />}
                      {t('academic.auto.apply_n', 'Create {{count}} sessions', { count: sessionsToCreate })}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
      {dialog}
    </AcademicPageShell>
  )
}
