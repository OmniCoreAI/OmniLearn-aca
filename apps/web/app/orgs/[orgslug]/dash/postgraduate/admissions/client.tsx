'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Archive,
  ArrowRight,
  ClipboardText,
  FileDashed,
  GraduationCap,
  Hourglass,
  Kanban,
  ListBullets,
  ListChecks,
  Plus,
  SealCheck,
  Student,
  Tray,
} from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicPrimaryButton, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { PostgradDrawer } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { PostgradTabs, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { PersonAvatar, useStoredView } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getPrograms, getProgramCohorts } from '@services/academic/academic'
import { createApplication, displayName, getApplications, stripPrefix } from '@services/academic/core'
import { cn } from '@/lib/utils'

const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'

type StageKey = 'all' | 'new' | 'review' | 'waitlisted' | 'accepted' | 'enrolled' | 'closed' | 'drafts'

/** The admission funnel, in the order an application moves through it. */
const STAGES: { key: StageKey; statuses: string[] | null; labelKey: string; label: string; hintKey: string; hint: string; Icon: React.ElementType }[] = [
  { key: 'all', statuses: null, labelKey: 'academic.adm.stage_all', label: 'All applications', hintKey: 'academic.adm.stage_all_hint', hint: 'Submitted to any intake', Icon: ClipboardText },
  { key: 'new', statuses: ['submitted'], labelKey: 'academic.adm.stage_new', label: 'New', hintKey: 'academic.adm.stage_new_hint', hint: 'Waiting for review', Icon: Tray },
  { key: 'review', statuses: ['under_review'], labelKey: 'academic.adm.stage_review', label: 'In review', hintKey: 'academic.adm.stage_review_hint', hint: 'Checks, tests, interviews', Icon: ListChecks },
  { key: 'waitlisted', statuses: ['waitlisted'], labelKey: 'academic.adm.stage_waitlisted', label: 'Waitlisted', hintKey: 'academic.adm.stage_waitlisted_hint', hint: 'If a seat frees up', Icon: Hourglass },
  { key: 'accepted', statuses: ['accepted'], labelKey: 'academic.adm.stage_accepted', label: 'Offer made', hintKey: 'academic.adm.stage_accepted_hint', hint: 'Ready to enroll', Icon: SealCheck },
  { key: 'enrolled', statuses: ['enrolled'], labelKey: 'academic.adm.stage_enrolled', label: 'Enrolled', hintKey: 'academic.adm.stage_enrolled_hint', hint: 'Now students', Icon: Student },
  { key: 'closed', statuses: ['rejected', 'withdrawn'], labelKey: 'academic.adm.stage_closed', label: 'Closed', hintKey: 'academic.adm.stage_closed_hint', hint: 'Rejected or withdrawn', Icon: Archive },
]
const BOARD: StageKey[] = ['new', 'review', 'waitlisted', 'accepted', 'enrolled']

export function EligibilityBadge({ eligible, pending }: { eligible: boolean | null; pending: number }) {
  const { t } = useTranslation()
  if (eligible === true) return <StatusPill status="met" label={t('academic.eligible', 'Eligible')} />
  if (eligible === false) return <StatusPill status="not_met" label={t('academic.not_eligible', 'Not eligible')} />
  return <StatusPill status="pending" label={t('academic.checks_pending', { count: pending, defaultValue: `${pending} pending` })} />
}

/** What the office does next with an application, in a few words. */
export function useNextStep() {
  const { t } = useTranslation()
  return (a: any): { label: string; urgent: boolean } | null => {
    switch (a.status) {
      case 'draft':
        return { label: t('academic.adm.next_submit', 'Complete and submit'), urgent: false }
      case 'submitted':
        return { label: t('academic.office.action_review', 'Start review'), urgent: true }
      case 'under_review':
        if (a.eligible === true) return { label: t('academic.adm.next_decide', 'Ready for a decision'), urgent: true }
        if (a.eligible === false) return { label: t('academic.adm.next_not_met', 'Requirements not met'), urgent: true }
        return { label: t('academic.adm.next_checks', '{{count}} checks to complete', { count: a.pending_checks }), urgent: false }
      case 'waitlisted':
        return { label: t('academic.adm.next_waitlist', 'Decide when a seat frees up'), urgent: false }
      case 'accepted':
        return { label: t('academic.adm.next_enroll', 'Enroll as student'), urgent: true }
      default:
        return null
    }
  }
}

