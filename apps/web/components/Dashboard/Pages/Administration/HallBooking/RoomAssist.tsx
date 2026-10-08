'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Sparkles, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { useFacilityOptions } from '@components/Dashboard/Pages/Administration/Pickers'
import { getFacilityConflicts, getFacilityFreeSlots, getRoomSuggestions } from '@services/administration/administration'
import { formatSlot, minutesBetween, reasonText } from './hallTime'

/**
 * Live room check under a room picker: says whether the chosen room is free
 * for start–end and, when it is not (or no room is chosen), offers free times
 * in that room and other free rooms ranked by fit. Picking one fills the form.
 */
export function RoomAssist({
  start,
  end,
  room,
  defaultRoom,
  attendees,
  exclude,
  onPickRoom,
  onPickTime,
  className,
}: {
  /** "YYYY-MM-DDTHH:mm" (or a date). */
  start: string
  end: string
  /** Selected room uuid ('' = none / the parent's default). */
  room: string
  /** The room used when none is selected (course or offering default). */
  defaultRoom?: { facility_uuid: string; name: string } | null
  attendees?: number | null
  /** Booking or session uuid being edited — its own slot is not a conflict. */
  exclude?: string
  onPickRoom: (_uuid: string) => void
  onPickTime?: (_start: string, _end: string) => void
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const options = useFacilityOptions()
  const effective = room || defaultRoom?.facility_uuid || ''
  const roomName =
    options.find((o) => o.facility_uuid === effective)?.name || (defaultRoom?.facility_uuid === effective ? defaultRoom?.name : '') || ''
  const valid = !!start && (!end || end > start)
  const duration = minutesBetween(start, end) || 60

  const conflicts = useQuery({
    queryKey: ['halls', 'conflicts', effective, start, end, exclude],
    queryFn: () => getFacilityConflicts(effective, access_token, start, end || undefined, exclude),
    enabled: ready && valid && !!effective,
    placeholderData: keepPreviousData,
  })
  const busy = !!effective && (conflicts.data?.length ?? 0) > 0
  const checked = !!effective && conflicts.isSuccess && !conflicts.isPlaceholderData

  const slots = useQuery({
    queryKey: ['halls', 'free-slots', effective, start, duration, exclude],
    queryFn: () =>
      getFacilityFreeSlots(effective, access_token, {
        start: `${start.slice(0, 10)}T00:00`,
        duration,
        days: 7,
        around: start,
        exclude,
        limit: 4,
      }),
    enabled: ready && valid && busy && !!onPickTime,
  })
  const suggestions = useQuery({
    queryKey: ['halls', 'suggestions', orgId, start, end, attendees, effective, exclude],
    queryFn: () =>
      getRoomSuggestions(orgId, access_token, {
        start,
        end: end || undefined,
        attendees: attendees || undefined,
        near: effective || undefined,
        exclude,
        limit: 4,
      }),
    enabled: ready && valid && (busy || !effective),
  })

  if (!valid) return null

  return (
    <div className={cn('space-y-2.5', className)} aria-live="polite">
      {effective && checked && !busy ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t('administration.halls.room_free', '{{room}} is free at this time', { room: roomName || t('administration.facilities.room', 'Room') })}
        </p>
      ) : null}

      {busy ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-900">
          <div className="flex items-start gap-1.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{t('administration.halls.room_busy', '{{room}} is not available at this time', { room: roomName || t('administration.facilities.room', 'Room') })}</p>
              <p className="mt-0.5 text-[11px] text-amber-800/80" dir="auto">
                {conflicts.data![0]}
                {conflicts.data!.length > 1 ? ` ${t('administration.halls.more_conflicts', '(+{{count}} more)', { count: conflicts.data!.length - 1 })}` : ''}
              </p>
            </div>
          </div>
          {onPickTime ? (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
                <CalendarClock className="h-3 w-3" />
                {t('administration.halls.free_times', 'Free times in {{room}}', { room: roomName })}
              </p>
              {slots.isLoading ? (
                <p className="text-[11px] text-amber-800/70">{t('administration.halls.checking', 'Checking…')}</p>
              ) : slots.data?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {slots.data.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => onPickTime(s.start, s.end)}
                      className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11.5px] font-medium text-amber-900 transition-colors hover:bg-amber-100"
                    >
                      {formatSlot(s.start, s.end, i18n.language)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-amber-800/70">{t('administration.halls.no_free_times', 'No free time in this room in the next 7 days.')}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {busy || !effective ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
            <Sparkles className="h-3 w-3" />
            {t('administration.halls.free_rooms', 'Free rooms at this time')}
          </p>
          {suggestions.isLoading ? (
            <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('administration.halls.checking', 'Checking…')}</p>
          ) : suggestions.data?.length ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {suggestions.data.map((s) => (
                <button
                  key={s.facility_uuid}
                  type="button"
                  onClick={() => onPickRoom(s.facility_uuid)}
                  className="group rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-start transition-colors hover:border-[hsl(var(--dash-accent))]/60 hover:bg-[hsl(var(--dash-accent-soft))]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-[hsl(var(--dash-ink))]">{s.name}</span>
                    <span
                      className="shrink-0 rounded-full bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]"
                      title={t('administration.halls.match', 'Match')}
                    >
                      {s.score}%
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[hsl(var(--dash-muted))]">
                    {[s.location_name, ...s.reasons.slice(0, 2).map((r) => reasonText(t, r))].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('administration.halls.no_free_rooms', 'No other room is free at this time.')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
