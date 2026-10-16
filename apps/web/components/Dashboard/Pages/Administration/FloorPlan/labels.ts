'use client'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { RenderStatus } from './geometry'

/** Translated names for statuses, room kinds, fixtures and wall sides. */
export function useFloorPlanLabels() {
  const { t } = useTranslation()
  return useMemo(() => {
    const k = (key: string, fallback: string, opts?: any) => String(t(`administration.floor_plan.${key}`, fallback, opts))
    const STATUS: Record<RenderStatus, string> = {
      available: k('status_available', 'Available'),
      booked: k('status_booked', 'Booked'),
      maintenance: k('status_maintenance', 'Maintenance'),
      inactive: k('status_inactive', 'Inactive'),
    }
    const FACILITY: Record<string, string> = {
      active: k('facility_active', 'Active'),
      maintenance: k('status_maintenance', 'Maintenance'),
      inactive: k('status_inactive', 'Inactive'),
    }
    const KIND: Record<string, string> = {
      room: k('kind_room', 'Room (bookable)'),
      reception: k('kind_reception', 'Reception'),
      lobby: k('kind_lobby', 'Lobby / lounge'),
    }
    const KIND_SHORT: Record<string, string> = {
      room: k('tool_room', 'Room'),
      reception: k('kind_reception', 'Reception'),
      lobby: k('tool_lobby', 'Lobby'),
    }
    const FIXTURE: Record<string, string> = {
      corridor: k('fx_corridor', 'Corridor'),
      entrance: k('fx_entrance', 'Entrance'),
      stairs: k('fx_stairs', 'Stairs'),
      lift: k('fx_lift', 'Lift'),
      wc: k('fx_wc', 'WC'),
      label: k('fx_label', 'Text'),
    }
    const SIDE: Record<string, string> = {
      top: k('side_top', 'Top'),
      bottom: k('side_bottom', 'Bottom'),
      left: k('side_left', 'Left'),
      right: k('side_right', 'Right'),
    }
    return {
      status: (s: RenderStatus) => STATUS[s] || s,
      facilityStatus: (s: string) => FACILITY[s] || s,
      kind: (s: string) => KIND[s] || s,
      kindShort: (s: string) => KIND_SHORT[s] || s,
      fixture: (s: string) => FIXTURE[s] || s,
      side: (s: string) => SIDE[s] || s,
      seats: (n: number | null | undefined) => (n == null ? k('seats_unknown', '— seats') : k('seats', '{{count}} seats', { count: n })),
    }
  }, [t])
}
