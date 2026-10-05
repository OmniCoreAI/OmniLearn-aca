'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Certificate, FileText, GraduationCap, PauseCircle, PlayCircle, SignOut, SquaresFour, Student, UsersThree } from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { TranscriptView } from '@components/Dashboard/Pages/Academic/TranscriptView'
import { PostgradDrawer } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { PostgradTabs, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { getPrograms } from '@services/academic/academic'
import { displayName, getOrgStudents, stripPrefix } from '@services/academic/core'
import { cn } from '@/lib/utils'

const SEGMENTS: { key: string; Icon: React.ElementType }[] = [
  { key: 'all', Icon: SquaresFour },
  { key: 'active', Icon: PlayCircle },
  { key: 'deferred', Icon: PauseCircle },
  { key: 'suspended', Icon: PauseCircle },
  { key: 'withdrawn', Icon: SignOut },
  { key: 'completed', Icon: Certificate },
  { key: 'graduated', Icon: GraduationCap },
]

function StudentsDirectory({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAcademicContext()
  const [program, setProgram] = useState('')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [transcriptFor, setTranscriptFor] = useState<any>(null)

  const { data: programs = [] } = useQuery({ queryKey: ['academic', 'programs', orgId], queryFn: () => getPrograms(orgId, access_token), enabled: ready })
  const { data: students = [], isLoading, error } = useQuery({
    queryKey: ['academic', 'students', orgId, program],
    queryFn: () => getOrgStudents(orgId, access_token, { program_uuid: program || undefined }),
    enabled: ready,
    retry: false,
  })
  const all = students as any[]
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((s) => (status === 'all' || s.status === status) && (!q || `${displayName(s.user)} ${s.user?.email || ''} ${s.student_number}`.toLowerCase().includes(q)))
  }, [all, status, query])
  const fmt = (v?: string) => (v ? new Date(v.length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: t('academic.tab_students', 'Students') },
        ]}
      />
      <AcademicHeader title={t('academic.tab_students', 'Students')} subtitle={t('academic.students_desc', 'One academic record per student and cohort, with a system-generated student number and status.')} />
      <PostgradTabs orgslug={orgslug} />

      <div className="dash-card mb-4 grid grid-cols-2 gap-1 rounded-[1.25rem] p-1.5 sm:grid-cols-4 xl:grid-cols-7" role="tablist">
        {SEGMENTS.map(({ key, Icon }) => {
          const n = key === 'all' ? all.length : all.filter((s) => s.status === key).length
          const active = status === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(key)}
              className={cn('flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-start transition-all', active ? 'bg-[hsl(var(--dash-ink))] text-white shadow-[0_10px_24px_-12px_hsl(0_0%_8%/0.6)]' : 'hover:bg-[hsl(var(--dash-canvas))]')}
            >
              <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-white/10 text-[hsl(43_80%_62%)]' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]')}>
                <Icon size={18} weight={active ? 'fill' : 'duotone'} />
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-[11px] font-medium', active ? 'text-white/70' : 'text-[hsl(var(--dash-muted))]')}>
                  {key === 'all' ? t('academic.stu.all', 'All students') : String(t(`academic.state_${key}`, key))}
                </span>
                <span className="block text-lg font-semibold leading-tight tabular-nums">{n}</span>
              </span>
            </button>
          )
        })}
      </div>

      {error ? (
        <p className="dash-card rounded-[1.25rem] p-6 text-sm text-[hsl(var(--dash-muted))]">{(error as any)?.message}</p>
      ) : (
        <DashDataTable
          rows={visible}
          rowKey={(s: any) => s.membership_uuid}
          loading={isLoading}
          onRowClick={setTranscriptFor}
          initialSort={{ key: 'student', dir: 'asc' }}
          itemLabel={(n) => t('academic.coh.students_count', '{{count}} students', { count: n })}
          actions={(s: any) => [
            { label: t('academic.transcript', 'Transcript'), icon: <FileText size={14} />, onSelect: () => setTranscriptFor(s) },
            ...(s.program_uuid
              ? [{ label: t('academic.stu.open_intake', 'Open intake'), icon: <UsersThree size={14} />, href: getUriWithOrg(orgslug, `/dash/postgraduate/${stripPrefix(s.program_uuid, 'program')}/cohort/${stripPrefix(s.cohort_uuid, 'cohort')}`) }]
              : []),
          ]}
          toolbar={
            <>
              <ToolbarSearch value={query} onChange={setQuery} placeholder={t('academic.search_students_hint', 'Name, email or student no.')} />
              <ToolbarSelect
                label={t('academic.program')}
                value={program || 'all'}
                onChange={(v) => setProgram(v === 'all' ? '' : v)}
                options={[{ value: 'all', label: t('academic.all_programs', 'All programs') }, ...(programs as any[]).map((p) => ({ value: p.program_uuid, label: p.code ? `${p.code} · ${p.name}` : p.name }))]}
              />
            </>
          }
          empty={
            <AcademicEmptyState
              compact
              icon={<Student size={24} />}
              title={query || status !== 'all' || program ? t('administration.common.no_matches', 'No matches') : t('academic.stu.empty', 'No students yet')}
              description={t('academic.stu.empty_hint', 'Students appear here when an accepted applicant is enrolled, or when they are added to an intake directly.')}
            />
          }
          columns={[
            {
              key: 'student',
              header: t('academic.student', 'Student'),
              primary: true,
              sortValue: (s: any) => displayName(s.user),
              cell: (s: any) => (
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar name={displayName(s.user)} size={32} />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate font-medium">{displayName(s.user)}</div>
                    <div className="truncate font-mono text-[11px] text-[hsl(var(--dash-muted))]">{s.student_number}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'program',
              header: t('academic.program'),
              sortValue: (s: any) => s.program_name,
              cell: (s: any) => (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[13px]">{s.program_name}</div>
                  {s.program_uuid ? (
                    <Link
                      onClick={(e) => e.stopPropagation()}
                      className="truncate text-[11px] text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-accent))]"
                      href={getUriWithOrg(orgslug, `/dash/postgraduate/${stripPrefix(s.program_uuid, 'program')}/cohort/${stripPrefix(s.cohort_uuid, 'cohort')}`)}
                    >
                      {s.cohort_code || s.cohort_name}
                    </Link>
                  ) : (
                    <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{s.cohort_code || s.cohort_name}</div>
                  )}
                </div>
              ),
            },
            { key: 'courses', header: t('academic.current_courses', 'Current courses'), align: 'end', hideBelow: 'lg', sortValue: (s: any) => s.enrolled_offerings, cell: (s: any) => <span className="tabular-nums">{s.enrolled_offerings}</span> },
            { key: 'admitted', header: t('academic.admitted', 'Admitted'), hideBelow: 'lg', sortValue: (s: any) => s.admitted_at, cell: (s: any) => <span className="whitespace-nowrap text-[12px] text-[hsl(var(--dash-muted))]">{fmt(s.admitted_at)}</span> },
            {
              key: 'status',
              header: t('academic.status'),
              sortValue: (s: any) => s.status,
              cell: (s: any) => (
                <div className="min-w-0">
                  <StatusPill status={s.status} />
                  {s.status_reason ? (
                    <div className="mt-1 max-w-[14rem] truncate text-[11px] text-[hsl(var(--dash-muted))]" title={s.status_reason}>
                      {s.status_reason}
                    </div>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <PostgradDrawer
        isDialogOpen={!!transcriptFor}
        onOpenChange={(o: boolean) => !o && setTranscriptFor(null)}
        minWidth="lg"
        icon={<FileText size={20} weight="duotone" />}
        dialogTitle={t('academic.transcript', 'Transcript')}
        dialogDescription={transcriptFor ? `${displayName(transcriptFor.user)} · ${transcriptFor.student_number} · ${transcriptFor.program_name || ''}` : undefined}
        dialogContent={transcriptFor ? <TranscriptView membershipUuid={transcriptFor.membership_uuid} /> : null}
      />
    </AcademicPageShell>
  )
}

export default StudentsDirectory
