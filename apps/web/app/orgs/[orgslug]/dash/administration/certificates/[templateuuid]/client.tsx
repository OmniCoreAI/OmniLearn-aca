'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, Eye, ImagePlus, Minus, Plus, Star, Trash2, X } from 'lucide-react'
import { AcademicPageShell, AcademicPrimaryButton } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Field, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { CertificatePreviewDialog, FitCertificate, useSamplePdf } from '@components/Dashboard/Pages/Certificates/CertificateUI'
import { Switch } from '@components/ui/switch'
import {
  CERTIFICATE_FONTS,
  CERTIFICATE_LAYOUTS,
  CERTIFICATE_VARIABLES,
  CertificateDesign,
  assetUrl as certificateAssetUrl,
} from '@components/Certificates/TemplateCertificate'
import { getCertificateTemplate, updateCertificateTemplate, uploadCertificateAsset } from '@services/administration/administration'
import { cn } from '@/lib/utils'

type PanelTab = 'design' | 'content' | 'signatures' | 'settings'
type TextKey = 'title_text' | 'subtitle_text' | 'body_text' | 'footer_text'
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5]
const switchCls = 'data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]'

function serialExample(format: string) {
  const now = new Date()
  return (format || '')
    .replace('{YYYY}', String(now.getFullYear()))
    .replace('{YY}', String(now.getFullYear()).slice(2))
    .replace('{MM}', String(now.getMonth() + 1).padStart(2, '0'))
    .replace(/\{SEQ(?::(\d))?\}/, (_m, w) => '1'.padStart(Number(w || 4), '0'))
}

function SwitchRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (_v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[hsl(var(--dash-ink))]">{label}</span>
        {hint ? <span className="block text-[11px] text-[hsl(var(--dash-muted))]">{hint}</span> : null}
      </span>
      <Switch className={switchCls} checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/** Small segmented control in the dashboard tab style. */
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (_v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className={cn(TAB_TRACK, 'flex w-full p-0.5 shadow-none')} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={tabItemClass(value === o.value, 'flex-1 justify-center px-2 py-1 text-xs')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ImageField({
  label,
  value,
  orgUuid,
  onUpload,
  onClear,
}: {
  label: string
  value?: string | null
  orgUuid?: string
  onUpload: (_f: File) => Promise<void>
  onClear: () => void
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    await onUpload(file)
    setBusy(false)
    if (input.current) input.current.value = ''
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))] p-2.5">
      <span className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
        {value && orgUuid ? <img src={certificateAssetUrl(orgUuid, value)} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
          {busy ? t('certificates.uploading', 'Uploading…') : value ? value.split('/').pop()?.replace(/^[0-9a-f-]{36}_/, '') : t('certificates.no_image', 'None')}
        </span>
      </span>
      <GhostButton type="button" onClick={() => input.current?.click()} disabled={busy}>
        {value ? t('certificates.replace', 'Replace') : t('certificates.upload', 'Upload')}
      </GhostButton>
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={String(t('administration.common.remove', 'Remove'))}
          className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

function CertificateTemplateEditor({ orgslug, templateUuid }: { orgslug: string; templateUuid: string }) {
  const { t } = useTranslation()
  const { org, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['administration', 'certificate-template', templateUuid],
    queryFn: () => getCertificateTemplate(templateUuid, access_token),
    enabled: ready,
  })
  const [saved, setSaved] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<PanelTab>('design')
  const [zoom, setZoom] = useState(1)
  const [previewing, setPreviewing] = useState(false)
  const [signerSlots, setSignerSlots] = useState(0)
  const [caret, setCaret] = useState<{ key: TextKey; start: number; end: number } | null>(null)
  const pendingCaret = useRef<{ key: TextKey; at: number } | null>(null)
  const pdf = useSamplePdf(form)

  // Seed the editable copy once the template arrives.
  if (data && !saved) {
    setSaved(data)
    setForm(data)
    setSignerSlots(Math.max(1, data.design?.signatures?.length || 0))
  }
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(saved)

  // After inserting a variable, put the cursor right after it.
  useEffect(() => {
    const pending = pendingCaret.current
    if (!pending) return
    pendingCaret.current = null
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-cert-field="${pending.key}"]`)
    el?.focus()
    el?.setSelectionRange(pending.at, pending.at)
  })

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (!form) {
    return (
      <AcademicPageShell>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="dash-shimmer h-[520px] rounded-[1.25rem]" />
          <div className="dash-shimmer h-[520px] rounded-[1.25rem]" />
        </div>
      </AcademicPageShell>
    )
  }
  const design: CertificateDesign = form.design
  const setDesign = (patch: Partial<CertificateDesign>) => setForm({ ...form, design: { ...design, ...patch } })

  const save = async () => {
    setSaving(true)
    try {
      const next = await updateCertificateTemplate(
        templateUuid,
        { name: form.name, layout: form.layout, orientation: form.orientation, status: form.status, is_default: form.is_default, serial_format: form.serial_format, design },
        access_token
      )
      setSaved(next)
      setForm(next)
      queryClient.invalidateQueries({ queryKey: ['administration', 'certificate-templates'] })
      queryClient.setQueryData(['administration', 'certificate-template', templateUuid], next)
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  const upload = async (kind: string, file: File) => {
    try {
      const res = await uploadCertificateAsset(templateUuid, kind, file, access_token)
      // Keep unsaved edits; take only the uploaded image from the server.
      const d = res.design
      if (kind === 'background') setDesign({ background_image: d.background_image })
      else if (kind === 'secondary_logo') setDesign({ secondary_logo: d.secondary_logo })
      else {
        const index = Number(kind.split('_')[1])
        const signatures = [...(design.signatures || [])]
        while (signatures.length <= index) signatures.push({ name: '', title: '', image: null })
        signatures[index] = { ...signatures[index], image: d.signatures[index]?.image }
        setDesign({ signatures })
      }
      toast.success(t('certificates.uploaded', 'Uploaded — save to keep your other changes'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const signatures = Array.from({ length: signerSlots }, (_, i) => design.signatures?.[i] || { name: '', title: '', image: null })
  const setSignature = (i: number, patch: any) => {
    const next = signatures.map((s, j) => (j === i ? { ...s, ...patch } : s))
    // Trailing empty rows are dropped so the preview only shows real signers.
    while (next.length && !next[next.length - 1].name && !next[next.length - 1].title && !next[next.length - 1].image) next.pop()
    setDesign({ signatures: next })
  }
  const removeSigner = (i: number) => {
    setDesign({ signatures: (design.signatures || []).filter((_, j) => j !== i) })
    setSignerSlots((n) => Math.max(1, n - 1))
  }

  // Variables go where the cursor was in the last text field (the body by default).
  const insertVariable = (name: string) => {
    const token = `{{${name}}}`
    const key: TextKey = caret?.key || 'body_text'
    const current = design[key] || ''
    const start = caret?.key === key ? caret.start : current.length
    const end = caret?.key === key ? caret.end : current.length
    setDesign({ [key]: current.slice(0, start) + token + current.slice(end) } as Partial<CertificateDesign>)
    const at = start + token.length
    setCaret({ key, start: at, end: at })
    pendingCaret.current = { key, at }
  }
  const trackCaret = (key: TextKey) => (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCaret({ key, start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 })
  const textProps = (key: TextKey) => ({
    'data-cert-field': key,
    value: design[key] || '',
    dir: design.direction,
    onSelect: trackCaret(key),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDesign({ [key]: e.target.value } as Partial<CertificateDesign>),
  })

  const COLORS: [keyof CertificateDesign, string][] = [
    ['primary_color', t('certificates.primary', 'Primary')],
    ['accent_color', t('certificates.accent', 'Accent')],
    ['text_color', t('certificates.text', 'Text')],
    ['background_color', t('certificates.background', 'Background')],
  ]
  const TABS: { key: PanelTab; label: string }[] = [
    { key: 'design', label: t('certificates.tab_design', 'Design') },
    { key: 'content', label: t('certificates.tab_content', 'Content') },
    { key: 'signatures', label: t('certificates.signatures', 'Signatures') },
    { key: 'settings', label: t('certificates.tab_settings', 'Settings') },
  ]
  const zoomIndex = ZOOMS.indexOf(zoom)

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.certificates', 'Certificates'), href: '/dash/administration/certificates' }, { label: saved?.name || form.name }]}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{form.name || t('certificates.untitled', 'Untitled')}</h1>
            <StatusPill status={form.status} />
            {form.is_default ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {t('certificates.default_badge', 'Default')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[hsl(var(--dash-muted))]">{t('certificates.editor_desc', 'Changes show in the preview right away. Save to apply them to certificates.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? <span className="me-1 text-xs font-medium text-amber-700">{t('administration.common.unsaved', 'You have unsaved changes')}</span> : null}
          <GhostButton onClick={() => setPreviewing(true)}>
            <Eye className="h-3.5 w-3.5" /> {t('certificates.preview', 'Preview')}
          </GhostButton>
          <GhostButton onClick={pdf.download} disabled={pdf.busy}>
            <Download className="h-3.5 w-3.5" /> {pdf.busy ? '…' : t('certificates.sample_pdf', 'Sample PDF')}
          </GhostButton>
          {dirty ? (
            <GhostButton onClick={() => setForm(saved)} disabled={saving}>
              {t('administration.common.discard', 'Discard')}
            </GhostButton>
          ) : null}
          <AcademicPrimaryButton onClick={save} disabled={saving || !dirty} className="disabled:opacity-50">
            {saving ? t('academic.saving', 'Saving…') : t('academic.save', 'Save')}
          </AcademicPrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Canvas */}
        <div className="dash-card overflow-hidden rounded-[1.25rem] xl:sticky xl:top-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--dash-border))] px-4 py-2.5">
            <div className="w-56">
              <Segmented
                value={form.orientation}
                onChange={(v) => setForm({ ...form, orientation: v })}
                options={[
                  { value: 'landscape', label: t('certificates.landscape', 'Landscape') },
                  { value: 'portrait', label: t('certificates.portrait', 'Portrait') },
                ]}
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-[hsl(var(--dash-muted))]">
              <button
                type="button"
                aria-label={String(t('certificates.zoom_out', 'Zoom out'))}
                disabled={zoomIndex <= 0}
                onClick={() => setZoom(ZOOMS[zoomIndex - 1])}
                className="rounded-full p-1.5 hover:bg-[hsl(var(--dash-canvas))] disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setZoom(1)} className="min-w-[52px] rounded-full px-2 py-1 font-medium tabular-nums hover:bg-[hsl(var(--dash-canvas))]">
                {zoom === 1 ? t('certificates.fit', 'Fit') : `${Math.round(zoom * 100)}%`}
              </button>
              <button
                type="button"
                aria-label={String(t('certificates.zoom_in', 'Zoom in'))}
                disabled={zoomIndex >= ZOOMS.length - 1}
                onClick={() => setZoom(ZOOMS[zoomIndex + 1])}
                className="rounded-full p-1.5 hover:bg-[hsl(var(--dash-canvas))] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div
            className={cn('overflow-auto bg-[hsl(var(--dash-canvas))] p-5 sm:p-8', zoom > 1 && 'max-h-[calc(100vh-200px)]')}
            style={{ backgroundImage: 'radial-gradient(hsl(var(--dash-border)) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          >
            <FitCertificate template={form} zoom={zoom} className={form.orientation === 'portrait' ? 'mx-auto max-w-[560px]' : undefined} />
          </div>
          <div className="border-t border-[hsl(var(--dash-border))] px-4 py-2 text-[11px] text-[hsl(var(--dash-muted))]">
            {t('certificates.preview_hint', 'Shown with sample data. Real certificates use the learner, course and issue date.')}
          </div>
        </div>

        {/* Settings panel */}
        <div className="dash-card rounded-[1.25rem]">
          <div className="border-b border-[hsl(var(--dash-border))] p-3">
            <div className={cn(TAB_TRACK, 'flex w-full p-0.5 shadow-none')} role="tablist">
              {TABS.map((item) => (
                <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={tabItemClass(tab === item.key, 'flex-1 justify-center px-2 py-1.5 text-xs')}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 p-5">
            {tab === 'design' && (
              <>
                <FormSection title={t('certificates.layout', 'Layout')} columns={1}>
                  <div className="grid grid-cols-2 gap-2">
                    {CERTIFICATE_LAYOUTS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setForm({ ...form, layout: l })}
                        aria-pressed={form.layout === l}
                        className={cn(
                          'rounded-2xl border p-2 text-start transition-colors',
                          form.layout === l
                            ? 'border-[hsl(var(--dash-ink))] ring-1 ring-[hsl(var(--dash-ink))]'
                            : 'border-[hsl(var(--dash-border))] hover:border-[hsl(var(--dash-muted))]'
                        )}
                      >
                        <div className="pointer-events-none overflow-hidden rounded-lg bg-[hsl(var(--dash-canvas))] p-2">
                          <FitCertificate template={{ ...form, layout: l, orientation: 'landscape' }} />
                        </div>
                        <div className="mt-1.5 px-0.5 text-xs font-medium">{String(t(`certificates.layout_${l}`, l))}</div>
                      </button>
                    ))}
                  </div>
                </FormSection>

                <FormSection title={t('certificates.colors', 'Colours')} columns={2}>
                  {COLORS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 rounded-2xl border border-[hsl(var(--dash-border))] p-2">
                      <input
                        type="color"
                        className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                        value={design[key] as string}
                        onChange={(e) => setDesign({ [key]: e.target.value } as Partial<CertificateDesign>)}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">{label}</span>
                        <span className="block font-mono text-[11px] uppercase text-[hsl(var(--dash-muted))]">{design[key] as string}</span>
                      </span>
                    </label>
                  ))}
                </FormSection>

                <FormSection title={t('certificates.typography', 'Typography & frame')} columns={1}>
                  <Field label={t('certificates.font', 'Font')}>
                    <select className={inputCls} value={design.font_family} onChange={(e) => setDesign({ font_family: e.target.value })} style={{ fontFamily: design.font_family }}>
                      {CERTIFICATE_FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('certificates.border', 'Border')}>
                    <Segmented
                      value={design.border_style}
                      onChange={(v) => setDesign({ border_style: v })}
                      options={(['none', 'single', 'double', 'ornate'] as const).map((b) => ({ value: b, label: String(t(`certificates.border_${b}`, b)) }))}
                    />
                  </Field>
                  <Field label={t('certificates.direction', 'Direction')}>
                    <Segmented
                      value={design.direction}
                      onChange={(v) => setDesign({ direction: v })}
                      options={[
                        { value: 'rtl', label: t('certificates.rtl', 'Right to left') },
                        { value: 'ltr', label: t('certificates.ltr', 'Left to right') },
                      ]}
                    />
                  </Field>
                </FormSection>

                <FormSection title={t('certificates.images', 'Logos & background')} columns={1}>
                  <SwitchRow checked={design.show_org_logo} onChange={(v) => setDesign({ show_org_logo: v })} label={t('certificates.org_logo', 'Show the academy logo')} />
                  <ImageField
                    label={t('certificates.secondary_logo', 'Second logo (partner / entity)')}
                    value={design.secondary_logo}
                    orgUuid={org?.org_uuid}
                    onUpload={(f) => upload('secondary_logo', f)}
                    onClear={() => setDesign({ secondary_logo: null })}
                  />
                  <ImageField
                    label={t('certificates.background_image', 'Background image')}
                    value={design.background_image}
                    orgUuid={org?.org_uuid}
                    onUpload={(f) => upload('background', f)}
                    onClear={() => setDesign({ background_image: null })}
                  />
                </FormSection>
              </>
            )}

            {tab === 'content' && (
              <>
                <FormSection title={t('certificates.texts', 'Texts')} description={t('certificates.texts_desc', 'The learner’s name sits between the two middle lines.')} columns={1}>
                  <Field label={t('certificates.title', 'Title')}>
                    <input className={inputCls} {...textProps('title_text')} />
                  </Field>
                  <Field label={t('certificates.subtitle_label', 'Line above the name')}>
                    <input className={inputCls} {...textProps('subtitle_text')} />
                  </Field>
                  <Field label={t('certificates.body', 'Line below the name')}>
                    <textarea className={inputCls} rows={3} {...textProps('body_text')} />
                  </Field>
                  <Field label={t('certificates.footer', 'Footer note')}>
                    <input className={inputCls} {...textProps('footer_text')} />
                  </Field>
                </FormSection>
                <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 p-3">
                  <div className="mb-2 text-xs font-medium text-[hsl(var(--dash-muted))]">{t('certificates.variables_insert', 'Variables — click to insert where your cursor is')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CERTIFICATE_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVariable(v)}
                        className="rounded-md border border-[hsl(var(--dash-accent))]/30 bg-[hsl(var(--dash-accent-soft))] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[hsl(var(--dash-accent))] transition-colors hover:border-[hsl(var(--dash-accent))] hover:bg-white"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'signatures' && (
              <FormSection title={t('certificates.signatures', 'Signatures')} description={t('certificates.signatures_desc', 'Up to three signers, shown along the bottom.')} columns={1}>
                {signatures.map((s, i) => (
                  <div key={i} className="space-y-2 rounded-2xl border border-[hsl(var(--dash-border))] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[hsl(var(--dash-muted))]">
                        {t('certificates.signer_n', 'Signer {{n}}', { n: i + 1 })}
                      </span>
                      {signatures.length > 1 || s.name || s.title || s.image ? (
                        <button
                          type="button"
                          onClick={() => removeSigner(i)}
                          aria-label={String(t('administration.common.remove', 'Remove'))}
                          className="rounded-full p-1 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-warn))]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder={String(t('certificates.signer_name', 'Name'))} value={s.name} onChange={(e) => setSignature(i, { name: e.target.value })} />
                      <input className={inputCls} placeholder={String(t('certificates.signer_title', 'Title'))} value={s.title} onChange={(e) => setSignature(i, { title: e.target.value })} />
                    </div>
                    <ImageField
                      label={t('certificates.signature_image', 'Signature image')}
                      value={s.image}
                      orgUuid={org?.org_uuid}
                      onUpload={(f) => upload(`signature_${i}`, f)}
                      onClear={() => setSignature(i, { image: null })}
                    />
                  </div>
                ))}
                {signerSlots < 3 ? (
                  <button
                    type="button"
                    onClick={() => setSignerSlots((n) => Math.min(3, n + 1))}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[hsl(var(--dash-border))] py-2.5 text-sm font-medium text-[hsl(var(--dash-muted))] hover:border-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]"
                  >
                    <Plus className="h-4 w-4" /> {t('certificates.add_signer', 'Add signer')}
                  </button>
                ) : null}
              </FormSection>
            )}

            {tab === 'settings' && (
              <>
                <FormSection title={t('certificates.basics', 'Basics')} columns={1}>
                  <Field label={t('administration.common.name', 'Name')} required hint={t('certificates.name_hint', 'Only staff see this name.')}>
                    <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label={t('certificates.serial_format', 'Certificate number format')} hint={`{YYYY} {YY} {MM} {SEQ:5} → ${serialExample(form.serial_format)}`}>
                    <input className={`${inputCls} font-mono`} value={form.serial_format} onChange={(e) => setForm({ ...form, serial_format: e.target.value })} />
                  </Field>
                </FormSection>
                <FormSection title={t('certificates.availability', 'Availability')} columns={1}>
                  <SwitchRow
                    checked={form.status === 'active'}
                    onChange={(v) => setForm({ ...form, status: v ? 'active' : 'inactive' })}
                    label={t('communication.active', 'Active')}
                    hint={t('certificates.active_hint', 'Inactive designs can’t be picked for new courses.')}
                  />
                  <SwitchRow
                    checked={form.is_default}
                    onChange={(v) => setForm({ ...form, is_default: v, status: v ? 'active' : form.status })}
                    label={t('certificates.default', 'Default for the academy')}
                    hint={t('certificates.default_hint', 'Used by courses that don’t choose a design.')}
                  />
                </FormSection>
                <FormSection title={t('certificates.verification', 'Verification')} columns={1}>
                  <SwitchRow checked={design.show_qr} onChange={(v) => setDesign({ show_qr: v })} label={t('certificates.show_qr', 'QR code to the verification page')} />
                  <SwitchRow checked={design.show_certificate_id} onChange={(v) => setDesign({ show_certificate_id: v })} label={t('certificates.show_id', 'Certificate number and date')} />
                </FormSection>
              </>
            )}
          </div>
        </div>
      </div>

      <CertificatePreviewDialog template={previewing ? form : null} onClose={() => setPreviewing(false)} />
      {pdf.capture}
    </AcademicPageShell>
  )
}

export default CertificateTemplateEditor
