'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import {
  DataTable,
  PostgradTabs,
  StatusPill,
  selectCls,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import { getPrograms } from '@services/academic/academic'
import { displayName, getOrgStudents, stripPrefix } from '@services/academic/core'

const MEMBERSHIP_STATUSES = ['active', 'deferred', 'suspended', 'withdrawn', 'completed', 'graduated']

function StudentsDirectory({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const [program, setProgram] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')

  const { data: programs = [] } = useQuery({
    queryKey: ['academic', 'programs', orgId],
    queryFn: () => getPrograms(orgId, access_token),
    enabled: ready,
  })
  const { data: students = [], isLoading, error } = useQuery({
    queryKey: ['academic', 'students', orgId, program, status, query],
    queryFn: () => getOrgStudents(orgId, access_token, { program_uuid: program, status, q: query }),
    enabled: ready,
    retry: false,
  })

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_students', 'Students') },
        ]}
      />
      <AcademicHeader
        title={t('academic.tab_students', 'Students')}
        subtitle={t(
          'academic.students_desc',
          'One academic record per student and cohort, with a system-generated student number and status.'
        )}
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-1.5">
          <Search className="h-4 w-4 text-[hsl(var(--dash-muted))]" />
          <input
            className="w-56 bg-transparent text-sm focus:outline-none"
            placeholder={t('academic.search_students_hint', 'Name, email or student no.')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className={selectCls()} value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="">{t('academic.all_programs', 'All programs')}</option>
          {programs.map((p: any) => (
            <option key={p.program_uuid} value={p.program_uuid}>
              {p.code ? `${p.code} · ` : ''}
              {p.name}
            </option>
          ))}
        </select>
        <select className={selectCls()} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('academic.all_statuses', 'All statuses')}</option>
          {MEMBERSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`academic.state_${s}`, s)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>
      ) : (
        <DataTable
          headers={[
            t('academic.student_number', 'Student no.'),
            t('academic.student', 'Student'),
            t('academic.program'),
            t('academic.cohort', 'Cohort'),
            t('academic.current_courses', 'Current courses'),
            t('academic.admitted', 'Admitted'),
            t('academic.status'),
          ]}
          empty={isLoading ? '…' : t('academic.no_students', 'No students yet. Add students from a cohort page.')}
        >
          {students.map((s: any) => (
            <tr key={s.membership_uuid}>
              <td className={`${tdCls} font-mono text-xs font-semibold`}>{s.student_number}</td>
              <td className={tdCls}>
                <div className="font-medium">{displayName(s.user)}</div>
                <div className="text-xs text-[hsl(var(--dash-muted))]">{s.user.email}</div>
              </td>
              <td className={`${tdCls} text-xs`}>{s.program_name}</td>
              <td className={`${tdCls} text-xs`}>
                {s.program_uuid ? (
                  <Link
                    className="hover:text-[hsl(var(--dash-accent))]"
                    href={getUriWithOrg(
                      orgslug,
                      `/dash/postgraduate/${stripPrefix(s.program_uuid, 'program')}/cohort/${stripPrefix(s.cohort_uuid, 'cohort')}`
                    )}
                  >
                    {s.cohort_code || s.cohort_name}
                  </Link>
                ) : (
                  s.cohort_code || s.cohort_name
                )}
              </td>
              <td className={tdCls}>{s.enrolled_offerings}</td>
              <td className={`${tdCls} text-xs`}>{s.admitted_at?.slice(0, 10)}</td>
              <td className={tdCls}>
                <StatusPill status={s.status} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </AcademicPageShell>
  )
}

export default StudentsDirectory
