'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, UploadSimple } from '@phosphor-icons/react'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { cn } from '@/lib/utils'
import { DOCUMENT_TYPES } from '@services/academic/core'

/* Forms shared by the staff application page and the applicant portal. */

export function useSubmit<T>(onSubmit: (_v: T) => Promise<any> | void) {
  const [saving, setSaving] = useState(false)
  const run = async (e: React.FormEvent, value: T) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(value)
    } finally {
      setSaving(false)
    }
  }
  return { saving, run }
}

export function ProfileForm({ profile, onSubmit }: { profile: any; onSubmit: (_p: any) => any }) {
  const { t } = useTranslation()
  const [p, setP] = useState<any>({ gpa_scale: 4, ...profile })
  const { saving, run } = useSubmit(onSubmit)
  const set = (k: string, v: any) => setP((prev: any) => ({ ...prev, [k]: v }))
  const num = (v: string) => (v === '' ? null : Number(v))
  return (
    <form onSubmit={(e) => run(e, p)} className="space-y-6">
      <FormSection title={t('academic.adm.section_degree', 'Previous degree')}>
        <Field label={t('academic.degree', 'Degree')}>
          <select className={inputCls} value={p.degree_level || ''} onChange={(e) => set('degree_level', e.target.value || null)}>
            <option value="">—</option>
            {['bachelor', 'master', 'doctorate'].map((d) => (
              <option key={d} value={d}>
                {String(t(`academic.degree_${d}`, d))}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.degree_field', 'Field of study')}>
          <input className={inputCls} value={p.degree_field || ''} onChange={(e) => set('degree_field', e.target.value)} />
        </Field>
        <Field label={t('academic.institution', 'Institution')}>
          <input className={inputCls} value={p.institution || ''} onChange={(e) => set('institution', e.target.value)} />
        </Field>
        <Field label={t('academic.graduation_year', 'Graduation year')}>
          <input type="number" min={1950} max={2100} className={inputCls} value={p.graduation_year ?? ''} onChange={(e) => set('graduation_year', num(e.target.value))} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.adm.section_scores', 'Grades and language')}>
        <Field label="GPA">
          <input type="number" step="0.01" min={0} className={inputCls} value={p.gpa ?? ''} onChange={(e) => set('gpa', num(e.target.value))} />
        </Field>
        <Field label={t('academic.gpa_scale', 'GPA scale')} hint={t('academic.adm.gpa_scale_hint', 'Usually 4 or 5')}>
          <input type="number" step="0.1" min={1} className={inputCls} value={p.gpa_scale ?? ''} onChange={(e) => set('gpa_scale', num(e.target.value))} />
        </Field>
        <Field label={t('academic.language_test', 'Language test')}>
          <input className={inputCls} value={p.language_test || ''} onChange={(e) => set('language_test', e.target.value)} placeholder="IELTS" />
        </Field>
        <Field label={t('academic.language_score', 'Score')}>
          <input type="number" step="0.5" min={0} className={inputCls} value={p.language_score ?? ''} onChange={(e) => set('language_score', num(e.target.value))} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.adm.section_contact', 'Experience and contact')}>
        <Field label={t('academic.experience_years', 'Experience (years)')}>
          <input type="number" step="0.5" min={0} className={inputCls} value={p.experience_years ?? ''} onChange={(e) => set('experience_years', num(e.target.value))} />
        </Field>
        <Field label={t('academic.phone', 'Phone')}>
          <input className={inputCls} value={p.phone || ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
        </Field>
        <Field label={t('academic.national_id', 'National ID')} className="sm:col-span-2">
          <input className={inputCls} value={p.national_id || ''} onChange={(e) => set('national_id', e.target.value)} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.statement', 'Statement of purpose')} columns={1}>
        <Field label={t('academic.adm.statement_label', 'Why this program?')}>
          <textarea className={inputCls} rows={5} value={p.statement || ''} onChange={(e) => set('statement', e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

export function UploadForm({ onSubmit }: { onSubmit: (_type: string, _file: File) => any }) {
  const { t } = useTranslation()
  const [type, setType] = useState('transcript')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const { saving, run } = useSubmit(async () => file && onSubmit(type, file))
  return (
    <form onSubmit={(e) => run(e, null)} className="space-y-6">
      <FormSection title={t('academic.adm.section_document', 'Document')} columns={1}>
        <Field label={t('academic.document_type', 'Type')}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d} value={d}>
                {String(t(`academic.doc_${d}`, d.replace(/_/g, ' ')))}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.file', 'File')} hint={t('academic.adm.file_hint', 'PDF, Word or an image')}>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) setFile(dropped)
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-[hsl(var(--dash-accent))] bg-[hsl(var(--dash-accent-soft))]/50' : 'border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/50 hover:border-[hsl(var(--dash-ink))]/30'
            )}
          >
            {file ? <FileText size={26} weight="duotone" className="text-[hsl(var(--dash-accent))]" /> : <UploadSimple size={26} weight="duotone" className="text-[hsl(var(--dash-muted))]" />}
            <span className="mt-2 max-w-full truncate text-sm font-medium">{file ? file.name : t('academic.adm.drop_file', 'Drop a file here or choose one')}</span>
            {file ? <span className="text-[11px] text-[hsl(var(--dash-muted))]">{(file.size / 1024 / 1024).toFixed(2)} MB</span> : null}
            <input type="file" accept=".pdf,.doc,.docx,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={!file} submitLabel={t('academic.upload_document', 'Upload')} />
    </form>
  )
}
