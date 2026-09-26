'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  DataTable,
  GhostButton,
  IconButton,
  Section,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  DOCUMENT_TYPES,
  createAdmissionRequirement,
  createEntranceTest,
  deleteAdmissionRequirement,
  deleteEntranceTest,
  getAdmissionRequirements,
  getEntranceTests,
  updateEntranceTest,
} from '@services/academic/core'

const REQUIREMENT_TYPES = ['degree', 'min_gpa', 'language', 'experience', 'document', 'entrance_test', 'interview', 'other']

function describe(t: any, r: any, tests: any[]): string {
  const c = r.config || {}
  switch (r.requirement_type) {
    case 'degree':
      return String(t(`academic.degree_${c.degree_level}`, c.degree_level))
    case 'min_gpa':
      return `≥ ${c.min_gpa} / 4.0`
    case 'language':
      return `${c.test || ''} ≥ ${c.min_score}`.trim()
    case 'experience':
      return `≥ ${c.years} ${t('academic.years', 'years')}`
    case 'document':
      return String(t(`academic.doc_${c.document_type}`, c.document_type))
    case 'entrance_test':
      return tests.find((x) => x.test_uuid === c.test_uuid)?.code || '—'
    case 'interview':
      return c.min_score != null ? `≥ ${c.min_score}` : ''
    default:
      return ''
  }
}

