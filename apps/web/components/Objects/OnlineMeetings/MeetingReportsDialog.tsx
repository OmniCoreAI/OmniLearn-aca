'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowsClockwise, Play } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog'
import {
  getAttendance,
  getRecordings,
  syncAttendance,
  syncRecordings,
  type OnlineMeeting,
} from '@services/integrations/zoom'
import { formatDuration, zoomErrorMessage } from './meetingUtils'

type Tab = 'attendance' | 'recordings'

/** Host view of a meeting's attendance (matched to students) and recordings. */
export function MeetingReportsDialog({
  open,
  onOpenChange,
  meeting,
  access_token,
  initialTab = 'attendance',
}: {
  open: boolean
  onOpenChange: (_open: boolean) => void
  meeting: OnlineMeeting
  access_token: string
  initialTab?: Tab
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [syncing, setSyncing] = useState(false)
  const key = ['online-meetings', meeting.meeting_uuid]

  const attendance = useQuery({
    queryKey: [...key, 'attendance'],
    queryFn: () => getAttendance(meeting.meeting_uuid, access_token),
    enabled: open && tab === 'attendance',
  })
  const recordings = useQuery({
    queryKey: [...key, 'recordings'],
    queryFn: () => getRecordings(meeting.meeting_uuid, access_token),
    enabled: open && tab === 'recordings',
  })

  const sync = async () => {
    setSyncing(true)
    try {
      if (tab === 'attendance') {
        queryClient.setQueryData([...key, 'attendance'], await syncAttendance(meeting.meeting_uuid, access_token))
      } else {
        queryClient.setQueryData([...key, 'recordings'], await syncRecordings(meeting.meeting_uuid, access_token))
      }
    } catch (err: any) {
      toast.error(zoomErrorMessage(err, t))
    } finally {
      setSyncing(false)
    }
  }

  const tabCls = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-[hsl(var(--dash-ink))] text-white' : 'text-gray-600 hover:bg-gray-100'}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[min(720px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{meeting.topic}</DialogTitle>
          <DialogDescription>{t('online_meetings.reports.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <button className={tabCls(tab === 'attendance')} onClick={() => setTab('attendance')}>
                {t('online_meetings.reports.attendance')}
              </button>
              <button className={tabCls(tab === 'recordings')} onClick={() => setTab('recordings')}>
                {t('online_meetings.reports.recordings')}
              </button>
            </div>
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ArrowsClockwise className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {t('online_meetings.reports.sync_from_zoom')}
            </button>
          </div>

          {tab === 'attendance' && (
            <div>
              {attendance.data && (
                <p className="mb-3 text-sm text-gray-600">
                  {t('online_meetings.reports.attended_of', {
                    attended: attendance.data.attended,
                    enrolled: attendance.data.enrolled,
                  })}
                  {attendance.data.unmatched > 0 && (
                    <span className="ms-2 text-xs text-gray-500">
                      · {t('online_meetings.reports.unmatched', { count: attendance.data.unmatched })}
                    </span>
                  )}
                </p>
              )}
              {attendance.isLoading ? (
                <p className="text-sm text-gray-400">{t('online_meetings.loading')}</p>
              ) : !attendance.data?.rows.length ? (
                <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                  {t('online_meetings.reports.no_attendance')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-start text-xs uppercase tracking-wide text-gray-500">
                        <th className="py-2 text-start font-semibold">{t('online_meetings.reports.participant')}</th>
                        <th className="py-2 text-start font-semibold">{t('online_meetings.reports.time_in_class')}</th>
                        <th className="py-2 text-start font-semibold">{t('online_meetings.reports.identified_by')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attendance.data.rows.map((r, i) => (
                        <tr key={`${r.user_uuid || r.email || r.name}-${i}`}>
                          <td className="py-2">
                            <div className="font-medium text-gray-800">{r.name || '—'}</div>
                            {r.email && <div className="text-xs text-gray-500">{r.email}</div>}
                          </td>
                          <td className="py-2 text-gray-700">
                            {formatDuration(r.duration_seconds)}
                            {r.segments > 1 && (
                              <span className="ms-1 text-xs text-gray-400">
                                ({t('online_meetings.reports.rejoined', { count: r.segments })})
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-xs text-gray-500">{t(`online_meetings.reports.match.${r.match_method}`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-gray-400">{t('online_meetings.reports.matching_note')}</p>
            </div>
          )}

          {tab === 'recordings' && (
            <div>
              {recordings.isLoading ? (
                <p className="text-sm text-gray-400">{t('online_meetings.loading')}</p>
              ) : !recordings.data?.files.length ? (
                <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                  {meeting.recording_status === 'processing'
                    ? t('online_meetings.recordings.processing')
                    : t('online_meetings.recordings.none')}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    {recordings.data.published
                      ? t('online_meetings.recordings.published')
                      : t('online_meetings.recordings.not_published')}
                  </p>
                  {recordings.data.password && (
                    <p className="text-sm text-gray-700">
                      {t('online_meetings.recordings.passcode')}: <code className="rounded bg-gray-100 px-1.5 py-0.5">{recordings.data.password}</code>
                    </p>
                  )}
                  {recordings.data.files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-sm text-gray-800">
                        {(f.recording_type || f.file_type || '').replace(/_/g, ' ')}
                        <span className="ms-2 text-xs text-gray-400">{f.file_type}</span>
                      </span>
                      {f.play_url && (
                        <a
                          href={f.play_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--dash-tile-mint-fg))] hover:underline"
                        >
                          <Play className="h-3.5 w-3.5" weight="fill" /> {t('online_meetings.recordings.watch')}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
