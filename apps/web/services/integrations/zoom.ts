import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
  Zoom online meetings. Every Zoom call happens on the LMS backend; the browser
  only ever talks to /integrations/zoom/* and never sees Zoom secrets or tokens.
  Meetings are addressed by the LMS meeting_uuid or the lecture's session_uuid.
*/

const base = () => `${getAPIUrl()}integrations/zoom`

export type MeetingStatus = 'upcoming' | 'live' | 'ended' | 'canceled' | 'error'

export interface ZoomConnection {
  configured: boolean
  sdk_configured: boolean
  webhooks_configured: boolean
  connected: boolean
  status?: 'active' | 'reauth_required' | null
  zoom_email?: string | null
  zoom_display_name?: string | null
  zoom_account_id?: string | null
  scopes?: string | null
  last_error?: string | null
  connected_at?: string | null
  webhook_path: string
}

export interface MeetingSettings {
  waiting_room: boolean
  join_before_host: boolean
  host_video: boolean
  participant_video: boolean
  mute_upon_entry: boolean
  auto_recording: 'none' | 'local' | 'cloud'
  meeting_authentication: boolean
  alternative_hosts?: string | null
  allow_multiple_devices: boolean
}

export interface Recurrence {
  type: 1 | 2 | 3
  repeat_interval: number
  weekly_days?: string | null
  monthly_day?: number | null
  end_times?: number | null
  end_date_time?: string | null
}

export interface LectureRef {
  kind: 'course_session' | 'offering_session'
  session_uuid: string
  title?: string | null
  start?: string | null
  end?: string | null
  course_uuid?: string | null
  course_name?: string | null
  offering_uuid?: string | null
  offering_code?: string | null
}

export interface OnlineMeeting {
  meeting_uuid: string
  lecture: LectureRef
  topic: string
  agenda?: string | null
  start_time: string
  duration: number
  timezone: string
  meeting_type: number
  recurrence?: Recurrence | null
  status: MeetingStatus
  status_detail?: string | null
  started_at?: string | null
  ended_at?: string | null
  recording_status: 'none' | 'recording' | 'processing' | 'available'
  recordings_published: boolean
  viewer_is_host: boolean
  viewer_can_join: boolean
  join_url?: string | null
  zoom_meeting_id?: string | null
  password?: string | null
  settings?: MeetingSettings | null
  host_email?: string | null
  last_synced_at?: string | null
}

export interface MeetingInput {
  topic?: string | null
  agenda?: string | null
  start_time?: string | null
  duration?: number | null
  timezone?: string
  password?: string | null
  recurrence?: Recurrence | null
  clear_recurrence?: boolean
  settings?: MeetingSettings
  recordings_published?: boolean
}

export interface JoinToken {
  sdk_key: string
  sdk_version: string
  signature: string
  meeting_number: string
  password: string
  role: 0 | 1
  user_name: string
  user_email?: string | null
  customer_key: string
  zak?: string | null
  join_url?: string | null
}

export interface AttendanceReport {
  meeting_uuid: string
  rows: {
    user_uuid?: string | null
    name?: string | null
    email?: string | null
    match_method: 'customer_key' | 'email' | 'none'
    segments: number
    first_join?: string | null
    last_leave?: string | null
    duration_seconds: number
  }[]
  unmatched: number
  enrolled: number
  attended: number
}

export interface Recordings {
  meeting_uuid: string
  recording_status: string
  published: boolean
  share_url?: string | null
  password?: string | null
  files: {
    recording_type?: string | null
    file_type?: string | null
    file_size?: number | null
    play_url?: string | null
    recording_start?: string | null
    recording_end?: string | null
  }[]
}

async function call<T>(method: string, url: string, token: string, data: any = null): Promise<T> {
  return errorHandling(await fetch(url, RequestBodyWithAuthHeader(method, data, null, token)))
}

// ------------------------------ Connection ------------------------------

export const getZoomConnection = (orgId: number, token: string) =>
  call<ZoomConnection>('GET', `${base()}/connection?org_id=${orgId}`, token)

export const startZoomConnect = (orgId: number, token: string) =>
  call<{ authorize_url: string }>('POST', `${base()}/connect?org_id=${orgId}`, token, {})

export const completeZoomConnect = (orgId: number, code: string, state: string, token: string) =>
  call<ZoomConnection>('POST', `${base()}/oauth/callback?org_id=${orgId}`, token, { code, state })

export const disconnectZoom = (orgId: number, token: string) =>
  call<string>('DELETE', `${base()}/connection?org_id=${orgId}`, token, {})

// ------------------------------- Meetings -------------------------------

export const getLectureMeeting = (sessionUuid: string, token: string) =>
  call<OnlineMeeting | null>('GET', `${base()}/lectures/${encodeURIComponent(sessionUuid)}/meeting`, token)

export const createLectureMeeting = (sessionUuid: string, data: MeetingInput, token: string) =>
  call<OnlineMeeting>('POST', `${base()}/lectures/${encodeURIComponent(sessionUuid)}/meeting`, token, data)

export const getCourseMeetings = (courseUuid: string, token: string) =>
  call<OnlineMeeting[]>('GET', `${base()}/courses/${encodeURIComponent(courseUuid)}/meetings`, token)

export const getMyMeetings = (orgId: number, includePast: boolean, token: string) =>
  call<OnlineMeeting[]>('GET', `${base()}/meetings?org_id=${orgId}&include_past=${includePast}`, token)

export const getMeeting = (meetingUuid: string, token: string) =>
  call<OnlineMeeting>('GET', `${base()}/meetings/${encodeURIComponent(meetingUuid)}`, token)

export const updateMeeting = (meetingUuid: string, data: MeetingInput, token: string) =>
  call<OnlineMeeting>('PUT', `${base()}/meetings/${encodeURIComponent(meetingUuid)}`, token, data)

export const cancelMeeting = (meetingUuid: string, token: string) =>
  call<OnlineMeeting>('DELETE', `${base()}/meetings/${encodeURIComponent(meetingUuid)}`, token, {})

export const refreshMeeting = (meetingUuid: string, token: string) =>
  call<OnlineMeeting>('POST', `${base()}/meetings/${encodeURIComponent(meetingUuid)}/refresh`, token, {})

export const getStartUrl = (meetingUuid: string, token: string) =>
  call<{ start_url: string }>('POST', `${base()}/meetings/${encodeURIComponent(meetingUuid)}/start`, token, {})

export const getJoinToken = (meetingUuid: string, asHost: boolean, token: string) =>
  call<JoinToken>(
    'POST',
    `${base()}/meetings/${encodeURIComponent(meetingUuid)}/join-token?as_host=${asHost}`,
    token,
    {}
  )

export const getAttendance = (meetingUuid: string, token: string) =>
  call<AttendanceReport>('GET', `${base()}/meetings/${encodeURIComponent(meetingUuid)}/attendance`, token)

export const syncAttendance = (meetingUuid: string, token: string) =>
  call<AttendanceReport>('POST', `${base()}/meetings/${encodeURIComponent(meetingUuid)}/attendance/sync`, token, {})

export const getRecordings = (meetingUuid: string, token: string) =>
  call<Recordings>('GET', `${base()}/meetings/${encodeURIComponent(meetingUuid)}/recordings`, token)

export const syncRecordings = (meetingUuid: string, token: string) =>
  call<Recordings>('POST', `${base()}/meetings/${encodeURIComponent(meetingUuid)}/recordings/sync`, token, {})
