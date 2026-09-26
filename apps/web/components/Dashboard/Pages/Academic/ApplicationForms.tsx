'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
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
    <form onSubmit={(e) => run(e, p)} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
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
        <Field label={t('academic.graduation_year', 'Graduation year')}>
          <input type="number" className={inputCls} value={p.graduation_year ?? ''} onChange={(e) => set('graduation_year', num(e.target.value))} />
        </Field>
      </div>
      <Field label={t('academic.institution', 'Institution')}>
        <input className={inputCls} value={p.institution || ''} onChange={(e) => set('institution', e.target.value)} />
      </Field>
      <div className="grid grid-cols-4 gap-3">
        <Field label="GPA">
          <input type="number" step="0.01" className={inputCls} value={p.gpa ?? ''} onChange={(e) => set('gpa', num(e.target.value))} />
        </Field>
        <Field label={t('academic.gpa_scale', 'GPA scale')}>
          <input type="number" step="0.1" className={inputCls} value={p.gpa_scale ?? ''} onChange={(e) => set('gpa_scale', num(e.target.value))} />
        </Field>
        <Field label={t('academic.language_test', 'Language test')}>
          <input className={inputCls} value={p.language_test || ''} onChange={(e) => set('language_test', e.target.value)} placeholder="IELTS" />
        </Field>
        <Field label={t('academic.language_score', 'Score')}>
          <input type="number" step="0.5" className={inputCls} value={p.language_score ?? ''} onChange={(e) => set('language_score', num(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.experience_years', 'Experience (years)')}>
          <input type="number" step="0.5" className={inputCls} value={p.experience_years ?? ''} onChange={(e) => set('experience_years', num(e.target.value))} />
        </Field>
        <Field label={t('academic.phone', 'Phone')}>
          <input className={inputCls} value={p.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label={t('academic.national_id', 'National ID')}>
          <input className={inputCls} value={p.national_id || ''} onChange={(e) => set('national_id', e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.statement', 'Statement of purpose')}>
        <textarea className={inputCls} rows={3} value={p.statement || ''} onChange={(e) => set('statement', e.target.value)} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export function UploadForm({ onSubmit }: { onSubmit: (_type: string, _file: File) => any }) {
  const { t } = useTranslation()
  const [type, setType] = useState('transcript')
  const [file, setFile] = useState<File | null>(null)
  const { saving, run } = useSubmit(async () => file && onSubmit(type, file))
  return (
    <form onSubmit={(e) => run(e, null)} className="space-y-4">
      <Field label={t('academic.document_type', 'Type')}>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
          {DOCUMENT_TYPES.map((d) => (
            <option key={d} value={d}>
              {String(t(`academic.doc_${d}`, d.replace(/_/g, ' ')))}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('academic.file', 'File')}>
        <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}
