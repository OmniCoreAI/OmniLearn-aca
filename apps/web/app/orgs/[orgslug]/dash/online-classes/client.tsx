'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { VideoCamera } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getUriWithOrg } from '@services/config/config'
import { getMyMeetings, type OnlineMeeting } from '@services/integrations/zoom'
import { LectureMeetingControls, useZoomConnection } from '@components/Objects/OnlineMeetings/LectureMeetingControls'
import { formatMeetingTime, meetingPath } from '@components/Objects/OnlineMeetings/meetingUtils'

/**
 * Instructor dashboard for online classes: every meeting the user hosts
 * (administrators: the whole academy) with status and the same actions as on
 * the lecture — start, copy link, edit, cancel, attendance, recordings.
 * Meetings are created from a lecture (course schedule or offering session).
 */
export default function OnlineClassesDashboard({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const [includePast, setIncludePast] = useState(false)
  const connection = useZoomConnection(access_token)
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['online-meetings', 'list', 'mine', orgId, includePast],
    queryFn: () => getMyMeetings(orgId, includePast, access_token),
    enabled: ready,
  })

  const hosted = meetings.filter((m) => m.viewer_is_host)
  const attending = meetings.filter((m) => !m.viewer_is_host)

  return (
    <AcademicPageShell>
      <AcademicHeader
        title={t('online_meetings.dashboard.title')}
        subtitle={t('online_meetings.dashboard.subtitle')}
        action={
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--dash-muted))]">
            <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />
            {t('online_meetings.dashboard.include_past')}
          </label>
        }
      />

      {connection.data && !connection.data.connected && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {connection.data.status === 'reauth_required'
            ? t('online_meetings.errors.zoom_reauth_required')
            : t('online_meetings.errors.zoom_not_connected')}{' '}
          <Link href={getUriWithOrg(orgslug, '/dash/administration/zoom')} className="font-semibold underline">
            {t('online_meetings.admin.title')}
          </Link>
        </p>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[1.25rem] bg-white/60" />
      ) : !meetings.length ? (
        <div className="rounded-[1.25rem] border border-dashed border-[hsl(var(--dash-border))] bg-white px-6 py-12 text-center">
          <VideoCamera size={28} className="mx-auto text-[hsl(var(--dash-muted))]" />
          <p className="mt-3 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('online_meetings.dashboard.empty')}</p>
          <p className="mt-1 text-sm text-[hsl(var(--dash-muted))]">{t('online_meetings.dashboard.empty_hint')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {hosted.length > 0 && <MeetingList title={t('online_meetings.dashboard.hosting')} meetings={hosted} access_token={access_token} orgslug={orgslug} lang={i18n.language} />}
          {attending.length > 0 && <MeetingList title={t('online_meetings.dashboard.attending')} meetings={attending} access_token={access_token} orgslug={orgslug} lang={i18n.language} />}
        </div>
      )}
    </AcademicPageShell>
  )
}

function MeetingList({
  title,
  meetings,
  access_token,
  orgslug,
  lang,
}: {
  title: string
  meetings: OnlineMeeting[]
  access_token: string
  orgslug: string
  lang: string
}) {
  const { t } = useTranslation()
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">{title}</h2>
      <ul className="space-y-2">
        {meetings.map((m) => (
          <li key={m.meeting_uuid} className="rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[hsl(var(--dash-ink))]" dir="auto">{m.topic}</p>
                <p className="text-[12px] text-[hsl(var(--dash-muted))]">
                  {[m.lecture.course_name || m.lecture.offering_code, m.lecture.title].filter(Boolean).join(' · ')}
                </p>
              </div>
              {!m.viewer_is_host && (m.status === 'upcoming' || m.status === 'live') && (
                <Link
                  href={getUriWithOrg(orgslug, meetingPath(m.meeting_uuid))}
                  className="rounded-full bg-[hsl(var(--dash-accent))] px-4 py-1.5 text-xs font-bold text-[hsl(var(--dash-ink))]"
                >
                  {t('online_meetings.actions.join_online_class')}
                </Link>
              )}
            </div>
            {m.viewer_is_host ? (
              <LectureMeetingControls
                lecture={{ session_uuid: m.lecture.session_uuid, title: m.lecture.title, start: m.lecture.start, end: m.lecture.end }}
                access_token={access_token}
                initialMeeting={m}
              />
            ) : (
              <p className="mt-1 text-[12px] text-[hsl(var(--dash-muted))]">{formatMeetingTime(m.start_time, m.timezone, lang)}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
