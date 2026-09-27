'use client'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { DataTable, GhostButton, Section, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CommunicationTabs, useEventLabel, useNotificationCatalog } from '@components/Dashboard/Pages/Communication/CommunicationTabs'
import { NotificationSettings, getAdminSetting, putAdminSetting } from '@services/administration/administration'

const hoursToText = (hours: number[]) => (hours || []).join(', ')
const textToHours = (text: string) =>
  text
    .split(/[,\s]+/)
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isFinite(v) && v > 0)

function NotificationSettingsPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const { data } = useQuery({
    queryKey: ['communication', 'settings', orgId],
    queryFn: () => getAdminSetting(orgId, 'notifications', access_token),
    enabled: ready,
  })
  const [form, setForm] = useState<NotificationSettings | null>(null)
  const [sessionHours, setSessionHours] = useState('')
  const [examHours, setExamHours] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (data && !form) {
      setForm(data)
      setSessionHours(hoursToText(data.session_reminder_hours))
      setExamHours(hoursToText(data.exam_reminder_hours))
    }
  }, [data, form])

  if (!form) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />
      </AcademicPageShell>
    )
  }
  const channelOn = (event: any, channel: 'email' | 'sms') => {
    if (event.required && channel === 'email') return true
    const configured = form.events?.[event.key]
    return configured ? configured[channel] : !!event.default_channels?.[channel]
  }
  const toggle = (event: any, channel: 'email' | 'sms', value: boolean) => {
    const current = { email: channelOn(event, 'email'), sms: channelOn(event, 'sms') }
    setForm({ ...form, events: { ...form.events, [event.key]: { ...current, [channel]: value } } })
  }
  const save = async () => {
    setSaving(true)
    try {
      await putAdminSetting(
        orgId,
        'notifications',
        { ...form, session_reminder_hours: textToHours(sessionHours), exam_reminder_hours: textToHours(examHours) },
        access_token
      )
      toast.success(t('administration.common.updated', 'Saved'))
      queryClient.invalidateQueries({ queryKey: ['communication'] })
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.communication', 'Communication'), href: '/dash/administration/communication' }, { label: t('communication.tab_settings', 'Notification settings') }]}
      />
      <AcademicHeader
        title={t('communication.tab_settings', 'Notification settings')}
        subtitle={t('communication.settings_desc', 'Choose which events send email or SMS, reminder timing and the sender name.')}
        action={
          <GhostButton onClick={save} disabled={saving}>
            {saving ? '…' : t('academic.save', 'Save')}
          </GhostButton>
        }
      />
      <CommunicationTabs orgslug={orgslug} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title={t('communication.events', 'Events')} className="lg:col-span-2">
          <DataTable headers={[t('communication.event', 'Event'), t('communication.email', 'Email'), 'SMS']}>
            {catalog.map((event) => (
              <tr key={event.key}>
                <td className={tdCls}>
                  <div className="font-medium">{eventLabel(event)}</div>
                  <div className="text-xs text-[hsl(var(--dash-muted))]">{event.description}</div>
                </td>
                <td className={tdCls}>
                  <input
                    type="checkbox"
                    checked={channelOn(event, 'email')}
                    disabled={event.required}
                    title={event.required ? String(t('communication.always_sent', 'Always sent')) : undefined}
                    onChange={(e) => toggle(event, 'email', e.target.checked)}
                  />
                </td>
                <td className={tdCls}>
                  <input type="checkbox" checked={channelOn(event, 'sms')} onChange={(e) => toggle(event, 'sms', e.target.checked)} />
                </td>
              </tr>
            ))}
          </DataTable>
          <p className="mt-2 text-xs text-[hsl(var(--dash-muted))]">
            {t('communication.sms_hint', 'SMS uses the phone number on the member’s profile and the SMS provider configured on the server.')}
          </p>
        </Section>
        <div className="space-y-6">
          <Section title={t('communication.reminders', 'Reminders')}>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.reminders_enabled} onChange={(e) => setForm({ ...form, reminders_enabled: e.target.checked })} />
              {t('communication.reminders_enabled', 'Send reminders')}
            </label>
            <div className="space-y-3">
              <Field label={t('communication.session_hours', 'Session reminders (hours before)')}>
                <input className={inputCls} value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} placeholder="24, 2" />
              </Field>
              <Field label={t('communication.exam_hours', 'Assignment / exam reminders (hours before)')}>
                <input className={inputCls} value={examHours} onChange={(e) => setExamHours(e.target.value)} placeholder="48" />
              </Field>
            </div>
          </Section>
          <Section title={t('communication.sending', 'Sending')}>
            <div className="space-y-3">
              <Field label={t('communication.sender_name', 'Sender name')}>
                <input className={inputCls} value={form.sender_name || ''} onChange={(e) => setForm({ ...form, sender_name: e.target.value || null })} placeholder="OmniLearn" />
              </Field>
              <Field label={t('communication.language', 'Language')}>
                <select
                  className={inputCls}
                  value={form.default_language || ''}
                  onChange={(e) => setForm({ ...form, default_language: (e.target.value || null) as NotificationSettings['default_language'] })}
                >
                  <option value="">{t('communication.org_language', 'Academy default language')}</option>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </Field>
            </div>
          </Section>
        </div>
      </div>
    </AcademicPageShell>
  )
}

export default NotificationSettingsPage
