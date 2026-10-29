'use client'

import React, { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChalkboardTeacher, Coins, CreditCard, Receipt, TrendUp, Wallet } from '@phosphor-icons/react'
import DashboardPageShell from '@components/Dashboard/Shared/DashboardPageShell'
import { useReport, type FinancialReport } from '@services/reports/reports'
import { cn } from '@/lib/utils'
import MonthlyChart, { SERIES } from './MonthlyChart'
import {
  BackToReports,
  BarList,
  Kpi,
  KpiGrid,
  Panel,
  RangeCaption,
  RangePicker,
  ReportActions,
  ReportError,
  ReportLoading,
  ReportTable,
  ReportTabs,
  exportCsv,
  useReportFormats,
  useReportRange,
} from './ReportKit'

type Tab = 'statement' | 'revenue' | 'instructors'

export default function FinancialReportPage() {
  const { t } = useTranslation()
  const range = useReportRange()
  const params = useSearchParams()
  const initial = params.get('tab')
  const [tab, setTab] = useState<Tab>(initial === 'revenue' || initial === 'instructors' ? initial : 'statement')
  const { data, isLoading, isError, refetch } = useReport('financial', range.range)

  const exportTab = () => {
    if (!data) return
    const stamp = `${data.range.date_from}_${data.range.date_to}`
    if (tab === 'statement') {
      exportCsv(`financial-statement_${stamp}.csv`, ['month', 'revenue', 'refunds', 'operating_expenses', 'instructor_cost', 'net'], data.monthly.map((m) => [m.month, m.revenue, m.refunds, m.expenses, m.instructor_cost, m.net]))
    } else if (tab === 'revenue') {
      exportCsv(`revenue_${stamp}.csv`, ['group', 'name', 'total', 'entries', 'share_pct'], [
        ...data.revenue_by_category.map((r) => ['category', r.label, r.total, r.count, r.share_pct]),
        ...data.revenue_by_payment_method.map((r) => ['payment_method', r.label, r.total, r.count, r.share_pct]),
        ...data.revenue_by_course.map((r) => ['course', r.label, r.total, r.count, r.share_pct]),
      ])
    } else {
      exportCsv(`instructor-costs_${stamp}.csv`, ['instructor', 'hours', 'sessions', 'amount', 'avg_rate', 'share_pct', 'courses'], data.instructors.map((i) => [i.name, i.hours, i.sessions, i.amount, i.avg_rate, i.share_pct, i.courses.join(' | ')]))
    }
  }

  return (
    <DashboardPageShell
      title={t('reports.financial.title', 'Financial report')}
      description={t('reports.financial.description', 'Revenue, refunds, expenses and instructor costs, with the profit and loss statement for the period.')}
      actions={<ReportActions onExport={data ? exportTab : undefined} />}
      tabs={
        <div className="flex flex-col gap-3">
          <BackToReports />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ReportTabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                ['statement', t('reports.financial.tab_statement', 'Financial statement')],
                ['revenue', t('reports.financial.tab_revenue', 'Revenue')],
                ['instructors', t('reports.financial.tab_instructors', 'Instructor costs')],
              ]}
            />
            <RangePicker value={range} />
          </div>
          {data ? <RangeCaption from={data.range.date_from} to={data.range.date_to} previousFrom={data.range.previous_from} previousTo={data.range.previous_to} /> : null}
        </div>
      }
    >
      {isError ? <ReportError onRetry={() => refetch()} /> : null}
      {isLoading || !data ? (
        isError ? null : <ReportLoading />
      ) : tab === 'statement' ? (
        <Statement data={data} />
      ) : tab === 'revenue' ? (
        <Revenue data={data} />
      ) : (
        <Instructors data={data} />
      )}
    </DashboardPageShell>
  )
}

/* -------------------------------------------------------------- statement */

