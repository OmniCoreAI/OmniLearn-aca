'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { DataTable, GhostButton, Section, Stat, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { SearchBox, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getEntityProgress } from '@services/administration/administration'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'
import { personName, useEntityGroups } from './EntityMembersPanel'

function Bar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
        <div className="h-full rounded-full bg-[hsl(var(--dash-accent))]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="text-xs">{value}%</span>
    </div>
  )
}

/** Members' enrollment, progress, certificates and last activity. */
export function EntityProgressPanel({ entityUuid }: { entityUuid: string }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed)
  const [groupUuid, setGroupUuid] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'progress', groupUuid],
    queryFn: () => getEntityProgress(entityUuid, access_token, groupUuid || undefined),
    enabled: ready,
  })
  const needle = q.trim().toLowerCase()
  const members = ((data?.members || []) as any[]).filter(
    (m) => !needle || `${personName(m.user)} ${m.email || ''} ${m.employee_id || ''}`.toLowerCase().includes(needle)
  )

  const exportCsv = () => {
    const safe = (v: any) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v)
    const headers = ['member', 'email', 'employee_id', 'position', 'enrolled', 'in_progress', 'completed', 'average_progress', 'certificates', 'last_activity']
    const rows = members.map((m) =>
      [personName(m.user), m.email || '', m.employee_id || '', m.position_name || '', m.enrolled, m.in_progress, m.completed, m.average_progress, m.certificates, m.last_activity || ''].map(safe)
    )
    downloadCsv('entity-progress.csv', toCsv(headers, rows))
  }

  if (isLoading) return <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('entities.members', 'Members')} value={data?.total_members ?? 0} />
        <Stat label={t('entities.progress.learners', 'Learning now')} value={data?.active_learners ?? 0} />
        <Stat label={t('entities.progress.courses', 'Courses')} value={(data?.courses || []).length} />
        <Stat label={t('entities.progress.completion', 'Completion rate')} value={`${data?.completion_rate ?? 0}%`} />
      </div>

      {(data?.courses || []).length > 0 && (
        <Section title={t('entities.progress.by_course', 'By course')}>
          <DataTable headers={[t('entities.learning.course', 'Course'), t('entities.progress.enrolled', 'Enrolled'), t('entities.progress.completed', 'Completed'), t('entities.progress.average', 'Average progress')]}>
            {(data.courses as any[]).map((c) => (
              <tr key={c.course_uuid}>
                <td className={tdCls}>{c.course_name}</td>
                <td className={tdCls}>{c.enrolled}</td>
                <td className={tdCls}>{c.completed}</td>
                <td className={tdCls}><Bar value={c.average_progress} /></td>
              </tr>
            ))}
          </DataTable>
        </Section>
      )}

      <Section
        title={t('entities.progress.by_member', 'By member')}
        action={
          <GhostButton onClick={exportCsv} disabled={!members.length}>
            <Download className="h-3.5 w-3.5" /> CSV
          </GhostButton>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchBox value={q} onChange={setQ} placeholder={t('entities.search_members', 'Search by name, email or employee ID')} />
          </div>
          <select className={`${inputCls} mb-4 w-48`} value={groupUuid} onChange={(e) => setGroupUuid(e.target.value)}>
            <option value="">{t('entities.all_groups', 'All groups')}</option>
            {groups.map((g) => (
              <option key={g.usergroup_uuid} value={g.usergroup_uuid}>{g.name}</option>
            ))}
          </select>
        </div>
        <DataTable
          headers={['', t('entities.member', 'Member'), t('entities.progress.enrolled', 'Enrolled'), t('entities.progress.completed', 'Completed'), t('entities.progress.average', 'Average progress'), t('entities.progress.certificates', 'Certificates'), t('entities.progress.last_activity', 'Last activity')]}
          empty={t('entities.no_members', 'No members yet.')}
        >
          {members.flatMap((m) => {
            const expanded = open === m.member_uuid
            const rows = [
              <tr key={m.member_uuid}>
                <td className={tdCls}>
                  {m.courses.length > 0 && (
                    <button type="button" onClick={() => setOpen(expanded ? null : m.member_uuid)} aria-label="toggle">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
                    </button>
                  )}
                </td>
                <td className={tdCls}>
                  <div className="font-medium">{personName(m.user)}</div>
                  <div className="text-xs text-[hsl(var(--dash-muted))]">{[m.position_name, m.employee_id].filter(Boolean).join(' · ') || m.email}</div>
                </td>
                <td className={tdCls}>{m.enrolled}</td>
                <td className={tdCls}>{m.completed}</td>
                <td className={tdCls}><Bar value={m.average_progress} /></td>
                <td className={tdCls}>{m.certificates}</td>
                <td className={`${tdCls} whitespace-nowrap text-xs`}>{m.last_activity ? String(m.last_activity).slice(0, 16) : '—'}</td>
              </tr>,
            ]
            if (expanded) {
              rows.push(
                <tr key={`${m.member_uuid}-courses`}>
                  <td />
                  <td colSpan={6} className="px-3 pb-3">
                    <div className="space-y-1">
                      {m.courses.map((c: any) => (
                        <div key={c.course_uuid} className="flex items-center justify-between rounded-lg bg-[hsl(var(--dash-canvas))] px-3 py-1.5 text-xs">
                          <span>{c.course_name}</span>
                          <Bar value={c.completion_percentage} />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            }
            return rows
          })}
        </DataTable>
      </Section>
    </div>
  )
}
