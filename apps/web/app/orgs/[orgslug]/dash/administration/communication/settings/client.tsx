'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CommunicationTabs, useEventLabel, useNotificationCatalog } from '@components/Dashboard/Pages/Communication/CommunicationTabs'
import { Switch } from '@components/ui/switch'
import { NotificationSettings, getAdminSetting, putAdminSetting } from '@services/administration/administration'

const hoursToText = (hours: number[]) => (hours || []).join(', ')
const textToHours = (text: string) =>
  text
    .split(/[,\s]+/)
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isFinite(v) && v > 0)

const switchCls = 'data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]'

type Draft = { form: NotificationSettings; sessionHours: string; examHours: string }
const toDraft = (data: NotificationSettings): Draft => ({
  form: data,
  sessionHours: hoursToText(data.session_reminder_hours),
  examHours: hoursToText(data.exam_reminder_hours),
})

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
  const [saved, setSaved] = useState<Draft | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  // Seed the editable draft once the saved settings arrive.
  if (data && !saved) {
    setSaved(toDraft(data))
    setDraft(toDraft(data))
  }

  const header = (
    <>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.communication', 'Communication'), href: '/dash/administration/communication' }, { label: t('communication.tab_settings', 'Notification settings') }]}
      />
      <AcademicHeader
        title={t('communication.tab_settings', 'Notification settings')}
        subtitle={t('communication.settings_desc', 'Choose which events send email or SMS, reminder timing and the sender name.')}
        action={
          draft ? (
            <AcademicPrimaryButton onClick={() => save()} disabled={saving || JSON.stringify(draft) === JSON.stringify(saved)} className="disabled:opacity-50">
              {saving ? t('academic.saving', 'Saving…') : t('academic.save', 'Save')}
            </AcademicPrimaryButton>
          ) : null
        }
      />
      <CommunicationTabs orgslug={orgslug} />
    </>
  )

  if (!draft) {
    return (
      <AcademicPageShell>
        {header}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="dash-shimmer h-96 rounded-[var(--dash-radius)] lg:col-span-2" />
          <div className="dash-shimmer h-64 rounded-[var(--dash-radius)]" />
        </div>
      </AcademicPageShell>
    )
  }

  const { form } = draft
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const setForm = (next: NotificationSettings) => setDraft({ ...draft, form: next })
  const channelOn = (event: any, channel: 'email' | 'sms') => {
    if (event.required && channel === 'email') return true
    const configured = form.events?.[event.key]
    return configured ? configured[channel] : !!event.default_channels?.[channel]
  }
  const toggle = (event: any, channel: 'email' | 'sms', value: boolean) => {
    const current = { email: channelOn(event, 'email'), sms: channelOn(event, 'sms') }
    setForm({ ...form, events: { ...form.events, [event.key]: { ...current, [channel]: value } } })
  }
  const emailOn = catalog.filter((e) => channelOn(e, 'email')).length
  const smsOn = catalog.filter((e) => channelOn(e, 'sms')).length

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const payload = { ...draft.form, session_reminder_hours: textToHours(draft.sessionHours), exam_reminder_hours: textToHours(draft.examHours) }
      await putAdminSetting(orgId, 'notifications', payload, access_token)
      const next = toDraft(payload)
      setSaved(next)
      setDraft(next)
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
      {header}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section
          title={t('communication.events', 'Events')}
          description={t('communication.events_summary', '{{email}} send email · {{sms}} send SMS', { email: emailOn, sms: smsOn })}
          className="dash-card lg:col-span-2"
        >
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/60 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--dash-muted))]">
                  <th className="px-4 py-2.5 text-start sm:ps-5">{t('communication.event', 'Event')}</th>
                  <th className="w-24 px-3 py-2.5 text-center">{t('communication.email', 'Email')}</th>
                  <th className="w-24 px-3 py-2.5 text-center sm:pe-5">SMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--dash-border))]">
                {catalog.map((event) => (
                  <tr key={event.key} className="transition-colors hover:bg-[hsl(var(--dash-canvas))]/50">
                    <td className="px-4 py-3 sm:ps-5">
                      <div className="font-medium text-[hsl(var(--dash-ink))]">{eventLabel(event)}</div>
                      <div className="text-xs text-[hsl(var(--dash-muted))]">{event.description}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {event.required ? (
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-[hsl(var(--dash-muted))]"
                          title={String(t('communication.required_hint', 'Security emails are always sent.'))}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {t('communication.always_sent', 'Always sent')}
                        </span>
                      ) : (
                        <Switch
                          className={switchCls}
                          checked={channelOn(event, 'email')}
                          onCheckedChange={(v) => toggle(event, 'email', v)}
                          aria-label={`${eventLabel(event)} — ${t('communication.email', 'Email')}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 text-center sm:pe-5">
                      <Switch className={switchCls} checked={channelOn(event, 'sms')} onCheckedChange={(v) => toggle(event, 'sms', v)} aria-label={`${eventLabel(event)} — SMS`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[hsl(var(--dash-muted))]">
            {t('communication.sms_hint', 'SMS uses the phone number on the member’s profile and the SMS provider configured on the server.')}
          </p>
        </Section>

        <div className="space-y-6">
          <Section title={t('communication.reminders', 'Reminders')} description={t('communication.reminders_desc', 'Sent automatically before sessions and due dates.')} className="dash-card">
            <label className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5 text-sm font-medium">
              {t('communication.reminders_enabled', 'Send reminders')}
              <Switch className={switchCls} checked={form.reminders_enabled} onCheckedChange={(v) => setForm({ ...form, reminders_enabled: v })} />
            </label>
            <div className={`space-y-3 ${form.reminders_enabled ? '' : 'pointer-events-none opacity-50'}`}>
              <Field label={t('communication.session_hours', 'Session reminders (hours before)')} hint={t('communication.hours_hint', 'Separate several with commas, e.g. 24, 2')}>
                <input className={inputCls} value={draft.sessionHours} onChange={(e) => setDraft({ ...draft, sessionHours: e.target.value })} placeholder="24, 2" inputMode="numeric" />
              </Field>
              <Field label={t('communication.exam_hours', 'Assignment / exam reminders (hours before)')}>
                <input className={inputCls} value={draft.examHours} onChange={(e) => setDraft({ ...draft, examHours: e.target.value })} placeholder="48" inputMode="numeric" />
              </Field>
            </div>
          </Section>
          <Section title={t('communication.sending', 'Sending')} description={t('communication.sending_desc', 'How messages appear in the recipient’s inbox.')} className="dash-card">
            <div className="space-y-3">
              <Field label={t('communication.sender_name', 'Sender name')}>
                <input className={inputCls} value={form.sender_name || ''} onChange={(e) => setForm({ ...form, sender_name: e.target.value || null })} placeholder="OmniLearn" />
              </Field>
              <Field label={t('communication.language', 'Language')} hint={t('communication.language_hint', 'Used when a member has no preferred language.')}>
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

      {dirty ? (
        <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-3 rounded-full bg-[hsl(var(--dash-ink))] py-2 pe-2 ps-5 text-sm text-white shadow-lg">
          <span>{t('administration.common.unsaved', 'You have unsaved changes')}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDraft(saved)} className="rounded-full px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white">
              {t('administration.common.discard', 'Discard')}
            </button>
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-4 py-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))] hover:brightness-110 disabled:opacity-60"
            >
              {saving ? t('academic.saving', 'Saving…') : t('academic.save', 'Save')}
            </button>
          </div>
        </div>
      ) : null}
    </AcademicPageShell>
  )
}

export default NotificationSettingsPage
