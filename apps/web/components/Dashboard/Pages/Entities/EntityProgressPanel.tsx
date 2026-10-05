'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { BookOpen, ChartLineUp, Student, UsersThree } from '@phosphor-icons/react'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { GhostButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminDrawer, DetailItem, PersonAvatar, formatAdminDate, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getEntityProgress } from '@services/administration/administration'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'
import { personName, useEntityGroups } from './EntityMembersPanel'

function Bar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value || 0)))
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
        <div className="h-full rounded-full bg-[hsl(var(--dash-accent))]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-end text-xs tabular-nums">{pct}%</span>
    </div>
  )
}

/** Members' enrollment, progress, certificates and last activity. */
export function EntityProgressPanel({ entityUuid }: { entityUuid: string }) {
  const { t, i18n } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed)
  const [groupUuid, setGroupUuid] = useState('all')
  const [q, setQ] = useState('')
  const [courseQ, setCourseQ] = useState('')
  const [viewing, setViewing] = useState<any>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'progress', groupUuid],
    queryFn: () => getEntityProgress(entityUuid, access_token, groupUuid === 'all' ? undefined : groupUuid),
    enabled: ready,
  })
  const members = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ((data?.members || []) as any[]).filter((m) => !needle || `${personName(m.user)} ${m.email || ''} ${m.employee_id || ''}`.toLowerCase().includes(needle))
  }, [data, q])
  const courses = useMemo(() => {
    const needle = courseQ.trim().toLowerCase()
    return ((data?.courses || []) as any[]).filter((c) => !needle || String(c.course_name).toLowerCase().includes(needle))
  }, [data, courseQ])
  const totalMembers = data?.total_members ?? 0

  const exportCsv = () => {
    const safe = (v: any) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v)
    const headers = ['member', 'email', 'employee_id', 'position', 'enrolled', 'in_progress', 'completed', 'average_progress', 'certificates', 'last_activity']
    const rows = members.map((m) =>
      [personName(m.user), m.email || '', m.employee_id || '', m.position_name || '', m.enrolled, m.in_progress, m.completed, m.average_progress, m.certificates, m.last_activity || ''].map(safe)
    )
    downloadCsv('organization-progress.csv', toCsv(headers, rows))
  }

  return (
    <div className="space-y-6">
      <DashStatCards
        loading={isLoading}
        stats={[
          { key: 'members', label: t('entities.members', 'Members'), value: totalMembers, icon: UsersThree, tone: 'stone' },
          {
            key: 'learners',
            label: t('entities.progress.learners', 'Learning now'),
            value: data?.active_learners ?? 0,
            icon: Student,
            tone: 'gold',
            progress: totalMembers ? (data?.active_learners ?? 0) / totalMembers : undefined,
          },
          { key: 'courses', label: t('entities.progress.courses', 'Courses'), value: (data?.courses || []).length, icon: BookOpen, tone: 'sand' },
          {
            key: 'completion',
            label: t('entities.progress.completion', 'Completion rate'),
            value: `${data?.completion_rate ?? 0}%`,
            icon: ChartLineUp,
            tone: 'rose',
            progress: (data?.completion_rate ?? 0) / 100,
          },
        ]}
      />

      <DashDataTable
        rows={members}
        rowKey={(m: any) => m.member_uuid}
        loading={isLoading}
        onRowClick={setViewing}
        initialSort={{ key: 'progress', dir: 'desc' }}
        itemLabel={(n) => t('entities.members_count', '{{count}} members', { count: n })}
        toolbar={
          <>
            <span className="me-1 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('entities.progress.by_member', 'By member')}</span>
            <ToolbarSearch value={q} onChange={setQ} placeholder={t('entities.search_members', 'Search by name, email or employee ID')} />
            {groups.length ? (
              <ToolbarSelect
                label={t('entities.group', 'Group')}
                value={groupUuid}
                onChange={setGroupUuid}
                options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...groups.map((g) => ({ value: g.usergroup_uuid, label: g.name }))]}
              />
            ) : null}
          </>
        }
        toolbarEnd={
          <GhostButton onClick={exportCsv} disabled={!members.length}>
            <Download className="h-3.5 w-3.5" /> {t('administration.common.export_csv', 'Export CSV')}
          </GhostButton>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<UsersThree size={24} />}
            title={q ? t('administration.common.no_matches', 'No matches') : t('entities.no_members', 'No members yet')}
            description={q ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.') : t('entities.no_progress_hint', 'Progress appears once members are enrolled in training.')}
          />
        }
        columns={[
          {
            key: 'member',
            header: t('entities.member', 'Member'),
            primary: true,
            sortValue: (m: any) => personName(m.user),
            cell: (m: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={personName(m.user)} size={32} />
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-medium">{personName(m.user)}</div>
                  <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{[m.position_name, m.employee_id].filter(Boolean).join(' · ') || m.email}</div>
                </div>
              </div>
            ),
          },
          { key: 'enrolled', header: t('entities.progress.enrolled', 'Enrolled'), align: 'end', sortValue: (m: any) => m.enrolled, cell: (m: any) => <span className="tabular-nums">{m.enrolled}</span> },
          { key: 'completed', header: t('entities.progress.completed', 'Completed'), align: 'end', sortValue: (m: any) => m.completed, cell: (m: any) => <span className="tabular-nums">{m.completed}</span> },
          { key: 'progress', header: t('entities.progress.average', 'Average progress'), align: 'end', sortValue: (m: any) => m.average_progress, cell: (m: any) => <Bar value={m.average_progress} /> },
          {
            key: 'certificates',
            header: t('entities.progress.certificates', 'Certificates'),
            align: 'end',
            hideBelow: 'lg',
            hideOnMobile: true,
            sortValue: (m: any) => m.certificates,
            cell: (m: any) => <span className="tabular-nums">{m.certificates}</span>,
          },
          {
            key: 'activity',
            header: t('entities.progress.last_activity', 'Last activity'),
            hideBelow: 'xl',
            hideOnMobile: true,
            sortValue: (m: any) => m.last_activity || '',
            cell: (m: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{m.last_activity ? formatAdminDate(m.last_activity, i18n.language) : '—'}</span>,
          },
        ]}
      />

      {(data?.courses || []).length > 0 ? (
        <DashDataTable
          rows={courses}
          rowKey={(c: any) => c.course_uuid}
          initialSort={{ key: 'enrolled', dir: 'desc' }}
          pageSize={10}
          itemLabel={(n) => t('entities.courses_count', '{{count}} courses', { count: n })}
          toolbar={
            <>
              <span className="me-1 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('entities.progress.by_course', 'By course')}</span>
              <ToolbarSearch value={courseQ} onChange={setCourseQ} placeholder={t('entities.search_courses', 'Search courses')} />
            </>
          }
          columns={[
            {
              key: 'course',
              header: t('entities.learning.course', 'Course'),
              primary: true,
              sortValue: (c: any) => c.course_name,
              cell: (c: any) => <span className="line-clamp-1 font-medium">{c.course_name}</span>,
            },
            { key: 'enrolled', header: t('entities.progress.enrolled', 'Enrolled'), align: 'end', sortValue: (c: any) => c.enrolled, cell: (c: any) => <span className="tabular-nums">{c.enrolled}</span> },
            { key: 'completed', header: t('entities.progress.completed', 'Completed'), align: 'end', sortValue: (c: any) => c.completed, cell: (c: any) => <span className="tabular-nums">{c.completed}</span> },
            { key: 'progress', header: t('entities.progress.average', 'Average progress'), align: 'end', sortValue: (c: any) => c.average_progress, cell: (c: any) => <Bar value={c.average_progress} /> },
          ]}
        />
      ) : null}

      <AdminDrawer
        icon={<ChartLineUp size={20} weight="duotone" />}
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? personName(viewing.user) : ''}
        description={viewing ? [viewing.position_name, viewing.employee_id, viewing.email].filter(Boolean).join(' · ') : undefined}
      >
        {viewing ? (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DetailItem label={t('entities.progress.enrolled', 'Enrolled')}>{String(viewing.enrolled)}</DetailItem>
              <DetailItem label={t('entities.progress.in_progress', 'In progress')}>{String(viewing.in_progress ?? 0)}</DetailItem>
              <DetailItem label={t('entities.progress.completed', 'Completed')}>{String(viewing.completed)}</DetailItem>
              <DetailItem label={t('entities.progress.certificates', 'Certificates')}>{String(viewing.certificates)}</DetailItem>
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t('entities.progress.courses', 'Courses')}</h3>
              {(viewing.courses || []).length ? (
                <ul className="divide-y divide-[hsl(var(--dash-border))] rounded-2xl border border-[hsl(var(--dash-border))]">
                  {viewing.courses.map((c: any) => (
                    <li key={c.course_uuid} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate">{c.course_name}</span>
                      <Bar value={c.completion_percentage} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[hsl(var(--dash-muted))]">{t('entities.progress.no_courses', 'Not enrolled in any course yet.')}</p>
              )}
            </div>
            {viewing.last_activity ? (
              <p className="text-xs text-[hsl(var(--dash-muted))]">
                {t('entities.progress.last_activity', 'Last activity')}: {formatAdminDate(viewing.last_activity, i18n.language)}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  )
}
