import type { MeetingSettings, MeetingStatus } from '@services/integrations/zoom'

export const DEFAULT_SETTINGS: MeetingSettings = {
  waiting_room: true,
  join_before_host: false,
  host_video: true,
  participant_video: false,
  mute_upon_entry: true,
  auto_recording: 'none',
  meeting_authentication: false,
  alternative_hosts: '',
  allow_multiple_devices: false,
}

export const STATUS_STYLE: Record<MeetingStatus, string> = {
  upcoming: 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-tile-mint-fg))]',
  live: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  ended: 'bg-gray-100 text-gray-600',
  canceled: 'bg-gray-100 text-gray-500 line-through',
  error: 'bg-amber-50 text-amber-800',
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function timezoneOptions(current?: string): string[] {
  let zones: string[] = []
  try {
    zones = (Intl as any).supportedValuesOf?.('timeZone') || []
  } catch {
    zones = []
  }
  const base = zones.length ? zones : ['UTC', 'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London']
  const all = new Set<string>(['UTC', ...base])
  if (current) all.add(current)
  return Array.from(all)
}

/** "2030-01-05T10:00:00" in its own time zone → readable text in the viewer's locale. */
export function formatMeetingTime(start: string, timezone: string, locale?: string): string {
  if (!start) return ''
  const [datePart, timePart = '00:00'] = start.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  // Wall-clock values; render them as-is and name the zone.
  const date = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0))
  try {
    const text = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(date)
    return `${text} (${timezone})`
  } catch {
    return `${start.replace('T', ' ').slice(0, 16)} (${timezone})`
  }
}

/** datetime-local value ("YYYY-MM-DDTHH:MM") from a stored wall-clock time. */
export function toInputValue(value?: string | null): string {
  if (!value) return ''
  return value.replace(' ', 'T').slice(0, 16)
}

export function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  const a = Date.parse(start)
  const b = Date.parse(end)
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null
  return Math.round((b - a) / 60000)
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

/** Translated message for a Zoom API error ({code, message} detail). */
export function zoomErrorMessage(err: any, t: (_key: string, _fallback?: any) => string): string {
  const code: string | undefined = err?.detail?.code
  if (code) {
    const key = `online_meetings.errors.${code}`
    const translated = t(key, '')
    if (translated && translated !== key) {
      // Zoom's own refusal text is actionable ("Invalid passcode"); keep it.
      return code === 'zoom_rejected' || code === 'invalid' ? `${translated} ${err.message || ''}`.trim() : translated
    }
  }
  return err?.message || t('online_meetings.errors.generic', 'Something went wrong. Please try again.')
}

/** The in-LMS meeting room (org-relative path). */
export function meetingPath(meetingUuid: string, asHost = false): string {
  return `/online/${meetingUuid.replace(/^onlinemeeting_/, '')}${asHost ? '?host=1' : ''}`
}
