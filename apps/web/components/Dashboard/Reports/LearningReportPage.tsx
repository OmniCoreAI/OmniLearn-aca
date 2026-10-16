'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { BookOpenText, CheckCircle, Medal, Student, Target, UserPlus } from '@phosphor-icons/react'
import DashboardPageShell from '@components/Dashboard/Shared/DashboardPageShell'
import { useReport } from '@services/reports/reports'
import MonthlyChart, { SERIES } from './MonthlyChart'
import {
  BackToReports,
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
} from './ReportKit'

export default function LearningReportPage() {
  const { t } = useTranslation()
  const range = useReportRange()
  const fmt = useReportFormats()
  const { data, isLoading, isError, refetch } = useReport('learning', range.range)

  const onExport = data
    ? () =>
        exportCsv(
          `learning_${data.range.date_from}_${data.range.date_to}.csv`,
          ['course', 'lessons', 'enrolled', 'new_enrollments', 'active_learners', 'completed', 'completion_rate', 'avg_progress'],
          data.courses.map((c) => [c.course_name, c.lessons, c.enrolled, c.new_enrollments, c.active_learners, c.completed, c.completion_rate, c.avg_progress])
        )
    : undefined

  return (
    <DashboardPageShell
      title={t('reports.learning.title', 'Learning & completion')}
      description={t('reports.learning.description', 'Enrollments, completions and how actively learners study, overall and per course.')}
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
            <Kpi icon={<UserPlus size={17} />} label={t('reports.learning.enrollments', 'New enrollments')} value={fmt.number(data.totals.enrollments)} current={data.totals.enrollments} previous={data.previous.enrollments} />
            <Kpi icon={<CheckCircle size={17} />} label={t('reports.learning.completions', 'Course completions')} value={fmt.number(data.totals.completions)} current={data.totals.completions} previous={data.previous.completions} />
            <Kpi icon={<Student size={17} />} label={t('reports.learning.active_learners', 'Active learners')} value={fmt.number(data.totals.active_learners)} current={data.totals.active_learners} previous={data.previous.active_learners} />
            <Kpi icon={<BookOpenText size={17} />} label={t('reports.learning.lessons', 'Lessons completed')} value={fmt.number(data.totals.lessons_completed)} current={data.totals.lessons_completed} previous={data.previous.lessons_completed} />
            <Kpi icon={<Medal size={17} />} label={t('reports.learning.certificates', 'Certificates issued')} value={fmt.number(data.totals.certificates)} current={data.totals.certificates} previous={data.previous.certificates} />
            <Kpi icon={<Target size={17} />} label={t('reports.learning.completion_rate', 'Overall completion rate')} value={fmt.pct(data.overall_completion_rate)} hint={t('reports.learning.completion_rate_hint', 'Of all {{count}} enrollments, all time', { count: data.total_enrolled })} />
          </KpiGrid>

          <Panel title={t('reports.learning.monthly_title', 'Enrollments and completions by month')} subtitle={t('reports.learning.monthly_subtitle', 'Active learners completed at least one lesson that month.')}>
            <MonthlyChart
              data={data.monthly}
              format={fmt.number}
              series={[
                { key: 'enrollments', label: t('reports.learning.enrollments', 'New enrollments'), color: SERIES.gold, kind: 'bar' },
                { key: 'completions', label: t('reports.learning.completions', 'Course completions'), color: SERIES.green, kind: 'bar' },
                { key: 'active_learners', label: t('reports.learning.active_learners', 'Active learners'), color: SERIES.blue, kind: 'line' },
              ]}
            />
          </Panel>

          <Panel title={t('reports.learning.courses_title', 'By course')} subtitle={t('reports.learning.courses_subtitle', 'Enrolled and completed are all time; new and active are for the period.')}>
            <ReportTable
              rows={data.courses}
              initialSort="enrolled"
              empty={t('reports.learning.no_courses', 'No enrollments yet.')}
              columns={[
                {
                  key: 'name',
                  label: t('reports.col.course', 'Course'),
                  value: (r) => r.course_name,
                  render: (r) => (
                    <Link href={`/dash/courses/course/${r.course_uuid.replace('course_', '')}/general`} className="font-semibold hover:underline" dir="auto">
                      {r.course_name}
                    </Link>
                  ),
                },
                { key: 'lessons', label: t('reports.col.lessons', 'Lessons'), value: (r) => r.lessons, numeric: true },
                { key: 'enrolled', label: t('reports.col.enrolled', 'Enrolled'), value: (r) => r.enrolled, numeric: true },
                { key: 'new', label: t('reports.col.new', 'New'), value: (r) => r.new_enrollments, numeric: true },
                { key: 'active', label: t('reports.col.active', 'Active'), value: (r) => r.active_learners, numeric: true },
                { key: 'completed', label: t('reports.col.completed', 'Completed'), value: (r) => r.completed, numeric: true },
                {
                  key: 'rate',
                  label: t('reports.col.completion_rate', 'Completion'),
                  value: (r) => r.completion_rate,
                  numeric: true,
                  render: (r) => (
                    <span className="inline-flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[hsl(220_14%_93%)] sm:inline-block">
                        <span className="block h-full rounded-full" style={{ width: `${r.completion_rate}%`, background: SERIES.green }} />
                      </span>
                      {fmt.pct(r.completion_rate)}
                    </span>
                  ),
                },
                { key: 'progress', label: t('reports.col.avg_progress', 'Avg. progress'), value: (r) => r.avg_progress, render: (r) => fmt.pct(r.avg_progress), numeric: true },
              ]}
            />
          </Panel>
        </>
      )}
    </DashboardPageShell>
  )
}
