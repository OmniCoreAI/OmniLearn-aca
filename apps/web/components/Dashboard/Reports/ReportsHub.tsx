'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChartLineUp, GraduationCap, UsersThree, Wallet } from '@phosphor-icons/react'
import DashboardPageShell from '@components/Dashboard/Shared/DashboardPageShell'
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility'
import { useReport } from '@services/reports/reports'
import { useReportFormats } from './ReportKit'

const LAST_12 = (() => {
  const d = new Date()
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { from: iso(new Date(d.getFullYear(), d.getMonth() - 11, 1)), to: iso(d) }
})()

function Card({
  href,
  icon,
  tint,
  title,
  description,
  stats,
  loading,
  links,
}: {
  href: string
  icon: React.ReactNode
  tint: string
  title: string
  description: string
  stats: { label: string; value: string }[]
  loading: boolean
  links?: { href: string; label: string }[]
}) {
  const { t } = useTranslation()
  return (
    <article className="group flex flex-col rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-5 shadow-[0_1px_2px_hsl(220_30%_10%/0.04)] transition-shadow hover:shadow-[0_18px_40px_-22px_hsl(220_30%_10%/0.3)]">
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tint}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold text-[hsl(var(--dash-ink))]">{title}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[hsl(var(--dash-muted))]">{description}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2.5">
            <dt className="truncate text-[11.5px] text-[hsl(var(--dash-muted))]">{s.label}</dt>
            <dd className="mt-0.5 truncate text-[17px] font-bold tabular-nums text-[hsl(var(--dash-ink))]">{loading ? <span className="dash-shimmer inline-block h-4 w-16 rounded" /> : s.value}</dd>
          </div>
        ))}
      </dl>
      {links?.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex rounded-full border border-[hsl(var(--dash-border))] px-2.5 py-1 text-[12px] font-semibold text-[hsl(var(--dash-ink))]/80 hover:border-[hsl(var(--dash-ink))]/25 hover:text-[hsl(var(--dash-ink))]">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-[13px] font-semibold text-white">
        {t('reports.open_report', 'Open report')}
        <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
      </Link>
    </article>
  )
}

/** Reports home: every report with its headline numbers for the last 12 months. */
export default function ReportsHub() {
  const { t } = useTranslation()
  const { isItemVisible } = usePortalNavVisibility()
  const showFinance = isItemVisible('finance')
  const showAdmissions = isItemVisible('postgraduate')
  const fin = useReport('financial', LAST_12, showFinance)
  const learn = useReport('learning', LAST_12)
  const adm = useReport('admissions', LAST_12, showAdmissions)
  const ppl = useReport('people', LAST_12)
  const money = useReportFormats(fin.data?.currency ?? 'EGP')
  const fmt = useReportFormats()
  const dash = (v: string | undefined) => v ?? '—'

  return (
    <DashboardPageShell
      title={t('reports.title', 'Reports')}
      description={t('reports.hub_description', 'Academy-wide reports with filters by period, comparison with the previous period, CSV export and printing. Figures below cover the last 12 months.')}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {showFinance ? (
          <Card
            href="/dash/reports/financial"
            icon={<Wallet size={22} weight="duotone" />}
            tint="bg-[hsl(43_85%_92%)] text-[hsl(38_80%_34%)]"
            title={t('reports.financial.title', 'Financial report')}
            description={t('reports.financial.card', 'Revenue, instructor costs and the profit and loss statement.')}
            loading={fin.isLoading}
            stats={[
              { label: t('reports.financial.net_revenue', 'Net revenue'), value: dash(fin.data && money.money(fin.data.totals.net_revenue)) },
              { label: t('reports.financial.net_profit', 'Net profit'), value: dash(fin.data && money.money(fin.data.totals.net_profit)) },
            ]}
            links={[
              { href: '/dash/reports/financial?tab=statement', label: t('reports.financial.tab_statement', 'Financial statement') },
              { href: '/dash/reports/financial?tab=revenue', label: t('reports.financial.tab_revenue', 'Revenue') },
              { href: '/dash/reports/financial?tab=instructors', label: t('reports.financial.tab_instructors', 'Instructor costs') },
            ]}
          />
        ) : null}
        <Card
          href="/dash/reports/learning"
          icon={<ChartLineUp size={22} weight="duotone" />}
          tint="bg-[hsl(152_45%_92%)] text-[hsl(152_60%_28%)]"
          title={t('reports.learning.title', 'Learning & completion')}
          description={t('reports.learning.card', 'Enrollments, completions and active learners per course.')}
          loading={learn.isLoading}
          stats={[
            { label: t('reports.learning.enrollments', 'New enrollments'), value: dash(learn.data && fmt.number(learn.data.totals.enrollments)) },
            { label: t('reports.learning.completion_rate', 'Overall completion rate'), value: dash(learn.data && fmt.pct(learn.data.overall_completion_rate)) },
          ]}
        />
        {showAdmissions ? (
          <Card
            href="/dash/reports/admissions"
            icon={<GraduationCap size={22} weight="duotone" />}
            tint="bg-[hsl(212_75%_94%)] text-[hsl(212_65%_36%)]"
            title={t('reports.admissions.title', 'Admissions')}
            description={t('reports.admissions.card', 'Applications, decisions, acceptance rate and interviews.')}
            loading={adm.isLoading}
            stats={[
              { label: t('reports.admissions.submitted', 'Submitted'), value: dash(adm.data && fmt.number(adm.data.totals.submitted)) },
              { label: t('reports.admissions.acceptance_rate', 'Acceptance rate'), value: dash(adm.data && fmt.pct(adm.data.totals.acceptance_rate)) },
            ]}
          />
        ) : null}
        <Card
          href="/dash/reports/people"
          icon={<UsersThree size={22} weight="duotone" />}
          tint="bg-[hsl(268_60%_95%)] text-[hsl(268_45%_42%)]"
          title={t('reports.people.title', 'Users & entities')}
          description={t('reports.people.card', 'Members by role, new sign-ups, activity and each entity’s learning.')}
          loading={ppl.isLoading}
          stats={[
            { label: t('reports.people.members', 'Members'), value: dash(ppl.data && fmt.number(ppl.data.totals.members)) },
            { label: t('reports.people.active_learners', 'Active learners'), value: dash(ppl.data && fmt.number(ppl.data.totals.active_learners)) },
          ]}
        />
      </div>
    </DashboardPageShell>
  )
}
