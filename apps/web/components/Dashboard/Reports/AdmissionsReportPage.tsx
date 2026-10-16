'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, ClockCountdown, FileText, GraduationCap, HourglassMedium, PaperPlaneTilt, Percent, UsersThree } from '@phosphor-icons/react'
import DashboardPageShell from '@components/Dashboard/Shared/DashboardPageShell'
import { useReport, type AdmissionsGroupRow } from '@services/reports/reports'
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
  exportCsv,
  useReportFormats,
  useReportRange,
  type Column,
} from './ReportKit'

export default function AdmissionsReportPage() {
  const { t } = useTranslation()
  const range = useReportRange()
  const fmt = useReportFormats()
  const { data, isLoading, isError, refetch } = useReport('admissions', range.range)

  const statusLabel = (s: string) => t(`reports.admissions.status.${s}`, s.replace(/_/g, ' '))
  const groupColumns = (label: string): Column<AdmissionsGroupRow>[] => [
    { key: 'name', label, value: (r) => r.name, render: (r) => <span className="font-semibold" dir="auto">{r.name}</span> },
    { key: 'submitted', label: t('reports.admissions.submitted', 'Submitted'), value: (r) => r.submitted, numeric: true },
    { key: 'pending', label: t('reports.admissions.pending', 'Awaiting decision'), value: (r) => r.pending, numeric: true },
    { key: 'accepted', label: t('reports.admissions.accepted', 'Accepted'), value: (r) => r.accepted, numeric: true },
    { key: 'rejected', label: t('reports.admissions.rejected', 'Rejected'), value: (r) => r.rejected, numeric: true },
    { key: 'enrolled', label: t('reports.admissions.enrolled', 'Enrolled'), value: (r) => r.enrolled, numeric: true },
    { key: 'rate', label: t('reports.admissions.acceptance_rate', 'Acceptance rate'), value: (r) => r.acceptance_rate, render: (r) => fmt.pct(r.acceptance_rate), numeric: true },
  ]

  const onExport = data
    ? () =>
        exportCsv(
          `admissions_${data.range.date_from}_${data.range.date_to}.csv`,
          ['group', 'name', 'submitted', 'pending', 'accepted', 'rejected', 'enrolled', 'acceptance_rate'],
          [
            ...data.by_program.map((r) => ['program', r.name, r.submitted, r.pending, r.accepted, r.rejected, r.enrolled, r.acceptance_rate]),
            ...data.by_intake.map((r) => ['intake', r.name, r.submitted, r.pending, r.accepted, r.rejected, r.enrolled, r.acceptance_rate]),
          ]
        )
    : undefined

  return (
    <DashboardPageShell
      title={t('reports.admissions.title', 'Admissions')}
      description={t('reports.admissions.description', 'Postgraduate applications submitted in the period, how they were decided and how fast.')}
      actions={<ReportActions onExport={onExport} />}
      tabs={
        <div className="flex flex-col gap-3">
          <BackToReports />
          <RangePicker value={range} />
          {data ? <RangeCaption from={data.range.date_from} to={data.range.date_to} previousFrom={data.range.previous_from} previousTo={data.range.previous_to} /> : null}
        </div>
      }
    >
      {isError ? <ReportError onRetry={() => refetch()} /> : null}
      {isLoading || !data ? (
        isError ? null : <ReportLoading />
      ) : (
        <>
          <KpiGrid>
            <Kpi icon={<PaperPlaneTilt size={17} />} label={t('reports.admissions.submitted', 'Submitted')} value={fmt.number(data.totals.submitted)} current={data.totals.submitted} previous={data.previous.submitted} />
            <Kpi icon={<HourglassMedium size={17} />} label={t('reports.admissions.pending', 'Awaiting decision')} value={fmt.number(data.totals.pending)} hint={t('reports.admissions.pending_hint', 'Submitted or under review')} />
            <Kpi icon={<CheckCircle size={17} />} label={t('reports.admissions.accepted', 'Accepted')} value={fmt.number(data.totals.accepted)} current={data.totals.accepted} previous={data.previous.accepted} />
            <Kpi icon={<Percent size={17} />} label={t('reports.admissions.acceptance_rate', 'Acceptance rate')} value={fmt.pct(data.totals.acceptance_rate)} current={data.totals.acceptance_rate} previous={data.previous.acceptance_rate} />
            <Kpi
              icon={<ClockCountdown size={17} />}
              label={t('reports.admissions.days_to_decision', 'Days to decision')}
              value={data.totals.avg_days_to_decision === null ? '—' : fmt.number(data.totals.avg_days_to_decision)}
              current={data.totals.avg_days_to_decision ?? undefined}
              previous={data.totals.avg_days_to_decision === null ? undefined : (data.previous.avg_days_to_decision ?? undefined)}
              invert
            />
            <Kpi icon={<GraduationCap size={17} />} label={t('reports.admissions.enrolled', 'Enrolled')} value={fmt.number(data.totals.enrolled)} current={data.totals.enrolled} previous={data.previous.enrolled} />
          </KpiGrid>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title={t('reports.admissions.monthly_title', 'Applications by month')} subtitle={t('reports.admissions.monthly_subtitle', 'Submissions by submission date; decisions by decision date.')}>
              <MonthlyChart
                data={data.monthly}
                format={fmt.number}
                series={[
                  { key: 'submitted', label: t('reports.admissions.submitted', 'Submitted'), color: SERIES.gold, kind: 'bar' },
                  { key: 'decided', label: t('reports.admissions.decided', 'Decided'), color: SERIES.blue, kind: 'bar' },
                  { key: 'accepted', label: t('reports.admissions.accepted', 'Accepted'), color: SERIES.green, kind: 'line' },
                ]}
              />
            </Panel>
            <Panel title={t('reports.admissions.by_status', 'Where applications stand')}>
              <BarList rows={data.by_status.map((r) => ({ label: statusLabel(r.status), value: r.count, share: r.share_pct }))} format={fmt.number} empty={t('reports.admissions.none', 'No applications were submitted in this period.')} />
              <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-[hsl(var(--dash-border))] pt-4 text-[12.5px]">
                <div className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-[hsl(var(--dash-muted))]"><FileText size={14} />{t('reports.admissions.documents_pending', 'Documents to review')}</dt>
                  <dd className="mt-0.5 text-[16px] font-bold tabular-nums">{fmt.number(data.documents_pending)}</dd>
                </div>
                <div className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2">
                  <dt className="text-[hsl(var(--dash-muted))]">{t('reports.admissions.drafts', 'Unsubmitted drafts')}</dt>
                  <dd className="mt-0.5 text-[16px] font-bold tabular-nums">{fmt.number(data.drafts)}</dd>
                </div>
              </dl>
            </Panel>
          </div>

          <Panel title={t('reports.admissions.interviews', 'Interviews in the period')}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['scheduled', t('reports.admissions.iv_scheduled', 'Scheduled'), data.interviews.scheduled],
                ['completed', t('reports.admissions.iv_completed', 'Completed'), data.interviews.completed],
                ['no_show', t('reports.admissions.iv_no_show', 'No-show'), data.interviews.no_show],
                ['cancelled', t('reports.admissions.iv_cancelled', 'Cancelled'), data.interviews.cancelled],
              ].map(([key, label, value]) => (
                <div key={key as string} className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--dash-muted))]"><UsersThree size={14} />{label}</dt>
                  <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{fmt.number(value as number)}</dd>
                </div>
              ))}
              <div className="rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2.5">
                <dt className="text-[12px] text-[hsl(var(--dash-muted))]">{t('reports.admissions.iv_avg_score', 'Average score')}</dt>
                <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{data.interviews.avg_score === null ? '—' : fmt.number(data.interviews.avg_score)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title={t('reports.admissions.by_program', 'By program')}>
            <ReportTable rows={data.by_program} initialSort="submitted" empty={t('reports.admissions.none', 'No applications were submitted in this period.')} columns={groupColumns(t('reports.col.program', 'Program'))} />
          </Panel>
          <Panel title={t('reports.admissions.by_intake', 'By intake')}>
            <ReportTable rows={data.by_intake} initialSort="submitted" empty={t('reports.admissions.none', 'No applications were submitted in this period.')} columns={groupColumns(t('reports.col.intake', 'Intake'))} />
          </Panel>
        </>
      )}
    </DashboardPageShell>
  )
}
