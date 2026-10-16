'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Building2, ChevronRight, Clock, Landmark, PencilRuler } from 'lucide-react'
import { Buildings } from '@phosphor-icons/react'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext, useStoredView } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getFloorPlan, getLocations } from '@services/administration/administration'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import FloorPlanView from './FloorPlanView'
import type { RenderStatus } from './geometry'
import { useFloorPlanLabels } from './labels'
import { RoomDetails, nowTime, todayStr, useRoomOccupancy } from './occupancy'

const BUILDING_KEY = 'admin-facilities-plan-building'

/**
 * Read-only "Plan" view of the Facilities list: pick a campus and a building
 * and see every floor drawn, rooms coloured by what is happening now.
 * `visibleUuids` (the list's filters) dims rooms that do not match.
 */
export default function FacilitiesPlanPreview({
  orgslug,
  facilities,
  visibleUuids,
  onEdit,
}: {
  orgslug: string
  facilities: any[]
  visibleUuids: Set<string> | null
  onEdit?: (_facility: any) => void
}) {
  const { t } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts))
  const { orgId, access_token, ready } = useAdminContext()

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['administration', 'locations', orgId],
    queryFn: () => getLocations(orgId, access_token),
    enabled: ready,
  })
  const all = locations as any[]

  /* ---------- campus → buildings ---------- */
  const byUuid = useMemo(() => new Map(all.map((l) => [l.location_uuid, l])), [all])
  const campusOf = useCallback(
    (loc: any) => {
      let cur = loc
      for (let i = 0; i < 6 && cur?.parent_uuid && byUuid.has(cur.parent_uuid); i++) cur = byUuid.get(cur.parent_uuid)
      return cur
    },
    [byUuid]
  )
  const campuses = useMemo(() => all.filter((l) => !l.parent_uuid || !byUuid.has(l.parent_uuid)), [all, byUuid])
  const buildingsOf = useCallback(
    (campusUuid: string) => all.filter((l) => campusOf(l)?.location_uuid === campusUuid && (l.floor_count > 0 || l.location_uuid !== campusUuid)),
    [all, campusOf]
  )

  const [storedBuilding, setStoredBuilding] = useStoredView<string>(BUILDING_KEY, '')
  const building = useMemo(() => {
    const stored = storedBuilding && byUuid.get(storedBuilding)
    if (stored) return stored
    return all.find((l) => l.floor_count > 0) || null
  }, [storedBuilding, byUuid, all])
  const campus = building ? campusOf(building) : campuses[0] || null
  const buildings = campus ? buildingsOf(campus.location_uuid) : []

  const pickCampus = (uuid: string) => {
    const list = buildingsOf(uuid)
    const next = list.find((l) => l.floor_count > 0) || list[0] || byUuid.get(uuid)
    if (next) setStoredBuilding(next.location_uuid)
    setPicked(null)
    setFloorId(undefined)
  }

  const { data: planData, isFetching } = useQuery({
    queryKey: ['administration', 'floor-plan', building?.location_uuid],
    queryFn: () => getFloorPlan(building.location_uuid, access_token),
    enabled: ready && !!building && building.floor_count > 0,
  })
  const plan = building?.floor_count > 0 && planData?.location_uuid === building.location_uuid ? planData.plan : null

  /* ---------- live status ---------- */
  const [date, setDate] = useState(todayStr)
  const [time, setTime] = useState(nowTime)
  const { statusOf, bookingsFor } = useRoomOccupancy(date, time, !!plan)
  const [picked, setPicked] = useState<{ room: any; floor: any } | null>(null)
  const [floorId, setFloorId] = useState<string | undefined>(undefined)
  const roomFilter = useMemo(() => (visibleUuids ? (room: any) => !!room.facility_uuid && visibleUuids.has(room.facility_uuid) : null), [visibleUuids])

  const unplacedCount = useMemo(() => {
    const placedSomewhere = (f: any) => f.location_uuid && (byUuid.get(f.location_uuid)?.floor_count || 0) > 0
    return facilities.filter((f) => !placedSomewhere(f)).length
  }, [facilities, byUuid])

  const designHref = (uuid?: string) => getUriWithOrg(orgslug, `/dash/administration/facilities/floor-plans${uuid ? `?building=${uuid}` : ''}`)

  if (!isLoading && !all.some((l) => l.floor_count > 0)) {
    return (
      <div className="dash-card rounded-[1.25rem] px-6 py-14">
        <AcademicEmptyState
          compact
          icon={<Buildings size={24} />}
          title={tr('preview_empty_title', 'No floor plans yet')}
          description={tr('preview_empty_desc', 'Draw your campuses and buildings once, then see every room here, floor by floor.')}
          action={
            <a href={designHref()}>
              <GhostButton type="button">
                <PencilRuler className="h-3.5 w-3.5" /> {tr('open_designer', 'Open the designer')}
              </GhostButton>
            </a>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* campus & building picker */}
      <div className="dash-card flex flex-wrap items-center gap-2 rounded-[1.25rem] px-4 py-2.5">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[hsl(var(--dash-muted))]">
          <Landmark className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">{tr('campus', 'Campus')}</span>
          <select
            className={cn(inputCls, 'h-8 w-auto max-w-[220px] rounded-full py-0 text-[13px] font-semibold text-[hsl(var(--dash-ink))]')}
            value={campus?.location_uuid || ''}
            onChange={(e) => pickCampus(e.target.value)}
          >
            {campuses.map((c) => (
              <option key={c.location_uuid} value={c.location_uuid}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <span className="mx-1 hidden h-5 w-px bg-[hsl(var(--dash-border))] sm:block" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" role="tablist" aria-label={tr('building', 'Building')}>
          {buildings.map((b) => {
            const active = b.location_uuid === building?.location_uuid
            const drawn = b.floor_count > 0
            return (
              <button
                key={b.location_uuid}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStoredBuilding(b.location_uuid)
                  setPicked(null)
                  setFloorId(undefined)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                  active
                    ? 'border-[hsl(var(--dash-ink))] bg-[hsl(var(--dash-ink))] text-white'
                    : 'border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]',
                  !drawn && !active && 'text-[hsl(var(--dash-muted))]'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                {b.name}
                <span className={cn('text-[11px] font-medium', active ? 'text-white/70' : 'text-[hsl(var(--dash-muted))]')}>
                  {drawn ? tr('n_floors', '{{count}} floors', { count: b.floor_count }) : tr('not_drawn', 'not drawn')}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" className={cn(inputCls, 'h-8 w-auto rounded-full py-0 text-[12px]')} value={date} onChange={(e) => setDate(e.target.value || todayStr())} aria-label={tr('date', 'Date')} />
          <input type="time" step={1800} className={cn(inputCls, 'h-8 w-auto rounded-full py-0 text-[12px]')} value={time} onChange={(e) => setTime(e.target.value || '09:00')} aria-label={tr('time', 'Time')} />
          <GhostButton
            type="button"
            title={tr('now_title', 'Show what is happening now')}
            onClick={() => {
              setDate(todayStr())
              setTime(nowTime())
            }}
          >
            <Clock className="h-3.5 w-3.5" /> {tr('now', 'Now')}
          </GhostButton>
          <a href={designHref(building?.location_uuid)}>
            <GhostButton type="button">
              <PencilRuler className="h-3.5 w-3.5" /> {tr('design', 'Design')}
            </GhostButton>
          </a>
        </div>
      </div>

      {/* the drawing */}
      {!building || building.floor_count === 0 ? (
        <div className="dash-card rounded-[1.25rem] px-6 py-14">
          <AcademicEmptyState
            compact
            icon={<Building2 className="h-6 w-6" />}
            title={tr('building_not_drawn', '{{name}} has no floor plan yet', { name: building?.name || '' })}
            description={tr('building_not_drawn_desc', 'Draw its floors and rooms in the designer to see them here.')}
            action={
              <a href={designHref(building?.location_uuid)}>
                <GhostButton type="button">
                  <PencilRuler className="h-3.5 w-3.5" /> {tr('design_building', 'Design this building')}
                </GhostButton>
              </a>
            }
          />
        </div>
      ) : !plan ? (
        <div className={cn('dash-card h-[460px] rounded-[1.25rem]', isFetching && 'dash-shimmer')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="dash-card min-w-0 rounded-[1.25rem] p-3 sm:p-4">
            <FloorPlanView
              key={building.location_uuid}
              plan={plan}
              getStatus={statusOf}
              roomFilter={roomFilter}
              showSearch={false}
              floorId={floorId}
              selectedRoomId={picked?.room.id ?? null}
              onRoomSelect={(room, floor) => setPicked({ room, floor })}
              onFloorChange={(floor) => {
                setFloorId(floor?.id)
                setPicked(null)
              }}
            />
          </div>
          <aside className="dash-card rounded-[1.25rem] p-4 text-[13px] lg:sticky lg:top-4">
            {!picked ? (
              <BuildingOverview
                name={building.name}
                plan={plan}
                statusOf={statusOf}
                when={`${date} · ${time}`}
                onPick={(room, floor) => {
                  setFloorId(floor.id)
                  setPicked({ room, floor })
                }}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
                >
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {tr('back_to_building', 'Building overview')}
                </button>
            <RoomDetails
              orgslug={orgslug}
              picked={picked}
              status={picked ? statusOf(picked.room) : null}
              time={time}
              bookings={bookingsFor(picked?.room)}
              onEdit={
                onEdit && picked?.room.facility_uuid
                  ? () => {
                      const f = facilities.find((x) => x.facility_uuid === picked.room.facility_uuid)
                      if (f) onEdit(f)
                    }
                  : undefined
              }
            />
              </>
            )}
          </aside>
        </div>
      )}

      {unplacedCount > 0 ? (
        <p className="px-1 text-[12px] text-[hsl(var(--dash-muted))]">
          {tr('n_not_on_plan', '{{count}} facilities are not on any floor plan yet.', { count: unplacedCount })}{' '}
          <a className="font-semibold text-[hsl(var(--dash-ink))] underline underline-offset-2" href={designHref(building?.location_uuid)}>
            {tr('place_them', 'Place them in the designer')}
          </a>
        </p>
      ) : null}
    </div>
  )
}

const DOT: Record<RenderStatus, string> = {
  available: 'bg-emerald-500',
  booked: 'bg-[hsl(var(--dash-warn))]',
  maintenance: 'bg-amber-500',
  inactive: 'bg-slate-400',
}

/** What the side panel shows before a room is picked: live counts and every room, floor by floor. */
function BuildingOverview({
  name,
  plan,
  statusOf,
  when,
  onPick,
}: {
  name: string
  plan: any
  statusOf: (_room: any) => RenderStatus
  when: string
  onPick: (_room: any, _floor: any) => void
}) {
  const { t } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts))
  const L = useFloorPlanLabels()
  const floors = (plan?.floors || []).map((f: any) => ({ ...f, rooms: (f.rooms || []).filter((r: any) => r.kind === 'room') }))
  const rooms = floors.flatMap((f: any) => f.rooms)
  const counts = { available: 0, booked: 0, maintenance: 0, inactive: 0 } as Record<RenderStatus, number>
  rooms.forEach((r: any) => counts[statusOf(r)]++)
  const seats = rooms.reduce((n: number, r: any) => n + (+r.capacity || 0), 0)
  const total = rooms.length || 1
  const tiles: { label: string; value: number; tone?: string }[] = [
    { label: tr('stat_rooms', 'Rooms'), value: rooms.length },
    { label: tr('stat_seats', 'Seats'), value: seats },
    { label: L.status('available'), value: counts.available, tone: 'text-emerald-600' },
    { label: L.status('booked'), value: counts.booked, tone: 'text-[hsl(var(--dash-warn))]' },
  ]
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dash-muted))]">{tr('live_at', 'Live · {{when}}', { when })}</div>
      <h3 className="mt-1 truncate text-[17px] font-semibold">{name}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2">
            <div className={cn('text-[18px] font-bold tabular-nums leading-tight', tile.tone)}>{tile.value}</div>
            <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{tile.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-border))]" aria-hidden="true">
        {(['available', 'booked', 'maintenance', 'inactive'] as RenderStatus[]).map((st) =>
          counts[st] ? <span key={st} className={DOT[st]} style={{ width: `${(counts[st] / total) * 100}%` }} /> : null
        )}
      </div>
      {counts.maintenance + counts.inactive > 0 ? (
        <p className="mt-1.5 text-[11px] text-[hsl(var(--dash-muted))]">
          {tr('n_unavailable', '{{count}} out of service', { count: counts.maintenance + counts.inactive })}
        </p>
      ) : null}

      <div className="mt-4 max-h-[380px] space-y-3 overflow-y-auto pe-1">
        {floors.map((f: any) => (
          <div key={f.id}>
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
              <span className="truncate">{f.name}</span>
              <span className="font-medium normal-case tracking-normal">{tr('n_rooms', '{{count}} rooms', { count: f.rooms.length })}</span>
            </div>
            {f.rooms.length ? (
              <ul className="space-y-0.5">
                {f.rooms.map((r: any) => {
                  const st = statusOf(r)
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onPick(r, f)}
                        className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]"
                      >
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[st])} title={L.status(st)} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.name}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--dash-muted))]">{L.seats(r.capacity)}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--dash-muted))] opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-2 text-[12px] text-[hsl(var(--dash-muted))]">{tr('floor_no_rooms', 'No bookable rooms on this floor.')}</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-[hsl(var(--dash-border))] pt-3 text-[11.5px] text-[hsl(var(--dash-muted))]">{tr('pick_room', 'Select a room on the plan to see its bookings for the day.')}</p>
    </div>
  )
}
