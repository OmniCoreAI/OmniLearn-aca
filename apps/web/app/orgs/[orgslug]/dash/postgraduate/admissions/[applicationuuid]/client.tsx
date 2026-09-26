'use client'
import React, { useState } from 'react'
import {
  GraduationCap,
  Eye,
  CheckCircle2,
  XCircle,
  Upload,
  Plus,
  ClipboardCheck,
  UserCheck,
  Pencil,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import {
  DataTable,
  GhostButton,
  IconButton,
  PostgradTabs,
  Section,
  Stat,
  StatusPill,
  selectCls,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  DOCUMENT_TYPES,
  applicationAction,
  decideApplication,
  displayName,
  getApplication,
  getEntranceTests,
  openApplicationDocument,
  overrideCheck,
  recordEntranceTest,
  reviewDocument,
  scheduleEntranceTest,
  scheduleInterview,
  updateApplication,
  updateInterview,
  uploadApplicationDocument,
} from '@services/academic/core'

const REVIEWABLE = ['submitted', 'under_review', 'waitlisted']

function ApplicationDetail({ orgslug, applicationuuid }: { orgslug: string; applicationuuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const uuid = `application_${applicationuuid}`
  const key = ['academic', 'application', uuid]
  const [modal, setModal] = useState<
    null | 'decision' | 'profile' | 'upload' | 'test' | 'interview' | { interview: any } | { check: any } | { attempt: any }
  >(null)

  const { data: app, error } = useQuery({
    queryKey: key,
    queryFn: () => getApplication(uuid, access_token),
    enabled: !!access_token,
    retry: false,
  })
  const { data: tests = [] } = useQuery({
    queryKey: ['academic', 'entrance-tests', app?.program_uuid],
    queryFn: () => getEntranceTests(app.program_uuid, access_token),
    enabled: !!app?.program_uuid && !!access_token,
  })

  const done = (result?: any) => {
    if (result?.application_uuid) queryClient.setQueryData(key, result)
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['academic', 'applications'] })
    setModal(null)
  }
  const act = async (fn: () => Promise<any>, ok = t('academic.updated')) => {
    try {
      done(await fn())
      toast.success(ok)
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  if (error) return <AcademicPageShell><p className="text-sm">{(error as any)?.message}</p></AcademicPageShell>
  if (!app) return <AcademicPageShell><div className="py-10 text-center">…</div></AcademicPageShell>

  const reviewable = REVIEWABLE.includes(app.status)
  const open = ['draft', ...REVIEWABLE].includes(app.status)
  const statusLabel = (s: string) => String(t(`academic.app_${s}`, s))

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_admissions', 'Admissions'), href: getUriWithOrg(orgslug, '/dash/postgraduate/admissions') },
          { label: app.application_number },
        ]}
      />
      <AcademicHeader
        title={displayName(app.applicant)}
        subtitle={`${app.application_number} · ${app.program_name} · ${app.cohort_code || app.cohort_name}`}
        action={
          <>
            {app.status === 'draft' && (
              <GhostButton onClick={() => act(() => applicationAction(uuid, 'submit', access_token), t('academic.app_submitted_ok', 'Application submitted'))}>
                {t('academic.submit_application', 'Submit')}
              </GhostButton>
            )}
            {app.status === 'submitted' && (
              <GhostButton onClick={() => act(() => applicationAction(uuid, 'review', access_token))}>
                <ClipboardCheck className="h-3.5 w-3.5" /> {t('academic.start_review', 'Start review')}
              </GhostButton>
            )}
            {['under_review', 'waitlisted'].includes(app.status) && (
              <GhostButton onClick={() => setModal('decision')}>{t('academic.record_decision', 'Record decision')}</GhostButton>
            )}
            {app.status === 'accepted' && (
              <GhostButton
                onClick={() =>
                  window.confirm(t('academic.confirm_enroll', 'Enroll this applicant as a student of the cohort?')) &&
                  act(() => applicationAction(uuid, 'enroll', access_token), t('academic.enrolled_ok', 'Student enrolled'))
                }
              >
                <UserCheck className="h-3.5 w-3.5" /> {t('academic.enroll_student', 'Enroll as student')}
              </GhostButton>
            )}
            {open || app.status === 'accepted' ? (
              <GhostButton
                onClick={() => {
                  const note = window.prompt(t('academic.withdraw_reason', 'Reason for withdrawal (optional)'))
                  if (note !== null) act(() => applicationAction(uuid, 'withdraw', access_token, { note: note || null }))
                }}
              >
                {t('academic.withdraw', 'Withdraw')}
              </GhostButton>
            ) : null}
          </>
        }
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label={t('academic.status')} value={<StatusPill status={app.status} label={statusLabel(app.status)} />} />
          <Stat
            label={t('academic.eligibility', 'Eligibility')}
            value={
              app.eligible === true
                ? t('academic.eligible', 'Eligible')
                : app.eligible === false
                  ? t('academic.not_eligible', 'Not eligible')
                  : t('academic.checks_pending', { count: app.pending_checks, defaultValue: `${app.pending_checks} pending` })
            }
          />
          <Stat label={t('academic.submitted_at', 'Submitted')} value={app.submitted_at?.slice(0, 10)} />
          <Stat label={t('academic.decided_at', 'Decided')} value={app.decided_at?.slice(0, 10)} />
          <Stat label={t('academic.student_number', 'Student no.')} value={app.student_number} />
          <Stat label={t('academic.email', 'Email')} value={<span className="text-xs">{app.applicant.email}</span>} />
        </div>
        {app.decision_note && (
          <div className="rounded-xl bg-[hsl(var(--dash-canvas))] px-4 py-2 text-sm">
            <b>{t('academic.decision_note', 'Decision note')}:</b> {app.decision_note}
          </div>
        )}

        <Section
          title={t('academic.academic_background', 'Academic background')}
          action={
            open && (
              <GhostButton onClick={() => setModal('profile')}>
                <Pencil className="h-3.5 w-3.5" /> {t('academic.edit', 'Edit')}
              </GhostButton>
            )
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('academic.degree', 'Degree')} value={[app.profile.degree_level, app.profile.degree_field].filter(Boolean).join(' · ')} />
            <Stat label={t('academic.institution', 'Institution')} value={app.profile.institution} />
            <Stat label={t('academic.graduation_year', 'Graduation year')} value={app.profile.graduation_year} />
            <Stat label="GPA" value={app.profile.gpa != null ? `${app.profile.gpa} / ${app.profile.gpa_scale ?? 4}` : null} />
            <Stat
              label={t('academic.language', 'Language')}
              value={app.profile.language_score != null ? `${app.profile.language_test || ''} ${app.profile.language_score}` : null}
            />
            <Stat label={t('academic.experience_years', 'Experience (years)')} value={app.profile.experience_years} />
            <Stat label={t('academic.phone', 'Phone')} value={app.profile.phone} />
            <Stat label={t('academic.national_id', 'National ID')} value={app.profile.national_id} />
          </div>
          {app.profile.statement && <p className="mt-3 whitespace-pre-line text-sm text-[hsl(var(--dash-muted))]">{app.profile.statement}</p>}
        </Section>

        <Section
          title={t('academic.admission_requirements', 'Admission requirements')}
          description={t('academic.requirements_desc', 'Checked automatically from the application; staff can set a result manually with a reason.')}
        >
          <DataTable
            headers={[t('academic.requirement', 'Requirement'), t('academic.result', 'Result'), t('academic.detail', 'Detail'), '']}
            empty={t('academic.no_requirements', 'This program has no admission requirements configured.')}
          >
            {app.checks.map((c: any) => (
              <tr key={c.requirement_uuid}>
                <td className={tdCls}>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-xs text-[hsl(var(--dash-muted))]">
                    {String(t(`academic.req_${c.requirement_type}`, c.requirement_type))}
                    {!c.mandatory && ` · ${t('academic.optional', 'optional')}`}
                  </div>
                </td>
                <td className={tdCls}>
                  <StatusPill status={c.status} label={String(t(`academic.check_${c.status}`, c.status))} />
                </td>
                <td className={`${tdCls} text-xs`}>{c.detail}</td>
                <td className={`${tdCls} text-right`}>
                  {reviewable && (
                    <GhostButton onClick={() => setModal({ check: c })}>{t('academic.set_manually', 'Set manually')}</GhostButton>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <Section
          title={t('academic.documents', 'Documents')}
          description={t('academic.documents_private', 'Stored privately; only the applicant and program staff can open them.')}
          action={
            open && (
              <GhostButton onClick={() => setModal('upload')}>
                <Upload className="h-3.5 w-3.5" /> {t('academic.upload_document', 'Upload')}
              </GhostButton>
            )
          }
        >
          <DataTable
            headers={[t('academic.document_type', 'Type'), t('academic.file', 'File'), t('academic.status'), t('academic.note', 'Note'), '']}
            empty={t('academic.no_documents', 'No documents uploaded.')}
          >
            {app.documents.map((d: any) => (
              <tr key={d.document_uuid}>
                <td className={`${tdCls} text-xs`}>{String(t(`academic.doc_${d.document_type}`, d.document_type))}</td>
                <td className={`${tdCls} text-xs`}>{d.original_name}</td>
                <td className={tdCls}>
                  <StatusPill status={d.status} label={String(t(`academic.docstatus_${d.status}`, d.status))} />
                </td>
                <td className={`${tdCls} text-xs`}>{d.review_note}</td>
                <td className={`${tdCls} whitespace-nowrap text-right`}>
                  <IconButton
                    onClick={() => openApplicationDocument(uuid, d.document_uuid, access_token).catch((e) => toast.error(e.message))}
                    aria-label={t('academic.open', 'Open')}
                  >
                    <Eye className="h-4 w-4" />
                  </IconButton>
                  {reviewable && d.status !== 'verified' && (
                    <IconButton
                      onClick={() => act(() => reviewDocument(uuid, d.document_uuid, { status: 'verified' }, access_token))}
                      aria-label={t('academic.verify', 'Verify')}
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </IconButton>
                  )}
                  {reviewable && d.status !== 'rejected' && (
                    <IconButton
                      tone="danger"
                      onClick={() => {
                        const note = window.prompt(t('academic.reject_document_reason', 'Why is this document rejected?'))
                        if (note) act(() => reviewDocument(uuid, d.document_uuid, { status: 'rejected', note }, access_token))
                      }}
                      aria-label={t('academic.reject', 'Reject')}
                    >
                      <XCircle className="h-4 w-4" />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section
            title={t('academic.entrance_tests', 'Entrance tests')}
            action={
              reviewable &&
              tests.length > 0 && (
                <GhostButton onClick={() => setModal('test')}>
                  <Plus className="h-3.5 w-3.5" /> {t('academic.schedule', 'Schedule')}
                </GhostButton>
              )
            }
          >
            <DataTable
              headers={[t('academic.test', 'Test'), t('academic.attempt', 'Attempt'), t('academic.score', 'Score'), t('academic.status'), '']}
              empty={t('academic.no_attempts', 'No test attempts.')}
            >
              {app.test_attempts.map((a: any) => (
                <tr key={a.attempt_uuid}>
                  <td className={tdCls}>
                    <div className="text-sm font-medium">{a.test_name}</div>
                    <div className="text-xs text-[hsl(var(--dash-muted))]">{a.scheduled_at?.replace('T', ' ')}</div>
                  </td>
                  <td className={tdCls}>#{a.attempt_number}</td>
                  <td className={tdCls}>
                    {a.score ?? '—'} <span className="text-xs text-[hsl(var(--dash-muted))]">/ {t('academic.pass_at', 'pass')} {a.passing_score}</span>
                  </td>
                  <td className={tdCls}>
                    <StatusPill status={a.status} label={String(t(`academic.attempt_${a.status}`, a.status))} />
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {reviewable && ['scheduled', 'pending_review'].includes(a.status) && (
                      <GhostButton onClick={() => setModal({ attempt: a })}>{t('academic.record_result', 'Record result')}</GhostButton>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Section>

          <Section
            title={t('academic.interviews', 'Interviews')}
            action={
              reviewable && (
                <GhostButton onClick={() => setModal('interview')}>
                  <Plus className="h-3.5 w-3.5" /> {t('academic.schedule', 'Schedule')}
                </GhostButton>
              )
            }
          >
            <DataTable
              headers={[t('academic.when', 'When'), t('academic.panel', 'Panel'), t('academic.result', 'Result'), '']}
              empty={t('academic.no_interviews', 'No interviews.')}
            >
              {app.interviews.map((i: any) => (
                <tr key={i.interview_uuid}>
                  <td className={`${tdCls} text-xs`}>
                    {i.scheduled_at?.replace('T', ' ') || '—'}
                    <div className="text-[hsl(var(--dash-muted))]">{i.location}</div>
                  </td>
                  <td className={`${tdCls} text-xs`}>{i.panel.map(displayName).join(', ') || '—'}</td>
                  <td className={tdCls}>
                    <StatusPill status={i.status} label={String(t(`academic.interview_${i.status}`, i.status))} />
                    {i.recommendation && (
                      <div className="mt-1 text-xs">
                        {String(t(`academic.rec_${i.recommendation}`, i.recommendation))}
                        {i.score != null && ` · ${i.score}`}
                      </div>
                    )}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {reviewable && (
                      <GhostButton onClick={() => setModal({ interview: i })}>{t('academic.update', 'Update')}</GhostButton>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Section>
        </div>

        <Section title={t('academic.audit_trail', 'Audit trail')}>
          <ol className="space-y-2">
            {[...app.events].reverse().map((e: any, idx: number) => (
              <li key={idx} className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 font-mono text-[11px] text-[hsl(var(--dash-muted))]">
                  {e.created_at?.slice(0, 16).replace('T', ' ')}
                </span>
                <span>
                  <b>{String(t(`academic.event_${e.action}`, e.action.replace(/_/g, ' ')))}</b>
                  {e.to_status && ` → ${statusLabel(e.to_status)}`}
                  {e.note && <span className="text-[hsl(var(--dash-muted))]"> — {e.note}</span>}
                  {e.actor && <span className="text-xs text-[hsl(var(--dash-muted))]"> · {displayName(e.actor)}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <Modal
        isDialogOpen={!!modal}
        onOpenChange={(o: boolean) => !o && setModal(null)}
        minWidth={modal === 'profile' ? 'md' : 'sm'}
        dialogTitle={
          modal === 'decision'
            ? t('academic.record_decision', 'Record decision')
            : modal === 'profile'
              ? t('academic.academic_background', 'Academic background')
              : modal === 'upload'
                ? t('academic.upload_document', 'Upload')
                : modal === 'test'
                  ? t('academic.schedule_test', 'Schedule entrance test')
                  : modal === 'interview'
                    ? t('academic.schedule_interview', 'Schedule interview')
                    : modal && 'interview' in (modal as any)
                      ? t('academic.update_interview', 'Update interview')
                      : modal && 'check' in (modal as any)
                        ? (modal as any).check.label
                        : t('academic.record_result', 'Record result')
        }
        dialogContent={
          modal === 'decision' ? (
            <DecisionForm eligible={app.eligible} onSubmit={(data) => act(() => decideApplication(uuid, data, access_token))} />
          ) : modal === 'profile' ? (
            <ProfileForm profile={app.profile} onSubmit={(profile) => act(() => updateApplication(uuid, profile, access_token))} />
          ) : modal === 'upload' ? (
            <UploadForm onSubmit={(type, file) => act(() => uploadApplicationDocument(uuid, type, file, access_token), t('academic.uploaded', 'Uploaded'))} />
          ) : modal === 'test' ? (
            <ScheduleTestForm tests={tests} onSubmit={(data) => act(() => scheduleEntranceTest(uuid, data, access_token))} />
          ) : modal === 'interview' ? (
            <InterviewForm onSubmit={(data) => act(() => scheduleInterview(uuid, data, access_token))} />
          ) : modal && 'interview' in (modal as any) ? (
            <InterviewForm
              interview={(modal as any).interview}
              onSubmit={(data) => act(() => updateInterview(uuid, (modal as any).interview.interview_uuid, data, access_token))}
            />
          ) : modal && 'check' in (modal as any) ? (
            <CheckForm
              check={(modal as any).check}
              onSubmit={(data) => act(() => overrideCheck(uuid, (modal as any).check.requirement_uuid, data, access_token))}
            />
          ) : modal && 'attempt' in (modal as any) ? (
            <ResultForm onSubmit={(data) => act(() => recordEntranceTest(uuid, (modal as any).attempt.attempt_uuid, data, access_token))} />
          ) : null
        }
      />
    </AcademicPageShell>
  )
}

function useSubmit<T>(onSubmit: (_v: T) => Promise<any> | void) {
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

function DecisionForm({ eligible, onSubmit }: { eligible: boolean | null; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const [decision, setDecision] = useState('accepted')
  const [note, setNote] = useState('')
  const [override, setOverride] = useState(false)
  const { saving, run } = useSubmit(onSubmit)
  const needsOverride = decision === 'accepted' && eligible !== true
  return (
    <form onSubmit={(e) => run(e, { decision, note: note || null, override_requirements: needsOverride && override })} className="space-y-4">
      <Field label={t('academic.decision', 'Decision')}>
        <select className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value)}>
          {['accepted', 'waitlisted', 'rejected'].map((d) => (
            <option key={d} value={d}>
              {String(t(`academic.app_${d}`, d))}
            </option>
          ))}
        </select>
      </Field>
      {needsOverride && (
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" className="mt-1" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          {t('academic.override_admission', 'Accept as an exception although mandatory requirements are not all met (the reason is recorded).')}
        </label>
      )}
      <Field label={t('academic.decision_note', 'Decision note')}>
        <textarea
          className={inputCls}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required={decision === 'rejected' || (needsOverride && override)}
        />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

function ProfileForm({ profile, onSubmit }: { profile: any; onSubmit: (_p: any) => any }) {
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

function UploadForm({ onSubmit }: { onSubmit: (_type: string, _file: File) => any }) {
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

function ScheduleTestForm({ tests, onSubmit }: { tests: any[]; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const active = tests.filter((x) => x.active)
  const [test, setTest] = useState(active[0]?.test_uuid || '')
  const [when, setWhen] = useState('')
  const { saving, run } = useSubmit(onSubmit)
  return (
    <form onSubmit={(e) => run(e, { test_uuid: test, scheduled_at: when || null })} className="space-y-4">
      <Field label={t('academic.test', 'Test')}>
        <select className={inputCls} value={test} onChange={(e) => setTest(e.target.value)} required>
          {active.map((x) => (
            <option key={x.test_uuid} value={x.test_uuid}>
              {x.code} · {x.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('academic.when', 'When')}>
        <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

function ResultForm({ onSubmit }: { onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const [score, setScore] = useState('')
  const [absent, setAbsent] = useState(false)
  const { saving, run } = useSubmit(onSubmit)
  return (
    <form onSubmit={(e) => run(e, { score: absent || score === '' ? null : Number(score), absent })} className="space-y-4">
      <Field label={t('academic.score', 'Score')}>
        <input type="number" step="0.5" className={inputCls} value={score} onChange={(e) => setScore(e.target.value)} disabled={absent} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={absent} onChange={(e) => setAbsent(e.target.checked)} />
        {t('academic.absent', 'Absent')}
      </label>
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t('academic.online_test_hint', 'Leave the score empty for an online test to pull the graded result of its linked assignment.')}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}

function InterviewForm({ interview, onSubmit }: { interview?: any; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [when, setWhen] = useState(interview?.scheduled_at?.slice(0, 16) || '')
  const [location, setLocation] = useState(interview?.location || '')
  const [panel, setPanel] = useState<{ uuid: string; label: string }[]>(
    (interview?.panel || []).map((u: any) => ({ uuid: u.user_uuid, label: displayName(u) }))
  )
  const [status, setStatus] = useState(interview?.status || 'scheduled')
  const [score, setScore] = useState(interview?.score != null ? String(interview.score) : '')
  const [rec, setRec] = useState(interview?.recommendation || '')
  const [notes, setNotes] = useState(interview?.notes || '')
  const { saving, run } = useSubmit(onSubmit)
  const payload = interview
    ? {
        scheduled_at: when || null,
        location: location || null,
        panel_uuids: panel.map((p) => p.uuid),
        status,
        score: score === '' ? null : Number(score),
        recommendation: rec || null,
        notes: notes || null,
      }
    : { scheduled_at: when || null, location: location || null, panel_uuids: panel.map((p) => p.uuid) }
  return (
    <form onSubmit={(e) => run(e, payload)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.when', 'When')}>
          <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label={t('academic.location_or_link', 'Location / meeting link')}>
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.panel', 'Panel')}>
        <div className="mb-2 flex flex-wrap gap-1">
          {panel.map((p) => (
            <button
              type="button"
              key={p.uuid}
              onClick={() => setPanel((prev) => prev.filter((x) => x.uuid !== p.uuid))}
              className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-xs"
            >
              {p.label} ×
            </button>
          ))}
        </div>
        <CoordinatorPicker
          orgId={orgId}
          access_token={access_token}
          value={null}
          onChange={(uuid, label) => uuid && !panel.some((p) => p.uuid === uuid) && setPanel((prev) => [...prev, { uuid, label: label || uuid }])}
        />
      </Field>
      {interview && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('academic.status')}>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {['scheduled', 'completed', 'no_show', 'cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {String(t(`academic.interview_${s}`, s))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('academic.score', 'Score')}>
              <input type="number" min={0} max={100} className={inputCls} value={score} onChange={(e) => setScore(e.target.value)} />
            </Field>
            <Field label={t('academic.recommendation', 'Recommendation')}>
              <select className={inputCls} value={rec} onChange={(e) => setRec(e.target.value)} required={status === 'completed'}>
                <option value="">—</option>
                {['accept', 'waitlist', 'reject'].map((r) => (
                  <option key={r} value={r}>
                    {String(t(`academic.rec_${r}`, r))}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('academic.notes', 'Notes')}>
            <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </>
      )}
      <SubmitRow saving={saving} />
    </form>
  )
}

function CheckForm({ check, onSubmit }: { check: any; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(check.overridden ? check.status : 'met')
  const [note, setNote] = useState('')
  const { saving, run } = useSubmit(onSubmit)
  return (
    <form onSubmit={(e) => run(e, status === 'auto' ? { status: null } : { status, note })} className="space-y-4">
      <Field label={t('academic.result', 'Result')}>
        <select className={selectCls('w-full')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="met">{String(t('academic.check_met', 'met'))}</option>
          <option value="not_met">{String(t('academic.check_not_met', 'not met'))}</option>
          <option value="pending">{String(t('academic.check_pending', 'pending'))}</option>
          {check.overridden && <option value="auto">{t('academic.back_to_automatic', 'Back to automatic')}</option>}
        </select>
      </Field>
      {status !== 'auto' && (
        <Field label={t('academic.reason', 'Reason')}>
          <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} required />
        </Field>
      )}
      <SubmitRow saving={saving} />
    </form>
  )
}

export default ApplicationDetail
