'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Buildings, SignIn, Student, UserCircleMinus, UserPlus, Users } from '@phosphor-icons/react'
import DashboardPageShell from '@components/Dashboard/Shared/DashboardPageShell'
import { useReport } from '@services/reports/reports'
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
} from './ReportKit'

const ROLE_KEYS: Record<string, string> = {
  role_global_admin: 'roles_page.role_admin',
  role_global_maintainer: 'roles_page.role_coordinator',
  role_global_instructor: 'roles_page.role_instructor',
  role_global_user: 'roles_page.role_trainee',
}

export default function PeopleReportPage() {
  const { t, i18n } = useTranslation()
  const range = useReportRange()
  const fmt = useReportFormats()
  const { data, isLoading, isError, refetch } = useReport('people', range.range)
  const ar = i18n.language.startsWith('ar')

  const onExport = data
    ? () =>
        exportCsv(
          `entities_${data.range.date_from}_${data.range.date_to}.csv`,
          ['entity', 'code', 'members', 'coordinators', 'active_learners', 'enrollments', 'completions', 'completion_rate'],
          data.entities.map((e) => [e.name_ar && ar ? e.name_ar : e.name, e.code, e.members, e.coordinators, e.active_learners, e.enrollments, e.completions, e.completion_rate])
        )
    : undefined

  return (
    <DashboardPageShell
      title={t('reports.people.title', 'Users & entities')}
      description={t('reports.people.description', 'Who is in the academy, how members joined, who is active, and how each entity is learning.')}
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
            <Kpi icon={<Users size={17} />} label={t('reports.people.members', 'Members')} value={fmt.number(data.totals.members)} hint={t('reports.people.members_hint', 'Everyone with a role in the academy')} />
            <Kpi icon={<UserPlus size={17} />} label={t('reports.people.new_members', 'New members')} value={fmt.number(data.totals.new_members)} current={data.totals.new_members} previous={data.previous.new_members} />
            <Kpi icon={<Student size={17} />} label={t('reports.people.active_learners', 'Active learners')} value={fmt.number(data.totals.active_learners)} current={data.totals.active_learners} previous={data.previous.active_learners} />
            <Kpi icon={<SignIn size={17} />} label={t('reports.people.signed_in', 'Signed in recently')} value={fmt.number(data.totals.signed_in)} hint={t('reports.people.signed_in_hint', 'Last sign-in falls in the period')} />
            <Kpi icon={<UserCircleMinus size={17} />} label={t('reports.people.never_signed_in', 'Never signed in')} value={fmt.number(data.totals.never_signed_in)} />
            <Kpi icon={<Buildings size={17} />} label={t('reports.people.entities', 'Active entities')} value={fmt.number(data.totals.entities)} hint={t('reports.people.unassigned', '{{count}} members in no entity', { count: data.unassigned_members })} />
          </KpiGrid>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title={t('reports.people.monthly_title', 'New members and active learners by month')}>
              <MonthlyChart
                data={data.monthly}
                format={fmt.number}
                series={[
                  { key: 'new_members', label: t('reports.people.new_members', 'New members'), color: SERIES.gold, kind: 'bar' },
                  { key: 'active_learners', label: t('reports.people.active_learners', 'Active learners'), color: SERIES.blue, kind: 'line' },
                ]}
              />
            </Panel>
            <Panel title={t('reports.people.by_role', 'Members by role')}>
              <BarList
                rows={data.by_role.map((r) => ({ label: ROLE_KEYS[r.role_uuid] ? t(ROLE_KEYS[r.role_uuid], r.role) : r.role, value: r.count, share: r.share_pct }))}
                format={fmt.number}
                color={SERIES.blue}
                empty={t('reports.people.no_members', 'No members yet.')}
              />
            </Panel>
          </div>

          <Panel title={t('reports.people.entities_title', 'Entities')} subtitle={t('reports.people.entities_subtitle', 'Enrollments and completions are all time; active learners are for the period.')}>
            <ReportTable
              rows={data.entities}
              initialSort="members"
              empty={t('reports.people.no_entities', 'No entities have been set up yet.')}
              columns={[
                {
                  key: 'name',
                  label: t('reports.col.entity', 'Entity'),
                  value: (r) => (r.name_ar && ar ? r.name_ar : r.name),
                  render: (r) => (
                    <span className="flex flex-col">
                      <span className="font-semibold" dir="auto">{r.name_ar && ar ? r.name_ar : r.name}</span>
                      {r.code ? <span className="text-[11.5px] text-[hsl(var(--dash-muted))]" dir="ltr">{r.code}</span> : null}
                    </span>
                  ),
                },
                { key: 'members', label: t('reports.col.members', 'Members'), value: (r) => r.members, numeric: true },
                { key: 'coordinators', label: t('reports.col.coordinators', 'Coordinators'), value: (r) => r.coordinators, numeric: true },
                { key: 'active', label: t('reports.col.active', 'Active'), value: (r) => r.active_learners, numeric: true },
                { key: 'enrollments', label: t('reports.col.enrollments', 'Enrollments'), value: (r) => r.enrollments, numeric: true },
                { key: 'completions', label: t('reports.col.completed', 'Completed'), value: (r) => r.completions, numeric: true },
                { key: 'rate', label: t('reports.col.completion_rate', 'Completion'), value: (r) => r.completion_rate, render: (r) => fmt.pct(r.completion_rate), numeric: true },
              ]}
            />
          </Panel>
        </>
      )}
    </DashboardPageShell>
  )
}
