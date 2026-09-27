'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, ImagePlus, Save, X } from 'lucide-react'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton, Section } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  CERTIFICATE_FONTS,
  CERTIFICATE_LAYOUTS,
  CERTIFICATE_VARIABLES,
  CertificateDesign,
  SAMPLE_CERTIFICATE_VARIABLES,
  TemplateCertificate,
  downloadCertificatePdf,
} from '@components/Certificates/TemplateCertificate'
import { getCertificateTemplate, updateCertificateTemplate, uploadCertificateAsset } from '@services/administration/administration'

function serialExample(format: string) {
  const now = new Date()
  return (format || '')
    .replace('{YYYY}', String(now.getFullYear()))
    .replace('{YY}', String(now.getFullYear()).slice(2))
    .replace('{MM}', String(now.getMonth() + 1).padStart(2, '0'))
    .replace(/\{SEQ(?::(\d))?\}/, (_m, w) => '1'.padStart(Number(w || 4), '0'))
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (_v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function ImageField({
  label,
  value,
  onUpload,
  onClear,
}: {
  label: string
  value?: string | null
  onUpload: (_f: File) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--dash-border))] px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {value && <span className="max-w-[140px] truncate text-xs text-[hsl(var(--dash-muted))]">{value.split('/').pop()}</span>}
        <GhostButton type="button" onClick={() => input.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" /> {value ? t('certificates.replace', 'Replace') : t('certificates.upload', 'Upload')}
        </GhostButton>
        {value && (
          <GhostButton type="button" onClick={onClear} aria-label="remove">
            <X className="h-3.5 w-3.5" />
          </GhostButton>
        )}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </span>
    </div>
  )
}

