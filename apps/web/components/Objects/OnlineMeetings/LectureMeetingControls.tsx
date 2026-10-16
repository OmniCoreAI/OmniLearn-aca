'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  ChartBar,
  Copy,
  PencilSimple,
  Play,
  VideoCamera,
  XCircle,
} from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useModules } from '@/lib/modules'
import { getUriWithOrg } from '@services/config/config'
import {
  cancelMeeting,
  getLectureMeeting,
  getStartUrl,
  getZoomConnection,
  refreshMeeting,
  type OnlineMeeting,
} from '@services/integrations/zoom'
import { MeetingFormDialog, type LectureInfo } from './MeetingFormDialog'
import { MeetingReportsDialog } from './MeetingReportsDialog'
import { MeetingStatusBadge } from './MeetingStatusBadge'
import { formatMeetingTime, meetingPath, zoomErrorMessage } from './meetingUtils'

const actionCls =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-gray-600 hover:bg-white hover:text-black disabled:opacity-40'

export function useZoomConnection(access_token: string) {
  const org = useOrg() as any
  return useQuery({
    queryKey: ['zoom', 'connection', org?.id],
    queryFn: () => getZoomConnection(org.id, access_token),
    enabled: !!org?.id && !!access_token,
    staleTime: 60_000,
  })
}

/**
 * The "Online meeting" part of a lecture row for instructors and admins:
 * create the Zoom meeting, then start / copy link / edit / cancel it and see
 * its status, attendance and recordings.
 */
export function LectureMeetingControls(props: React.ComponentProps<typeof LectureMeetingControlsPanel>) {
  // Online classes switched off in the .env file: no Zoom controls on lectures.
  const { isModuleEnabled } = useModules()
  return isModuleEnabled('online_classes') ? <LectureMeetingControlsPanel {...props} /> : null
}

function LectureMeetingControlsPanel({
  lecture,
  access_token,
  initialMeeting,
}: {
  lecture: LectureInfo
  access_token: string
  /** Already-loaded meeting (lists), so the row doesn't fetch it again. */
  initialMeeting?: OnlineMeeting
}) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const key = ['online-meetings', 'lecture', lecture.session_uuid]

  const connection = useZoomConnection(access_token)
  const { data: meeting, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getLectureMeeting(lecture.session_uuid, access_token),
    enabled: !!access_token && !!lecture.session_uuid,
    initialData: initialMeeting,
    retry: false,
  })

  const setMeeting = (m: OnlineMeeting | null) => {
    queryClient.setQueryData(key, m)
    queryClient.invalidateQueries({ queryKey: ['online-meetings', 'list'] })
  }

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    try {
      await fn()
    } catch (err: any) {
      toast.error(zoomErrorMessage(err, t))
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) return null
  const connected = connection.data?.connected
  const active = meeting && meeting.status !== 'canceled'

  if (!active) {
    if (connection.data && !connected) {
      return (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-gray-400">
          <VideoCamera className="h-3.5 w-3.5" />
          {connection.data.status === 'reauth_required'
            ? t('online_meetings.state.reconnect_needed')
            : t('online_meetings.state.not_connected')}
        </span>
      )
    }
    return (
      <>
        <button className={actionCls} onClick={() => setFormOpen(true)} disabled={!connected}>
          <VideoCamera className="h-3.5 w-3.5" /> {t('online_meetings.actions.create')}
        </button>
        {formOpen && (
          <MeetingFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            lecture={lecture}
            access_token={access_token}
            onSaved={setMeeting}
          />
        )}
      </>
    )
  }

  const startUrl = getUriWithOrg(org?.slug, meetingPath(meeting.meeting_uuid, true))
  const joinable = meeting.status === 'upcoming' || meeting.status === 'live'

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg bg-white/70 px-1.5 py-1">
      <span className="flex items-center gap-1.5 px-1 text-[11.5px] text-gray-600">
        <VideoCamera className="h-3.5 w-3.5 text-gray-500" />
        <MeetingStatusBadge status={meeting.status} />
        <span className="hidden sm:inline">{formatMeetingTime(meeting.start_time, meeting.timezone, i18n.language)}</span>
      </span>
      {meeting.status === 'error' && meeting.status_detail === 'deleted_in_zoom' && (
        <span className="text-[11px] text-amber-700">{t('online_meetings.state.deleted_in_zoom')}</span>
      )}
      {joinable && (
        <>
          <Link href={startUrl} className={`${actionCls} text-[hsl(var(--dash-tile-mint-fg))]`}>
            <Play className="h-3.5 w-3.5" weight="fill" /> {t('online_meetings.actions.start')}
          </Link>
          <button
            className={actionCls}
            disabled={busy === 'app'}
            onClick={() =>
              run('app', async () => {
                // Open the tab synchronously so pop-up blockers allow it.
                const win = window.open('about:blank', '_blank')
                try {
                  const { start_url } = await getStartUrl(meeting.meeting_uuid, access_token)
                  if (win) {
                    win.opener = null
                    win.location.href = start_url
                  } else {
                    window.location.href = start_url
                  }
                } catch (e) {
                  win?.close()
                  throw e
                }
              })
            }
          >
            <ArrowSquareOut className="h-3.5 w-3.5" /> {t('online_meetings.actions.open_in_zoom')}
          </button>
          {meeting.join_url && (
            <button
              className={actionCls}
              onClick={() =>
                run('copy', async () => {
                  await navigator.clipboard.writeText(meeting.join_url!)
                  toast.success(t('online_meetings.link_copied'))
                })
              }
            >
              <Copy className="h-3.5 w-3.5" /> {t('online_meetings.actions.copy_link')}
            </button>
          )}
          <button className={actionCls} onClick={() => setFormOpen(true)}>
            <PencilSimple className="h-3.5 w-3.5" /> {t('online_meetings.actions.edit')}
          </button>
        </>
      )}
      <button
        className={actionCls}
        disabled={busy === 'refresh'}
        title={t('online_meetings.actions.refresh_hint')}
        onClick={() => run('refresh', async () => setMeeting(await refreshMeeting(meeting.meeting_uuid, access_token)))}
      >
        <ArrowsClockwise className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
        {t('online_meetings.actions.refresh')}
      </button>
      <button className={actionCls} onClick={() => setReportsOpen(true)}>
        <ChartBar className="h-3.5 w-3.5" /> {t('online_meetings.actions.reports')}
      </button>
      {meeting.status !== 'live' && (
        <button
          className={`${actionCls} hover:text-red-600`}
          disabled={busy === 'cancel'}
          onClick={() => {
            if (!window.confirm(t('online_meetings.confirm_cancel'))) return
            run('cancel', async () => {
              const canceled = await cancelMeeting(meeting.meeting_uuid, access_token)
              setMeeting(canceled)
              toast.success(t('online_meetings.canceled'))
            })
          }}
        >
          <XCircle className="h-3.5 w-3.5" /> {t('online_meetings.actions.cancel')}
        </button>
      )}

      {formOpen && (
        <MeetingFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          lecture={lecture}
          meeting={meeting}
          access_token={access_token}
          onSaved={setMeeting}
        />
      )}
      {reportsOpen && (
        <MeetingReportsDialog open={reportsOpen} onOpenChange={setReportsOpen} meeting={meeting} access_token={access_token} />
      )}
    </div>
  )
}