function useRelative() {
  const { i18n } = useTranslation()
  return (value?: string | null) => {
    if (!value) return ''
    const then = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
    if (Number.isNaN(then.getTime())) return ''
    const days = Math.round((then.getTime() - Date.now()) / 86_400_000)
    return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }).format(days, 'day')
  }
}

const hrefOf = (orgslug: string, a: any) => getUriWithOrg(orgslug, `/dash/postgraduate/admissions/${stripPrefix(a.application_uuid, 'application')}`)

function StageStrip({ counts, value, onChange }: { counts: Record<string, number>; value: StageKey; onChange: (_v: StageKey) => void }) {
  const { t } = useTranslation()
  return (
    <div className="dash-card mb-5 grid grid-cols-2 gap-1 rounded-[1.25rem] p-1.5 sm:grid-cols-4 xl:grid-cols-7" role="tablist" aria-label={t('academic.adm.stages', 'Admission stages')}>
      {STAGES.map(({ key, labelKey, label, hintKey, hint, Icon }) => {
        const active = value === key
        const n = counts[key] || 0
        const urgent = (key === 'new' || key === 'accepted') && n > 0
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'group flex min-w-0 items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-start transition-all duration-200',
              active ? 'bg-[hsl(var(--dash-ink))] text-white shadow-[0_10px_24px_-12px_hsl(0_0%_8%/0.6)]' : 'hover:bg-[hsl(var(--dash-canvas))]'
            )}
          >
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                active
                  ? 'bg-white/10 text-[hsl(43_80%_62%)]'
                  : urgent
                    ? `${GOLD} text-[hsl(var(--dash-ink))]`
                    : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))] group-hover:bg-white group-hover:text-[hsl(var(--dash-ink))]'
              )}
            >
              <Icon size={18} weight={active ? 'fill' : 'duotone'} />
            </span>
            <span className="min-w-0">
              <span className={cn('block truncate text-[11px] font-medium', active ? 'text-white/70' : 'text-[hsl(var(--dash-muted))]')}>{t(labelKey, label)}</span>
              <span className="block text-lg font-semibold leading-tight tabular-nums">{n}</span>
              <span className={cn('block truncate text-[10px]', active ? 'text-white/55' : 'text-[hsl(var(--dash-muted))]')}>{t(hintKey, hint)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ApplicantCell({ a }: { a: any }) {
  const name = displayName(a.applicant)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={name} size={34} />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-medium">{name}</div>
        <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{a.applicant?.email || (a.applicant?.username ? `@${a.applicant.username}` : '')}</div>
      </div>
    </div>
  )
}