function Statement({ data }: { data: FinancialReport }) {
  const { t } = useTranslation()
  const fmt = useReportFormats(data.currency)
  const c = data.totals
  const p = data.previous
  const lines: { label: string; value: number; kind: 'line' | 'sub' | 'total'; negative?: boolean }[] = [
    { label: t('reports.financial.gross_revenue', 'Gross revenue'), value: c.gross_revenue, kind: 'line' },
    { label: t('reports.financial.refunds', 'Refunds'), value: c.refunds, kind: 'line', negative: true },
    { label: t('reports.financial.net_revenue', 'Net revenue'), value: c.net_revenue, kind: 'sub' },
    { label: t('reports.financial.operating_expenses', 'Operating expenses'), value: c.operating_expenses, kind: 'line', negative: true },
    { label: t('reports.financial.instructor_cost', 'Instructor cost'), value: c.instructor_cost, kind: 'line', negative: true },
    { label: t('reports.financial.total_costs', 'Total costs'), value: c.total_costs, kind: 'sub', negative: true },
    { label: t('reports.financial.net_profit', 'Net profit'), value: c.net_profit, kind: 'total' },
  ]
  return (
    <>
      <KpiGrid>
        <Kpi icon={<Coins size={17} />} label={t('reports.financial.gross_revenue', 'Gross revenue')} value={fmt.money(c.gross_revenue)} current={c.gross_revenue} previous={p.gross_revenue} />
        <Kpi icon={<Receipt size={17} />} label={t('reports.financial.refunds', 'Refunds')} value={fmt.money(c.refunds)} current={c.refunds} previous={p.refunds} invert />
        <Kpi icon={<Wallet size={17} />} label={t('reports.financial.net_revenue', 'Net revenue')} value={fmt.money(c.net_revenue)} current={c.net_revenue} previous={p.net_revenue} />
        <Kpi icon={<CreditCard size={17} />} label={t('reports.financial.total_costs', 'Total costs')} value={fmt.money(c.total_costs)} current={c.total_costs} previous={p.total_costs} invert />
        <Kpi icon={<TrendUp size={17} />} label={t('reports.financial.net_profit', 'Net profit')} value={fmt.money(c.net_profit)} current={c.net_profit} previous={p.net_profit} />
        <Kpi label={t('reports.financial.margin', 'Profit margin')} value={fmt.pct(c.margin_pct)} hint={t('reports.financial.margin_hint', 'Net profit ÷ net revenue')} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={t('reports.financial.monthly_title', 'Revenue and costs by month')} subtitle={t('reports.financial.monthly_subtitle', 'Costs are operating expenses plus instructor pay; the line is net result.')}>
          <MonthlyChart
            data={data.monthly}
            format={fmt.money}
            series={[
              { key: 'revenue', label: t('reports.financial.revenue', 'Revenue'), color: SERIES.gold, kind: 'bar' },
              { key: 'expenses', label: t('reports.financial.operating_expenses', 'Operating expenses'), color: SERIES.blue, kind: 'bar', stack: 'cost' },
              { key: 'instructor_cost', label: t('reports.financial.instructor_cost', 'Instructor cost'), color: SERIES.rose, kind: 'bar', stack: 'cost' },
              { key: 'net', label: t('reports.financial.net', 'Net result'), color: SERIES.green, kind: 'line' },
            ]}
          />
        </Panel>

        <Panel title={t('reports.financial.statement_title', 'Profit and loss statement')} subtitle={t('reports.financial.statement_subtitle', 'Same figures as Finance → P&L.')}>
          <table className="w-full text-[13.5px]">
            <tbody>
              {lines.map((l) => (
                <tr key={l.label} className={cn(l.kind !== 'line' && 'font-bold', l.kind === 'total' && 'text-[15px]')}>
                  <td className={cn('py-2', l.kind === 'line' && 'ps-3 text-[hsl(var(--dash-ink))]/80', l.kind !== 'line' && 'border-t border-[hsl(var(--dash-border))]')}>{l.label}</td>
                  <td
                    className={cn(
                      'py-2 text-end tabular-nums',
                      l.kind !== 'line' && 'border-t border-[hsl(var(--dash-border))]',
                      l.kind === 'total' && (l.value >= 0 ? 'text-[hsl(152_60%_28%)]' : 'text-[hsl(var(--dash-warn))]')
                    )}
                  >
                    {l.negative && l.value ? `(${fmt.money(l.value)})` : fmt.money(l.value)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 ps-3 text-[12.5px] text-[hsl(var(--dash-muted))]">{t('reports.financial.margin', 'Profit margin')}</td>
                <td className="pt-2 text-end text-[12.5px] font-semibold tabular-nums">{fmt.pct(c.margin_pct)}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title={t('reports.financial.expenses_title', 'Operating expenses by category')}>
        <BarList
          rows={data.expenses_by_category.map((r) => ({ label: categoryLabel(t, r.label), value: r.total, share: r.share_pct }))}
          format={fmt.money}
          color={SERIES.blue}
          empty={t('reports.financial.no_expenses', 'No expenses recorded in this period.')}
        />
      </Panel>
    </>
  )
}

/* ---------------------------------------------------------------- revenue */

function Revenue({ data }: { data: FinancialReport }) {
  const { t } = useTranslation()
  const fmt = useReportFormats(data.currency)
  const c = data.totals
  const p = data.previous
  const avg = c.revenue_entries ? c.gross_revenue / c.revenue_entries : 0
  const prevAvg = p.revenue_entries ? p.gross_revenue / p.revenue_entries : 0
  return (
    <>
      <KpiGrid className="xl:grid-cols-4">
        <Kpi icon={<Coins size={17} />} label={t('reports.financial.gross_revenue', 'Gross revenue')} value={fmt.money(c.gross_revenue)} current={c.gross_revenue} previous={p.gross_revenue} />
        <Kpi icon={<Wallet size={17} />} label={t('reports.financial.net_revenue', 'Net revenue')} value={fmt.money(c.net_revenue)} current={c.net_revenue} previous={p.net_revenue} />
        <Kpi icon={<Receipt size={17} />} label={t('reports.financial.revenue_entries', 'Revenue entries')} value={fmt.number(c.revenue_entries)} current={c.revenue_entries} previous={p.revenue_entries} />
        <Kpi label={t('reports.financial.avg_entry', 'Average entry')} value={fmt.money(avg)} current={avg} previous={prevAvg} />
      </KpiGrid>

      <Panel title={t('reports.financial.revenue_by_month', 'Revenue by month')}>
        <MonthlyChart
          data={data.monthly}
          format={fmt.money}
          height={240}
          series={[
            { key: 'revenue', label: t('reports.financial.revenue', 'Revenue'), color: SERIES.gold, kind: 'bar' },
            { key: 'refunds', label: t('reports.financial.refunds', 'Refunds'), color: SERIES.rose, kind: 'bar' },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('reports.financial.by_category', 'By category')}>
          <BarList rows={data.revenue_by_category.map((r) => ({ label: categoryLabel(t, r.label), value: r.total, share: r.share_pct }))} format={fmt.money} empty={t('reports.financial.no_revenue', 'No revenue recorded in this period.')} />
        </Panel>
        <Panel title={t('reports.financial.by_payment_method', 'By payment method')}>
          <BarList rows={data.revenue_by_payment_method.map((r) => ({ label: methodLabel(t, r.label), value: r.total, share: r.share_pct }))} format={fmt.money} color={SERIES.blue} empty={t('reports.financial.no_revenue', 'No revenue recorded in this period.')} />
        </Panel>
      </div>

      <Panel title={t('reports.financial.by_course', 'Revenue by course')}>
        <ReportTable
          rows={data.revenue_by_course}
          initialSort="total"
          empty={t('reports.financial.no_revenue', 'No revenue recorded in this period.')}
          columns={[
            { key: 'label', label: t('reports.col.course', 'Course'), value: (r) => (r.key === 'unassigned' ? t('reports.financial.no_course', 'Not linked to a course') : r.label) },
            { key: 'count', label: t('reports.col.entries', 'Entries'), value: (r) => r.count, numeric: true },
            { key: 'total', label: t('reports.col.revenue', 'Revenue'), value: (r) => r.total, render: (r) => fmt.money(r.total), numeric: true },
            { key: 'share', label: t('reports.col.share', 'Share'), value: (r) => r.share_pct, render: (r) => fmt.pct(r.share_pct), numeric: true },
          ]}
        />
      </Panel>

      <Panel title={t('reports.financial.top_entries', 'Largest revenue entries')}>
        <ReportTable
          rows={data.top_revenue}
          initialSort="amount"
          empty={t('reports.financial.no_revenue', 'No revenue recorded in this period.')}
          columns={[
            { key: 'title', label: t('reports.col.entry', 'Entry'), value: (r) => r.title, render: (r) => <span dir="auto">{r.title}</span> },
            { key: 'category', label: t('reports.col.category', 'Category'), value: (r) => categoryLabel(t, r.category) },
            { key: 'course', label: t('reports.col.course', 'Course'), value: (r) => r.course_name ?? '—' },
            { key: 'date', label: t('reports.col.date', 'Date'), value: (r) => r.entry_date, render: (r) => fmt.day(r.entry_date) },
            { key: 'amount', label: t('reports.col.amount', 'Amount'), value: (r) => r.amount, render: (r) => fmt.money(r.amount), numeric: true },
          ]}
        />
      </Panel>
    </>
  )
}

/* ------------------------------------------------------------ instructors */

function Instructors({ data }: { data: FinancialReport }) {
  const { t } = useTranslation()
  const fmt = useReportFormats(data.currency)
  const c = data.totals
  const p = data.previous
  const rate = c.instructor_hours ? c.instructor_cost / c.instructor_hours : 0
  const prevRate = p.instructor_hours ? p.instructor_cost / p.instructor_hours : 0
  return (
    <>
      <KpiGrid className="xl:grid-cols-5">
        <Kpi icon={<ChalkboardTeacher size={17} />} label={t('reports.financial.instructor_cost', 'Instructor cost')} value={fmt.money(c.instructor_cost)} current={c.instructor_cost} previous={p.instructor_cost} invert />
        <Kpi label={t('reports.financial.teaching_hours', 'Teaching hours')} value={fmt.number(c.instructor_hours)} current={c.instructor_hours} previous={p.instructor_hours} />
        <Kpi label={t('reports.financial.avg_rate', 'Average hourly rate')} value={fmt.money(rate)} current={rate} previous={prevRate} invert />
        <Kpi label={t('reports.financial.instructors_paid', 'Instructors paid')} value={fmt.number(data.instructors.length)} />
        <Kpi label={t('reports.financial.cost_share', 'Share of net revenue')} value={fmt.pct(c.net_revenue ? Math.round((c.instructor_cost * 1000) / c.net_revenue) / 10 : 0)} hint={t('reports.financial.cost_share_hint', 'Instructor cost ÷ net revenue')} />
      </KpiGrid>

      <Panel title={t('reports.financial.instructor_by_month', 'Instructor cost by month')}>
        <MonthlyChart data={data.monthly} format={fmt.money} height={220} series={[{ key: 'instructor_cost', label: t('reports.financial.instructor_cost', 'Instructor cost'), color: SERIES.rose, kind: 'bar' }]} />
      </Panel>

      <Panel title={t('reports.financial.by_instructor', 'By instructor')} subtitle={t('reports.financial.by_instructor_subtitle', 'From logged teaching hours at the rate applied when logged.')}>
        <ReportTable
          rows={data.instructors}
          initialSort="amount"
          empty={t('reports.financial.no_worklogs', 'No teaching hours logged in this period.')}
          columns={[
            { key: 'name', label: t('reports.col.instructor', 'Instructor'), value: (r) => r.name, render: (r) => <span dir="auto" className="font-semibold">{r.name}</span> },
            { key: 'courses', label: t('reports.col.courses', 'Courses'), value: (r) => r.courses.length, render: (r) => <span className="line-clamp-1 text-[hsl(var(--dash-muted))]" title={r.courses.join(', ')}>{r.courses.join('، ') || '—'}</span> },
            { key: 'sessions', label: t('reports.col.sessions', 'Sessions'), value: (r) => r.sessions, numeric: true },
            { key: 'hours', label: t('reports.col.hours', 'Hours'), value: (r) => r.hours, render: (r) => fmt.number(r.hours), numeric: true },
            { key: 'rate', label: t('reports.col.avg_rate', 'Avg. rate'), value: (r) => r.avg_rate, render: (r) => fmt.money(r.avg_rate), numeric: true },
            { key: 'amount', label: t('reports.col.cost', 'Cost'), value: (r) => r.amount, render: (r) => fmt.money(r.amount), numeric: true },
            { key: 'share', label: t('reports.col.share', 'Share'), value: (r) => r.share_pct, render: (r) => fmt.pct(r.share_pct), numeric: true },
          ]}
        />
      </Panel>

      <Panel title={t('reports.financial.cost_by_course', 'Instructor cost by course')}>
        <BarList
          rows={data.instructor_cost_by_course.map((r) => ({
            label: r.course_uuid ? r.course_name : t('reports.financial.no_course', 'Not linked to a course'),
            value: r.amount,
            hint: t('reports.financial.course_cost_hint', '{{hours}} hours · {{count}} instructors', { hours: fmt.number(r.hours), count: r.instructors }),
          }))}
          format={fmt.money}
          color={SERIES.rose}
          empty={t('reports.financial.no_worklogs', 'No teaching hours logged in this period.')}
        />
      </Panel>
    </>
  )
}

function categoryLabel(t: (_k: string, _d: string) => string, key: string) {
  return t(`reports.categories.${key}`, key.replace(/_/g, ' '))
}

function methodLabel(t: (_k: string, _d: string) => string, key: string) {
  return t(`reports.payment_methods.${key}`, key.replace(/_/g, ' '))
}
