'use client'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation, type UseTranslationOptions } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CaretLeft, CaretRight, Door } from '@phosphor-icons/react'
import { ArrowLeft, CalendarClock, MapPin, Pencil, Plus, TriangleAlert, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  EventCalendar,
  useEventCalendarNavigation,
  type EventCalendarApi,
  type EventCalendarClassNames,
} from '@/components/ui/reui-event-calendar'
import { EventCalendarContent } from '@/components/ui/reui-event-calendar-utils/event-calendar-content'
import type { EventCalendarI18nOverrides } from '@/components/ui/reui-event-calendar-utils/event-calendar-i18n'
import type {
  CalendarView,
  EventCalendarDateRange,
  EventCalendarProposedUpdate,
  EventCalendarResource,
  CalendarEvent as GridEvent,
} from '@/components/ui/reui-event-calendar-utils/event-calendar-types'
import { useDateLocale } from '@components/Calendar/EventsCalendar'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, AdminDrawer, useAdminContext, useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'
import { getUriWithOrg } from '@services/config/config'
import {
  cancelFacilityBooking,
  getFacilities,
  getOrgFacilityBookings,
  updateFacilityBooking,
  type FacilityBooking,
} from '@services/administration/administration'
import { BookingForm, bookingKindLabel } from './BookingForm'
import { formatSlot, parseMinuteString, toMinuteString } from './hallTime'

const VIEWS: CalendarView[] = ['resource', 'week', 'agenda']
const NARROW_QUERY = '(max-width: 639px)'
const I18N_OPTIONS = { bindI18nStore: 'added' } as UseTranslationOptions<undefined>
const INTERACTIONS = { drag: true, resize: true, selectSlot: true }
// Opening window used for the day-load bars.
const DAY_MINUTES = 12 * 60

const KIND_COLORS: Record<string, string> = {
  session: 'hsl(43 85% 48%)',
  event: 'hsl(228 60% 55%)',
  exam: 'hsl(0 0% 12%)',
  meeting: 'hsl(158 55% 36%)',
  maintenance: 'hsl(220 12% 50%)',
  other: 'hsl(24 80% 52%)',
}
const DOUBLE_BOOKED_COLOR = 'hsl(351 82% 48%)'

export const CALENDAR_THEME = [
  '[--color-primary:hsl(var(--dash-accent))]',
  '[--color-primary-foreground:hsl(var(--dash-ink))]',
  '[--color-foreground:hsl(var(--dash-ink))]',
  '[--color-muted-foreground:hsl(var(--dash-muted))]',
  '[--color-border:hsl(222_25%_60%/0.18)]',
].join(' ')

export const CALENDAR_CLASSES: EventCalendarClassNames = {
  event: cn(
    'rounded-md text-[11.5px]',
    'not-data-[view=agenda]:rounded-lg not-data-[view=agenda]:border-s-[3px] not-data-[view=agenda]:border-(--ec-event-color)',
    'not-data-[view=agenda]:bg-linear-to-r not-data-[view=agenda]:from-(--ec-event-color)/25 not-data-[view=agenda]:to-(--ec-event-color)/8',
    'not-data-[view=agenda]:font-medium not-data-[view=agenda]:shadow-[0_1px_2px_hsl(222_40%_18%/0.06)]'
  ),
  timeGridHeader: 'bg-white/35',
  timeGutterLabel: 'text-[11px] tabular-nums',
  agendaDayHeader: 'bg-white/40 text-[13px]',
}
export const TODAY_CLASS = 'bg-[linear-gradient(180deg,hsl(43_90%_60%/0.16),hsl(43_90%_60%/0.04))]'

type Pending = Record<string, { start: string; end: string; facility_uuid: string }>

function overlaps(a0: Date, a1: Date, b0: Date, b1: Date) {
  return a0 < b1 && b0 < a1
}