function PipelineBoard({ apps, orgslug }: { apps: any[]; orgslug: string }) {
  const { t } = useTranslation()
  const next = useNextStep()
  const relative = useRelative()
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {BOARD.map((key) => {
        const stage = STAGES.find((s) => s.key === key)!
        const items = apps.filter((a) => stage.statuses!.includes(a.status))
        return (
          <div key={key} className="flex min-h-[220px] flex-col rounded-[1.25rem] bg-[hsl(var(--dash-ink))]/[0.03] p-2">
            <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
              <stage.Icon size={15} weight="duotone" className="text-[hsl(var(--dash-muted))]" />
              <span className="text-sm font-semibold">{t(stage.labelKey, stage.label)}</span>
              <span className="ms-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[hsl(var(--dash-muted))] shadow-sm">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((a) => {
                const step = next(a)
                return (
                  <Link
                    key={a.application_uuid}
                    href={hrefOf(orgslug, a)}
                    className="group block rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-3 shadow-[0_1px_2px_hsl(220_30%_20%/0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(220_30%_20%/0.35)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar name={displayName(a.applicant)} size={30} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{displayName(a.applicant)}</p>
                        <p className="truncate font-mono text-[10px] text-[hsl(var(--dash-muted))]">{a.application_number}</p>
                      </div>
                    </div>
                    <p className="mt-2 truncate text-[11.5px] text-[hsl(var(--dash-ink))]/75">{a.program_name}</p>
                    <p className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                      {[a.cohort_code || a.cohort_name, relative(a.submitted_at)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {['submitted', 'under_review', 'waitlisted'].includes(a.status) ? <EligibilityBadge eligible={a.eligible} pending={a.pending_checks} /> : <span />}
                      {step?.urgent ? <span className={cn('h-2 w-2 shrink-0 rounded-full', GOLD)} title={step.label} /> : null}
                    </div>
                    {step ? (
                      <p className={cn('mt-2 border-t border-[hsl(var(--dash-border))]/60 pt-2 text-[11px] font-semibold', step.urgent ? 'text-[hsl(var(--dash-accent))]' : 'text-[hsl(var(--dash-muted))]')}>
                        {step.label} →
                      </p>
                    ) : null}
                  </Link>
                )
              })}
              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-3 py-6 text-center text-xs text-[hsl(var(--dash-muted))]">
                  {t('training.column_empty', 'Nothing here')}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AdmissionsList({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const next = useNextStep()
  const relative = useRelative()
  const [program, setProgram] = useState('')
  const [intake, setIntake] = useState('')
  const [stage, setStage] = useState<StageKey>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [view, setView] = useStoredView<'list' | 'board'>('postgrad-admissions-view', 'list')

  const { data: programs = [] } = useQuery({
    queryKey: ['academic', 'programs', orgId],
    queryFn: () => getPrograms(orgId, access_token),
    enabled: ready,
  })
  const { data: cohorts = [] } = useQuery({
    queryKey: ['academic', 'cohorts', program],
    queryFn: () => getProgramCohorts(program, access_token),
    enabled: !!program && !!access_token,
  })
  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ['academic', 'applications', orgId, program],
    queryFn: () => getApplications(orgId, access_token, { program_uuid: program || undefined }),
    enabled: ready,
    retry: false,
  })
  const { data: drafts = [] } = useQuery({
    queryKey: ['academic', 'applications', orgId, program, 'draft'],
    queryFn: () => getApplications(orgId, access_token, { program_uuid: program || undefined, status: 'draft' }),
    enabled: ready,
    retry: false,
  })

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const source = (stage === 'drafts' ? drafts : applications) as any[]
    return source.filter(
      (a) =>
        (!intake || a.cohort_uuid === intake) &&
        (!q || `${displayName(a.applicant)} ${a.applicant?.email || ''} ${a.application_number}`.toLowerCase().includes(q))
    )
  }, [applications, drafts, stage, intake, query])
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    const base = (applications as any[]).filter((a) => !intake || a.cohort_uuid === intake)
    for (const s of STAGES) out[s.key] = s.statuses ? base.filter((a) => s.statuses!.includes(a.status)).length : base.length
    return out
  }, [applications, intake])
  const stageDef = STAGES.find((s) => s.key === stage)
  const visible = stage === 'drafts' || !stageDef?.statuses ? scoped : scoped.filter((a) => stageDef.statuses!.includes(a.status))
  const filtering = !!query || !!program || !!intake || stage !== 'all'

  const newButton = (
    <AcademicPrimaryButton onClick={() => setOpen(true)}>
      <Plus size={16} weight="bold" /> {t('academic.new_application', 'New application')}
    </AcademicPrimaryButton>
  )

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_admissions', 'Admissions') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_admissions', 'Admissions')}
        subtitle={t('academic.admissions_desc', 'Applications to program intakes: document verification, eligibility, entrance tests, interviews and decisions.')}
        action={newButton}
      />
      <PostgradTabs orgslug={orgslug} />

      <StageStrip counts={counts} value={stage === 'drafts' ? 'all' : stage} onChange={setStage} />

      <div className="dash-card mb-5 flex flex-wrap items-center gap-2 rounded-[1.25rem] px-4 py-3">
        <ToolbarSearch value={query} onChange={setQuery} placeholder={t('academic.search_applications', 'Name, email or application no.')} className="min-w-[220px] flex-1 sm:max-w-sm" />
        <ToolbarSelect
          label={t('academic.program')}
          value={program || 'all'}
          onChange={(v) => {
            setProgram(v === 'all' ? '' : v)
            setIntake('')
          }}
          options={[{ value: 'all', label: t('academic.all_programs', 'All programs') }, ...(programs as any[]).map((p) => ({ value: p.program_uuid, label: p.code ? `${p.code} · ${p.name}` : p.name }))]}
        />
        {program ? (
          <ToolbarSelect
            label={t('academic.intake', 'Intake')}
            value={intake || 'all'}
            onChange={(v) => setIntake(v === 'all' ? '' : v)}
            options={[{ value: 'all', label: t('academic.adm.all_intakes', 'All intakes') }, ...(cohorts as any[]).map((c) => ({ value: c.cohort_uuid, label: c.code || c.name }))]}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setStage(stage === 'drafts' ? 'all' : 'drafts')}
          aria-pressed={stage === 'drafts'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            stage === 'drafts' ? 'bg-[hsl(var(--dash-ink))] text-white' : 'border border-[hsl(var(--dash-border))] bg-white text-[hsl(var(--dash-ink))]/75 hover:text-[hsl(var(--dash-ink))]'
          )}
          title={t('academic.adm.drafts_hint', 'Started but not yet submitted by the applicant')}
        >
          <FileDashed size={14} weight="duotone" /> {t('academic.adm.drafts', 'Drafts')}
          <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', stage === 'drafts' ? 'bg-white/15' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>
            {(drafts as any[]).length}
          </span>
        </button>
        <div className={cn(TAB_TRACK, 'ms-auto p-0.5 shadow-none')} role="tablist" aria-label={t('administration.common.view', 'View')}>
          {(
            [
              { key: 'list', label: t('postgrad.view_list', 'List'), Icon: ListBullets },
              { key: 'board', label: t('academic.adm.view_pipeline', 'Pipeline'), Icon: Kanban },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={tabItemClass(view === key, 'inline-flex items-center gap-1.5 px-3 py-1 text-xs')}>
              <Icon size={14} weight={view === key ? 'fill' : 'regular'} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="dash-card rounded-[1.25rem] p-6 text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>
      ) : view === 'board' && stage !== 'drafts' ? (
        <PipelineBoard apps={scoped} orgslug={orgslug} />
      ) : (
        <DashDataTable
          rows={visible}
          rowKey={(a: any) => a.application_uuid}
          rowHref={(a: any) => hrefOf(orgslug, a)}
          loading={isLoading}
          initialSort={{ key: 'submitted', dir: 'desc' }}
          itemLabel={(n) => t('academic.adm.count', '{{count}} applications', { count: n })}
          empty={
            <AcademicEmptyState
              compact
              icon={<ClipboardText size={24} />}
              title={filtering ? t('administration.common.no_matches', 'No matches') : t('academic.no_applications', 'No applications yet.')}
              description={
                filtering
                  ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                  : t('academic.adm.empty_hint', 'Applications arrive when an intake is open for admission. You can also create one on behalf of an applicant.')
              }
              action={filtering ? undefined : newButton}
            />
          }
          columns={[
            { key: 'applicant', header: t('academic.applicant', 'Applicant'), primary: true, sortValue: (a: any) => displayName(a.applicant), cell: (a: any) => <ApplicantCell a={a} /> },
            {
              key: 'number',
              header: t('academic.application_no', 'Application no.'),
              sortValue: (a: any) => a.application_number,
              cell: (a: any) => <span className="whitespace-nowrap font-mono text-[11.5px]">{a.application_number}</span>,
            },
            {
              key: 'program',
              header: t('academic.program'),
              sortValue: (a: any) => a.program_name,
              cell: (a: any) => (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[13px]">{a.program_name}</div>
                  <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{a.cohort_code || a.cohort_name}</div>
                </div>
              ),
            },
            {
              key: 'submitted',
              header: t('academic.submitted_at', 'Submitted'),
              hideBelow: 'lg',
              sortValue: (a: any) => a.submitted_at || a.creation_date,
              cell: (a: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{relative(a.submitted_at) || '—'}</span>,
            },
            {
              key: 'eligibility',
              header: t('academic.eligibility', 'Eligibility'),
              hideBelow: 'lg',
              sortValue: (a: any) => (a.eligible === true ? 0 : a.eligible === false ? 2 : 1),
              cell: (a: any) => <EligibilityBadge eligible={a.eligible} pending={a.pending_checks} />,
            },
            {
              key: 'status',
              header: t('academic.status'),
              sortValue: (a: any) => a.status,
              cell: (a: any) => <StatusPill status={a.status} label={String(t(`academic.app_${a.status}`, a.status))} />,
            },
            {
              key: 'next',
              header: t('academic.adm.next_step', 'Next step'),
              hideBelow: 'xl',
              hideOnMobile: true,
              cell: (a: any) => {
                const step = next(a)
                return step ? (
                  <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold', step.urgent ? 'text-[hsl(var(--dash-accent))]' : 'text-[hsl(var(--dash-muted))]')}>
                    {step.label}
                    {step.urgent ? <ArrowRight size={12} weight="bold" className="rtl:rotate-180" /> : null}
                  </span>
                ) : (
                  <span className="text-[hsl(var(--dash-muted))]">—</span>
                )
              },
            },
          ]}
        />
      )}

      <PostgradDrawer
        isDialogOpen={open}
        onOpenChange={setOpen}
        icon={<ClipboardText size={20} weight="duotone" />}
        dialogTitle={t('academic.new_application', 'New application')}
        dialogDescription={t('academic.new_application_hint', 'Creates a draft on behalf of the applicant. Complete the academic background, then submit it.')}
        dialogContent={<NewApplicationForm orgslug={orgslug} programs={programs} onDone={() => setOpen(false)} />}
      />
    </AcademicPageShell>
  )
}

