'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Books,
  CalendarDots,
  ChalkboardTeacher,
  Check,
  CheckCircle,
  ClipboardText,
  Exam,
  GraduationCap,
  ListChecks,
  SlidersHorizontal,
  Student,
  UserCirclePlus,
  UsersThree,
  VideoCamera,
} from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { AcademicHeader, AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { PostgradTabs, statusDotClass, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { termProgress } from '@components/Dashboard/Menus/postgradNavItems'
import { getAcademicOverview, stripPrefix } from '@services/academic/core'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

const BASE = '/dash/postgraduate'
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'

/** Where each attention item leads and what the button says. */
const ATTENTION: Record<string, { Icon: React.ElementType; tile: string; href: (_uuid: string) => string; actionKey: string; actionFallback: string }> = {
  application_new: {
    Icon: ClipboardText,
    tile: 'bg-sky-50 text-sky-600',
    href: (uuid) => `${BASE}/admissions/${stripPrefix(uuid, 'application')}`,
    actionKey: 'academic.office.action_review',
    actionFallback: 'Start review',
  },
  application_review: {
    Icon: ListChecks,
    tile: 'bg-sky-50 text-sky-600',
    href: (uuid) => `${BASE}/admissions/${stripPrefix(uuid, 'application')}`,
    actionKey: 'academic.office.action_decide',
    actionFallback: 'Decide',
  },
  application_accepted: {
    Icon: UserCirclePlus,
    tile: 'bg-emerald-50 text-emerald-600',
    href: (uuid) => `${BASE}/admissions/${stripPrefix(uuid, 'application')}`,
    actionKey: 'academic.office.action_enroll',
    actionFallback: 'Enroll',
  },
  grades_submitted: {
    Icon: Exam,
    tile: 'bg-violet-50 text-violet-600',
    href: (uuid) => `${BASE}/offerings/${stripPrefix(uuid, 'offering')}`,
    actionKey: 'academic.office.action_approve',
    actionFallback: 'Approve grades',
  },
  no_instructor: {
    Icon: ChalkboardTeacher,
    tile: 'bg-amber-50 text-amber-600',
    href: (uuid) => `${BASE}/offerings/${stripPrefix(uuid, 'offering')}`,
    actionKey: 'academic.office.action_assign',
    actionFallback: 'Assign lecturer',
  },
  interview: {
    Icon: VideoCamera,
    tile: 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]',
    href: (uuid) => `${BASE}/admissions/${stripPrefix(uuid, 'application')}`,
    actionKey: 'academic.office.action_interview',
    actionFallback: 'Open',
  },
}

const ATTENTION_GROUPS: { key: string; kinds: string[]; labelKey: string; fallback: string }[] = [
  { key: 'admissions', kinds: ['application_new', 'application_review', 'application_accepted'], labelKey: 'academic.office.group_admissions', fallback: 'Admissions' },
  { key: 'interviews', kinds: ['interview'], labelKey: 'academic.office.group_interviews', fallback: 'Interviews this week' },
  { key: 'results', kinds: ['grades_submitted'], labelKey: 'academic.office.group_results', fallback: 'Results to approve' },
  { key: 'staffing', kinds: ['no_instructor'], labelKey: 'academic.office.group_staffing', fallback: 'Courses without a lecturer' },
]

/** The setup steps, in the order a graduate school is configured, and where each one is done. */
const SETUP: Record<string, { Icon: React.ElementType; href: string; titleKey: string; title: string; hintKey: string; hint: string }> = {
  calendar: { Icon: CalendarDots, href: `${BASE}/calendar`, titleKey: 'academic.office.setup_calendar', title: 'Academic calendar', hintKey: 'academic.office.setup_calendar_hint', hint: 'Academic years and terms' },
  grading: { Icon: SlidersHorizontal, href: `${BASE}/settings`, titleKey: 'academic.office.setup_grading', title: 'Grade scale', hintKey: 'academic.office.setup_grading_hint', hint: 'Letter grades and pass mark' },
  catalog: { Icon: Books, href: `${BASE}/courses`, titleKey: 'academic.office.setup_catalog', title: 'Course catalog', hintKey: 'academic.office.setup_catalog_hint', hint: 'The courses programs are built from' },
  program: { Icon: GraduationCap, href: BASE, titleKey: 'academic.office.setup_program', title: 'Programs', hintKey: 'academic.office.setup_program_hint', hint: 'PhD, master’s and diploma degrees' },
  curriculum: { Icon: ListChecks, href: BASE, titleKey: 'academic.office.setup_curriculum', title: 'Active curriculum', hintKey: 'academic.office.setup_curriculum_hint', hint: 'A study plan per program' },
  intake: { Icon: UsersThree, href: BASE, titleKey: 'academic.office.setup_intake', title: 'Intakes', hintKey: 'academic.office.setup_intake_hint', hint: 'Cohorts that students join' },
  admissions: { Icon: ClipboardText, href: `${BASE}/admissions`, titleKey: 'academic.office.setup_admissions', title: 'Open admissions', hintKey: 'academic.office.setup_admissions_hint', hint: 'An intake accepting applications' },
  offerings: { Icon: ChalkboardTeacher, href: `${BASE}/offerings`, titleKey: 'academic.office.setup_offerings', title: 'Course offerings', hintKey: 'academic.office.setup_offerings_hint', hint: 'Courses scheduled in a term' },
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

function TermHero({ data, orgslug }: { data: any; orgslug: string }) {
  const { t, i18n } = useTranslation()
  const term = data.current_term
  const progress = term ? termProgress(term) : null
  const fmt = (v?: string) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const sum = (obj: Record<string, number>, keys: string[]) => keys.reduce((n, k) => n + (obj?.[k] || 0), 0)
  const kpis = [
    { label: t('academic.office.kpi_students', 'Active students'), value: data.students?.active || 0, Icon: Student, href: `${BASE}/students` },
    { label: t('academic.office.kpi_pipeline', 'Applications in progress'), value: sum(data.applications, ['submitted', 'under_review', 'waitlisted']), Icon: ClipboardText, href: `${BASE}/admissions` },
    { label: t('academic.office.kpi_intakes', 'Open intakes'), value: data.open_intakes || 0, Icon: UsersThree, href: BASE },
    {
      label: t('academic.office.kpi_courses', 'Courses this term'),
      value: Object.entries(data.offerings || {}).reduce((n, [k, v]) => (k === 'cancelled' ? n : n + (v as number)), 0),
      Icon: ChalkboardTeacher,
      href: `${BASE}/offerings`,
    },
  ]
  return (
    <section className="relative mb-6 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,hsl(0_0%_12%),hsl(0_0%_5%))] text-white">
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.5)] to-transparent" />
      <div className="relative grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(43_80%_64%)]">
            <CalendarDots size={14} weight="bold" /> {t('academic.nav.current_term', 'Current term')}
          </p>
          {term ? (
            <>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{term.name || term.code}</h2>
              <p className="mt-1 text-[13px] text-white/60">
                {[term.academic_year_code, `${fmt(term.start_date)} – ${fmt(term.end_date)}`].filter(Boolean).join(' · ')}
              </p>
              {progress ? (
                <div className="mt-4 max-w-md">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn('h-full rounded-full', GOLD)} style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/55">{t('academic.nav.week_of', 'Week {{week}} of {{total}}', { week: progress.week, total: progress.totalWeeks })}</p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl font-semibold">{t('academic.office.no_term', 'No term in progress')}</h2>
              <Link href={getUriWithOrg(orgslug, `${BASE}/calendar`)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(43_80%_64%)] hover:underline">
                {t('academic.office.set_up_calendar', 'Set up the academic calendar')} <ArrowRight size={14} className="rtl:rotate-180" />
              </Link>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {kpis.map(({ label, value, Icon, href }) => (
            <Link
              key={label}
              href={getUriWithOrg(orgslug, href)}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.08]"
            >
              <span className="flex items-center justify-between text-white/55">
                <Icon size={18} weight="duotone" className="text-[hsl(43_80%_62%)]" />
                <ArrowRight size={13} className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 rtl:rotate-180" />
              </span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{value}</span>
              <span className="block truncate text-[11.5px] text-white/60">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function AttentionCard({ items, orgslug }: { items: any[]; orgslug: string }) {
  const { t } = useTranslation()
  const relative = useRelative()
  return (
    <section className="dash-card rounded-[1.25rem] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">{t('academic.office.attention', 'Needs your attention')}</h2>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', items.length ? `${GOLD} text-[hsl(var(--dash-ink))]` : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[hsl(var(--dash-canvas))]/60 px-6 py-10 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle size={26} weight="duotone" />
          </span>
          <p className="mt-3 text-sm font-semibold">{t('academic.office.all_clear', 'All caught up')}</p>
          <p className="mt-0.5 max-w-xs text-xs text-[hsl(var(--dash-muted))]">
            {t('academic.office.all_clear_hint', 'No applications, results or courses are waiting for the office right now.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ATTENTION_GROUPS.map((group) => {
            const rows = items.filter((item) => group.kinds.includes(item.kind))
            if (!rows.length) return null
            return (
              <div key={group.key}>
                <p className="mb-1.5 flex items-center gap-2 px-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--dash-muted))]">
                  {t(group.labelKey, group.fallback)}
                  <span className="h-px flex-1 bg-[hsl(var(--dash-border))]/70" />
                </p>
                <ul className="space-y-1">
                  {rows.map((item) => {
                    const meta = ATTENTION[item.kind] || ATTENTION.application_new
                    const when = relative(item.date)
                    return (
                      <li key={`${item.kind}-${item.uuid}`}>
                        <Link
                          href={getUriWithOrg(orgslug, meta.href(item.uuid))}
                          className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[hsl(var(--dash-canvas))]/70"
                        >
                          <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', meta.tile)}>
                            <meta.Icon size={18} weight="duotone" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium">{item.title}</span>
                            <span className="block truncate text-[11.5px] text-[hsl(var(--dash-muted))]">
                              {[item.subtitle, when].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3 py-1 text-xs font-semibold transition-colors group-hover:border-[hsl(var(--dash-ink))] group-hover:bg-[hsl(var(--dash-ink))] group-hover:text-white">
                            {t(meta.actionKey, meta.actionFallback)}
                            <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SetupCard({ steps, orgslug }: { steps: any[]; orgslug: string }) {
  const { t } = useTranslation()
  const done = steps.filter((s) => s.done).length
  const firstOpen = steps.find((s) => !s.done)?.key
  return (
    <section className="dash-card rounded-[1.25rem] p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{t('academic.office.setup', 'Setup checklist')}</h2>
        <span className="text-xs font-semibold tabular-nums text-[hsl(var(--dash-muted))]">
          {t('academic.office.setup_progress', '{{done}} of {{total}}', { done, total: steps.length })}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
        <div className={cn('h-full rounded-full transition-all', GOLD)} style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} />
      </div>
      <ol className="space-y-0.5">
        {steps.map((step, i) => {
          const meta = SETUP[step.key]
          if (!meta) return null
          const next = step.key === firstOpen
          return (
            <li key={step.key}>
              <Link
                href={getUriWithOrg(orgslug, meta.href)}
                className={cn('group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[hsl(var(--dash-canvas))]/70', next && 'bg-[hsl(var(--dash-accent-soft))]/60')}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    step.done ? 'bg-emerald-500 text-white' : next ? `${GOLD} text-[hsl(var(--dash-ink))]` : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
                  )}
                >
                  {step.done ? <Check size={14} weight="bold" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-medium', step.done && 'text-[hsl(var(--dash-ink))]/70')}>{t(meta.titleKey, meta.title)}</span>
                  <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">{t(meta.hintKey, meta.hint)}</span>
                </span>
                {step.done ? (
                  <span className="shrink-0 rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[hsl(var(--dash-muted))]">{step.count}</span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[hsl(var(--dash-accent))]">
                    {t('academic.office.set_up', 'Set up')}
                    <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** A small card with a stacked bar and a legend, for one status breakdown. */
function Breakdown({
  title,
  Icon,
  counts,
  order,
  labelOf,
  href,
  orgslug,
  empty,
}: {
  title: string
  Icon: React.ElementType
  counts: Record<string, number>
  order: string[]
  labelOf: (_key: string) => string
  href: string
  orgslug: string
  empty: string
}) {
  const keys = [...order.filter((k) => counts?.[k]), ...Object.keys(counts || {}).filter((k) => !order.includes(k) && counts[k])]
  const total = keys.reduce((n, k) => n + counts[k], 0)
  return (
    <Link href={getUriWithOrg(orgslug, href)} className="dash-card group block rounded-[1.25rem] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-20px_hsl(220_30%_20%/0.45)]">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70">
          <Icon size={17} weight="duotone" />
        </span>
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="ms-auto text-xl font-semibold tabular-nums">{total}</span>
      </div>
      {total ? (
        <>
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {keys.map((k) => (
              <span key={k} className={cn('h-full', statusDotClass(k))} style={{ width: `${(counts[k] / total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {keys.map((k) => (
              <li key={k} className="flex items-center gap-2 text-[12px]">
                <span className={cn('h-2 w-2 rounded-full', statusDotClass(k))} />
                <span className="truncate text-[hsl(var(--dash-ink))]/75">{labelOf(k)}</span>
                <span className="ms-auto font-semibold tabular-nums">{counts[k]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-xs text-[hsl(var(--dash-muted))]">{empty}</p>
      )}
    </Link>
  )
}

function GraduateOffice({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const { data, isLoading, error } = useQuery({
    queryKey: ['academic', 'overview', orgId],
    queryFn: () => getAcademicOverview(orgId, access_token),
    enabled: ready,
    staleTime: 30_000,
  })

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, BASE), icon: <GraduationCap size={14} /> },
          { label: t('academic.nav.overview', 'Overview') },
        ]}
      />
      <AcademicHeader
        title={t('academic.office.title', 'Graduate Studies Office')}
        subtitle={t('academic.office.subtitle', 'What is waiting for you across admissions, teaching and results, and how far setup has got.')}
      />
      <PostgradTabs orgslug={orgslug} />

      {error ? (
        <p className="dash-card rounded-[1.25rem] p-6 text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <div className="dash-shimmer h-48 rounded-[1.5rem]" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="dash-shimmer h-80 rounded-[1.25rem]" />
            <div className="dash-shimmer h-80 rounded-[1.25rem]" />
          </div>
        </div>
      ) : (
        <>
          <TermHero data={data} orgslug={orgslug} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <AttentionCard items={data.attention || []} orgslug={orgslug} />
            <SetupCard steps={data.setup || []} orgslug={orgslug} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Breakdown
              title={t('academic.office.pipeline', 'Admissions pipeline')}
              Icon={ClipboardText}
              counts={data.applications}
              order={['draft', 'submitted', 'under_review', 'waitlisted', 'accepted', 'enrolled', 'rejected', 'withdrawn']}
              labelOf={(k) => String(t(`academic.app_${k}`, k.replace(/_/g, ' ')))}
              href={`${BASE}/admissions`}
              orgslug={orgslug}
              empty={t('academic.no_applications', 'No applications yet.')}
            />
            <Breakdown
              title={t('academic.tab_students', 'Students')}
              Icon={Student}
              counts={data.students}
              order={['active', 'deferred', 'suspended', 'withdrawn', 'completed', 'graduated']}
              labelOf={(k) => String(t(`academic.state_${k}`, k.replace(/_/g, ' ')))}
              href={`${BASE}/students`}
              orgslug={orgslug}
              empty={t('academic.office.no_students', 'No students admitted yet.')}
            />
            <Breakdown
              title={t('academic.office.term_courses', 'This term’s courses')}
              Icon={ChalkboardTeacher}
              counts={data.offerings}
              order={['planned', 'open', 'in_progress', 'completed', 'cancelled']}
              labelOf={(k) => String(t(`academic.state_${k}`, k.replace(/_/g, ' ')))}
              href={`${BASE}/offerings`}
              orgslug={orgslug}
              empty={t('academic.office.no_offerings', 'No courses scheduled this term.')}
            />
            <Breakdown
              title={t('academic.office.results', 'Results')}
              Icon={Exam}
              counts={data.grades}
              order={['open', 'submitted', 'returned', 'approved']}
              labelOf={(k) => String(t(`academic.grades_${k}`, k.replace(/_/g, ' ')))}
              href={`${BASE}/offerings`}
              orgslug={orgslug}
              empty={t('academic.office.no_results', 'No gradebooks in progress.')}
            />
          </div>
        </>
      )}
    </AcademicPageShell>
  )
}

export default GraduateOffice
