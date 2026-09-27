'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { AlertTriangle, Send } from 'lucide-react'
import HtmlRichTextEditor from '@components/Dashboard/CMS/HtmlRichTextEditor'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  NotificationChannel,
  createNotificationTemplate,
  previewNotification,
  testNotificationTemplate,
  updateNotificationTemplate,
} from '@services/administration/administration'
import { useEventLabel, useNotificationCatalog } from './CommunicationTabs'

const token = (name: string) => `{{${name}}}`

export function TemplateEditor({
  channel,
  template,
  eventKey,
  onDone,
}: {
  channel: NotificationChannel
  template: any
  eventKey?: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const [form, setForm] = useState({
    event_key: template?.event_key || eventKey || 'course_assigned',
    name: template?.name || '',
    language: template?.language || 'ar',
    subject: template?.subject || '',
    body: template?.body || '',
    is_default_for_event: template?.is_default_for_event ?? true,
    status: template?.status || 'active',
  })
  const [preview, setPreview] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('')
  const smsRef = useRef<HTMLTextAreaElement>(null)
  const event = catalog.find((e) => e.key === form.event_key)

  // Live preview with the event's sample data (debounced).
  useEffect(() => {
    if (!orgId || !access_token) return
    const handle = setTimeout(() => {
      previewNotification(
        orgId,
        { channel, event_key: form.event_key, subject: form.subject, body: form.body, language: form.language },
        access_token
      )
        .then(setPreview)
        .catch(() => setPreview(null))
    }, 400)
    return () => clearTimeout(handle)
  }, [orgId, access_token, channel, form.event_key, form.subject, form.body, form.language])

  const insertVariable = async (name: string) => {
    if (channel === 'sms') {
      const el = smsRef.current
      const start = el?.selectionStart ?? form.body.length
      const end = el?.selectionEnd ?? form.body.length
      setForm({ ...form, body: form.body.slice(0, start) + token(name) + form.body.slice(end) })
      return
    }
    try {
      await navigator.clipboard.writeText(token(name))
      toast.success(t('communication.copied', 'Copied — paste it where you want it'))
    } catch {
      setForm({ ...form, body: `${form.body}<p>${token(name)}</p>` })
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, channel, subject: channel === 'email' ? form.subject : undefined }
      if (template) await updateNotificationTemplate(template.template_uuid, payload, access_token)
      else await createNotificationTemplate(orgId, payload, access_token)
      toast.success(template ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!template) return
    try {
      const log = await testNotificationTemplate(template.template_uuid, testTo, access_token)
      if (log.status === 'sent') toast.success(`${t('communication.test_sent', 'Test sent to')} ${log.recipient}`)
      else toast.error(log.error || String(t('communication.test_failed', 'The test could not be sent')))
    } catch (err: any) {
      toast.error(err?.message || t('communication.test_failed', 'The test could not be sent'))
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('communication.event', 'Event')}>
            <select className={inputCls} value={form.event_key} disabled={!!template} onChange={(e) => setForm({ ...form, event_key: e.target.value })}>
              {catalog.map((ev) => (
                <option key={ev.key} value={ev.key}>
                  {eventLabel(ev)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('communication.language', 'Language')}>
            <select className={inputCls} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
        <Field label={t('administration.common.name', 'Name')}>
          <input className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        {event?.description && <p className="-mt-2 text-xs text-[hsl(var(--dash-muted))]">{event.description}</p>}
        {channel === 'email' && (
          <Field label={t('communication.subject', 'Subject')}>
            <input
              className={inputCls}
              required
              dir={form.language === 'ar' ? 'rtl' : 'ltr'}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>
        )}
        <Field label={t('communication.message', 'Message')}>
          {channel === 'email' ? (
            <div dir={form.language === 'ar' ? 'rtl' : 'ltr'}>
              <HtmlRichTextEditor value={form.body} onChange={(html) => setForm((f) => ({ ...f, body: html }))} />
            </div>
          ) : (
            <textarea
              ref={smsRef}
              className={inputCls}
              rows={5}
              required
              dir={form.language === 'ar' ? 'rtl' : 'ltr'}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          )}
        </Field>
        <div>
          <div className="mb-1 text-xs font-semibold text-[hsl(var(--dash-muted))]">
            {channel === 'sms'
              ? t('communication.variables_sms', 'Variables — click to insert')
              : t('communication.variables_email', 'Variables — click to copy, then paste into the message or subject')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(event?.variables || []).map((v: any) => (
              <button
                key={v.name}
                type="button"
                title={v.description}
                onClick={() => insertVariable(v.name)}
                className="rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-2 py-0.5 font-mono text-[11px] hover:border-[hsl(var(--dash-accent))]"
              >
                {token(v.name)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default_for_event} onChange={(e) => setForm({ ...form, is_default_for_event: e.target.checked })} />
            {t('communication.use_as_default', 'Use for this event (replaces the built-in message)')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.status === 'active'} onChange={(e) => setForm({ ...form, status: e.target.checked ? 'active' : 'inactive' })} />
            {t('communication.active', 'Active')}
          </label>
        </div>
        {template && (
          <div className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder={String(channel === 'sms' ? t('communication.test_phone', 'Phone (defaults to yours)') : t('communication.test_email', 'Email (defaults to yours)'))}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <GhostButton type="button" onClick={sendTest}>
              <Send className="h-3.5 w-3.5" /> {t('communication.send_test', 'Send test')}
            </GhostButton>
          </div>
        )}
        <SubmitRow saving={saving} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
          {t('communication.preview', 'Preview with sample data')}
        </div>
        {preview?.unknown_variables?.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--dash-tile-amber))] px-3 py-2 text-xs text-[hsl(var(--dash-tile-amber-fg))]">
            <AlertTriangle className="h-4 w-4" />
            {t('communication.unknown_variables', 'Unknown variables (they will be empty):')} {preview.unknown_variables.join(', ')}
          </div>
        )}
        {channel === 'email' ? (
          <>
            <div className="rounded-lg bg-[hsl(var(--dash-canvas))] px-3 py-2 text-sm">
              <span className="text-[hsl(var(--dash-muted))]">{t('communication.subject', 'Subject')}: </span>
              <span className="font-medium">{preview?.subject || '—'}</span>
            </div>
            <iframe
              title="preview"
              sandbox=""
              className="h-[520px] w-full rounded-xl border border-[hsl(var(--dash-border))] bg-white"
              srcDoc={preview?.html || ''}
            />
          </>
        ) : (
          <div className="rounded-2xl bg-[hsl(var(--dash-canvas))] p-4">
            <div dir={form.language === 'ar' ? 'rtl' : 'ltr'} className="max-w-xs whitespace-pre-wrap rounded-2xl bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm shadow-sm">
              {preview?.text || '—'}
            </div>
            <div className="mt-2 text-xs text-[hsl(var(--dash-muted))]">
              {(preview?.text || '').length} {t('communication.characters', 'characters')} · {preview?.sms_segments ?? 0} {t('communication.segments', 'SMS part(s)')}
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
