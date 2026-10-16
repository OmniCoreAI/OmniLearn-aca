'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Play, VideoCamera } from '@phosphor-icons/react'
import { getUriWithOrg } from '@services/config/config'
import { getCourseMeetings, type OnlineMeeting } from '@services/integrations/zoom'
import { MeetingStatusBadge } from './MeetingStatusBadge'
import { formatMeetingTime, meetingPath } from './meetingUtils'
import { useModules } from '@/lib/modules'

/**
 * A course's online classes for the signed-in learner (or its teachers):
 * live classes first with a prominent "Join", then upcoming ones, then the
 * most recent past ones with recordings when the instructor shared them.
 * Renders nothing when the course has no online class the viewer can see.
 */
export default function CourseOnlineClasses(props: React.ComponentProps<typeof CourseOnlineClassesList>) {
  // Online classes switched off in the .env file: nothing to show, nothing to fetch.
  const { isModuleEnabled } = useModules()
  return isModuleEnabled('online_classes') ? <CourseOnlineClassesList {...props} /> : null
}

function CourseOnlineClassesList({
  courseUuid,
  orgslug,
  access_token,
}: {
  courseUuid: string
  orgslug: string
  access_token?: string
}) {
  const { t, i18n } = useTranslation()
  const { data: meetings = [] } = useQuery({
    queryKey: ['online-meetings', 'list', 'course', courseUuid],
    queryFn: () => getCourseMeetings(courseUuid, access_token!),
    enabled: !!access_token && !!courseUuid,
    retry: false,
    refetchInterval: (q) =>
      ((q.state.data as OnlineMeeting[] | undefined) || []).some((m) => m.status === 'upcoming' || m.status === 'live')
        ? 60_000
        : false,
  })

  const visible = meetings
    .filter((m) => m.status !== 'error')
    .filter((m, i, all) => m.status !== 'ended' || all.slice(0, i).filter((x) => x.status === 'ended').length < 3)
  if (!visible.length) return null
  const live = visible.find((m) => m.status === 'live')

  return (
    <section
      aria-labelledby="course-online-classes"
      className="rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-4 shadow-[0_1px_2px_hsl(220_30%_10%/0.04),0_12px_32px_-20px_hsl(220_30%_10%/0.14)] sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/75">
          <VideoCamera size={18} weight="bold" />
        </span>
        <h2 id="course-online-classes" className="text-[16.5px] font-bold tracking-tight text-[hsl(var(--dash-ink))]">
          {t('online_meetings.course.title')}
        </h2>
      </div>

      {live && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-100">
          <div className="min-w-0">
            <MeetingStatusBadge status="live" />
            <p className="mt-1 truncate text-sm font-semibold text-[hsl(var(--dash-ink))]">{live.topic}</p>
          </div>
          {live.viewer_can_join && (
            <Link
              href={getUriWithOrg(orgslug, meetingPath(live.meeting_uuid, live.viewer_is_host))}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              <VideoCamera size={16} weight="fill" />
              {live.viewer_is_host ? t('online_meetings.actions.start_meeting') : t('online_meetings.actions.join_meeting')}
            </Link>
          )}
        </div>
      )}

      <ul className="mt-3 divide-y divide-[hsl(var(--dash-border))]/60">
        {visible
          .filter((m) => m !== live)
          .map((m) => (
            <li key={m.meeting_uuid} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-[hsl(var(--dash-ink))]" dir="auto">{m.topic}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[hsl(var(--dash-muted))]">
                  <MeetingStatusBadge status={m.status} />
                  {formatMeetingTime(m.start_time, m.timezone, i18n.language)}
                </p>
              </div>
              {m.status === 'upcoming' && m.viewer_can_join && (
                <Link
                  href={getUriWithOrg(orgslug, meetingPath(m.meeting_uuid, m.viewer_is_host))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-accent))] px-4 py-1.5 text-xs font-bold text-[hsl(var(--dash-ink))] hover:brightness-110"
                >
                  {m.viewer_is_host ? t('online_meetings.actions.start_meeting') : t('online_meetings.actions.join_online_class')}
                </Link>
              )}
              {m.status === 'ended' && (m.recordings_published || m.viewer_is_host) && m.recording_status === 'available' && (
                <Link
                  href={getUriWithOrg(orgslug, meetingPath(m.meeting_uuid))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--dash-tile-mint-fg))] hover:underline"
                >
                  <Play size={12} weight="fill" /> {t('online_meetings.recordings.watch')}
                </Link>
              )}
            </li>
          ))}
      </ul>
    </section>
  )
}
