'use client'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, Pencil } from 'lucide-react'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getOrgFacilityBookings } from '@services/administration/administration'
import { getUriWithOrg } from '@services/config/config'
import { facilityRenderStatus, type RenderStatus } from './geometry'
import { useFloorPlanLabels } from './labels'

const pad = (n: number) => String(n).padStart(2, '0')
export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes() < 30 ? 0 : 30)}`
}
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The day's bookings per room and a status function for the plan: a room
 * under maintenance / inactive keeps that status, otherwise it is booked when
 * a booking covers `date`T`time`.
 */
export function useRoomOccupancy(date: string, time: string, enabled = true) {
  const { orgId, access_token, ready } = useAdminContext()
  const since = `${date}T00:00`
  const until = `${nextDay(date)}T00:00`
  const { data: bookings = [] } = useQuery({
    queryKey: ['halls', 'bookings', orgId, since, until],
    queryFn: () => getOrgFacilityBookings(orgId, access_token, since, until),
    enabled: ready && enabled,
  })
  const byRoom = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const b of bookings as any[]) {
      if (b.status === 'cancelled' || !b.facility_uuid || !b.starts_at) continue
      map.set(b.facility_uuid, [...(map.get(b.facility_uuid) || []), b])
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return map
  }, [bookings])
  const at = `${date}T${time}`
  const statusOf = useMemo(
    () =>
      (room: any): RenderStatus => {
        const base = facilityRenderStatus(room)
        if (base !== 'available') return base
        const list = room.facility_uuid ? byRoom.get(room.facility_uuid) || [] : []
        return list.some((b) => b.starts_at <= at && at < (b.ends_at || b.starts_at)) ? 'booked' : 'available'
      },
    [byRoom, at]
  )
  const bookingsFor = (room: any): any[] => (room?.facility_uuid ? byRoom.get(room.facility_uuid) || [] : [])
  return { statusOf, bookingsFor }
}

/** Side panel for the room picked on a live plan: status, equipment, the day's bookings, links. */
export function RoomDetails({
  orgslug,
  picked,
  status,
  time,
  bookings,
  onEdit,
  emptyHint,
}: {
  orgslug: string
  picked: { room: any; floor: any } | null
  status: RenderStatus | null
  time: string
  bookings: any[]
  onEdit?: () => void
  emptyHint?: string
}) {
  const { t } = useTranslation()
  const tr = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts))
  const L = useFloorPlanLabels()
  if (!picked) {
    return <p className="m-0 text-[hsl(var(--dash-muted))]">{emptyHint || tr('pick_room', 'Select a room on the plan to see its bookings for the day.')}</p>
  }
  const { room, floor } = picked
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
        {[floor.name, room.room_number ? `#${room.room_number}` : null].filter(Boolean).join(' · ')}
      </div>
      <h3 className="mt-1 text-[17px] font-semibold">{room.name}</h3>
      <p className="mt-1.5 flex flex-wrap items-center gap-2">
        <span>{L.seats(room.capacity)}</span>
        <span className="text-[hsl(var(--dash-muted))]">·</span>
        <span className="font-semibold">{status ? L.status(status) : ''}</span>
        <span className="text-[hsl(var(--dash-muted))]" dir="ltr">
          {time}
        </span>
      </p>
      <p className="mt-1 text-[12px] text-[hsl(var(--dash-muted))]">{(room.facilities || []).join(' · ') || tr('no_equipment_listed', 'No equipment listed')}</p>
      <h4 className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">{tr('bookings_on_day', 'Bookings this day')}</h4>
      {bookings.length ? (
        <ul className="space-y-1.5">
          {bookings.map((b) => (
            <li key={b.booking_uuid || `${b.starts_at}-${b.title}`} className="rounded-lg bg-[hsl(var(--dash-canvas))] px-2.5 py-1.5">
              <div className="font-mono text-[11px] text-[hsl(var(--dash-muted))]" dir="ltr">
                {b.starts_at.slice(11, 16)}–{(b.ends_at || '').slice(11, 16)}
              </div>
              <div className="truncate text-[12.5px] font-medium">{b.title || b.parent_name || tr('booking', 'Booking')}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[hsl(var(--dash-muted))]">
          {room.facility_uuid ? tr('no_bookings', 'Nothing booked this day.') : tr('not_saved_yet', 'Save the plan to start booking this room.')}
        </p>
      )}
      {room.facility_uuid ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <a href={getUriWithOrg(orgslug, `/dash/administration/facilities/${room.facility_uuid}`)}>
            <GhostButton type="button">
              <ExternalLink className="h-3.5 w-3.5" /> {tr('open_facility', 'Open details')}
            </GhostButton>
          </a>
          {onEdit ? (
            <GhostButton type="button" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> {t('administration.common.edit', 'Edit')}
            </GhostButton>
          ) : null}
          <a href={getUriWithOrg(orgslug, '/dash/administration/facilities/calendar')}>
            <GhostButton type="button">
              <CalendarDays className="h-3.5 w-3.5" /> {t('administration.halls.calendar', 'Hall calendar')}
            </GhostButton>
          </a>
        </div>
      ) : null}
    </>
  )
}
