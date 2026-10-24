'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Briefcase, ChartLineUp, Exam, FileText, GraduationCap, ListChecks, Plus, Trash, Translate, VideoCamera } from '@phosphor-icons/react'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, IconButton, Section, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { Switch } from '@components/ui/switch'
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

const TYPE_ICON: Record<string, React.ElementType> = {
  degree: GraduationCap,
  min_gpa: ChartLineUp,
  language: Translate,
  experience: Briefcase,
  document: FileText,
  entrance_test: Exam,
  interview: VideoCamera,
  other: ListChecks,
}

/** Program admission requirements and entrance tests. */
export function AdmissionSettings({ programUuid }: { programUuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const [drawer, setDrawer] = useState<null | 'requirement' | 'test'>(null)

  const reqKey = ['academic', 'admission-requirements', programUuid]
  const testKey = ['academic', 'entrance-tests', programUuid]
  const { data: requirements = [], isLoading } = useQuery({
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
  const remove = async (title: string, message: string, fn: () => Promise<any>) => {
    const ok = await ask({ title, message, confirmText: t('academic.delete', 'Delete'), tone: 'danger' })
    if (ok !== null) act(fn, t('academic.deleted'))
  }
  const mandatory = (requirements as any[]).filter((r) => r.mandatory).length

  return (
    <div className="space-y-4">
      <Section
        icon={<ListChecks size={18} weight="duotone" />}
        title={t('academic.admission_requirements', 'Admission requirements')}
        count={(requirements as any[]).length}
        description={t('academic.admission_requirements_desc', 'Rules an applicant must meet (separate from course prerequisites). Mandatory ones decide eligibility.')}
        action={
          <GhostButton onClick={() => setDrawer('requirement')}>
            <Plus size={14} /> {t('academic.add_requirement', 'Add requirement')}
          </GhostButton>
        }
      >
        {isLoading ? (
          <div className="dash-shimmer h-24 rounded-2xl" />
        ) : (requirements as any[]).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-8 text-center">
            <p className="text-sm font-medium">{t('academic.no_requirements', 'This program has no admission requirements configured.')}</p>
            <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">
              {t('academic.prog.no_rules_hint', 'Without rules every applicant counts as eligible. Add a degree, GPA or document rule to check applications automatically.')}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-[hsl(var(--dash-muted))]">
              {t('academic.prog.rules_summary', '{{mandatory}} mandatory · {{optional}} optional', { mandatory, optional: (requirements as any[]).length - mandatory })}
            </p>
            <ul className="divide-y divide-[hsl(var(--dash-border))]/60 overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))]/70">
              {(requirements as any[]).map((r) => {
                const Icon = TYPE_ICON[r.requirement_type] || ListChecks
                const rule = describe(t, r, tests as any[])
                return (
                  <li key={r.requirement_uuid} className="group flex items-center gap-3 bg-white px-4 py-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70">
                      <Icon size={18} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{r.label}</p>
                      <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">
                        {String(t(`academic.req_${r.requirement_type}`, r.requirement_type))}
                        {rule ? ` · ${rule}` : ''}
                      </p>
                    </div>
                    <StatusPill status={r.mandatory ? 'required' : 'inactive'} label={r.mandatory ? t('academic.mandatory', 'Mandatory') : t('academic.optional', 'optional')} />
                    <IconButton
                      tone="danger"
                      onClick={() =>
                        remove(
                          t('academic.prog.delete_rule_title', 'Delete “{{label}}”?', { label: r.label }),
                          t('academic.prog.delete_rule_message', 'Open applications are re-checked without this rule.'),
                          () => deleteAdmissionRequirement(r.requirement_uuid, access_token)
                        )
                      }
                      aria-label={t('academic.delete', 'Delete')}
                      className="opacity-60 transition-opacity group-hover:opacity-100"
                    >
                      <Trash size={16} />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Section>

      <Section
        icon={<Exam size={18} weight="duotone" />}
        title={t('academic.entrance_tests', 'Entrance tests')}
        count={(tests as any[]).length}
        description={t('academic.prog.tests_desc', 'Tests applicants sit before a decision. Link one to an “Entrance test” requirement to make passing it a rule.')}
        action={
          <GhostButton onClick={() => setDrawer('test')}>
            <Plus size={14} /> {t('academic.new_entrance_test', 'Entrance test')}
          </GhostButton>
        }
      >
        {(tests as any[]).length === 0 ? (
          <p className="rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-4 py-6 text-center text-sm text-[hsl(var(--dash-muted))]">{t('academic.adm.no_tests_configured', 'This program has no entrance test.')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(tests as any[]).map((x) => (
              <li key={x.test_uuid} className="group rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{x.code}</span>
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{x.name}</p>
                  <IconButton
                    tone="danger"
                    onClick={() =>
                      remove(
                        t('academic.prog.delete_test_title', 'Delete {{name}}?', { name: x.name }),
                        t('academic.prog.delete_test_message', 'Only tests nobody has sat can be deleted; otherwise switch it off.'),
                        () => deleteEntranceTest(x.test_uuid, access_token)
                      )
                    }
                    aria-label={t('academic.delete', 'Delete')}
                    className="opacity-60 transition-opacity group-hover:opacity-100"
                  >
                    <Trash size={16} />
                  </IconButton>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[12px] text-[hsl(var(--dash-muted))]">
                  <span>
                    {t('academic.pass_at', 'pass')} <b className="text-[hsl(var(--dash-ink))]">{x.passing_score}</b>/{x.max_score}
                  </span>
                  <span>{t('academic.prog.attempts', '{{count}} attempts', { count: x.attempt_limit })}</span>
                  {x.duration_minutes ? <span>{x.duration_minutes} min</span> : null}
                  <label className="ms-auto inline-flex cursor-pointer items-center gap-2">
                    <span>{x.active ? t('academic.active', 'Active') : t('academic.inactive', 'Inactive')}</span>
                    <Switch
                      className="data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]"
                      checked={!!x.active}
                      onCheckedChange={(v) => act(() => updateEntranceTest(x.test_uuid, { active: v }, access_token), t('academic.updated'))}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <PostgradDrawer
        isDialogOpen={!!drawer}
        onOpenChange={(o: boolean) => !o && setDrawer(null)}
        icon={drawer === 'test' ? <Exam size={20} weight="duotone" /> : <ListChecks size={20} weight="duotone" />}
        dialogTitle={drawer === 'test' ? t('academic.new_entrance_test', 'Entrance test') : t('academic.add_requirement', 'Add requirement')}
        dialogDescription={
          drawer === 'test'
            ? t('academic.prog.test_form_desc', 'Applicants are scheduled for it from their application.')
            : t('academic.prog.rule_form_desc', 'Checked automatically against each application.')
        }
        dialogContent={
          drawer === 'requirement' ? (
            <RequirementForm
              tests={tests as any[]}
              onSubmit={(data) =>
                act(async () => {
                  await createAdmissionRequirement(programUuid, data, access_token)
                  setDrawer(null)
                }, t('academic.created'))
              }
            />
          ) : drawer === 'test' ? (
            <TestForm
              onSubmit={(data) =>
                act(async () => {
                  await createEntranceTest(programUuid, data, access_token)
                  setDrawer(null)
                }, t('academic.created'))
              }
            />
          ) : null
        }
      />
      {dialog}
    </div>
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
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.prog.rule', 'Rule')} columns={1}>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
        <span>
          <span className="block text-sm font-medium">{t('academic.mandatory', 'Mandatory')}</span>
          <span className="block text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.prog.mandatory_hint', 'Applicants must meet it to be eligible')}</span>
        </span>
        <Switch className="data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]" checked={mandatory} onCheckedChange={setMandatory} />
      </label>
      </FormSection>
      <SubmitRow saving={saving} disabled={type === 'entrance_test' && tests.length === 0} />
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
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.test', 'Test')}>
        <Field label={t('academic.code')} required>
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MSC-AI-ET" required />
        </Field>
        <Field label={t('academic.name')} required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </FormSection>
      <FormSection title={t('academic.prog.scoring', 'Scoring and attempts')}>
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
      </FormSection>
      <SubmitRow saving={saving} disabled={Number(passing) > Number(max)} />
    </form>
  )
}