function NewApplicationForm({ orgslug, programs, onDone }: { orgslug: string; programs: any[]; onDone: () => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { orgId, access_token } = useAcademicContext()
  const [program, setProgram] = useState('')
  const [cohort, setCohort] = useState('')
  const [applicant, setApplicant] = useState<string | null>(null)
  const [label, setLabel] = useState<string | undefined>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const { data: cohorts = [] } = useQuery({
    queryKey: ['academic', 'cohorts', program],
    queryFn: () => getProgramCohorts(program, access_token),
    enabled: !!program && !!access_token,
  })
  const openCohorts = (cohorts as any[]).filter((c) => c.admission_status === 'open')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const required = String(t('administration.validation.required', 'Required'))
    const next: Record<string, string> = {}
    if (!program) next.program = required
    if (!cohort) next.cohort = required
    if (!applicant) next.applicant = required
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const app = await createApplication({ cohort_uuid: cohort, applicant_uuid: applicant }, access_token)
      toast.success(t('academic.created'))
      onDone()
      router.push(hrefOf(orgslug, app))
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('academic.adm.where', 'Program and intake')} columns={1}>
        <Field label={t('academic.program')} required error={errors.program}>
          <select
            className={inputCls}
            value={program}
            aria-invalid={!!errors.program}
            onChange={(e) => {
              setProgram(e.target.value)
              setCohort('')
            }}
          >
            <option value="">—</option>
            {programs.map((p: any) => (
              <option key={p.program_uuid} value={p.program_uuid}>
                {p.code ? `${p.code} · ` : ''}
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('academic.intake', 'Intake')}
          required
          error={errors.cohort}
          hint={program && openCohorts.length === 0 ? t('academic.adm.no_open_intake', 'No intake of this program is open for admission. Open one from the program page.') : undefined}
        >
          <select className={inputCls} value={cohort} onChange={(e) => setCohort(e.target.value)} disabled={!program} aria-invalid={!!errors.cohort}>
            <option value="">—</option>
            {(cohorts as any[]).map((c) => (
              <option key={c.cohort_uuid} value={c.cohort_uuid} disabled={c.admission_status !== 'open'}>
                {c.code || c.name}
                {c.admission_status === 'open' ? '' : ` (${t('academic.admissions_closed', 'admissions closed')})`}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>
      <FormSection title={t('academic.applicant', 'Applicant')} columns={1}>
        <Field label={t('academic.adm.applicant_account', 'Applicant account')} required error={errors.applicant} hint={t('academic.adm.applicant_hint', 'Search trainees by name or email.')}>
          <CoordinatorPicker
            orgId={orgId}
            access_token={access_token}
            value={applicant}
            selectedLabel={label}
            onlyRoles={['role_global_user']}
            placeholder={t('academic.search_students', 'Search trainees…')}
            onChange={(uuid, l) => {
              setApplicant(uuid)
              setLabel(l)
            }}
          />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} submitLabel={t('academic.adm.create_draft', 'Create draft')} />
    </form>
  )
}

export default AdmissionsList
