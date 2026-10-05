'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Eye, Pencil, Upload } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { getUriWithOrg } from '@services/config/config'
import {
  DataTable,
  GhostButton,
  IconButton,
  Section,
  Stat,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import { ProfileForm, UploadForm } from '@components/Dashboard/Pages/Academic/ApplicationForms'
import { PortalHeader, SignInPrompt } from '@components/Pages/Academics/PortalShared'
import {
  applicationAction,
  getApplication,
  openApplicationDocument,
  updateApplication,
  uploadApplicationDocument,
} from '@services/academic/core'

const STEPS = ['draft', 'submitted', 'under_review', 'decision', 'enrolled']

function stepIndex(status: string): number {
  if (status === 'draft') return 0
  if (status === 'submitted') return 1
  if (status === 'under_review' || status === 'waitlisted') return 2
  if (status === 'accepted' || status === 'rejected') return 3
  if (status === 'enrolled') return 4
  return -1
}

function Stepper({ status }: { status: string }) {
  const { t } = useTranslation()
  const current = stepIndex(status)
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, i) => {
        const done = current > i || status === 'enrolled'
        const active = current === i
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? 'bg-[hsl(var(--dash-accent))] text-[hsl(var(--dash-ink))]'
                  : active
                    ? 'border-2 border-[hsl(var(--dash-accent))] text-[hsl(var(--dash-accent))]'
                    : 'border border-[hsl(var(--dash-border))] text-[hsl(var(--dash-muted))]'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-sm ${active ? 'font-semibold' : 'text-[hsl(var(--dash-muted))]'}`}>
              {String(t(`academic.step_${step}`, step.replace('_', ' ')))}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-[hsl(var(--dash-border))]" />}
          </li>
        )
      })}
    </ol>
  )
}

function MyApplication({ orgslug, applicationuuid }: { orgslug: string; applicationuuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const uuid = `application_${applicationuuid}`
  const key = ['portal', 'application', uuid]
  const [modal, setModal] = useState<null | 'profile' | 'upload'>(null)

  const { data: app, error } = useQuery({
    queryKey: key,
    queryFn: () => getApplication(uuid, access_token),
    enabled: !!access_token,
    retry: false,
  })

  if (!access_token) {
    return (
      <GeneralWrapperStyled>
        <PortalHeader title={t('academic.my_application', 'My application')} />
        <SignInPrompt orgslug={orgslug} />
      </GeneralWrapperStyled>
    )
  }
  if (error) return <GeneralWrapperStyled><p className="text-sm">{(error as any)?.message}</p></GeneralWrapperStyled>
  if (!app) return <GeneralWrapperStyled><div className="py-10 text-center">…</div></GeneralWrapperStyled>

  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      const result = await fn()
      if (result?.application_uuid) queryClient.setQueryData(key, result)
      queryClient.invalidateQueries({ queryKey: ['portal'] })
      setModal(null)
      toast.success(ok)
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  const draft = app.status === 'draft'
  const canUpload = ['draft', 'submitted', 'under_review', 'waitlisted'].includes(app.status)
  const canWithdraw = ['draft', 'submitted', 'under_review', 'waitlisted', 'accepted'].includes(app.status)
  const statusLabel = String(t(`academic.app_${app.status}`, app.status))

  return (
    <GeneralWrapperStyled>
      <PortalHeader
        title={app.program_name}
        subtitle={`${app.application_number} · ${app.cohort_code || app.cohort_name}`}
        action={
          <div className="flex flex-wrap gap-2">
            {draft && (
              <button
                onClick={() => act(() => applicationAction(uuid, 'submit', access_token), t('academic.app_submitted_ok', 'Application submitted'))}
                className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))]"
              >
                {t('academic.submit_application_long', 'Submit application')}
              </button>
            )}
            {canWithdraw && (
              <GhostButton
                onClick={() => {
                  if (!window.confirm(t('academic.confirm_withdraw', 'Withdraw this application? This cannot be undone.'))) return
                  act(() => applicationAction(uuid, 'withdraw', access_token, { note: null }), t('academic.withdrawn_ok', 'Application withdrawn'))
                }}
              >
                {t('academic.withdraw', 'Withdraw')}
              </GhostButton>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        <Section title={t('academic.application_status', 'Application status')}>
          <div className="flex flex-col gap-4">
            <Stepper status={app.status} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusPill status={app.status} label={statusLabel} />
              {app.status === 'draft' && (
                <span className="text-[hsl(var(--dash-muted))]">
                  {t('academic.draft_hint', 'Complete your academic background and upload your documents, then submit.')}
                </span>
              )}
              {app.status === 'enrolled' && app.student_number && (
                <span>
                  {t('academic.your_student_number', 'Your student number')}: <b className="font-mono">{app.student_number}</b> ·{' '}
                  <Link className="font-semibold text-[hsl(var(--dash-accent))]" href={getUriWithOrg(orgslug, '/academics')}>
                    {t('academic.my_academics', 'My academics')} →
                  </Link>
                </span>
              )}
            </div>
            {app.decision_note && ['accepted', 'rejected', 'waitlisted'].includes(app.status) && (
              <div className="rounded-xl bg-[hsl(var(--dash-canvas))] px-4 py-2 text-sm">{app.decision_note}</div>
            )}
          </div>
        </Section>

        <Section
          title={t('academic.academic_background', 'Academic background')}
          action={
            draft && (
              <GhostButton onClick={() => setModal('profile')}>
                <Pencil className="h-3.5 w-3.5" /> {t('academic.edit', 'Edit')}
              </GhostButton>
            )
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('academic.degree', 'Degree')} value={[app.profile.degree_level && String(t(`academic.degree_${app.profile.degree_level}`, app.profile.degree_level)), app.profile.degree_field].filter(Boolean).join(' · ')} />
            <Stat label={t('academic.institution', 'Institution')} value={app.profile.institution} />
            <Stat label="GPA" value={app.profile.gpa != null ? `${app.profile.gpa} / ${app.profile.gpa_scale ?? 4}` : null} />
            <Stat
              label={t('academic.language', 'Language')}
              value={app.profile.language_score != null ? `${app.profile.language_test || ''} ${app.profile.language_score}` : null}
            />
          </div>
        </Section>

        <Section title={t('academic.admission_requirements', 'Admission requirements')}>
          <DataTable headers={[t('academic.requirement', 'Requirement'), t('academic.status'), t('academic.detail', 'Detail')]}
            empty={t('academic.no_requirements_listed', 'No specific requirements listed.')}>
            {app.checks.map((c: any) => (
              <tr key={c.requirement_uuid}>
                <td className={tdCls}>
                  {c.label}
                  {!c.mandatory && <span className="text-xs text-[hsl(var(--dash-muted))]"> ({t('academic.optional', 'optional')})</span>}
                </td>
                <td className={tdCls}>
                  <StatusPill status={c.status} label={String(t(`academic.check_${c.status}`, c.status))} />
                </td>
                <td className={`${tdCls} text-xs`}>{c.overridden ? '' : c.detail}</td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <Section
          title={t('academic.documents', 'Documents')}
          description={t('academic.documents_private_applicant', 'Only you and the admissions team can see these files.')}
          action={
            canUpload && (
              <GhostButton onClick={() => setModal('upload')}>
                <Upload className="h-3.5 w-3.5" /> {t('academic.upload_document', 'Upload')}
              </GhostButton>
            )
          }
        >
          <DataTable
            headers={[t('academic.document_type', 'Type'), t('academic.file', 'File'), t('academic.status'), '']}
            empty={t('academic.no_documents', 'No documents uploaded.')}
          >
            {app.documents.map((d: any) => (
              <tr key={d.document_uuid}>
                <td className={`${tdCls} text-xs`}>{String(t(`academic.doc_${d.document_type}`, d.document_type))}</td>
                <td className={`${tdCls} text-xs`}>{d.original_name}</td>
                <td className={tdCls}>
                  <StatusPill status={d.status} label={String(t(`academic.docstatus_${d.status}`, d.status))} />
                  {d.status === 'rejected' && d.review_note && <div className="mt-1 text-xs text-red-700">{d.review_note}</div>}
                </td>
                <td className={`${tdCls} text-right`}>
                  <IconButton
                    onClick={() => openApplicationDocument(uuid, d.document_uuid, access_token).catch((e) => toast.error(e.message))}
                    aria-label={t('academic.open', 'Open')}
                  >
                    <Eye className="h-4 w-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>

        {(app.test_attempts.length > 0 || app.interviews.length > 0) && (
          <Section title={t('academic.tests_interviews', 'Tests & interviews')}>
            <ul className="space-y-2 text-sm">
              {app.test_attempts.map((a: any) => (
                <li key={a.attempt_uuid} className="flex flex-wrap items-center gap-2">
                  <b>{a.test_name}</b>
                  <span className="text-[hsl(var(--dash-muted))]">
                    #{a.attempt_number} {a.scheduled_at && `· ${a.scheduled_at.replace('T', ' ')}`}
                  </span>
                  <StatusPill status={a.status} label={String(t(`academic.attempt_${a.status}`, a.status))} />
                  {a.score != null && <span>{a.score}</span>}
                </li>
              ))}
              {app.interviews.map((i: any) => (
                <li key={i.interview_uuid} className="flex flex-wrap items-center gap-2">
                  <b>{t('academic.interview', 'Interview')}</b>
                  <span className="text-[hsl(var(--dash-muted))]">
                    {i.scheduled_at?.replace('T', ' ')} {i.location && `· ${i.location}`}
                  </span>
                  <StatusPill status={i.status} label={String(t(`academic.interview_${i.status}`, i.status))} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t('academic.history', 'History')}>
          <ol className="space-y-1.5">
            {[...app.events].reverse().map((e: any, idx: number) => (
              <li key={idx} className="flex gap-3 text-sm">
                <span className="w-32 shrink-0 font-mono text-[11px] text-[hsl(var(--dash-muted))]">
                  {e.created_at?.slice(0, 16).replace('T', ' ')}
                </span>
                <span>
                  {String(t(`academic.event_${e.action}`, e.action.replace(/_/g, ' ')))}
                  {e.to_status && ` → ${String(t(`academic.app_${e.to_status}`, e.to_status))}`}
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
        dialogTitle={modal === 'profile' ? t('academic.academic_background', 'Academic background') : t('academic.upload_document', 'Upload')}
        dialogContent={
          modal === 'profile' ? (
            <ProfileForm profile={app.profile} onSubmit={(p) => act(() => updateApplication(uuid, p, access_token), t('academic.saved', 'Saved'))} />
          ) : modal === 'upload' ? (
            <UploadForm
              onSubmit={(type, file) => act(() => uploadApplicationDocument(uuid, type, file, access_token), t('academic.uploaded', 'Uploaded'))}
            />
          ) : null
        }
      />
    </GeneralWrapperStyled>
  )
}

export default MyApplication
