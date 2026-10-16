'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Building2, CalendarRange, Check, CheckCircle2, ChevronDown, Layers, Map as MapIcon, Sparkles, Users } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getFloorPlan, getRoomAvailability, type RoomAvailability } from '@services/administration/administration'
import { cn } from '@/lib/utils'
import FloorPlanSvg from './FloorPlanSvg'
import { normalizePlan, type RenderStatus } from './geometry'

/* =====================================================================
   Visual room picker: the building's floor plan with every room coloured by
   its availability for a period. Only rooms that are free for the whole
   period *and* seat everyone can be clicked; the side list ranks them by fit
   and explains why the others are greyed out.
   ===================================================================== */

export interface RoomPeriod {
  /** Date (YYYY-MM-DD) or date-time; empty = no booking check. */
  start?: string
  end?: string
  attendees?: number | null
  /** The program being edited, so its own room does not count as taken. */
  excludeProgram?: string
  /** The booking or session being edited — its own slot is not a conflict. */
  exclude?: string
  /** A course / offering default room: check every session that inherits it. */
  forCourse?: string
  forOffering?: string
}

const RENDER: Record<RoomAvailability['status'], RenderStatus> = {
  available: 'available',
  busy: 'booked',
  unavailable: 'maintenance',
  too_small: 'inactive',
}

export function useRoomAvailability(period: RoomPeriod, enabled = true) {
  const { orgId, access_token, ready } = useAdminContext()
  const params = {
    start: period.start || undefined,
    end: period.end || period.start || undefined,
    attendees: period.attendees ?? undefined,
    exclude_program: period.excludeProgram || undefined,
    exclude: period.exclude || undefined,
    for_course: period.forCourse || undefined,
    for_offering: period.forOffering || undefined,
  }
  return useQuery({
    queryKey: ['facilities', 'availability', orgId, params],
    queryFn: () => getRoomAvailability(orgId, access_token, params),
    enabled: ready && enabled,
    staleTime: 30_000,
  })
}