/** Program admission requirements + entrance tests (Phase 3). */
export function AdmissionSettings({ programUuid }: { programUuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<null | 'requirement' | 'test'>(null)

  const reqKey = ['academic', 'admission-requirements', programUuid]
  const testKey = ['academic', 'entrance-tests', programUuid]
  const { data: requirements = [] } = useQuery({
    queryKey: reqKey,
    queryFn: () => getAdmissionRequirements(programUuid, access_token),
    enabled: !!access_token,
  })
  const { data: tests = [] } = useQuery({
    queryKey: testKey,
    queryFn: () => getEntranceTests(programUuid, access_token),
    enabled: !!access_token,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: reqKey })
    queryClient.invalidateQueries({ queryKey: testKey })
  }
  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  return (
    <Section
      title={t('academic.admission_requirements', 'Admission requirements')}
      description={t(
        'academic.admission_requirements_desc',
        'Rules an applicant must meet (separate from course prerequisites). Mandatory ones decide eligibility.'
      )}
      action={
        <>
          <GhostButton onClick={() => setModal('test')}>
            <Plus className="h-3.5 w-3.5" /> {t('academic.new_entrance_test', 'Entrance test')}
          </GhostButton>
          <GhostButton onClick={() => setModal('requirement')}>
            <Plus className="h-3.5 w-3.5" /> {t('academic.add_requirement', 'Add requirement')}
          </GhostButton>
        </>
      }
    >
      <DataTable
        headers={[t('academic.requirement', 'Requirement'), t('academic.course_type', 'Type'), t('academic.rule', 'Rule'), '']}
        empty={t('academic.no_requirements', 'This program has no admission requirements configured.')}
      >
        {requirements.map((r: any) => (
          <tr key={r.requirement_uuid}>
            <td className={tdCls}>
              <div className="font-medium">{r.label}</div>
              {!r.mandatory && <div className="text-xs text-[hsl(var(--dash-muted))]">{t('academic.optional', 'optional')}</div>}
            </td>
            <td className={`${tdCls} text-xs`}>{String(t(`academic.req_${r.requirement_type}`, r.requirement_type))}</td>
            <td className={`${tdCls} text-xs`}>{describe(t, r, tests)}</td>
            <td className={`${tdCls} text-right`}>
              <IconButton
                tone="danger"
                onClick={() =>
                  window.confirm(t('academic.confirm_delete')) &&
                  act(() => deleteAdmissionRequirement(r.requirement_uuid, access_token), t('academic.deleted'))
                }
                aria-label={t('academic.delete', 'Delete')}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </td>
          </tr>
        ))}
      </DataTable>

      {tests.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
            {t('academic.entrance_tests', 'Entrance tests')}
          </div>
          <DataTable
            headers={[
              t('academic.code'),
              t('academic.name'),
              t('academic.pass_at', 'pass'),
              t('academic.attempt_limit', 'Attempts'),
              t('academic.status'),
              '',
            ]}
          >
            {tests.map((x: any) => (
              <tr key={x.test_uuid}>
                <td className={`${tdCls} font-mono text-xs`}>{x.code}</td>
                <td className={tdCls}>
                  {x.name}
                  {x.duration_minutes && <span className="text-xs text-[hsl(var(--dash-muted))]"> · {x.duration_minutes} min</span>}
                </td>
                <td className={tdCls}>
                  {x.passing_score}/{x.max_score}
                </td>
                <td className={tdCls}>{x.attempt_limit}</td>
                <td className={tdCls}>
                  <button
                    type="button"
                    onClick={() => act(() => updateEntranceTest(x.test_uuid, { active: !x.active }, access_token), t('academic.updated'))}
                  >
                    <StatusPill status={x.active ? 'active' : 'closed'} label={x.active ? t('academic.active', 'Active') : t('academic.inactive', 'Inactive')} />
                  </button>
                </td>
                <td className={`${tdCls} text-right`}>
                  <IconButton
                    tone="danger"
                    onClick={() =>
                      window.confirm(t('academic.confirm_delete')) &&
                      act(() => deleteEntranceTest(x.test_uuid, access_token), t('academic.deleted'))
                    }
                    aria-label={t('academic.delete', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      <Modal
        isDialogOpen={!!modal}
        onOpenChange={(o: boolean) => !o && setModal(null)}
        minWidth="sm"
        dialogTitle={modal === 'test' ? t('academic.new_entrance_test', 'Entrance test') : t('academic.add_requirement', 'Add requirement')}
        dialogContent={
          modal === 'requirement' ? (
            <RequirementForm
              tests={tests}
              onSubmit={(data) =>
                act(async () => {
                  await createAdmissionRequirement(programUuid, data, access_token)
                  setModal(null)
                }, t('academic.created'))
              }
            />
          ) : modal === 'test' ? (
            <TestForm
              onSubmit={(data) =>
                act(async () => {
                  await createEntranceTest(programUuid, data, access_token)
                  setModal(null)
                }, t('academic.created'))
              }
            />
          ) : null
        }
      />
    </Section>
  )
}

function RequirementForm({ tests, onSubmit }: { tests: any[]; onSubmit: (_d: any) => Promise<any> }) {
  const { t } = useTranslation()
  const [type, setType] = useState('degree')
  const [label, setLabel] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [config, setConfig] = useState<any>({ degree_level: 'bachelor' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setConfig((c: any) => ({ ...c, [k]: v }))

  const changeType = (next: string) => {
    setType(next)
    setConfig(
      next === 'degree'
        ? { degree_level: 'bachelor' }
        : next === 'document'
          ? { document_type: 'transcript' }
          : next === 'entrance_test'
            ? { test_uuid: tests[0]?.test_uuid || '' }
            : {}
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        requirement_type: type,
        label: label || String(t(`academic.req_${type}`, type)),
        mandatory,
        config,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.course_type', 'Type')}>
        <select className={inputCls} value={type} onChange={(e) => changeType(e.target.value)}>
          {REQUIREMENT_TYPES.map((r) => (
            <option key={r} value={r}>
              {String(t(`academic.req_${r}`, r))}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('academic.label', 'Label')}>
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={String(t(`academic.req_${type}`, type))} />
      </Field>
      {type === 'degree' && (
        <Field label={t('academic.minimum_degree', 'Minimum degree')}>
          <select className={inputCls} value={config.degree_level} onChange={(e) => set('degree_level', e.target.value)}>
            {['bachelor', 'master', 'doctorate'].map((d) => (
              <option key={d} value={d}>
                {String(t(`academic.degree_${d}`, d))}
              </option>
            ))}
          </select>
        </Field>
      )}
      {type === 'min_gpa' && (
        <Field label={t('academic.min_gpa', 'Minimum GPA (4.0 scale)')}>
          <input type="number" step="0.01" min={0} max={4} className={inputCls} value={config.min_gpa ?? ''} onChange={(e) => set('min_gpa', Number(e.target.value))} required />
        </Field>
      )}
      {type === 'language' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('academic.language_test', 'Language test')}>
            <input className={inputCls} value={config.test || ''} onChange={(e) => set('test', e.target.value)} placeholder="IELTS" />
          </Field>
          <Field label={t('academic.min_score', 'Min score')}>
            <input type="number" step="0.5" className={inputCls} value={config.min_score ?? ''} onChange={(e) => set('min_score', Number(e.target.value))} required />
          </Field>
        </div>
      )}
      {type === 'experience' && (
        <Field label={t('academic.years', 'years')}>
          <input type="number" step="0.5" min={0} className={inputCls} value={config.years ?? ''} onChange={(e) => set('years', Number(e.target.value))} required />
        </Field>
      )}
      {type === 'document' && (
        <Field label={t('academic.document_type', 'Type')}>
          <select className={inputCls} value={config.document_type} onChange={(e) => set('document_type', e.target.value)}>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d} value={d}>
                {String(t(`academic.doc_${d}`, d.replace(/_/g, ' ')))}
              </option>
            ))}
          </select>
        </Field>
      )}
      {type === 'entrance_test' && (
        <Field label={t('academic.test', 'Test')}>
          {tests.length === 0 ? (
            <p className="text-xs text-[hsl(var(--dash-muted))]">{t('academic.create_test_first', 'Create an entrance test first.')}</p>
          ) : (
            <select className={inputCls} value={config.test_uuid} onChange={(e) => set('test_uuid', e.target.value)}>
              {tests.map((x) => (
                <option key={x.test_uuid} value={x.test_uuid}>
                  {x.code} · {x.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {type === 'interview' && (
        <Field label={t('academic.min_interview_score', 'Minimum interview score (optional)')}>
          <input type="number" min={0} max={100} className={inputCls} value={config.min_score ?? ''} onChange={(e) => set('min_score', e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
        {t('academic.mandatory', 'Mandatory')}
      </label>
      <SubmitRow saving={saving} />
    </form>
  )
}

function TestForm({ onSubmit }: { onSubmit: (_d: any) => Promise<any> }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [passing, setPassing] = useState('60')
  const [max, setMax] = useState('100')
  const [duration, setDuration] = useState('')
  const [attempts, setAttempts] = useState('1')
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        code,
        name,
        passing_score: Number(passing),
        max_score: Number(max),
        duration_minutes: duration === '' ? null : Number(duration),
        attempt_limit: Number(attempts),
      })
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.code')}>
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MSC-AI-ET" required />
        </Field>
        <div className="col-span-2">
          <Field label={t('academic.name')}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label={t('academic.pass_at', 'pass')}>
          <input type="number" min={0} className={inputCls} value={passing} onChange={(e) => setPassing(e.target.value)} required />
        </Field>
        <Field label={t('academic.max_score', 'Max')}>
          <input type="number" min={1} className={inputCls} value={max} onChange={(e) => setMax(e.target.value)} required />
        </Field>
        <Field label={t('academic.duration_min', 'Minutes')}>
          <input type="number" min={1} className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label={t('academic.attempt_limit', 'Attempts')}>
          <input type="number" min={1} className={inputCls} value={attempts} onChange={(e) => setAttempts(e.target.value)} required />
        </Field>
      </div>
      <SubmitRow saving={saving} />
    </form>
  )
}