function HallToolbar({
  view,
  viewNames,
  onView,
  locations,
  location,
  onLocation,
}: {
  view: CalendarView
  viewNames: Record<string, string>
  onView: (_v: CalendarView) => void
  locations: { value: string; label: string }[]
  location: string
  onLocation: (_v: string) => void
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
          <button type="button" onClick={nav.prev} aria-label={t('calendar.previous', 'Previous')} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white">
            <CaretLeft size={15} weight="bold" className="rtl:rotate-180" />
          </button>
          <button type="button" onClick={nav.next} aria-label={t('calendar.next', 'Next')} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white">
            <CaretRight size={15} weight="bold" className="rtl:rotate-180" />
          </button>
        </div>
        <h2 className="truncate text-lg font-semibold tracking-tight text-[hsl(var(--dash-ink))]" aria-live="polite">
          {nav.title}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {locations.length ? (
          <label className="glass-chip flex items-center gap-1.5 rounded-full py-1 pe-1 ps-3 text-xs text-[hsl(var(--dash-muted))]">
            <MapPin className="h-3.5 w-3.5" />
            <select
              value={location}
              onChange={(e) => onLocation(e.target.value)}
              className="rounded-full bg-transparent py-0.5 pe-1 text-xs font-medium text-[hsl(var(--dash-ink))] focus:outline-none"
              aria-label={t('administration.facilities.location', 'Location')}
            >
              <option value="all">{t('administration.halls.all_locations', 'All locations')}</option>
              {locations.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="glass-chip flex rounded-full p-0.5" role="tablist" aria-label={t('calendar.select_view', 'Select view')}>
          {VIEWS.map((v) => (
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
    </div>
  )
}

/**
 * Hall calendar: one column per room for a day (or a week / list), with every
 * booking — schedule sessions and direct hall bookings. Drag on empty space to
 * book, drag a hall booking to move it (sessions move from their schedule).
 */
export default function HallCalendar({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation(undefined, I18N_OPTIONS)
  const locale = useDateLocale(i18n.language)
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const apiRef = useRef<EventCalendarApi<FacilityBooking> | null>(null)
  const [view, setView] = useState<CalendarView>(() =>
    typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches ? 'agenda' : 'resource'
  )
  const [range, setRange] = useState<EventCalendarDateRange | null>(null)
  const [anchor, setAnchor] = useState(() => new Date())
  const [location, setLocation] = useState('all')
  const [selected, setSelected] = useState<FacilityBooking | null>(null)
  const [drawer, setDrawer] = useState<{ booking?: FacilityBooking; initial?: { facility_uuid?: string; start?: string; end?: string } } | null>(null)
  const [pending, setPending] = useState<Pending>({})

  const { data: facilities = [] } = useQuery({
    queryKey: ['administration', 'facilities', orgId],
    queryFn: () => getFacilities(orgId, access_token),
    enabled: ready,
  })
  const since = range ? toMinuteString(range.start) : undefined
  const until = range ? toMinuteString(range.end) : undefined
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['halls', 'bookings', orgId, since, until],
    queryFn: () => getOrgFacilityBookings(orgId, access_token, since, until),
    enabled: ready && !!range,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['halls'] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'facility'] })
  }

  const locationOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const f of facilities as any[]) if (f.location_uuid) seen.set(f.location_uuid, f.location_name || f.location_uuid)
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [facilities])
  const rooms = useMemo(
    () =>
      (facilities as any[]).filter(
        (f) => f.status !== 'inactive' && (location === 'all' || f.location_uuid === location)
      ),
    [facilities, location]
  )
  const roomByUuid = useMemo(() => new Map((facilities as any[]).map((f) => [f.facility_uuid, f])), [facilities])
  const resources = useMemo<EventCalendarResource[]>(
    () => rooms.map((f) => ({ id: f.facility_uuid, title: f.name })),
    [rooms]
  )

  const visible = useMemo(() => {
    const ids = new Set(rooms.map((f) => f.facility_uuid))
    return (bookings as FacilityBooking[])
      .filter((b) => b.facility_uuid && ids.has(b.facility_uuid))
      .map((b) => (pending[b.booking_uuid] ? { ...b, starts_at: pending[b.booking_uuid].start, ends_at: pending[b.booking_uuid].end, facility_uuid: pending[b.booking_uuid].facility_uuid } : b))
  }, [bookings, rooms, pending])

  const gridEvents = useMemo<GridEvent<FacilityBooking>[]>(
    () =>
      visible.flatMap((b) => {
        const start = parseMinuteString(b.starts_at)
        const end = parseMinuteString(b.ends_at)
        if (!start || !end) return []
        const title = b.title || bookingKindLabel(t, b.kind)
        return [
          {
            id: b.booking_uuid,
            title: view === 'resource' ? title : `${title} · ${b.facility_name || ''}`,
            start,
            end,
            resourceId: b.facility_uuid || undefined,
            color: b.double_booked ? DOUBLE_BOOKED_COLOR : KIND_COLORS[b.kind] || KIND_COLORS.other,
            // Sessions are moved from their course / offering schedule.
            readOnly: b.source !== 'manual',
            data: b,
          },
        ]
      }),
    [visible, t, view]
  )

  const calendarI18n = useMemo<EventCalendarI18nOverrides>(
    () => ({
      labels: {
        today: t('calendar.today', 'Today'),
        previous: t('calendar.previous', 'Previous'),
        next: t('calendar.next', 'Next'),
        allDay: t('calendar.all_day', 'All day'),
        noEvents: t('administration.halls.empty_period', 'No bookings in this period.'),
        selectView: t('calendar.select_view', 'Select view'),
        goToDate: t('calendar.go_to_date', 'Go to date'),
        more: (count: number) => t('calendar.more', '+{{count}} more', { count }),
      },
    }),
    [t]
  )
  const viewNames = useMemo(
    () => ({
      resource: t('administration.halls.view_rooms', 'Rooms'),
      week: t('calendar.view_week', 'Week'),
      agenda: t('calendar.view_list', 'List'),
    }),
    [t]
  )

  const confirmConflict = (message: string) =>
    confirm({
      title: t('administration.facilities.book_anyway', 'Book the room anyway?'),
      message,
      confirmText: t('academic.off.book_anyway', 'Book anyway'),
    })

  // Client-side guard while dragging: never drop onto another booking.
  const canDropEvent = useCallback(
    (update: EventCalendarProposedUpdate<FacilityBooking>) => {
      const roomId = update.resourceId ?? update.event.resourceId
      return !gridEvents.some(
        (e) => e.id !== update.event.id && e.resourceId === roomId && overlaps(update.start, update.end, e.start, e.end)
      )
    },
    [gridEvents]
  )

  const moveBooking = (update: EventCalendarProposedUpdate<FacilityBooking>) => {
    const b = update.event.data
    if (!b || b.source !== 'manual') return false
    const next = {
      start: toMinuteString(update.start),
      end: toMinuteString(update.end),
      facility_uuid: update.resourceId ?? b.facility_uuid ?? '',
    }
    setPending((p) => ({ ...p, [b.booking_uuid]: next }))
    updateFacilityBooking(b.booking_uuid, next, access_token)
      .then((saved) => {
        toast.success(t('administration.halls.moved', 'Booking moved'))
        setSelected((s) => (s?.booking_uuid === saved.booking_uuid ? saved : s))
        return queryClient.invalidateQueries({ queryKey: ['halls'] })
      })
      .catch((err: any) => toast.error(err?.message || t('administration.common.save_failed', 'Could not save')))
      .finally(() =>
        setPending((p) => {
          const { [b.booking_uuid]: _done, ...rest } = p
          return rest
        })
      )
    return true
  }

  const cancelBooking = async (b: FacilityBooking) => {
    const ok = await confirm({
      title: t('administration.halls.cancel_title', 'Cancel “{{title}}”?', { title: b.title }),
      message: t('administration.halls.cancel_message', 'The room becomes free for this time.'),
      confirmText: t('administration.halls.cancel_booking', 'Cancel booking'),
    })
    if (!ok) return
    try {
      await cancelFacilityBooking(b.booking_uuid, access_token)
      toast.success(t('administration.halls.cancelled', 'Booking cancelled'))
      setSelected(null)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  // Day load: booked minutes per room on the anchor day.
  const dayLoad = useMemo(() => {
    const dayStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    const minutes = new Map<string, number>()
    for (const e of gridEvents) {
      if (!e.resourceId || !overlaps(e.start, e.end, dayStart, dayEnd)) continue
      const from = Math.max(e.start.getTime(), dayStart.getTime())
      const to = Math.min(e.end.getTime(), dayEnd.getTime())
      minutes.set(e.resourceId, (minutes.get(e.resourceId) || 0) + (to - from) / 60000)
    }
    return rooms
      .map((f) => ({ room: f, minutes: Math.round(minutes.get(f.facility_uuid) || 0) }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [gridEvents, rooms, anchor])
  const doubleBooked = visible.filter((b) => b.double_booked)

  const openNew = (initial?: { facility_uuid?: string; start?: string; end?: string }) => setDrawer({ initial: initial || {} })
  const sourceHref = (b: FacilityBooking) =>
    b.source === 'course_session' && b.parent_uuid
      ? getUriWithOrg(orgslug, `/dash/courses/course/${b.parent_uuid.replace('course_', '')}/general`)
      : b.source === 'offering_session' && b.parent_uuid
        ? getUriWithOrg(orgslug, `/dash/postgraduate/offerings/${b.parent_uuid.replace('offering_', '')}`)
        : null

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.facilities', 'Facilities & Rooms'), href: '/dash/administration/facilities' },
          { label: t('administration.halls.calendar', 'Hall calendar') },
        ]}
      />
      <AcademicHeader
        title={t('administration.halls.calendar', 'Hall calendar')}
        subtitle={t('administration.halls.calendar_desc', 'Every booking by room. Drag on free space to book, drag a booking to move it.')}
        action={
          <AcademicPrimaryButton onClick={() => openNew()}>
            <Plus className="h-4 w-4" /> {t('administration.halls.new_booking', 'New booking')}
          </AcademicPrimaryButton>
        }
      />
      <FacilitiesTabs orgslug={orgslug} />

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="glass-panel relative flex min-h-0 flex-col overflow-hidden rounded-[1.5rem]">
          <EventCalendar<FacilityBooking>
            events={gridEvents}
            views={VIEWS}
            view={view}
            onViewChange={setView}
            resources={resources}
            loading={isLoading || !range}
            interactions={INTERACTIONS}
            locale={locale}
            i18n={calendarI18n}
            dayStartHour={7}
            dayEndHour={22}
            snapDuration={15}
            scrollToHour={8}
            classNames={CALENDAR_CLASSES}
            todayClassName={TODAY_CLASS}
            apiRef={apiRef}
            onRangeChange={(info) => {
              setRange(info.range)
              setAnchor(info.date)
            }}
            onEventClick={(occurrence) => setSelected(occurrence.event.data ?? null)}
            onSelectSlot={(slot) =>
              openNew({
                facility_uuid: slot.resourceId,
                start: toMinuteString(slot.start),
                end: toMinuteString(slot.end),
              })
            }
            canDropEvent={canDropEvent}
            onEventUpdate={moveBooking}
            onDragBlocked={() =>
              toast(t('administration.halls.session_readonly', 'Sessions are moved from their course or offering schedule.'), { id: 'hall-readonly' })
            }
            renderResourceHeader={({ resource }) => {
              const f = roomByUuid.get(resource.id)
              return (
                <span className="flex min-w-0 flex-col items-center leading-tight">
                  <span className="max-w-full truncate text-[12.5px] font-semibold text-[hsl(var(--dash-ink))]">{resource.title}</span>
                  <span className="max-w-full truncate text-[10.5px] font-normal text-[hsl(var(--dash-muted))]">
                    {[f?.capacity != null ? t('administration.facilities.capacity_n', '{{count}} people', { count: f.capacity }) : null, f?.status === 'maintenance' ? t('administration.facilities.status_maintenance', 'Maintenance') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              )
            }}
            className={cn('min-h-[560px] flex-1', CALENDAR_THEME)}
          >
            <HallToolbar
              view={view}
              viewNames={viewNames}
              onView={setView}
              locations={locationOptions}
              location={location}
              onLocation={setLocation}
            />
            {rooms.length === 0 && facilities.length > 0 ? (
              <p className="p-6 text-center text-sm text-[hsl(var(--dash-muted))]">{t('administration.halls.no_rooms_here', 'No rooms at this location.')}</p>
            ) : (
              <EventCalendarContent />
            )}
          </EventCalendar>
        </section>

        <aside className="glass-panel flex min-h-0 flex-col rounded-[1.5rem] p-4">
          {selected ? (
            <div className="flex min-h-0 flex-col gap-4">
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  apiRef.current?.clearSelection()
                }}
                className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {t('administration.halls.back_to_day', 'Back to the day')}
              </button>
              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px] font-semibold"
                >
                  <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS[selected.kind] || KIND_COLORS.other }} />
                  {selected.source === 'manual' ? bookingKindLabel(t, selected.kind) : t('administration.facilities.session', 'Session')}
                </span>
                <h2 className="mt-1.5 text-base font-semibold text-[hsl(var(--dash-ink))]">{selected.title || '—'}</h2>
                {selected.parent_name ? <p className="text-xs text-[hsl(var(--dash-muted))]">{selected.parent_name}</p> : null}
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[hsl(var(--dash-muted))]" />
                  <span>{formatSlot(selected.starts_at, selected.ends_at, i18n.language)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Door size={16} className="shrink-0 text-[hsl(var(--dash-muted))]" />
                  <Link className="hover:underline" href={getUriWithOrg(orgslug, `/dash/administration/facilities/${selected.facility_uuid}`)}>
                    {selected.facility_name}
                  </Link>
                  {selected.inherited ? <span className="text-[11px] text-[hsl(var(--dash-muted))]">({t('administration.facilities.inherited', 'course default')})</span> : null}
                </div>
                {selected.attendees != null ? (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-[hsl(var(--dash-muted))]" />
                    <span>{t('administration.facilities.capacity_n', '{{count}} people', { count: selected.attendees })}</span>
                  </div>
                ) : null}
              </dl>
              {selected.double_booked ? (
                <p className="flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('administration.halls.double_booked_hint', 'Saved over another booking of this room. Move one of them to resolve it.')}
                </p>
              ) : null}
              {selected.notes ? <p className="whitespace-pre-line rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2 text-xs">{selected.notes}</p> : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {selected.source === 'manual' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDrawer({ booking: selected })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelBooking(selected)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-xs font-medium hover:bg-[hsl(var(--dash-canvas))]"
                    >
                      <X className="h-3.5 w-3.5" /> {t('administration.halls.cancel_booking', 'Cancel booking')}
                    </button>
                  </>
                ) : sourceHref(selected) ? (
                  <Link
                    href={sourceHref(selected)!}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {t('administration.halls.open_schedule', 'Open the schedule')}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pe-1">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                  {t('administration.halls.day_load', 'Room use')}
                </p>
                <h2 className="mt-0.5 text-base font-semibold text-[hsl(var(--dash-ink))]">
                  {anchor.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {dayLoad.map(({ room, minutes }) => {
                    const share = Math.min(1, minutes / DAY_MINUTES)
                    return (
                      <li key={room.facility_uuid}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-[hsl(var(--dash-ink))]">{room.name}</span>
                          <span className="shrink-0 tabular-nums text-[hsl(var(--dash-muted))]">
                            {minutes ? t('administration.halls.hours_booked', '{{hours}} h booked', { hours: Math.round((minutes / 60) * 10) / 10 }) : t('administration.halls.free_day', 'Free')}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                          <div className="h-full rounded-full bg-[hsl(var(--dash-accent))]" style={{ width: `${share * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
              {doubleBooked.length ? (
                <section>
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                    <TriangleAlert className="h-3 w-3" /> {t('administration.halls.double_booked_list', 'Double-booked')}
                  </p>
                  <div className="space-y-1.5">
                    {doubleBooked.map((b) => (
                      <button
                        key={b.booking_uuid}
                        type="button"
                        onClick={() => {
                          const start = parseMinuteString(b.starts_at)
                          if (start) apiRef.current?.goTo(start)
                          setSelected(b)
                        }}
                        className="block w-full rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-start text-xs hover:bg-rose-50"
                      >
                        <span className="block truncate font-medium">{b.title}</span>
                        <span className="block truncate text-[11px] text-rose-800/80">
                          {b.facility_name} · {formatSlot(b.starts_at, b.ends_at, i18n.language)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      <AdminDrawer
        icon={<Door size={20} weight="duotone" />}
        open={!!drawer}
        onOpenChange={(open) => !open && setDrawer(null)}
        width="sm:max-w-[640px]"
        title={drawer?.booking ? t('administration.halls.edit_booking', 'Edit booking') : t('administration.halls.new_booking', 'New booking')}
        description={t('administration.halls.form_desc', 'The room is checked as you type; free rooms and times are suggested when it is taken.')}
      >
        {drawer ? (
          <BookingForm
            booking={drawer.booking}
            initial={drawer.initial}
            confirmConflict={confirmConflict}
            onDone={(saved) => {
              setDrawer(null)
              setSelected((s) => (s && s.booking_uuid === saved.booking_uuid ? saved : s))
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </AcademicPageShell>
  )
}