function useRoomText() {
  const { t } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.room_picker.${key}`, fallback, opts))
  const statusName = (s: RoomAvailability['status']) =>
    ({
      available: tr('status_available', 'Available'),
      busy: tr('status_busy', 'Booked'),
      too_small: tr('status_too_small', 'Too small'),
      unavailable: tr('status_unavailable', 'Out of service'),
    })[s]
  const why = (r: RoomAvailability, attendees?: number | null) => {
    if (r.status === 'busy') {
      const parts = []
      if (r.bookings) parts.push(tr('why_bookings', '{{count}} bookings in this period', { count: r.bookings }))
      if (r.programs.length) parts.push(tr('why_programs', 'Used by {{names}}', { names: r.programs.join(', ') }))
      return parts.join(' · ')
    }
    if (r.status === 'too_small') return tr('why_small', '{{capacity}} seats for {{attendees}} people', { capacity: r.capacity ?? 0, attendees: attendees ?? 0 })
    if (r.status === 'unavailable') return tr('why_unavailable', 'Inactive, under maintenance or blocked')
    return ''
  }
  const fit = (r: RoomAvailability, attendees?: number | null) => {
    if (!attendees || r.capacity == null) return r.capacity != null ? tr('seats', '{{count}} seats', { count: r.capacity }) : tr('seats_unknown', 'Seats unknown')
    const spare = r.capacity - attendees
    return spare === 0 ? tr('fit_exact', 'Exactly {{count}} seats', { count: r.capacity }) : tr('fit_spare', '{{count}} seats · {{spare}} spare', { count: r.capacity, spare })
  }
  return { t, tr, statusName, why, fit }
}

const STATUS_DOT: Record<RoomAvailability['status'], string> = {
  available: 'bg-emerald-500',
  busy: 'bg-[hsl(var(--dash-warn))]',
  too_small: 'bg-slate-400',
  unavailable: 'bg-amber-500',
}

/** One line under the room field: is the chosen room free and big enough? */
export function RoomFitHint({ value, period }: { value: string; period: RoomPeriod }) {
  const { tr, statusName, why } = useRoomText()
  const { data } = useRoomAvailability(period, !!value)
  const room = data?.rooms.find((r) => r.facility_uuid === value)
  if (!value || !room) return null
  const ok = room.status === 'available'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px]', ok ? 'text-emerald-700' : 'text-[hsl(var(--dash-warn))]')}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {ok
        ? data?.checked_period
          ? period.forCourse || period.forOffering
            ? tr('hint_ok_sessions', 'Free for all {{count}} sessions that use it', { count: data.windows })
            : tr('hint_ok', 'Free for these dates')
          : period.forCourse || period.forOffering
            ? tr('hint_ok_seats', 'Seats everyone')
            : tr('hint_ok_no_dates', 'Set dates to check bookings')
        : `${statusName(room.status)} — ${why(room, period.attendees)}`}
    </span>
  )
}

export function RoomPickerButton({
  value,
  onChange,
  period,
  className,
  clearLabel,
}: {
  value: string
  onChange: (_uuid: string) => void
  period: RoomPeriod
  className?: string
  /** What "no room" means here, e.g. "Use the offering room". */
  clearLabel?: string
}) {
  const { tr } = useRoomText()
  const [open, setOpen] = useState(false)
  return (
    <>
      <GhostButton type="button" onClick={() => setOpen(true)} className={className}>
        <MapIcon className="h-3.5 w-3.5" /> {tr('open', 'Choose on floor plan')}
      </GhostButton>
      {open ? (
        <RoomPickerDialog
          open={open}
          onOpenChange={setOpen}
          value={value}
          period={period}
          clearLabel={clearLabel}
          onSelect={(uuid) => {
            onChange(uuid)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

export function RoomPickerDialog({
  open,
  onOpenChange,
  value,
  period,
  onSelect,
  clearLabel,
}: {
  open: boolean
  onOpenChange: (_open: boolean) => void
  value: string
  period: RoomPeriod
  onSelect: (_uuid: string) => void
  clearLabel?: string
}) {
  const { t, tr, statusName, why, fit } = useRoomText()
  const { access_token, ready } = useAdminContext()
  const { data, isLoading } = useRoomAvailability(period, open)
  const rooms = useMemo(() => data?.rooms || [], [data])
  const buildings = useMemo(() => data?.buildings || [], [data])
  const byUuid = useMemo(() => new Map(rooms.map((r) => [r.facility_uuid, r])), [rooms])
  const attendees = period.attendees

  const [pending, setPending] = useState(value)
  const [buildingUuid, setBuildingUuid] = useState<string | null>(null)
  const [floorId, setFloorId] = useState<string | undefined>(undefined)
  const [showOthers, setShowOthers] = useState(false)

  // Open on the building of the current room, else the one with the most free rooms.
  useEffect(() => {
    if (buildingUuid || !buildings.length) return
    const current = byUuid.get(value)
    const own = current?.location_uuid && buildings.find((b) => b.location_uuid === current.location_uuid)
    const freeIn = (uuid: string) => rooms.filter((r) => r.location_uuid === uuid && r.status === 'available').length
    const best = [...buildings].sort((a, b) => freeIn(b.location_uuid) - freeIn(a.location_uuid))[0]
    setBuildingUuid((own || best).location_uuid)
  }, [buildings, rooms, byUuid, value, buildingUuid])

  const { data: planData, isFetching: loadingPlan } = useQuery({
    queryKey: ['administration', 'floor-plan', buildingUuid],
    queryFn: () => getFloorPlan(buildingUuid as string, access_token),
    enabled: ready && open && !!buildingUuid,
  })
  const plan = planData?.location_uuid === buildingUuid ? planData?.plan : null

  // Keep the plan on the floor of the picked room.
  useEffect(() => {
    if (!plan || !pending) return
    const floor = plan.floors.find((f: any) => f.rooms.some((r: any) => r.facility_uuid === pending))
    if (floor) setFloorId(floor.id)
  }, [plan, pending])

  const statusOf = useMemo(
    () =>
      (room: any): RenderStatus => {
        const a = room.facility_uuid ? byUuid.get(room.facility_uuid) : null
        return a ? RENDER[a.status] : 'inactive'
      },
    [byUuid]
  )
  const selectable = useMemo(() => (room: any) => byUuid.get(room.facility_uuid)?.status === 'available', [byUuid])
  const renderLabel = useMemo(
    () => (s: RenderStatus) =>
      ({ available: statusName('available'), booked: statusName('busy'), maintenance: statusName('unavailable'), inactive: statusName('too_small') })[s],
    [statusName]
  )
  const planRoomId = plan?.floors.flatMap((f: any) => f.rooms).find((r: any) => r.facility_uuid === pending)?.id ?? null

  const available = rooms.filter((r) => r.status === 'available')
  const others = rooms.filter((r) => r.status !== 'available')
  const counts = {
    available: available.length,
    busy: rooms.filter((r) => r.status === 'busy').length,
    too_small: rooms.filter((r) => r.status === 'too_small').length,
  }
  const picked = pending ? byUuid.get(pending) : undefined
  const choose = (r: RoomAvailability) => {
    setPending(r.facility_uuid)
    if (r.location_uuid && buildings.some((b) => b.location_uuid === r.location_uuid) && r.location_uuid !== buildingUuid) {
      setBuildingUuid(r.location_uuid)
      setFloorId(undefined)
    }
  }

  const pretty = (v: string) => v.replace('T', ' ')
  const parentMode = !!(period.forCourse || period.forOffering)
  const period_ = period.start
    ? period.end && period.end !== period.start
      ? tr('period_range', '{{start}} → {{end}}', { start: pretty(period.start), end: pretty(period.end) })
      : pretty(period.start)
    : parentMode
      ? tr('sessions_checked', '{{count}} sessions use this room', { count: data?.windows ?? 0 })
      : tr('no_dates', 'No dates yet')

  const roomRow = (r: RoomAvailability, index: number) => {
    const active = r.facility_uuid === pending
    const onPlan = r.location_uuid && buildings.some((b) => b.location_uuid === r.location_uuid)
    return (
      <li key={r.facility_uuid}>
        <button
          type="button"
          onClick={() => choose(r)}
          className={cn(
            'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-start transition-colors',
            active
              ? 'border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent-soft))]'
              : 'border-transparent hover:border-[hsl(var(--dash-border))] hover:bg-[hsl(var(--dash-canvas))]'
          )}
        >
          <span
            className={cn(
              'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              active ? 'border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent))] text-[hsl(var(--dash-ink))]' : 'border-[hsl(var(--dash-border))]'
            )}
          >
            {active ? <Check className="h-3 w-3" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold">{r.name}</span>
              {index === 0 && attendees ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  <Sparkles className="h-2.5 w-2.5" /> {tr('best_fit', 'Best fit')}
                </span>
              ) : null}
            </span>
            <span className="block truncate text-[11.5px] text-[hsl(var(--dash-muted))]">
              {[r.location_name, r.floor, r.facility_type_name].filter(Boolean).join(' · ') || tr('no_building', 'No building')}
              {!onPlan ? ` · ${tr('not_on_plan', 'not on a plan')}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-end text-[11.5px] tabular-nums text-[hsl(var(--dash-muted))]">{fit(r, attendees)}</span>
        </button>
      </li>
    )
  }

  const allFloors: any[] = useMemo(
    () => (plan ? normalizePlan(plan).floors.filter((f: any) => f.rooms.some((r: any) => r.kind === 'room')) : []),
    [plan]
  )
  const floor = allFloors.find((f) => f.id === floorId) || allFloors[0] || null
  const selectableIds = useMemo(
    () => new Set<string>((floor?.rooms || []).filter((r: any) => r.kind === 'room' && selectable(r)).map((r: any) => r.id)),
    [floor, selectable]
  )
  const freeOn = (f: any) => f.rooms.filter((r: any) => r.kind === 'room' && selectable(r)).length
  const planHandlers = useMemo(
    () => ({
      onClick: (_e: React.SyntheticEvent, room: any) => {
        if (room.kind === 'room' && room.facility_uuid && selectable(room)) setPending(room.facility_uuid)
      },
    }),
    [selectable]
  )
  const legend: [string, string][] = [
    [STATUS_DOT.available, statusName('available')],
    [STATUS_DOT.busy, statusName('busy')],
    [STATUS_DOT.too_small, statusName('too_small')],
    [STATUS_DOT.unavailable, statusName('unavailable')],
  ]
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-canvas))] px-3 py-1 text-[12px] font-medium'
  const tab = (active: boolean) =>
    cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
      active ? 'border-[hsl(var(--dash-ink))] bg-[hsl(var(--dash-ink))] text-white' : 'border-[hsl(var(--dash-border))] bg-white hover:bg-[hsl(var(--dash-canvas))]'
    )
  const count = (active: boolean, n: number) => (
    <span className={cn('rounded-full px-1.5 text-[10.5px] tabular-nums', active ? 'bg-white/15' : n ? 'bg-emerald-50 text-emerald-700' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>{n}</span>
  )

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {/* what is being checked */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[hsl(var(--dash-border))] px-5 py-2.5">
        <span className={chip}>
          <CalendarRange className="h-3.5 w-3.5 text-[hsl(var(--dash-muted))]" /> {period_}
        </span>
        <span className={chip}>
          <Users className="h-3.5 w-3.5 text-[hsl(var(--dash-muted))]" />
          {attendees ? tr('needs_seats', '{{count}} seats needed', { count: attendees }) : tr('no_seats', 'Any size')}
        </span>
        <span className="text-[12px] text-[hsl(var(--dash-muted))]">
          {tr('summary', '{{available}} free · {{busy}} booked · {{small}} too small', { available: counts.available, busy: counts.busy, small: counts.too_small })}
        </span>
        <ul className="ms-auto flex flex-wrap items-center gap-3 text-[11.5px] text-[hsl(var(--dash-muted))]" aria-label={tr('legend', 'Legend')}>
          {legend.map(([dot, label]) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', dot)} /> {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(240px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1">
        {/* the plan: only the rooms, scaled to fit */}
        <section className="flex min-h-0 flex-col gap-2.5 bg-[hsl(var(--dash-canvas))]/60 p-4">
          {buildings.length > 1 || allFloors.length > 1 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {buildings.length > 1
                ? buildings.map((b) => {
                    const active = b.location_uuid === buildingUuid
                    const free = rooms.filter((r) => r.location_uuid === b.location_uuid && r.status === 'available').length
                    return (
                      <button
                        key={b.location_uuid}
                        type="button"
                        onClick={() => {
                          setBuildingUuid(b.location_uuid)
                          setFloorId(undefined)
                        }}
                        className={tab(active)}
                        aria-pressed={active}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {b.name}
                        {count(active, free)}
                      </button>
                    )
                  })
                : null}
              {buildings.length > 1 && allFloors.length > 1 ? <span className="mx-1 h-5 w-px bg-[hsl(var(--dash-border))]" aria-hidden="true" /> : null}
              {allFloors.length > 1
                ? allFloors.map((f) => {
                    const active = f.id === floor?.id
                    return (
                      <button key={f.id} type="button" onClick={() => setFloorId(f.id)} className={tab(active)} aria-pressed={active}>
                        <Layers className="h-3.5 w-3.5" />
                        {f.name}
                        {count(active, freeOn(f))}
                      </button>
                    )
                  })
                : null}
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))] bg-white">
            {!buildings.length && !isLoading ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[hsl(var(--dash-muted))]">
                {tr('no_plans', 'No building has a floor plan yet — pick a room from the list.')}
              </div>
            ) : !floor ? (
              <div className={cn('h-full', (loadingPlan || isLoading) && 'dash-shimmer')} />
            ) : (
              <>
                <div className="pointer-events-none absolute start-3 top-2.5 z-[1] rounded-full bg-white/90 px-2.5 py-0.5 text-[11.5px] font-semibold text-[hsl(var(--dash-muted))] shadow-sm">
                  {[buildings.find((b) => b.location_uuid === buildingUuid)?.name, floor.name].filter(Boolean).join(' · ')}
                </div>
                <div className="fp fp-picker h-full w-full p-3" dir="ltr">
                  <FloorPlanSvg
                    floor={floor}
                    appearance={normalizePlan(plan).appearance}
                    statusOf={statusOf}
                    statusLabel={renderLabel}
                    seatsLabel={(n) => (n == null ? tr('seats_unknown', 'Seats unknown') : tr('seats', '{{count}} seats', { count: n }))}
                    selectedIds={new Set(planRoomId ? [planRoomId] : [])}
                    dimmedIds={selectableIds}
                    viewer
                    roomsOnly
                    handlers={planHandlers}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* the list and the choice */}
        <aside className="flex min-h-0 flex-col border-t border-[hsl(var(--dash-border))] lg:border-s lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {!data?.checked_period && !isLoading ? (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                {parentMode
                  ? tr('no_sessions', 'No scheduled session uses this room yet, so only seats are checked. Each session is checked when you schedule it.')
                  : tr('set_dates', 'Set the start and end dates to rule out rooms that are already booked.')}
              </p>
            ) : null}
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
              {tr('best_matches', 'Free rooms that fit')} · {available.length}
            </h4>
            {available.length ? (
              <ul className="space-y-1">{available.map(roomRow)}</ul>
            ) : (
              <p className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-3 text-[12.5px] text-[hsl(var(--dash-muted))]">
                {isLoading ? t('administration.common.loading', 'Loading…') : tr('none_free', 'No room is free and big enough for this period. Try other dates or fewer seats.')}
              </p>
            )}
            {others.length ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowOthers((v) => !v)}
                  className="flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]"
                  aria-expanded={showOthers}
                >
                  {tr('not_available', 'Not available')} · {others.length}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showOthers && 'rotate-180')} />
                </button>
                {showOthers ? (
                  <ul className="mt-1.5 space-y-1">
                    {others.map((r) => (
                      <li key={r.facility_uuid} className="flex items-start gap-2.5 rounded-xl px-3 py-2 opacity-80">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_DOT[r.status])} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium">{r.name}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-[hsl(var(--dash-muted))]">{statusName(r.status)}</span>
                          </span>
                          <span className="block text-[11.5px] text-[hsl(var(--dash-muted))]">{why(r, attendees)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[hsl(var(--dash-border))] bg-white px-4 py-3">
            {picked ? (
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_DOT[picked.status])} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{picked.name}</div>
                  <div className="truncate text-[11.5px] text-[hsl(var(--dash-muted))]">
                    {[fit(picked, attendees), picked.location_name, picked.floor].filter(Boolean).join(' · ')}
                    {picked.status !== 'available' ? ` · ${statusName(picked.status)}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mb-2.5 text-[12.5px] text-[hsl(var(--dash-muted))]">{tr('pick_hint', 'Click a green room on the plan or in the list.')}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              {value ? (
                <GhostButton type="button" onClick={() => onSelect('')}>
                  {clearLabel || tr('clear', 'No room')}
                </GhostButton>
              ) : null}
              <AcademicPrimaryButton
                type="button"
                disabled={!pending || pending === value || picked?.status !== 'available'}
                onClick={() => onSelect(pending)}
                className="disabled:opacity-50 disabled:shadow-none"
              >
                <Check className="h-4 w-4" /> {tr('use_room', 'Use this room')}
              </AcademicPrimaryButton>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={onOpenChange}
      minWidth="no-min"
      customWidth="md:w-[min(1180px,94vw)] md:max-w-[94vw] lg:max-w-[94vw] xl:max-w-[94vw]"
      customHeight="h-[88vh] max-h-[88vh]"
      noPadding
      dialogTitle={tr('title', 'Choose a room')}
      dialogDescription={tr('description', 'Only rooms that are free for the whole period and seat everyone can be picked.')}
      dialogContent={content}
    />
  )
}
