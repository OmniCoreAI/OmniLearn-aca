'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  Hourglass,
  ListChecks,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  SealCheck,
  Student,
  UploadSimple,
  UserCirclePlus,
  VideoCamera,
  Exam,
  XCircle,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { ProfileForm, UploadForm, useSubmit } from '@components/Dashboard/Pages/Academic/ApplicationForms'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, PostgradTabs, Section, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
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
import { cn } from '@/lib/utils'

const REVIEWABLE = ['submitted', 'under_review', 'waitlisted']
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'

type Drawer = null | 'decision' | 'profile' | 'upload' | 'test' | 'interview' | { interview: any } | { check: any } | { attempt: any }

function useDateTime() {
  const { i18n } = useTranslation()
  return (value?: string | null, withTime = false) => {
    if (!value) return ''
    const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString(i18n.language, withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' })
  }
}

/** Draft → Submitted → In review → Decision → Enrolled, with the current step highlighted. */
function Stepper({ app }: { app: any }) {
  const { t } = useTranslation()
  const reviewed = app.events?.some((e: any) => e.to_status === 'under_review') || ['under_review', 'waitlisted', 'accepted', 'rejected', 'enrolled'].includes(app.status)
  const decided = !!app.decided_at || ['accepted', 'rejected', 'waitlisted', 'enrolled'].includes(app.status)
  const reached = app.status === 'enrolled' ? 4 : decided ? 3 : reviewed ? 2 : app.submitted_at ? 1 : 0
  const decisionLabel =
    app.status === 'rejected'
      ? t('academic.app_rejected', 'Rejected')
      : app.status === 'waitlisted'
        ? t('academic.app_waitlisted', 'Waitlisted')
        : ['accepted', 'enrolled'].includes(app.status)
          ? t('academic.adm.stage_accepted', 'Offer made')
          : t('academic.decision', 'Decision')
  const steps = [
    { label: t('academic.app_draft', 'Draft'), Icon: NotePencil },
    { label: t('academic.app_submitted', 'Submitted'), Icon: PaperPlaneTilt },
    { label: t('academic.adm.stage_review', 'In review'), Icon: ListChecks },
    { label: decisionLabel, Icon: app.status === 'rejected' ? XCircle : app.status === 'waitlisted' ? Hourglass : SealCheck },
    { label: t('academic.app_enrolled', 'Enrolled'), Icon: Student },
  ]
  const closed = ['rejected', 'withdrawn'].includes(app.status)
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label={t('academic.adm.progress', 'Application progress')}>
      {steps.map((step, i) => {
        const done = i < reached || (i === reached && app.status === 'enrolled')
        const current = i === reached && !done
        const bad = closed && i === reached
        return (
          <React.Fragment key={i}>
            <li className="flex shrink-0 items-center gap-2" aria-current={current ? 'step' : undefined}>
              <span
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 transition-colors',
                  bad
                    ? 'bg-red-50 text-red-600 ring-red-200'
                    : done
                      ? 'bg-emerald-500 text-white ring-emerald-500'
                      : current
                        ? `${GOLD} text-[hsl(var(--dash-ink))] ring-transparent shadow-[0_6px_14px_-6px_hsl(43_80%_45%/0.8)]`
                        : 'bg-white text-[hsl(var(--dash-muted))] ring-[hsl(var(--dash-border))]'
                )}
              >
                {done ? <Check size={14} weight="bold" /> : <step.Icon size={15} weight="duotone" />}
              </span>
              <span className={cn('whitespace-nowrap text-[12.5px]', current || bad ? 'font-semibold text-[hsl(var(--dash-ink))]' : done ? 'text-[hsl(var(--dash-ink))]/75' : 'text-[hsl(var(--dash-muted))]')}>
                {step.label}
              </span>
            </li>
            {i < steps.length - 1 ? <li aria-hidden="true" className={cn('h-px min-w-6 flex-1', i < reached ? 'bg-emerald-400' : 'bg-[hsl(var(--dash-border))]')} /> : null}
          </React.Fragment>
        )
      })}
      {app.status === 'withdrawn' ? (
        <li className="ms-2 shrink-0">
          <StatusPill status="withdrawn" label={t('academic.app_withdrawn', 'Withdrawn')} />
        </li>
      ) : null}
    </ol>
  )
}

const CHECK_ICON: Record<string, { Icon: React.ElementType; cls: string }> = {
  met: { Icon: CheckCircle, cls: 'text-emerald-500' },
  not_met: { Icon: XCircle, cls: 'text-red-500' },
  pending: { Icon: Clock, cls: 'text-amber-500' },
}