function CertificateTemplateEditor({ orgslug, templateUuid }: { orgslug: string; templateUuid: string }) {
  const { t } = useTranslation()
  const { org, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const captureRef = useRef<HTMLDivElement>(null)
  const { data } = useQuery({
    queryKey: ['administration', 'certificate-template', templateUuid],
    queryFn: () => getCertificateTemplate(templateUuid, access_token),
    enabled: ready,
  })
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (data && !form) setForm(data)
  }, [data, form])

  if (!form) {
    return (
      <AcademicPageShell>
        <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />
      </AcademicPageShell>
    )
  }
  const design: CertificateDesign = form.design
  const setDesign = (patch: Partial<CertificateDesign>) => setForm({ ...form, design: { ...design, ...patch } })
  const variables = { ...SAMPLE_CERTIFICATE_VARIABLES, org_name: org?.name || SAMPLE_CERTIFICATE_VARIABLES.org_name }

  const save = async () => {
    setSaving(true)
    try {
      const saved = await updateCertificateTemplate(
        templateUuid,
        {
          name: form.name,
          layout: form.layout,
          orientation: form.orientation,
          status: form.status,
          is_default: form.is_default,
          serial_format: form.serial_format,
          design,
        },
        access_token
      )
      setForm(saved)
      queryClient.invalidateQueries({ queryKey: ['administration', 'certificate-templates'] })
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  const upload = async (kind: string, file: File) => {
    try {
      const saved = await uploadCertificateAsset(templateUuid, kind, file, access_token)
      // Keep unsaved edits; take only the uploaded image from the server.
      const d = saved.design
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
  const signatures = [0, 1, 2].map((i) => design.signatures?.[i] || { name: '', title: '', image: null })
  const setSignature = (i: number, patch: any) => {
    const next = signatures.map((s, j) => (j === i ? { ...s, ...patch } : s))
    // Trailing empty rows are dropped so the preview only shows real signers.
    while (next.length && !next[next.length - 1].name && !next[next.length - 1].title && !next[next.length - 1].image) next.pop()
    setDesign({ signatures: next })
  }
  const copyVariable = async (name: string) => {
    try {
      await navigator.clipboard.writeText(`{{${name}}}`)
      toast.success(t('communication.copied', 'Copied — paste it where you want it'))
    } catch {
      /* ignore */
    }
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.certificates', 'Certificates'), href: '/dash/administration/certificates' }, { label: form.name }]}
      />
      <AcademicHeader
        title={form.name}
        subtitle={t('certificates.editor_desc', 'Changes show in the preview right away. Save to apply them to certificates.')}
        action={
          <div className="flex gap-2">
            <GhostButton
              onClick={() =>
                captureRef.current &&
                downloadCertificatePdf(captureRef.current, form.orientation, 'certificate-sample.pdf').catch(() => toast.error('PDF failed'))
              }
            >
              <Download className="h-3.5 w-3.5" /> {t('certificates.sample_pdf', 'Sample PDF')}
            </GhostButton>
            <GhostButton onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? '…' : t('academic.save', 'Save')}
            </GhostButton>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Section title={t('certificates.basics', 'Basics')}>
            <div className="space-y-3">
              <Field label={t('administration.common.name', 'Name')}>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('certificates.layout', 'Layout')}>
                  <select className={inputCls} value={form.layout} onChange={(e) => setForm({ ...form, layout: e.target.value })}>
                    {CERTIFICATE_LAYOUTS.map((l) => (
                      <option key={l} value={l}>{String(t(`certificates.layout_${l}`, l))}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('certificates.orientation', 'Orientation')}>
                  <select className={inputCls} value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value })}>
                    <option value="landscape">{t('certificates.landscape', 'Landscape')}</option>
                    <option value="portrait">{t('certificates.portrait', 'Portrait')}</option>
                  </select>
                </Field>
              </div>
              <Field label={t('certificates.serial_format', 'Certificate number format')}>
                <input className={`${inputCls} font-mono`} value={form.serial_format} onChange={(e) => setForm({ ...form, serial_format: e.target.value })} />
                <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">
                  {'{YYYY} {YY} {MM} {SEQ:5}'} → <span className="font-mono">{serialExample(form.serial_format)}</span>
                </p>
              </Field>
              <div className="flex flex-wrap gap-4">
                <Toggle checked={form.is_default} onChange={(v) => setForm({ ...form, is_default: v })} label={t('certificates.default', 'Default for the academy')} />
                <Toggle checked={form.status === 'active'} onChange={(v) => setForm({ ...form, status: v ? 'active' : 'inactive' })} label={t('communication.active', 'Active')} />
              </div>
            </div>
          </Section>

          <Section title={t('certificates.look', 'Look')}>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['primary_color', t('certificates.primary', 'Primary')],
                    ['accent_color', t('certificates.accent', 'Accent')],
                    ['text_color', t('certificates.text', 'Text')],
                    ['background_color', t('certificates.background', 'Background')],
                  ] as [keyof CertificateDesign, string][]
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-xs">
                    <span className="block text-[hsl(var(--dash-muted))]">{label}</span>
                    <input type="color" className="h-9 w-full cursor-pointer rounded-lg border border-[hsl(var(--dash-border))]" value={design[key] as string} onChange={(e) => setDesign({ [key]: e.target.value } as any)} />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label={t('certificates.font', 'Font')}>
                  <select className={inputCls} value={design.font_family} onChange={(e) => setDesign({ font_family: e.target.value })}>
                    {CERTIFICATE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('certificates.border', 'Border')}>
                  <select className={inputCls} value={design.border_style} onChange={(e) => setDesign({ border_style: e.target.value as any })}>
                    {['none', 'single', 'double', 'ornate'].map((b) => (
                      <option key={b} value={b}>{String(t(`certificates.border_${b}`, b))}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('certificates.direction', 'Direction')}>
                  <select className={inputCls} value={design.direction} onChange={(e) => setDesign({ direction: e.target.value as any })}>
                    <option value="rtl">{t('certificates.rtl', 'Right to left')}</option>
                    <option value="ltr">{t('certificates.ltr', 'Left to right')}</option>
                  </select>
                </Field>
              </div>
              <ImageField label={t('certificates.background_image', 'Background image')} value={design.background_image} onUpload={(f) => upload('background', f)} onClear={() => setDesign({ background_image: null })} />
              <Toggle checked={design.show_org_logo} onChange={(v) => setDesign({ show_org_logo: v })} label={t('certificates.org_logo', 'Show the academy logo')} />
              <ImageField label={t('certificates.secondary_logo', 'Second logo (partner / entity)')} value={design.secondary_logo} onUpload={(f) => upload('secondary_logo', f)} onClear={() => setDesign({ secondary_logo: null })} />
            </div>
          </Section>

          <Section title={t('certificates.texts', 'Texts')}>
            <div className="space-y-3">
              <Field label={t('certificates.title', 'Title')}>
                <input className={inputCls} value={design.title_text} onChange={(e) => setDesign({ title_text: e.target.value })} />
              </Field>
              <Field label={t('certificates.subtitle_label', 'Line above the name')}>
                <input className={inputCls} value={design.subtitle_text} onChange={(e) => setDesign({ subtitle_text: e.target.value })} />
              </Field>
              <Field label={t('certificates.body', 'Line below the name')}>
                <textarea className={inputCls} rows={3} value={design.body_text} onChange={(e) => setDesign({ body_text: e.target.value })} />
              </Field>
              <Field label={t('certificates.footer', 'Footer note')}>
                <input className={inputCls} value={design.footer_text} onChange={(e) => setDesign({ footer_text: e.target.value })} />
              </Field>
              <div>
                <div className="mb-1 text-xs text-[hsl(var(--dash-muted))]">{t('certificates.variables', 'Variables — click to copy')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {CERTIFICATE_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => copyVariable(v)}
                      className="rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-2 py-0.5 font-mono text-[11px] hover:border-[hsl(var(--dash-accent))]"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title={t('certificates.signatures', 'Signatures')}>
            <div className="space-y-3">
              {signatures.map((s, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-[hsl(var(--dash-border))] p-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} placeholder={String(t('certificates.signer_name', 'Name'))} value={s.name} onChange={(e) => setSignature(i, { name: e.target.value })} />
                    <input className={inputCls} placeholder={String(t('certificates.signer_title', 'Title'))} value={s.title} onChange={(e) => setSignature(i, { title: e.target.value })} />
                  </div>
                  <ImageField label={t('certificates.signature_image', 'Signature image')} value={s.image} onUpload={(f) => upload(`signature_${i}`, f)} onClear={() => setSignature(i, { image: null })} />
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('certificates.verification', 'Verification')}>
            <div className="flex flex-wrap gap-4">
              <Toggle checked={design.show_qr} onChange={(v) => setDesign({ show_qr: v })} label={t('certificates.show_qr', 'QR code to the verification page')} />
              <Toggle checked={design.show_certificate_id} onChange={(v) => setDesign({ show_certificate_id: v })} label={t('certificates.show_id', 'Certificate number and date')} />
            </div>
          </Section>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <div className="overflow-x-auto rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] p-4">
            <div className="mx-auto w-fit shadow-lg">
              <TemplateCertificate template={form} variables={variables} orgUuid={org?.org_uuid} orgLogo={org?.logo_image} scale={form.orientation === 'portrait' ? 0.5 : 0.62} />
            </div>
          </div>
          {/* Full-size copy used for the sample PDF capture. */}
          <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden>
            <TemplateCertificate ref={captureRef} template={form} variables={variables} orgUuid={org?.org_uuid} orgLogo={org?.logo_image} />
          </div>
        </div>
      </div>
    </AcademicPageShell>
  )
}

export default CertificateTemplateEditor
