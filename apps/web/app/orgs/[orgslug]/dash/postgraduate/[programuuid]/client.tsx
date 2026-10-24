'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Buildings,
  CalendarDots,
  Check,
  ClockCountdown,
  Coins,
  Copy,
  GraduationCap,
  ListChecks,
  NotePencil,
  Plus,
  SquaresFour,
  Student,
  UsersThree,
} from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { AdmissionSettings } from '@components/Dashboard/Pages/Academic/AdmissionSettings'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, PostgradTabs, Section, Stat, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { ProgramForm } from '@components/Dashboard/Pages/Academic/ProgramForm'
import { ProgramCover, levelStyle } from '@components/Dashboard/Pages/Academic/ProgramVisuals'
import { AdminDrawer, PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import { RowActionsMenu } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { Switch } from '@components/ui/switch'
import { getProgram, getProgramCohorts, createCohort, updateCohort, deleteCohort } from '@services/academic/academic'
import { cloneCurriculum, createCurriculum, displayName, getAdmissionRequirements, getProgramCurricula, getTerms, stripPrefix } from '@services/academic/core'
import { cn } from '@/lib/utils'

const COHORT_STATUSES = ['upcoming', 'active', 'completed', 'archived']
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'
type Tab = 'overview' | 'curriculum' | 'intakes' | 'admission'

function ProgramDetail({ orgslug, programuuid }: { orgslug: string; programuuid: string }) {
  const { t } = useTranslation()
  const { org, orgId, access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const program_uuid = `program_${programuuid}`
  const [tab, setTab] = useState<Tab>('overview')
  const [cohortDrawer, setCohortDrawer] = useState<null | { cohort: any | null }>(null)
  const [curriculumDrawer, setCurriculumDrawer] = useState<null | { cloneFrom?: any }>(null)
  const [editingProgram, setEditingProgram] = useState(false)

  const { data: program, error } = useQuery({
    queryKey: ['academic', 'program', program_uuid],
    queryFn: () => getProgram(program_uuid, access_token),
    enabled: !!access_token,
    retry: false,
  })
  const { data: cohorts = [], isLoading: loadingCohorts } = useQuery({
    queryKey: ['academic', 'cohorts', program_uuid],
    queryFn: () => getProgramCohorts(program_uuid, access_token),
    enabled: !!access_token,
    staleTime: 30_000,
  })
  const { data: curricula = [] } = useQuery({
    queryKey: ['academic', 'curricula', program_uuid],
    queryFn: () => getProgramCurricula(program_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: requirements = [] } = useQuery({
    queryKey: ['academic', 'admission-requirements', program_uuid],
    queryFn: () => getAdmissionRequirements(program_uuid, access_token),
    enabled: !!access_token,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohorts', program_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'curricula', program_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'program', program_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'programs'] })
  }
  const allCohorts = cohorts as any[]
  const allCurricula = curricula as any[]
  const activeCurriculum = allCurricula.find((c) => c.status === 'active')
  const students = allCohorts.reduce((n, c) => n + (c.enrolled_count || 0), 0)
  const openIntakes = allCohorts.filter((c) => c.admission_status === 'open')

  const toggleAdmissions = async (c: any, open: boolean) => {
    try {
      await updateCohort(c.cohort_uuid, { admission_status: open ? 'open' : 'closed' }, access_token)
      toast.success(open ? t('academic.prog.admissions_opened', 'Admissions opened for {{code}}', { code: c.code || c.name }) : t('academic.prog.admissions_closed', 'Admissions closed for {{code}}', { code: c.code || c.name }))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }
  const removeCohort = async (c: any) => {
    const ok = await ask({
      title: t('academic.prog.delete_intake_title', 'Delete {{code}}?', { code: c.code || c.name }),
      message: t('academic.confirm_delete_cohort', 'Delete this cohort? Deletion is only possible while it has no official results or admission decisions; otherwise archive it.'),
      confirmText: t('academic.delete', 'Delete'),
      tone: 'danger',
    })
    if (ok === null) return
    try {
      await deleteCohort(c.cohort_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  if (error)
    return (
      <AcademicPageShell>
        <p className="dash-card rounded-[1.25rem] p-6 text-sm">{(error as any)?.message}</p>
      </AcademicPageShell>
    )

  const steps: { key: string; label: string; hint: string; done: boolean; go: Tab; optional?: boolean }[] = [
    { key: 'curriculum', label: t('academic.office.setup_curriculum', 'Active curriculum'), hint: activeCurriculum ? `${t('academic.version', 'Version')} ${activeCurriculum.version}` : t('academic.prog.step_curriculum', 'Define the study plan'), done: !!activeCurriculum, go: 'curriculum' },
    { key: 'intake', label: t('academic.office.setup_intake', 'Intakes'), hint: allCohorts.length ? t('academic.prog.n_intakes', '{{count}} intakes', { count: allCohorts.length }) : t('academic.prog.step_intake', 'Create the first cohort'), done: allCohorts.length > 0, go: 'intakes' },
    { key: 'rules', label: t('academic.admission_requirements', 'Admission requirements'), hint: (requirements as any[]).length ? t('academic.prog.n_rules', '{{count}} rules', { count: (requirements as any[]).length }) : t('academic.prog.step_rules', 'Recommended'), done: (requirements as any[]).length > 0, go: 'admission', optional: true },
    { key: 'admissions', label: t('academic.office.setup_admissions', 'Open admissions'), hint: openIntakes.length ? openIntakes.map((c) => c.code || c.name).join(', ') : t('academic.prog.step_open', 'Open an intake to applicants'), done: openIntakes.length > 0, go: 'intakes' },
    { key: 'students', label: t('academic.tab_students', 'Students'), hint: students ? t('academic.prog.n_students', '{{count}} enrolled', { count: students }) : t('academic.prog.step_students', 'Enroll admitted applicants'), done: students > 0, go: 'intakes' },
  ]
  const nextStep = steps.find((s) => !s.done && !s.optional)
  const style = levelStyle(program?.program_level)
  const tabs: { key: Tab; label: string; count?: number; Icon: React.ElementType }[] = [
    { key: 'overview', label: t('academic.nav.overview', 'Overview'), Icon: SquaresFour },
    { key: 'curriculum', label: t('academic.curricula', 'Curricula'), count: allCurricula.length, Icon: ListChecks },
    { key: 'intakes', label: t('academic.prog.intakes', 'Intakes'), count: allCohorts.length, Icon: UsersThree },
    { key: 'admission', label: t('academic.prog.admission_rules', 'Admission rules'), count: (requirements as any[]).length, Icon: ListChecks },
  ]

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: program?.name || t('academic.program') },
        ]}
      />
      <PostgradTabs orgslug={orgslug} />

      {/* Hero */}
      {program ? (
        <section className="relative mb-4 mt-2 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,hsl(0_0%_12%),hsl(0_0%_5%))] text-white">
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.5)] to-transparent" />
          <div className="relative grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
                  <style.Icon size={13} weight="bold" style={{ color: style.dot }} /> {t(`academic.level_${program.program_level}`, program.program_level)}
                </span>
                <StatusPill status={program.status} label={String(t(`academic.pstatus_${program.status}`, program.status))} className="bg-white/95" />
                {program.code ? <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">{program.code}</span> : null}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[1.9rem]">{program.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-white/65">
                {[program.faculty, program.department].filter(Boolean).length ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Buildings size={15} /> {[program.faculty, program.department].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
                {program.duration_months ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ClockCountdown size={15} /> {t('postgrad.months', '{{count}} months', { count: program.duration_months })}
                  </span>
                ) : null}
                {program.coordinator ? (
                  <span className="inline-flex items-center gap-1.5">
                    <PersonAvatar name={displayName(program.coordinator)} size={18} /> {displayName(program.coordinator)}
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
                  <button
                    type="button"
                    onClick={() => setEditingProgram(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-[hsl(43_80%_56%)] px-5 py-2.5 text-sm font-semibold text-[hsl(0_0%_8%)] shadow-[0_8px_24px_-10px_hsl(43_80%_50%/0.7)] transition-all hover:-translate-y-0.5"
                  >
                    <NotePencil size={16} weight="bold" /> {t('academic.prog.edit_program', 'Edit program')}
                  </button>
                </AuthenticatedClientElement>
                <Link
                  href={getUriWithOrg(orgslug, `/dash/postgraduate/admissions`)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
                >
                  {t('academic.tab_admissions', 'Admissions')} <ArrowRight size={14} className="rtl:rotate-180" />
                </Link>
              </div>
            </div>
            <ProgramCover p={program} orgUuid={org?.org_uuid} iconSize={96} className="hidden aspect-[4/3] rounded-2xl ring-1 ring-white/10 lg:block" />
          </div>
        </section>
      ) : (
        <div className="dash-shimmer mb-4 mt-2 h-56 rounded-[1.5rem]" />
      )}

      {/* Readiness */}
      <section className="dash-card mb-5 rounded-[1.25rem] p-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
          <p className="text-[13px] font-semibold">
            {nextStep ? t('academic.prog.readiness', 'Getting this program ready') : t('academic.prog.ready', 'Ready — applicants can apply and students are enrolled')}
          </p>
          <span className="text-xs font-semibold tabular-nums text-[hsl(var(--dash-muted))]">
            {t('academic.office.setup_progress', '{{done}} of {{total}}', { done: steps.filter((s) => s.done).length, total: steps.length })}
          </span>
        </div>
        <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, i) => {
            const isNext = nextStep?.key === step.key
            return (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => setTab(step.go)}
                  className={cn('flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-start transition-colors hover:bg-[hsl(var(--dash-canvas))]', isNext && 'bg-[hsl(var(--dash-accent-soft))]/60')}
                >
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      step.done ? 'bg-emerald-500 text-white' : isNext ? `${GOLD} text-[hsl(var(--dash-ink))]` : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
                    )}
                  >
                    {step.done ? <Check size={14} weight="bold" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">{step.label}</span>
                    <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">{step.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <div className={cn(TAB_TRACK, 'mb-5')} role="tablist">
        {tabs.map(({ key, label, count, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tabItemClass(tab === key, 'inline-flex items-center gap-1.5')}>
            <Icon size={15} weight={tab === key ? 'fill' : 'duotone'} />
            {label}
            {count != null ? <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', tab === key ? 'bg-white/15' : 'bg-[hsl(var(--dash-canvas))]')}>{count}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && program ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Section title={t('academic.prog.at_a_glance', 'At a glance')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat icon={<ClockCountdown size={13} />} label={t('postgrad.duration', 'Duration')} value={program.duration_months ? t('postgrad.months', '{{count}} months', { count: program.duration_months }) : null} hint={program.max_duration_months ? t('postgrad.max_short', 'max {{count}}', { count: program.max_duration_months }) : undefined} />
              <Stat icon={<ListChecks size={13} />} label={t('academic.min_credits', 'Minimum credits')} value={program.min_credits} />
              <Stat icon={<UsersThree size={13} />} label={t('academic.capacity', 'Capacity')} value={program.capacity ?? t('training.open_seats', 'Open seats')} />
              <Stat icon={<Coins size={13} />} label={t('postgrad.fee', 'Fee')} value={program.is_paid && program.price != null ? `${Number(program.price).toLocaleString()} ${program.currency || ''}` : t('academic.free', 'Free')} />
              <Stat icon={<Student size={13} />} label={t('academic.tab_students', 'Students')} value={students} hint={t('academic.prog.n_intakes', '{{count}} intakes', { count: allCohorts.length })} />
              <Stat icon={<CalendarDots size={13} />} label={t('academic.office.setup_admissions', 'Open admissions')} value={openIntakes.length ? openIntakes.map((c) => c.code || c.name).join(', ') : t('academic.prog.none_open', 'None open')} />
            </div>
            {program.description ? <p className="mt-4 whitespace-pre-line text-[13.5px] leading-relaxed text-[hsl(var(--dash-ink))]/80">{program.description}</p> : null}
          </Section>
          <Section title={t('academic.office.setup_curriculum', 'Active curriculum')} action={<GhostButton onClick={() => setTab('curriculum')}>{t('academic.prog.manage', 'Manage')}</GhostButton>}>
            {activeCurriculum ? (
              <CurriculumSummary c={activeCurriculum} />
            ) : (
              <p className="text-sm text-[hsl(var(--dash-muted))]">{t('academic.prog.no_active_curriculum', 'No active curriculum yet. Create a version, add its courses, then activate it.')}</p>
            )}
          </Section>
        </div>
      ) : null}

      {tab === 'curriculum' ? (
        <Section
          icon={<ListChecks size={18} weight="duotone" />}
          title={t('academic.curricula', 'Curricula')}
          count={allCurricula.length}
          description={t('academic.curricula_desc', 'Versioned study plans. Each cohort follows one version, so changing the plan for a new intake never rewrites older cohorts.')}
          action={
            <GhostButton onClick={() => setCurriculumDrawer({})}>
              <Plus size={14} /> {t('academic.new_curriculum', 'New version')}
            </GhostButton>
          }
        >
          {allCurricula.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-10 text-center">
              <p className="text-sm font-medium">{t('academic.no_curricula', 'No curriculum yet — create version 1 to define the study plan.')}</p>
              <button type="button" onClick={() => setCurriculumDrawer({})} className={cn('mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))]', GOLD)}>
                <Plus size={14} weight="bold" /> {t('academic.new_curriculum', 'New version')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {allCurricula.map((c) => (
                <div key={c.curriculum_uuid} className={cn('group rounded-2xl border bg-white p-4 transition-shadow hover:shadow-[0_12px_28px_-18px_hsl(220_30%_20%/0.45)]', c.status === 'active' ? 'border-emerald-200' : 'border-[hsl(var(--dash-border))]/70')}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}/curriculum/${stripPrefix(c.curriculum_uuid, 'curriculum')}`)} className="min-w-0">
                      <p className="text-lg font-semibold tabular-nums hover:text-[hsl(var(--dash-accent))]">{c.version}</p>
                      <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">{c.name || ' '}</p>
                    </Link>
                    <StatusPill status={c.status} />
                  </div>
                  <CurriculumSummary c={c} compact />
                  <div className="mt-3 flex items-center gap-2 border-t border-[hsl(var(--dash-border))]/60 pt-3">
                    <span className="text-[11.5px] text-[hsl(var(--dash-muted))]">{t('academic.prog.used_by', 'Used by {{count}} intakes', { count: c.cohort_count })}</span>
                    <button type="button" onClick={() => setCurriculumDrawer({ cloneFrom: c })} className="ms-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[hsl(var(--dash-ink))]/70 hover:bg-[hsl(var(--dash-canvas))]">
                      <Copy size={13} /> {t('academic.clone_version', 'Clone')}
                    </button>
                    <Link href={getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}/curriculum/${stripPrefix(c.curriculum_uuid, 'curriculum')}`)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]">
                      {t('academic.open', 'Open')} <ArrowRight size={12} className="rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {tab === 'intakes' ? (
        <Section
          icon={<UsersThree size={18} weight="duotone" />}
          title={t('academic.prog.intakes', 'Intakes')}
          count={allCohorts.length}
          description={t('academic.cohorts_desc', 'Intakes of this program. Each cohort follows one curriculum version.')}
          action={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <GhostButton onClick={() => setCohortDrawer({ cohort: null })}>
                <Plus size={14} /> {t('academic.new_cohort')}
              </GhostButton>
            </AuthenticatedClientElement>
          }
        >
          {loadingCohorts ? (
            <div className="dash-shimmer h-40 rounded-2xl" />
          ) : allCohorts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-10 text-center">
              <p className="text-sm font-medium">{t('academic.no_cohorts')}</p>
              <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">{t('academic.no_cohorts_desc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {allCohorts.map((c) => {
                const href = getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}/cohort/${stripPrefix(c.cohort_uuid, 'cohort')}`)
                const fill = c.capacity ? Math.min(100, Math.round(((c.enrolled_count || 0) / c.capacity) * 100)) : null
                return (
                  <div key={c.cohort_uuid} className="group relative flex flex-col rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white p-4 transition-shadow hover:shadow-[0_12px_28px_-18px_hsl(220_30%_20%/0.45)]">
                    <div className="absolute end-2 top-2">
                      <RowActionsMenu
                        label={t('administration.table.actions', 'Actions')}
                        actions={[
                          { label: t('academic.open', 'Open'), href },
                          { label: t('academic.edit', 'Edit'), onSelect: () => setCohortDrawer({ cohort: c }) },
                          { label: t('academic.delete', 'Delete'), tone: 'danger', onSelect: () => removeCohort(c) },
                        ]}
                      />
                    </div>
                    <Link href={href} className="block pe-8">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.code ? <span className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{c.code}</span> : null}
                        <StatusPill status={c.status} label={String(t(`academic.status_${c.status}`, c.status))} />
                      </div>
                      <p className="mt-2 truncate text-[15px] font-semibold group-hover:text-[hsl(var(--dash-accent))]">{c.name}</p>
                      <p className="truncate text-[12px] text-[hsl(var(--dash-muted))]">
                        {[c.intake_term_code, c.academic_year, c.curriculum_version && `${t('academic.curriculum', 'Curriculum')} ${c.curriculum_version}`].filter(Boolean).join(' · ') || ' '}
                      </p>
                    </Link>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[hsl(var(--dash-muted))]">{t('academic.tab_students', 'Students')}</span>
                        <span className="font-semibold tabular-nums">
                          {c.enrolled_count ?? 0}
                          {c.capacity != null ? <span className="font-normal text-[hsl(var(--dash-muted))]"> / {c.capacity}</span> : null}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
                        <div className={cn('h-full rounded-full', fill != null && fill >= 100 ? 'bg-red-400' : GOLD)} style={{ width: `${fill ?? (c.enrolled_count ? 100 : 0)}%` }} />
                      </div>
                    </div>
                    <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 rounded-xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium">{c.admission_status === 'open' ? t('academic.admissions_open', 'Admissions open') : t('academic.prog.admissions_closed_label', 'Admissions closed')}</span>
                        <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">
                          {c.admission_status === 'open' ? t('academic.prog.accepting', 'Accepting applications') : t('academic.prog.not_accepting', 'Not accepting applications')}
                        </span>
                      </span>
                      <Switch
                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-[hsl(var(--dash-border))]"
                        checked={c.admission_status === 'open'}
                        onCheckedChange={(v) => toggleAdmissions(c, v)}
                      />
                    </label>
                    {c.coordinator ? (
                      <div className="mt-3 flex items-center gap-2 text-[12px] text-[hsl(var(--dash-ink))]/75">
                        <PersonAvatar name={displayName(c.coordinator)} size={20} /> {displayName(c.coordinator)}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      ) : null}

      {tab === 'admission' ? <AdmissionSettings programUuid={program_uuid} /> : null}

      <PostgradDrawer
        isDialogOpen={!!cohortDrawer}
        onOpenChange={(open: boolean) => !open && setCohortDrawer(null)}
        minWidth="md"
        icon={<UsersThree size={20} weight="duotone" />}
        dialogTitle={cohortDrawer?.cohort ? `${t('academic.edit', 'Edit')} ${cohortDrawer.cohort.code || cohortDrawer.cohort.name}` : t('academic.create_cohort')}
        dialogDescription={t('academic.prog.cohort_form_desc', 'An intake of {{program}}: when it starts, which study plan it follows and whether it accepts applications.', { program: program?.name || '' })}
        dialogContent={
          <CohortForm
            programUuid={program_uuid}
            programCode={program?.code}
            curricula={allCurricula}
            cohort={cohortDrawer?.cohort}
            onDone={() => {
              setCohortDrawer(null)
              refresh()
            }}
          />
        }
      />
      <PostgradDrawer
        isDialogOpen={!!curriculumDrawer}
        onOpenChange={(open: boolean) => !open && setCurriculumDrawer(null)}
        icon={<ListChecks size={20} weight="duotone" />}
        dialogTitle={curriculumDrawer?.cloneFrom ? t('academic.clone_curriculum', 'Clone curriculum {{version}}', { version: curriculumDrawer.cloneFrom.version }) : t('academic.new_curriculum', 'New version')}
        dialogContent={
          <CurriculumForm
            programUuid={program_uuid}
            cloneFrom={curriculumDrawer?.cloneFrom}
            onDone={() => {
              setCurriculumDrawer(null)
              refresh()
            }}
          />
        }
      />
      <AdminDrawer
        open={editingProgram}
        onOpenChange={setEditingProgram}
        width="sm:max-w-[680px]"
        icon={<GraduationCap size={20} weight="duotone" />}
        title={`${t('administration.common.edit', 'Edit')} ${program?.name || ''}`}
        description={t('postgrad.form_desc', 'Define the degree, its structure and intake, then activate and publish it when applications open.')}
      >
        {editingProgram && program ? (
          <ProgramForm
            orgId={orgId!}
            orgUuid={org?.org_uuid}
            access_token={access_token}
            program={program}
            onCancel={() => setEditingProgram(false)}
            onDone={() => {
              setEditingProgram(false)
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </AcademicPageShell>
  )
}

/** Courses and credits of a curriculum version, with the required/elective split. */
function CurriculumSummary({ c, compact = false }: { c: any; compact?: boolean }) {
  const { t } = useTranslation()
  const total = Number(c.total_credits) || 0
  const required = Number(c.required_credits) || 0
  return (
    <div className={compact ? 'mt-3' : ''}>
      {!compact ? (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-lg font-semibold tabular-nums">{c.version}</span>
          <StatusPill status={c.status} />
        </div>
      ) : null}
      <div className="flex items-baseline gap-3 text-[12.5px]">
        <span>
          <b className="tabular-nums">{c.items?.length ?? 0}</b> <span className="text-[hsl(var(--dash-muted))]">{t('academic.courses_count', 'Courses')}</span>
        </span>
        <span>
          <b className="tabular-nums">{total}</b> <span className="text-[hsl(var(--dash-muted))]">{t('academic.credits', 'Credits')}</span>
        </span>
      </div>
      {total > 0 ? (
        <>
          <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <span className="h-full bg-sky-500" style={{ width: `${(required / total) * 100}%` }} />
            <span className="h-full bg-violet-400" style={{ width: `${((total - required) / total) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[hsl(var(--dash-muted))]">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> {t('academic.prog.required_credits', 'Required {{count}}', { count: required })}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> {t('academic.prog.elective_credits', 'Elective {{count}}', { count: c.elective_credits ?? total - required })}
            </span>
          </div>
        </>
      ) : null}
    </div>
  )
}

function CurriculumForm({ programUuid, cloneFrom, onDone }: { programUuid: string; cloneFrom?: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [version, setVersion] = useState(`${new Date().getFullYear()}.1`)
  const [name, setName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (cloneFrom) {
        await cloneCurriculum(cloneFrom.curriculum_uuid, { version, name: name || null }, access_token)
      } else {
        await createCurriculum(programUuid, { version, name: name || null, effective_date: effectiveDate || null }, access_token)
      }
      toast.success(t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection
        title={t('academic.version', 'Version')}
        description={cloneFrom ? t('academic.clone_curriculum_hint', 'The new draft copies every course slot of the source version.') : t('academic.new_curriculum_hint', 'Starts as a draft. Add courses, then activate it.')}
      >
        <Field label={t('academic.version', 'Version')} required hint={t('academic.prog.version_hint', 'Year and number, e.g. 2026.1')}>
          <input className={inputCls} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2026.1" required />
        </Field>
        {!cloneFrom ? (
          <Field label={t('academic.effective_date', 'Effective date')}>
            <input type="date" className={inputCls} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t('academic.name')} className="sm:col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

function CohortForm({ programUuid, programCode, curricula, cohort, onDone }: { programUuid: string; programCode?: string | null; curricula: any[]; cohort: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [name, setName] = useState(cohort?.name || '')
  const [description, setDescription] = useState(cohort?.description || '')
  const [status, setStatus] = useState(cohort?.status || 'upcoming')
  const [admissionOpen, setAdmissionOpen] = useState(cohort?.admission_status === 'open')
  const [intakeTerm, setIntakeTerm] = useState<string>(cohort?.intake_term_uuid || '')
  const [curriculum, setCurriculum] = useState<string>(cohort?.curriculum_uuid || curricula.find((c) => c.status === 'active')?.curriculum_uuid || '')
  const [capacity, setCapacity] = useState<string>(cohort?.capacity != null ? String(cohort.capacity) : '')
  const [startDate, setStartDate] = useState(cohort?.start_date || '')
  const [endDate, setEndDate] = useState(cohort?.end_date || '')
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(cohort?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(cohort?.coordinator ? displayName(cohort.coordinator) : undefined)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const { data: terms = [] } = useQuery({
    queryKey: ['academic', 'terms', orgId],
    queryFn: () => getTerms(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const selectedTerm = (terms as any[]).find((tm) => tm.term_uuid === intakeTerm)
  const yearPart = selectedTerm?.code?.slice(-4) || startDate?.slice(0, 4)
  const codePreview = cohort?.code || (programCode && yearPart ? `${programCode}-${yearPart}` : null)
  const curriculumLocked = !!cohort && cohort.offering_count > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = String(t('administration.validation.required', 'Required'))
    if (startDate && endDate && endDate < startDate) next.endDate = String(t('administration.validation.date_range', 'End date must be on or after the start date'))
    if (capacity !== '' && Number(capacity) < 0) next.capacity = String(t('administration.validation.non_negative', 'Enter a number of 0 or more'))
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const payload: any = {
        name,
        description,
        status,
        capacity: capacity === '' ? null : Number(capacity),
        start_date: startDate || null,
        end_date: endDate || null,
        coordinator_uuid: coordinatorUuid || '',
        intake_term_uuid: intakeTerm || null,
        admission_status: admissionOpen ? 'open' : 'closed',
      }
      if (!cohort || curriculum !== (cohort?.curriculum_uuid || '')) payload.curriculum_uuid = curriculum || null
      if (cohort) {
        await updateCohort(cohort.cohort_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createCohort(programUuid, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || (cohort ? t('academic.update_failed') : t('academic.create_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('academic.name')} required error={errors.name}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026 intake" aria-invalid={!!errors.name} />
        </Field>
        <Field label={t('academic.cohort_code', 'Cohort code')} hint={cohort ? undefined : t('academic.code_generated', 'Generated automatically')}>
          <div className="flex h-[38px] items-center rounded-lg border border-dashed border-[hsl(var(--dash-border))] px-3 font-mono text-sm text-[hsl(var(--dash-muted))]">{codePreview || '—'}</div>
        </Field>
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {COHORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.status_${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.coordinator')}>
          <CoordinatorPicker
            orgId={orgId!}
            access_token={access_token}
            value={coordinatorUuid}
            selectedLabel={coordinatorLabel}
            onChange={(uuid, label) => {
              setCoordinatorUuid(uuid)
              setCoordinatorLabel(label)
            }}
          />
        </Field>
      </FormSection>
      <FormSection title={t('academic.prog.section_plan', 'Term and study plan')}>
        <Field label={t('academic.intake_term', 'Intake term')}>
          <select className={inputCls} value={intakeTerm} onChange={(e) => setIntakeTerm(e.target.value)}>
            <option value="">—</option>
            {(terms as any[]).map((tm) => (
              <option key={tm.term_uuid} value={tm.term_uuid}>
                {tm.code} · {tm.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.curriculum_version', 'Curriculum version')} hint={curriculumLocked ? t('academic.prog.curriculum_locked', 'Locked: courses were already generated from it') : undefined}>
          <select className={inputCls} value={curriculum} onChange={(e) => setCurriculum(e.target.value)} disabled={curriculumLocked}>
            <option value="">—</option>
            {curricula
              .filter((c) => c.status !== 'retired' || c.curriculum_uuid === curriculum)
              .map((c) => (
                <option key={c.curriculum_uuid} value={c.curriculum_uuid}>
                  {c.version} ({t(`academic.state_${c.status}`, c.status)})
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.expected_end_date', 'Expected end date')} error={errors.endDate}>
          <input type="date" className={inputCls} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} aria-invalid={!!errors.endDate} />
        </Field>
      </FormSection>
      <FormSection title={t('academic.prog.section_admissions', 'Seats and admissions')}>
        <Field label={t('academic.capacity')} error={errors.capacity} hint={t('training.capacity_hint', 'Leave empty for open seats')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} aria-invalid={!!errors.capacity} />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium">{t('academic.admission_status', 'Admissions')}</span>
            <span className="block text-[11px] text-[hsl(var(--dash-muted))]">{admissionOpen ? t('academic.prog.accepting', 'Accepting applications') : t('academic.prog.not_accepting', 'Not accepting applications')}</span>
          </span>
          <Switch className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-[hsl(var(--dash-border))]" checked={admissionOpen} onCheckedChange={setAdmissionOpen} />
        </label>
        <Field label={t('academic.description')} className="sm:col-span-2">
          <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default ProgramDetail