function ApplicationDetail({ orgslug, applicationuuid }: { orgslug: string; applicationuuid: string }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const fmt = useDateTime()
  const { ask, dialog } = useActionDialog()
  const uuid = `application_${applicationuuid}`
  const key = ['academic', 'application', uuid]
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [busy, setBusy] = useState(false)

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
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
    setDrawer(null)
  }
  const act = async (fn: () => Promise<any>, ok = t('academic.updated')) => {
    setBusy(true)
    try {
      done(await fn())
      toast.success(ok)
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    } finally {
      setBusy(false)
    }
  }

  if (error)
    return (
      <AcademicPageShell>
        <p className="dash-card rounded-[1.25rem] p-6 text-sm">{(error as any)?.message}</p>
      </AcademicPageShell>
    )
  if (!app)
    return (
      <AcademicPageShell>
        <div className="space-y-4 pt-8">
          <div className="dash-shimmer h-40 rounded-[1.25rem]" />
          <div className="dash-shimmer h-72 rounded-[1.25rem]" />
        </div>
      </AcademicPageShell>
    )

  const name = displayName(app.applicant)
  const reviewable = REVIEWABLE.includes(app.status)
  const editable = ['draft', ...REVIEWABLE].includes(app.status)
  const statusLabel = (s: string) => String(t(`academic.app_${s}`, s))
  const metCount = app.checks.filter((c: any) => c.status === 'met').length
  const mandatory = app.checks.filter((c: any) => c.mandatory)
  const pendingMandatory = mandatory.filter((c: any) => c.status === 'pending')

  const submit = () => act(() => applicationAction(uuid, 'submit', access_token), t('academic.app_submitted_ok', 'Application submitted'))
  const startReview = () => act(() => applicationAction(uuid, 'review', access_token), t('academic.adm.review_started', 'Review started'))
  const enroll = async () => {
    const ok = await ask({
      title: t('academic.adm.enroll_title', 'Enroll {{name}}?', { name }),
      message: t(
        'academic.adm.enroll_message',
        'Creates the student record in {{intake}}: a student number, access to the program and registration in its required courses.',
        { intake: app.cohort_code || app.cohort_name }
      ),
      confirmText: t('academic.enroll_student', 'Enroll as student'),
      tone: 'success',
    })
    if (ok !== null) act(() => applicationAction(uuid, 'enroll', access_token), t('academic.enrolled_ok', 'Student enrolled'))
  }
  const withdraw = async () => {
    const note = await ask({
      title: t('academic.adm.withdraw_title', 'Withdraw this application?'),
      message: t('academic.adm.withdraw_message', 'The application closes. It can be reopened later as a draft with the same number.'),
      confirmText: t('academic.withdraw', 'Withdraw'),
      tone: 'danger',
      noteLabel: t('academic.withdraw_reason', 'Reason for withdrawal (optional)'),
    })
    if (note !== null) act(() => applicationAction(uuid, 'withdraw', access_token, { note: note || null }))
  }
  const rejectDocument = async (d: any) => {
    const note = await ask({
      title: t('academic.adm.reject_doc_title', 'Reject this document?'),
      message: t('academic.adm.reject_doc_message', 'The applicant sees the reason and can upload a replacement.'),
      confirmText: t('academic.reject', 'Reject'),
      tone: 'danger',
      noteLabel: t('academic.reject_document_reason', 'Why is this document rejected?'),
      noteRequired: true,
    })
    if (note) act(() => reviewDocument(uuid, d.document_uuid, { status: 'rejected', note }, access_token))
  }

  /** The one thing to do next, with its button. */
  const next = (() => {
    switch (app.status) {
      case 'draft':
        return {
          tone: 'gold',
          title: t('academic.adm.next_draft_title', 'Complete the application and submit it'),
          body: t('academic.adm.next_draft_body', 'Fill in the academic background and upload the documents, then submit for review.'),
          actions: (
            <>
              <GhostButton onClick={() => setDrawer('profile')}>
                <NotePencil size={14} /> {t('academic.adm.edit_background', 'Edit background')}
              </GhostButton>
              <PrimaryAction onClick={submit} busy={busy} Icon={PaperPlaneTilt} label={t('academic.submit_application', 'Submit')} />
            </>
          ),
        }
      case 'submitted':
        return {
          tone: 'gold',
          title: t('academic.adm.next_submitted_title', 'Start the review'),
          body: t('academic.adm.next_submitted_body', 'Reviewing lets you verify documents, schedule entrance tests and interviews, and then record a decision.'),
          actions: <PrimaryAction onClick={startReview} busy={busy} Icon={ListChecks} label={t('academic.start_review', 'Start review')} />,
        }
      case 'under_review':
      case 'waitlisted':
        return {
          tone: app.eligible === true ? 'gold' : 'neutral',
          title:
            app.eligible === true
              ? t('academic.adm.next_ready_title', 'All mandatory requirements are met')
              : app.eligible === false
                ? t('academic.adm.next_not_met_title', 'Some mandatory requirements are not met')
                : t('academic.adm.next_pending_title', '{{count}} mandatory checks still pending', { count: pendingMandatory.length }),
          body:
            app.status === 'waitlisted'
              ? t('academic.adm.next_waitlisted_body', 'Waitlisted. Record a new decision when a seat frees up.')
              : app.eligible === true
                ? t('academic.adm.next_ready_body', 'Record the decision. Accepting makes an offer; enrolling then creates the student.')
                : app.eligible === false
                  ? t('academic.adm.next_not_met_body', 'You can reject, waitlist, or accept as a recorded exception.')
                  : pendingMandatory.map((c: any) => c.label).join(' · '),
          actions: <PrimaryAction onClick={() => setDrawer('decision')} busy={busy} Icon={SealCheck} label={t('academic.record_decision', 'Record decision')} />,
        }
      case 'accepted':
        return {
          tone: 'green',
          title: t('academic.adm.next_accepted_title', 'Offer made — enroll the student'),
          body: t('academic.adm.next_accepted_body', 'Enrolling gives a student number, program access and registration in the required courses.'),
          actions: <PrimaryAction onClick={enroll} busy={busy} Icon={UserCirclePlus} label={t('academic.enroll_student', 'Enroll as student')} />,
        }
      case 'enrolled':
        return {
          tone: 'green',
          title: t('academic.adm.next_enrolled_title', 'Enrolled as student {{number}}', { number: app.student_number || '' }),
          body: t('academic.adm.next_enrolled_body', 'The student now appears in the Students list and in the intake roster.'),
          actions: (
            <Link
              href={getUriWithOrg(orgslug, '/dash/postgraduate/students')}
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Student size={15} weight="duotone" /> {t('academic.adm.open_students', 'Open students')}
            </Link>
          ),
        }
      default:
        return {
          tone: 'neutral',
          title: statusLabel(app.status),
          body: app.decision_note || t('academic.adm.closed_body', 'This application is closed.'),
          actions: null,
        }
    }
  })()

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_admissions', 'Admissions'), href: getUriWithOrg(orgslug, '/dash/postgraduate/admissions') },
          { label: app.application_number },
        ]}
      />
      <PostgradTabs orgslug={orgslug} />

      {/* Applicant header */}
      <section className="dash-card mb-4 mt-2 rounded-[1.25rem] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <PersonAvatar name={name} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
              <StatusPill status={app.status} label={statusLabel(app.status)} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
              <span className="font-mono text-[12px] text-[hsl(var(--dash-ink))]/80">{app.application_number}</span>
              <span>{app.applicant?.email}</span>
              <span className="inline-flex items-center gap-1">
                <GraduationCap size={14} /> {app.program_name}
              </span>
              <span>{app.cohort_code || app.cohort_name}</span>
            </p>
          </div>
          {editable || app.status === 'accepted' ? (
            <button
              type="button"
              onClick={withdraw}
              className="self-start rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 sm:self-center"
            >
              {t('academic.withdraw', 'Withdraw')}
            </button>
          ) : null}
        </div>
        <div className="mt-5 border-t border-[hsl(var(--dash-border))]/60 pt-4">
          <Stepper app={app} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* Next step */}
          <section
            className={cn(
              'flex flex-col gap-4 rounded-[1.25rem] border p-5 sm:flex-row sm:items-center',
              next.tone === 'gold'
                ? 'border-[hsl(var(--dash-accent))]/30 bg-[hsl(var(--dash-accent-soft))]/60'
                : next.tone === 'green'
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : 'border-[hsl(var(--dash-border))] bg-white'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--dash-muted))]">{t('academic.adm.next_step', 'Next step')}</p>
              <p className="mt-1 text-[15px] font-semibold">{next.title}</p>
              {next.body ? <p className="mt-0.5 text-[13px] leading-relaxed text-[hsl(var(--dash-ink))]/70">{next.body}</p> : null}
            </div>
            {next.actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{next.actions}</div> : null}
          </section>

          {/* Requirements */}
          <Section
            icon={<ListChecks size={18} weight="duotone" />}
            title={t('academic.admission_requirements', 'Admission requirements')}
            description={t('academic.requirements_desc', 'Checked automatically from the application; staff can set a result manually with a reason.')}
            action={
              app.checks.length ? (
                <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2.5 py-1 text-xs font-semibold tabular-nums">
                  {t('academic.adm.met_of', '{{met}} of {{total}} met', { met: metCount, total: app.checks.length })}
                </span>
              ) : null
            }
          >
            {app.checks.length === 0 ? (
              <p className="rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-4 py-6 text-center text-sm text-[hsl(var(--dash-muted))]">
                {t('academic.no_requirements', 'This program has no admission requirements configured.')}
              </p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--dash-border))]/60 overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))]/70">
                {app.checks.map((c: any) => {
                  const icon = CHECK_ICON[c.status] || CHECK_ICON.pending
                  return (
                    <li key={c.requirement_uuid} className="flex items-start gap-3 bg-white px-4 py-3">
                      <icon.Icon size={20} weight="fill" className={cn('mt-0.5 shrink-0', icon.cls)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium">
                          {c.label}
                          {!c.mandatory ? <span className="ms-1.5 text-[11px] font-normal text-[hsl(var(--dash-muted))]">({t('academic.optional', 'optional')})</span> : null}
                        </p>
                        <p className="text-[12px] text-[hsl(var(--dash-muted))]">
                          {String(t(`academic.req_${c.requirement_type}`, c.requirement_type))}
                          {c.detail ? ` · ${c.detail}` : ''}
                          {c.overridden ? ` · ${t('academic.adm.set_by_staff', 'set by staff')}` : ''}
                        </p>
                      </div>
                      {reviewable ? (
                        <button
                          type="button"
                          onClick={() => setDrawer({ check: c })}
                          className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-[hsl(var(--dash-ink))]/70 transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
                        >
                          {t('academic.set_manually', 'Set manually')}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          {/* Documents */}
          <Section
            icon={<FileText size={18} weight="duotone" />}
            title={t('academic.documents', 'Documents')}
            count={app.documents.length}
            description={t('academic.documents_private', 'Stored privately; only the applicant and program staff can open them.')}
            action={
              editable ? (
                <GhostButton onClick={() => setDrawer('upload')}>
                  <UploadSimple size={14} /> {t('academic.upload_document', 'Upload')}
                </GhostButton>
              ) : null
            }
          >
            {app.documents.length === 0 ? (
              <p className="rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-4 py-6 text-center text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_documents', 'No documents uploaded.')}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {app.documents.map((d: any) => (
                  <li key={d.document_uuid} className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-3 py-2.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70">
                      <FileText size={18} weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{String(t(`academic.doc_${d.document_type}`, d.document_type))}</p>
                      <p className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{d.review_note || d.original_name}</p>
                    </div>
                    <StatusPill status={d.status} label={String(t(`academic.docstatus_${d.status}`, d.status))} />
                    <div className="flex shrink-0 items-center">
                      <IconAction label={t('academic.open', 'Open')} onClick={() => openApplicationDocument(uuid, d.document_uuid, access_token, d.original_name).catch((e) => toast.error(e.message))}>
                        <Eye size={16} />
                      </IconAction>
                      {reviewable && d.status !== 'verified' ? (
                        <IconAction label={t('academic.verify', 'Verify')} tone="good" onClick={() => act(() => reviewDocument(uuid, d.document_uuid, { status: 'verified' }, access_token))}>
                          <CheckCircle size={16} weight="duotone" />
                        </IconAction>
                      ) : null}
                      {reviewable && d.status !== 'rejected' ? (
                        <IconAction label={t('academic.reject', 'Reject')} tone="bad" onClick={() => rejectDocument(d)}>
                          <XCircle size={16} weight="duotone" />
                        </IconAction>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Section
              icon={<Exam size={18} weight="duotone" />}
              title={t('academic.entrance_tests', 'Entrance tests')}
              count={app.test_attempts.length}
              action={
                reviewable && (tests as any[]).length > 0 ? (
                  <GhostButton onClick={() => setDrawer('test')}>
                    <Plus size={14} /> {t('academic.schedule', 'Schedule')}
                  </GhostButton>
                ) : null
              }
            >
              {app.test_attempts.length === 0 ? (
                <p className="text-sm text-[hsl(var(--dash-muted))]">
                  {(tests as any[]).length ? t('academic.no_attempts', 'No test attempts.') : t('academic.adm.no_tests_configured', 'This program has no entrance test.')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {app.test_attempts.map((a: any) => (
                    <li key={a.attempt_uuid} className="rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {a.test_name} <span className="text-[11px] font-normal text-[hsl(var(--dash-muted))]">#{a.attempt_number}</span>
                        </p>
                        <StatusPill status={a.status} label={String(t(`academic.attempt_${a.status}`, a.status))} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[hsl(var(--dash-muted))]">
                        <span>{fmt(a.scheduled_at, true) || '—'}</span>
                        <span>
                          <b className="text-[hsl(var(--dash-ink))]">{a.score ?? '—'}</b> / {t('academic.pass_at', 'pass')} {a.passing_score}
                        </span>
                      </div>
                      {reviewable && ['scheduled', 'pending_review'].includes(a.status) ? (
                        <button type="button" onClick={() => setDrawer({ attempt: a })} className="mt-2 text-[12px] font-semibold text-[hsl(var(--dash-accent))] hover:underline">
                          {t('academic.record_result', 'Record result')} →
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              icon={<VideoCamera size={18} weight="duotone" />}
              title={t('academic.interviews', 'Interviews')}
              count={app.interviews.length}
              action={
                reviewable ? (
                  <GhostButton onClick={() => setDrawer('interview')}>
                    <Plus size={14} /> {t('academic.schedule', 'Schedule')}
                  </GhostButton>
                ) : null
              }
            >
              {app.interviews.length === 0 ? (
                <p className="text-sm text-[hsl(var(--dash-muted))]">{t('academic.no_interviews', 'No interviews.')}</p>
              ) : (
                <ul className="space-y-2">
                  {app.interviews.map((i: any) => (
                    <li key={i.interview_uuid} className="rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{fmt(i.scheduled_at, true) || t('academic.adm.unscheduled', 'Not scheduled')}</p>
                        <StatusPill status={i.status} label={String(t(`academic.interview_${i.status}`, i.status))} />
                      </div>
                      {i.location ? <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">{i.location}</p> : null}
                      <div className="mt-2 flex items-center gap-1.5">
                        {i.panel.slice(0, 4).map((u: any) => (
                          <span key={u.user_uuid} title={displayName(u)}>
                            <PersonAvatar name={displayName(u)} size={22} />
                          </span>
                        ))}
                        {i.recommendation ? (
                          <span className="ms-auto text-[12px] font-semibold">
                            {String(t(`academic.rec_${i.recommendation}`, i.recommendation))}
                            {i.score != null ? ` · ${i.score}` : ''}
                          </span>
                        ) : null}
                      </div>
                      {reviewable ? (
                        <button type="button" onClick={() => setDrawer({ interview: i })} className="mt-2 text-[12px] font-semibold text-[hsl(var(--dash-accent))] hover:underline">
                          {t('academic.update', 'Update')} →
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>

        {/* Side column */}
        <aside className="min-w-0 space-y-4">
          <Section
            title={t('academic.academic_background', 'Academic background')}
            action={
              editable ? (
                <GhostButton onClick={() => setDrawer('profile')}>
                  <NotePencil size={14} /> {t('academic.edit', 'Edit')}
                </GhostButton>
              ) : null
            }
          >
            <dl className="space-y-2.5 text-[13px]">
              {[
                [t('academic.degree', 'Degree'), [app.profile.degree_level && t(`academic.degree_${app.profile.degree_level}`, app.profile.degree_level), app.profile.degree_field].filter(Boolean).join(' · ')],
                [t('academic.institution', 'Institution'), [app.profile.institution, app.profile.graduation_year].filter(Boolean).join(' · ')],
                ['GPA', app.profile.gpa != null ? `${app.profile.gpa} / ${app.profile.gpa_scale ?? 4}` : ''],
                [t('academic.language', 'Language'), app.profile.language_score != null ? `${app.profile.language_test || ''} ${app.profile.language_score}`.trim() : ''],
                [t('academic.experience_years', 'Experience (years)'), app.profile.experience_years ?? ''],
                [t('academic.phone', 'Phone'), app.profile.phone],
                [t('academic.national_id', 'National ID'), app.profile.national_id],
              ].map(([label, value], i) => (
                <div key={i} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-[hsl(var(--dash-muted))]">{label}</dt>
                  <dd className="min-w-0 truncate text-end font-medium">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {app.profile.statement ? (
              <p className="mt-3 whitespace-pre-line rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[hsl(var(--dash-ink))]/80">{app.profile.statement}</p>
            ) : null}
          </Section>

          {app.decision_note || app.decided_at ? (
            <Section icon={<SealCheck size={18} weight="duotone" />} title={t('academic.decision', 'Decision')}>
              <div className="flex items-center justify-between gap-2">
                <StatusPill status={app.status} label={statusLabel(app.status)} />
                <span className="text-[12px] text-[hsl(var(--dash-muted))]">{fmt(app.decided_at)}</span>
              </div>
              {app.decision_note ? <p className="mt-2 text-[13px] leading-relaxed">{app.decision_note}</p> : null}
            </Section>
          ) : null}

          <Section icon={<ClockCounterClockwise size={18} weight="duotone" />} title={t('academic.audit_trail', 'Audit trail')} count={app.events.length}>
            <ol className="relative space-y-3 ps-5 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-[hsl(var(--dash-border))]">
              {[...app.events].reverse().map((e: any, idx: number) => (
                <li key={idx} className="relative">
                  <span className={cn('absolute -start-5 top-1 h-[11px] w-[11px] rounded-full ring-2 ring-white', idx === 0 ? 'bg-[hsl(var(--dash-accent))]' : 'bg-[hsl(var(--dash-border))]')} />
                  <p className="text-[12.5px] font-semibold">
                    {String(t(`academic.event_${e.action}`, e.action.replace(/_/g, ' ')))}
                    {e.to_status ? <span className="font-normal text-[hsl(var(--dash-muted))]"> → {statusLabel(e.to_status)}</span> : null}
                  </p>
                  {e.note ? <p className="text-[12px] text-[hsl(var(--dash-ink))]/75">{e.note}</p> : null}
                  <p className="text-[11px] text-[hsl(var(--dash-muted))]">{[fmt(e.created_at, true), e.actor ? displayName(e.actor) : null].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>

      <PostgradDrawer
        isDialogOpen={!!drawer}
        onOpenChange={(o: boolean) => !o && setDrawer(null)}
        minWidth={drawer === 'profile' || (drawer && typeof drawer === 'object' && 'interview' in drawer) || drawer === 'interview' ? 'md' : 'sm'}
        icon={<ClipboardText size={20} weight="duotone" />}
        dialogTitle={
          drawer === 'decision'
            ? t('academic.record_decision', 'Record decision')
            : drawer === 'profile'
              ? t('academic.academic_background', 'Academic background')
              : drawer === 'upload'
                ? t('academic.upload_document', 'Upload')
                : drawer === 'test'
                  ? t('academic.schedule_test', 'Schedule entrance test')
                  : drawer === 'interview'
                    ? t('academic.schedule_interview', 'Schedule interview')
                    : drawer && 'interview' in (drawer as any)
                      ? t('academic.update_interview', 'Update interview')
                      : drawer && 'check' in (drawer as any)
                        ? (drawer as any).check.label
                        : t('academic.record_result', 'Record result')
        }
        dialogDescription={`${name} · ${app.application_number}`}
        dialogContent={
          drawer === 'decision' ? (
            <DecisionForm app={app} onSubmit={(data) => act(() => decideApplication(uuid, data, access_token), t('academic.adm.decision_saved', 'Decision recorded'))} />
          ) : drawer === 'profile' ? (
            <ProfileForm profile={app.profile} onSubmit={(profile) => act(() => updateApplication(uuid, profile, access_token))} />
          ) : drawer === 'upload' ? (
            <UploadForm onSubmit={(type, file) => act(() => uploadApplicationDocument(uuid, type, file, access_token), t('academic.uploaded', 'Uploaded'))} />
          ) : drawer === 'test' ? (
            <ScheduleTestForm tests={tests} onSubmit={(data) => act(() => scheduleEntranceTest(uuid, data, access_token))} />
          ) : drawer === 'interview' ? (
            <InterviewForm onSubmit={(data) => act(() => scheduleInterview(uuid, data, access_token))} />
          ) : drawer && 'interview' in (drawer as any) ? (
            <InterviewForm interview={(drawer as any).interview} onSubmit={(data) => act(() => updateInterview(uuid, (drawer as any).interview.interview_uuid, data, access_token))} />
          ) : drawer && 'check' in (drawer as any) ? (
            <CheckForm check={(drawer as any).check} onSubmit={(data) => act(() => overrideCheck(uuid, (drawer as any).check.requirement_uuid, data, access_token))} />
          ) : drawer && 'attempt' in (drawer as any) ? (
            <ResultForm attempt={(drawer as any).attempt} onSubmit={(data) => act(() => recordEntranceTest(uuid, (drawer as any).attempt.attempt_uuid, data, access_token))} />
          ) : null
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

function PrimaryAction({ onClick, busy, Icon, label }: { onClick: () => void; busy: boolean; Icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_hsl(0_0%_8%/0.6)] transition-all hover:-translate-y-px hover:opacity-90 disabled:opacity-50"
    >
      <Icon size={15} weight="duotone" /> {label}
      <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
    </button>
  )
}

function IconAction({ label, tone, onClick, children }: { label: string; tone?: 'good' | 'bad'; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors',
        tone === 'good' ? 'text-emerald-600 hover:bg-emerald-50' : tone === 'bad' ? 'text-red-500 hover:bg-red-50' : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]'
      )}
    >
      {children}
    </button>
  )
}

const DECISIONS = [
  { key: 'accepted', Icon: SealCheck, cls: 'peer-checked:border-emerald-400 peer-checked:bg-emerald-50', iconCls: 'text-emerald-600' },
  { key: 'waitlisted', Icon: Hourglass, cls: 'peer-checked:border-amber-400 peer-checked:bg-amber-50', iconCls: 'text-amber-600' },
  { key: 'rejected', Icon: XCircle, cls: 'peer-checked:border-red-400 peer-checked:bg-red-50', iconCls: 'text-red-600' },
] as const

function DecisionForm({ app, onSubmit }: { app: any; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const [decision, setDecision] = useState<string>(app.eligible === false ? 'rejected' : 'accepted')
  const [note, setNote] = useState('')
  const [override, setOverride] = useState(false)
  const { saving, run } = useSubmit(onSubmit)
  const needsOverride = decision === 'accepted' && app.eligible !== true
  const noteRequired = decision === 'rejected' || (needsOverride && override)
  const hint: Record<string, string> = {
    accepted: t('academic.adm.decide_accept_hint', 'Makes an offer. Enroll afterwards to create the student.'),
    waitlisted: t('academic.adm.decide_waitlist_hint', 'Keeps the application in reserve if a seat frees up.'),
    rejected: t('academic.adm.decide_reject_hint', 'Final for this intake. A reason is required.'),
  }
  return (
    <form onSubmit={(e) => run(e, { decision, note: note || null, override_requirements: needsOverride && override })} className="space-y-6">
      <FormSection title={t('academic.decision', 'Decision')} columns={1}>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {DECISIONS.map(({ key, Icon, cls, iconCls }) => (
            <label key={key} className="relative cursor-pointer">
              <input type="radio" name="decision" value={key} checked={decision === key} onChange={() => setDecision(key)} className="peer sr-only" />
              <span className={cn('flex h-full flex-col gap-1.5 rounded-2xl border border-[hsl(var(--dash-border))] bg-white p-3 transition-all hover:border-[hsl(var(--dash-ink))]/30 peer-focus-visible:ring-2 peer-focus-visible:ring-[hsl(var(--dash-ink))]/20', cls)}>
                <Icon size={22} weight="duotone" className={iconCls} />
                <span className="text-sm font-semibold">{String(t(`academic.app_${key}`, key))}</span>
                <span className="text-[11px] leading-snug text-[hsl(var(--dash-muted))]">{hint[key]}</span>
              </span>
            </label>
          ))}
        </div>
        {needsOverride ? (
          <label className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900">
            <input type="checkbox" className="mt-0.5" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            <span>
              {app.eligible === false
                ? t('academic.override_admission', 'Accept as an exception although mandatory requirements are not all met (the reason is recorded).')
                : t('academic.adm.override_pending', 'Accept now although some mandatory checks are still pending (the reason is recorded).')}
            </span>
          </label>
        ) : null}
        <Field label={t('academic.decision_note', 'Decision note')} required={noteRequired} hint={t('academic.adm.note_hint', 'Kept in the audit trail.')}>
          <textarea className={inputCls} rows={4} value={note} onChange={(e) => setNote(e.target.value)} required={noteRequired} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={(needsOverride && !override) || (noteRequired && !note.trim())} submitLabel={t('academic.adm.save_decision', 'Save decision')} />
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
    <form onSubmit={(e) => run(e, { test_uuid: test, scheduled_at: when || null })} className="space-y-6">
      <FormSection title={t('academic.test', 'Test')} columns={1}>
        <Field label={t('academic.test', 'Test')} required>
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
      </FormSection>
      <SubmitRow saving={saving} disabled={!test} />
    </form>
  )
}

function ResultForm({ attempt, onSubmit }: { attempt: any; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const [score, setScore] = useState('')
  const [absent, setAbsent] = useState(false)
  const { saving, run } = useSubmit(onSubmit)
  return (
    <form onSubmit={(e) => run(e, { score: absent || score === '' ? null : Number(score), absent })} className="space-y-6">
      <FormSection title={attempt?.test_name || t('academic.record_result', 'Record result')} columns={1}>
        <Field label={t('academic.score', 'Score')} hint={attempt ? `${t('academic.pass_at', 'pass')} ${attempt.passing_score}` : undefined}>
          <input type="number" step="0.5" min={0} className={inputCls} value={score} onChange={(e) => setScore(e.target.value)} disabled={absent} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={absent} onChange={(e) => setAbsent(e.target.checked)} />
          {t('academic.absent', 'Absent')}
        </label>
        <p className="text-xs text-[hsl(var(--dash-muted))]">{t('academic.online_test_hint', 'Leave the score empty for an online test to pull the graded result of its linked assignment.')}</p>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

function InterviewForm({ interview, onSubmit }: { interview?: any; onSubmit: (_d: any) => any }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [when, setWhen] = useState(interview?.scheduled_at?.slice(0, 16) || '')
  const [location, setLocation] = useState(interview?.location || '')
  const [panel, setPanel] = useState<{ uuid: string; label: string }[]>((interview?.panel || []).map((u: any) => ({ uuid: u.user_uuid, label: displayName(u) })))
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
    <form onSubmit={(e) => run(e, payload)} className="space-y-6">
      <FormSection title={t('academic.adm.section_when', 'When and where')}>
        <Field label={t('academic.when', 'When')}>
          <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label={t('academic.location_or_link', 'Location / meeting link')}>
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.panel', 'Panel')} description={t('academic.adm.panel_hint', 'Panel members can record their evaluation from My Teaching.')} columns={1}>
        {panel.length ? (
          <div className="flex flex-wrap gap-1.5">
            {panel.map((p) => (
              <button
                type="button"
                key={p.uuid}
                onClick={() => setPanel((prev) => prev.filter((x) => x.uuid !== p.uuid))}
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-canvas))] py-1 pe-2.5 ps-1 text-xs font-medium transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <PersonAvatar name={p.label} size={20} /> {p.label} ×
              </button>
            ))}
          </div>
        ) : null}
        <CoordinatorPicker
          orgId={orgId}
          access_token={access_token}
          value={null}
          onChange={(uuid, label) => uuid && !panel.some((p) => p.uuid === uuid) && setPanel((prev) => [...prev, { uuid, label: label || uuid }])}
        />
      </FormSection>
      {interview ? (
        <FormSection title={t('academic.adm.section_outcome', 'Outcome')}>
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
          <Field label={t('academic.recommendation', 'Recommendation')} required={status === 'completed'} className="sm:col-span-2">
            <select className={inputCls} value={rec} onChange={(e) => setRec(e.target.value)} required={status === 'completed'}>
              <option value="">—</option>
              {['accept', 'waitlist', 'reject'].map((r) => (
                <option key={r} value={r}>
                  {String(t(`academic.rec_${r}`, r))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('academic.notes', 'Notes')} className="sm:col-span-2">
            <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </FormSection>
      ) : null}
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
    <form onSubmit={(e) => run(e, status === 'auto' ? { status: null } : { status, note })} className="space-y-6">
      <FormSection title={t('academic.result', 'Result')} description={check.detail || undefined} columns={1}>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['met', 'not_met', 'pending'] as const).map((s) => {
            const icon = CHECK_ICON[s]
            return (
              <label key={s} className="cursor-pointer">
                <input type="radio" name="check" className="peer sr-only" checked={status === s} onChange={() => setStatus(s)} />
                <span className="flex items-center gap-2 rounded-2xl border border-[hsl(var(--dash-border))] bg-white px-3 py-2.5 text-sm font-medium transition-all peer-checked:border-[hsl(var(--dash-ink))] peer-checked:shadow-[0_0_0_1px_hsl(var(--dash-ink))]">
                  <icon.Icon size={18} weight="fill" className={icon.cls} /> {String(t(`academic.check_${s}`, s.replace('_', ' ')))}
                </span>
              </label>
            )
          })}
        </div>
        {check.overridden ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={status === 'auto'} onChange={(e) => setStatus(e.target.checked ? 'auto' : 'met')} />
            {t('academic.back_to_automatic', 'Back to automatic')}
          </label>
        ) : null}
        {status !== 'auto' ? (
          <Field label={t('academic.reason', 'Reason')} required hint={t('academic.adm.note_hint', 'Kept in the audit trail.')}>
            <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} required />
          </Field>
        ) : null}
      </FormSection>
      <SubmitRow saving={saving} disabled={status !== 'auto' && !note.trim()} />
    </form>
  )
}

export default ApplicationDetail
