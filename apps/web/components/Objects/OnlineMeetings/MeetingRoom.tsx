'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsOut,
  CalendarBlank,
  Play,
  SignIn,
  VideoCamera,
  WarningCircle,
} from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  getJoinToken,
  getMeeting,
  getRecordings,
  getStartUrl,
  type JoinToken,
  type OnlineMeeting,
} from '@services/integrations/zoom'
import { MeetingStatusBadge } from './MeetingStatusBadge'
import { formatMeetingTime, zoomErrorMessage } from './meetingUtils'

type Phase = 'idle' | 'preparing' | 'joining' | 'in_meeting' | 'left' | 'error'

const primaryBtn =
  'inline-flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-6 py-2.5 text-sm font-bold text-[hsl(var(--dash-ink))] shadow-[0_4px_12px_hsl(var(--dash-accent)/0.3)] hover:brightness-110 disabled:opacity-50'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))]/70 hover:bg-black/5'

/**
 * The online class inside the LMS. Joining asks the backend for a short-lived
 * Meeting SDK signature (only after the click, and only for enrolled students
 * or the class's hosts), then runs Zoom's official Web SDK in the same-origin
 * /zoom/meeting.html frame. If embedding fails, the Zoom app/web link remains.
 */
export default function MeetingRoom({
  orgslug,
  meetingUuid,
  asHost,
}: {
  orgslug: string
  meetingUuid: string
  asHost: boolean
}) {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const access_token: string | undefined = session?.data?.tokens?.access_token
  const signedIn = !!session?.data?.user
  const frameRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef<JoinToken | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  const { data: meeting, error, isLoading } = useQuery({
    queryKey: ['online-meetings', meetingUuid],
    queryFn: () => getMeeting(meetingUuid, access_token!),
    enabled: !!access_token,
    retry: false,
    // Our own API (kept current by Zoom webhooks) — shows "live" when the host starts.
    refetchInterval: (q) => {
      const m = q.state.data as OnlineMeeting | undefined
      return m && m.status === 'upcoming' && phase === 'idle' ? 30_000 : false
    },
  })
  const hosting = asHost && !!meeting?.viewer_is_host

  const recordings = useQuery({
    queryKey: ['online-meetings', meetingUuid, 'recordings'],
    queryFn: () => getRecordings(meetingUuid, access_token!),
    enabled: !!access_token && !!meeting && meeting.status === 'ended' && (meeting.recordings_published || meeting.viewer_is_host),
    retry: false,
  })

  // Messages from the SDK frame (same origin only).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      const data = event.data || {}
      switch (data.type) {
        case 'zoom:ready':
          if (tokenRef.current) {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'zoom:join', payload: tokenRef.current, lang: i18n.language },
              window.location.origin
            )
            tokenRef.current = null // single use
          }
          break
        case 'zoom:joining':
          setPhase('joining')
          break
        case 'zoom:joined':
          setPhase('in_meeting')
          break
        case 'zoom:left':
          setPhase('left')
          setFrameSrc(null)
          break
        case 'zoom:error':
          setPhase('error')
          setFrameSrc(null)
          setErrorText(
            data.code === 'sdk_load_failed'
              ? t('online_meetings.room.sdk_failed')
              : t('online_meetings.room.join_failed', { reason: data.message || data.code })
          )
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [i18n.language, t])

  const join = useCallback(async () => {
    if (!meeting || !access_token) return
    setPhase('preparing')
    setErrorText(null)
    try {
      const token = await getJoinToken(meeting.meeting_uuid, hosting, access_token)
      tokenRef.current = token
      setFrameSrc(`/zoom/meeting.html?v=${encodeURIComponent(token.sdk_version)}`)
    } catch (err: any) {
      setPhase('error')
      setErrorText(zoomErrorMessage(err, t))
    }
  }, [meeting, access_token, hosting, t])

  const openInZoom = async () => {
    if (!meeting || !access_token) return
    try {
      if (hosting) {
        const { start_url } = await getStartUrl(meeting.meeting_uuid, access_token)
        window.open(start_url, '_blank', 'noopener,noreferrer')
      } else if (meeting.join_url) {
        window.open(meeting.join_url, '_blank', 'noopener,noreferrer')
      }
    } catch (err: any) {
      setErrorText(zoomErrorMessage(err, t))
    }
  }

  const backHref = meeting?.lecture.course_uuid
    ? getUriWithOrg(orgslug, `/course/${meeting.lecture.course_uuid.replace(/^course_/, '')}`)
    : getUriWithOrg(orgslug, '/dash/online-classes')

  if (!signedIn && session?.status !== 'loading') {
    return (
      <RoomShell>
        <Notice icon={<SignIn size={28} />} title={t('online_meetings.room.sign_in')}>
          <Link href={getUriWithOrg(orgslug, '/login')} className={primaryBtn}>
            {t('online_meetings.room.sign_in_action')}
          </Link>
        </Notice>
      </RoomShell>
    )
  }

  if (isLoading || !meeting) {
    if (error) {
      return (
        <RoomShell>
          <Notice icon={<WarningCircle size={28} />} title={zoomErrorMessage(error, t)} />
        </RoomShell>
      )
    }
    return (
      <RoomShell>
        <div className="h-[60vh] animate-pulse rounded-[1.25rem] bg-white/60" />
      </RoomShell>
    )
  }

  const canEnter = meeting.status === 'upcoming' || meeting.status === 'live'
  const inFrame = !!frameSrc && (phase === 'preparing' || phase === 'joining' || phase === 'in_meeting')

  return (
    <RoomShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={backHref} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]">
            <ArrowLeft size={14} /> {meeting.lecture.course_name || meeting.lecture.offering_code || t('online_meetings.room.back')}
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">
            {meeting.topic}
            <MeetingStatusBadge status={meeting.status} />
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[hsl(var(--dash-muted))]">
            <CalendarBlank size={14} />
            {formatMeetingTime(meeting.start_time, meeting.timezone, i18n.language)} · {meeting.duration} min
          </p>
        </div>
        {inFrame && (
          <button className={ghostBtn} onClick={() => containerRef.current?.requestFullscreen?.()}>
            <ArrowsOut size={16} /> {t('online_meetings.room.fullscreen')}
          </button>
        )}
      </div>

      {frameSrc && (
        <div
          ref={containerRef}
          className="overflow-hidden rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-[#1f1f1f]"
          style={{ height: 'max(560px, calc(100vh - 210px))' }}
        >
          <iframe
            ref={frameRef}
            src={frameSrc}
            title={meeting.topic}
            className="h-full w-full border-0"
            allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
          />
        </div>
      )}

      {!frameSrc && (
        <div className="rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white px-6 py-10 text-center">
          {meeting.status === 'canceled' && (
            <Notice icon={<WarningCircle size={28} />} title={t('online_meetings.room.canceled')} />
          )}
          {meeting.status === 'error' && (
            <Notice icon={<WarningCircle size={28} />} title={t('online_meetings.room.unavailable')} />
          )}
          {meeting.status === 'ended' && (
            <Notice icon={<VideoCamera size={28} />} title={t('online_meetings.room.ended')}>
              {recordings.data?.files.length ? (
                <div className="mx-auto mt-2 max-w-md space-y-2 text-start">
                  {recordings.data.password && (
                    <p className="text-sm text-gray-600">
                      {t('online_meetings.recordings.passcode')}: <code className="rounded bg-gray-100 px-1.5">{recordings.data.password}</code>
                    </p>
                  )}
                  {recordings.data.files.filter((f) => f.play_url).map((f, i) => (
                    <a
                      key={i} href={f.play_url!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <span>{(f.recording_type || f.file_type || '').replace(/_/g, ' ')}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--dash-tile-mint-fg))]">
                        <Play size={12} weight="fill" /> {t('online_meetings.recordings.watch')}
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}
            </Notice>
          )}
          {canEnter && (
            <Notice
              icon={<VideoCamera size={28} />}
              title={
                phase === 'left'
                  ? t('online_meetings.room.left')
                  : meeting.status === 'live'
                    ? t('online_meetings.room.live_now')
                    : hosting
                      ? t('online_meetings.room.ready_to_start')
                      : t('online_meetings.room.not_started')
              }
            >
              {!meeting.viewer_can_join ? (
                <p className="text-sm text-red-600">{t('online_meetings.errors.not_enrolled')}</p>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button className={primaryBtn} onClick={join} disabled={phase === 'preparing'}>
                    <VideoCamera size={18} weight="fill" />
                    {hosting
                      ? t('online_meetings.actions.start_meeting')
                      : phase === 'left'
                        ? t('online_meetings.actions.rejoin')
                        : t('online_meetings.actions.join_online_class')}
                  </button>
                  {(hosting || meeting.join_url) && (
                    <button className={ghostBtn} onClick={openInZoom}>
                      <ArrowSquareOut size={16} /> {t('online_meetings.actions.open_in_zoom')}
                    </button>
                  )}
                </div>
              )}
              {errorText && <p className="mt-3 text-sm text-red-600">{errorText}</p>}
              {!hosting && meeting.status === 'upcoming' && (
                <p className="mt-3 text-xs text-[hsl(var(--dash-muted))]">{t('online_meetings.room.waiting_hint')}</p>
              )}
            </Notice>
          )}
        </div>
      )}
    </RoomShell>
  )
}

function RoomShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1480px] px-3 pb-10 pt-4 sm:px-5 lg:px-6">{children}</div>
}

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70">
        {icon}
      </span>
      <h2 className="text-base font-semibold text-[hsl(var(--dash-ink))]">{title}</h2>
      {children}
    </div>
  )
}
