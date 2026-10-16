'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog'
import {
  createLectureMeeting,
  updateMeeting,
  type MeetingInput,
  type MeetingSettings,
  type OnlineMeeting,
  type Recurrence,
} from '@services/integrations/zoom'
import {
  DEFAULT_SETTINGS,
  browserTimezone,
  minutesBetween,
  timezoneOptions,
  toInputValue,
  zoomErrorMessage,
} from './meetingUtils'

const inputCls =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]'
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

type RepeatKind = 'none' | '1' | '2' | '3'
const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] // Zoom: 1 = Sunday

export interface LectureInfo {
  session_uuid: string
  title?: string | null
  start?: string | null
  end?: string | null
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (_v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
      <span className="min-w-0">
        <span className="block text-sm text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--dash-accent))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

/**
 * Create or edit a lecture's Zoom meeting. Defaults come from the lecture
 * (title, start, length); everything is validated again on the server.
 * Mount it only while open so each opening starts from fresh values.
 */
export function MeetingFormDialog({
  open,
  onOpenChange,
  lecture,
  meeting,
  access_token,
  onSaved,
}: {
  open: boolean
  onOpenChange: (_open: boolean) => void
  lecture: LectureInfo
  meeting?: OnlineMeeting | null
  access_token: string
  onSaved: (_m: OnlineMeeting) => void
}) {
  const { t } = useTranslation()
  const editing = !!meeting
  const rec = meeting?.recurrence
  const [topic, setTopic] = useState(() => meeting ? meeting.topic : lecture.title || '')
  const [agenda, setAgenda] = useState(() => meeting?.agenda || '')
  const [start, setStart] = useState(() => toInputValue(meeting ? meeting.start_time : lecture.start))
  const [duration, setDuration] = useState(() => String(meeting ? meeting.duration : minutesBetween(lecture.start, lecture.end) || 60))
  const [timezone, setTimezone] = useState(() => meeting ? meeting.timezone : browserTimezone())
  const [password, setPassword] = useState(() => meeting?.password || '')
  const [repeat, setRepeat] = useState<RepeatKind>(() => (rec ? String(rec.type) : 'none') as RepeatKind)
  const [repeatInterval, setRepeatInterval] = useState(() => String(rec?.repeat_interval || 1))
  const [weekdays, setWeekdays] = useState<string[]>(() => rec?.weekly_days ? rec.weekly_days.split(',') : [])
  const [monthlyDay, setMonthlyDay] = useState(() => String(rec?.monthly_day || 1))
  const [occurrences, setOccurrences] = useState(() => String(rec?.end_times || 10))
  const [settings, setSettings] = useState<MeetingSettings>(() => ({ ...DEFAULT_SETTINGS, ...(meeting?.settings || {}) }))
  const [publishRecordings, setPublishRecordings] = useState(() => !!meeting?.recordings_published)
  const [saving, setSaving] = useState(false)

  const zones = useMemo(() => timezoneOptions(timezone), [timezone])
  const set = <K extends keyof MeetingSettings>(key: K, value: MeetingSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))

  const recurrence = (): Recurrence | null => {
    if (repeat === 'none') return null
    return {
      type: Number(repeat) as 1 | 2 | 3,
      repeat_interval: Math.max(1, Number(repeatInterval) || 1),
      weekly_days: repeat === '2' ? weekdays.join(',') : null,
      monthly_day: repeat === '3' ? Number(monthlyDay) || 1 : null,
      end_times: Math.max(1, Number(occurrences) || 1),
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim() || !start) {
      toast.error(t('online_meetings.form.required'))
      return
    }
    setSaving(true)
    const rec = recurrence()
    const payload: MeetingInput = {
      topic: topic.trim(),
      agenda: agenda.trim() || null,
      start_time: start,
      duration: Number(duration) || 60,
      timezone,
      password: password.trim() || null,
      settings: { ...settings, alternative_hosts: settings.alternative_hosts?.trim() || null },
      recurrence: rec,
    }
    try {
      const saved = editing
        ? await updateMeeting(
            meeting!.meeting_uuid,
            { ...payload, clear_recurrence: !rec, recordings_published: publishRecordings },
            access_token
          )
        : await createLectureMeeting(lecture.session_uuid, payload, access_token)
      toast.success(editing ? t('online_meetings.saved') : t('online_meetings.created'))
      onSaved(saved)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(zoomErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(640px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{editing ? t('online_meetings.form.edit_title') : t('online_meetings.form.create_title')}</DialogTitle>
          <DialogDescription>{t('online_meetings.form.subtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 px-6 pb-6">
          <div>
            <label className={labelCls} htmlFor="om-topic">{t('online_meetings.form.title')}</label>
            <input id="om-topic" className={inputCls} value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="om-agenda">{t('online_meetings.form.description')}</label>
            <textarea id="om-agenda" className={inputCls} rows={2} maxLength={2000} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className={labelCls} htmlFor="om-start">{t('online_meetings.form.start')}</label>
              <input id="om-start" type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="om-duration">{t('online_meetings.form.duration')}</label>
              <input id="om-duration" type="number" min={1} max={1440} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="om-tz">{t('online_meetings.form.timezone')}</label>
              <select id="om-tz" className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {zones.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 p-3">
            <label className={labelCls} htmlFor="om-repeat">{t('online_meetings.form.recurrence')}</label>
            <div className="grid gap-2 sm:grid-cols-3">
              <select id="om-repeat" className={inputCls} value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
                <option value="none">{t('online_meetings.form.repeat_none')}</option>
                <option value="1">{t('online_meetings.form.repeat_daily')}</option>
                <option value="2">{t('online_meetings.form.repeat_weekly')}</option>
                <option value="3">{t('online_meetings.form.repeat_monthly')}</option>
              </select>
              {repeat !== 'none' && (
                <>
                  <input
                    type="number" min={1} className={inputCls} value={repeatInterval}
                    aria-label={t('online_meetings.form.repeat_every')}
                    placeholder={t('online_meetings.form.repeat_every')}
                    onChange={(e) => setRepeatInterval(e.target.value)}
                  />
                  <input
                    type="number" min={1} max={60} className={inputCls} value={occurrences}
                    aria-label={t('online_meetings.form.occurrences')}
                    placeholder={t('online_meetings.form.occurrences')}
                    onChange={(e) => setOccurrences(e.target.value)}
                  />
                </>
              )}
            </div>
            {repeat === '2' && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const active = weekdays.includes(d)
                  return (
                    <button
                      type="button" key={d}
                      onClick={() => setWeekdays((w) => (active ? w.filter((x) => x !== d) : [...w, d]))}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-[hsl(var(--dash-accent))] text-[hsl(var(--dash-ink))]' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {t(`online_meetings.weekday.${d}`)}
                    </button>
                  )
                })}
              </div>
            )}
            {repeat === '3' && (
              <input
                type="number" min={1} max={31} className={`${inputCls} mt-2`} value={monthlyDay}
                aria-label={t('online_meetings.form.monthly_day')}
                placeholder={t('online_meetings.form.monthly_day')}
                onChange={(e) => setMonthlyDay(e.target.value)}
              />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="om-pass">{t('online_meetings.form.passcode')}</label>
              <input
                id="om-pass" className={inputCls} value={password} maxLength={10} autoComplete="off"
                placeholder={t('online_meetings.form.passcode_hint')}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="om-rec">{t('online_meetings.form.recording')}</label>
              <select
                id="om-rec" className={inputCls} value={settings.auto_recording}
                onChange={(e) => set('auto_recording', e.target.value as MeetingSettings['auto_recording'])}
              >
                <option value="none">{t('online_meetings.form.recording_none')}</option>
                <option value="cloud">{t('online_meetings.form.recording_cloud')}</option>
                <option value="local">{t('online_meetings.form.recording_local')}</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            <Toggle label={t('online_meetings.form.waiting_room')} checked={settings.waiting_room} onChange={(v) => set('waiting_room', v)} />
            <Toggle label={t('online_meetings.form.join_before_host')} checked={settings.join_before_host} onChange={(v) => set('join_before_host', v)} />
            <Toggle label={t('online_meetings.form.host_video')} checked={settings.host_video} onChange={(v) => set('host_video', v)} />
            <Toggle label={t('online_meetings.form.participant_video')} checked={settings.participant_video} onChange={(v) => set('participant_video', v)} />
            <Toggle label={t('online_meetings.form.mute_upon_entry')} checked={settings.mute_upon_entry} onChange={(v) => set('mute_upon_entry', v)} />
            <Toggle
              label={t('online_meetings.form.meeting_authentication')}
              hint={t('online_meetings.form.meeting_authentication_hint')}
              checked={settings.meeting_authentication}
              onChange={(v) => set('meeting_authentication', v)}
            />
            {editing && (
              <Toggle
                label={t('online_meetings.form.publish_recordings')}
                hint={t('online_meetings.form.publish_recordings_hint')}
                checked={publishRecordings}
                onChange={setPublishRecordings}
              />
            )}
          </div>

          <div>
            <label className={labelCls} htmlFor="om-alt">{t('online_meetings.form.alternative_hosts')}</label>
            <input
              id="om-alt" className={inputCls} value={settings.alternative_hosts || ''}
              placeholder="teacher@academy.org"
              onChange={(e) => set('alternative_hosts', e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">{t('online_meetings.form.alternative_hosts_hint')}</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit" disabled={saving}
              className="rounded-lg bg-[hsl(var(--dash-accent))] px-4 py-2 text-sm font-bold text-[hsl(var(--dash-ink))] disabled:opacity-50"
            >
              {saving ? t('online_meetings.saving') : editing ? t('online_meetings.form.save') : t('online_meetings.form.create')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
