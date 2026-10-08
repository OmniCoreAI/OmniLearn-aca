import type { TFunction } from 'i18next'
import type { SuggestionReason } from '@services/administration/administration'

/*
  Booking times travel as local wall-clock strings ("YYYY-MM-DDTHH:mm"), the
  same shape a datetime-local input produces and the API stores. Never pass
  them through `new Date(string)`: a date-only value would parse as UTC.
*/

const pad = (n: number) => String(n).padStart(2, '0')

export function toMinuteString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseMinuteString(value?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value || '')
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0))
}

/** Minutes from a to b (0 when either is missing or b is not later). */
export function minutesBetween(a?: string | null, b?: string | null): number {
  const start = parseMinuteString(a)
  const end = parseMinuteString(b)
  if (!start || !end) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function addMinutesString(value: string, minutes: number): string {
  const d = parseMinuteString(value)
  return d ? toMinuteString(new Date(d.getTime() + minutes * 60000)) : value
}

/** "Mon 3 Mar · 11:00–12:30" in the viewer's language. */
export function formatSlot(start?: string | null, end?: string | null, locale?: string): string {
  const s = parseMinuteString(start)
  if (!s) return ''
  const e = parseMinuteString(end)
  const day = s.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (!e) return `${day} · ${time(s)}`
  const sameDay = s.toDateString() === e.toDateString()
  return sameDay ? `${day} · ${time(s)}–${time(e)}` : `${day} ${time(s)} → ${e.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${time(e)}`
}

export function reasonText(t: TFunction, reason: SuggestionReason): string {
  const p = reason.params || {}
  switch (reason.code) {
    case 'fits':
      return t('administration.halls.reason_fits', 'Seats {{capacity}} — a good fit for {{attendees}}', p)
    case 'roomy':
      return t('administration.halls.reason_roomy', 'Seats {{capacity}} — roomy for {{attendees}}', p)
    case 'seats':
      return t('administration.halls.reason_seats', 'Seats {{capacity}}', p)
    case 'capacity_unknown':
      return t('administration.halls.reason_capacity_unknown', 'Capacity not set')
    case 'same_room':
      return t('administration.halls.reason_same_room', 'The usual room')
    case 'same_location':
      return t('administration.halls.reason_same_location', 'Same building ({{location}})', p)
    case 'nearby':
      return t('administration.halls.reason_nearby', 'Nearby ({{location}})', p)
    case 'equipment':
      return t('administration.halls.reason_equipment', 'Has {{items}}', { items: (p.items || []).join(', ') })
    case 'quiet_day':
      return t('administration.halls.reason_quiet_day', 'No other bookings that day')
    case 'busy_day':
      return t('administration.halls.reason_busy_day', 'Busy day ({{count}} bookings)', p)
    default:
      return reason.code
  }
}
