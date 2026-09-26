import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'

export type CalendarEventType = 'lecture' | 'exam' | 'class' | 'deadline' | 'term' | 'program' | 'interview'

export type CalendarEvent = {
  id: string
  type: CalendarEventType
  /** Finer grain: lecture/seminar/lab…, term_start/registration_end…, entrance_test… */
  kind: string | null
  title: string
  subtitle: string | null
  /** Naive local ISO datetime from the server. */
  start: string
  end: string | null
  all_day: boolean
  location: string | null
  instructor: string | null
  description: string | null
  status: string | null
  refs: {
    course_uuid?: string
    offering_uuid?: string
    assignment_uuid?: string
    activity_uuid?: string
    term_uuid?: string
    trainingprogram_uuid?: string
    application_uuid?: string
    role?: 'applicant' | 'staff'
  }
}

export type CalendarScope = 'all' | 'teaching' | 'learning'

export type CalendarFeed = {
  scope: CalendarScope
  start: string
  end: string
  events: CalendarEvent[]
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function getCalendarEvents(orgId: number, accessToken: string, start: Date, end: Date) {
  const qs = new URLSearchParams({ org_id: String(orgId), start: isoDay(start), end: isoDay(end) })
  return apiFetch(`${getAPIUrl()}calendar/events?${qs}`, accessToken) as Promise<CalendarFeed>
}
