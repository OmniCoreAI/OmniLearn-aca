'use client'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  CalendarDots,
  ChalkboardTeacher,
  FileText,
  GraduationCap,
  ListChecks,
  MagicWand,
  Student,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getUriWithOrg } from '@services/config/config'
import { AcademicEmptyState, AcademicPageShell } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, FormSection, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { OfferingsTable } from '@components/Dashboard/Pages/Academic/OfferingsTable'
import { TranscriptView } from '@components/Dashboard/Pages/Academic/TranscriptView'
import { PostgradDrawer, useActionDialog } from '@components/Dashboard/Pages/Academic/AcademicDialogs'
import { GhostButton, PostgradTabs, Section, StatusPill, useAcademicContext } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { PersonAvatar } from '@components/Dashboard/Pages/Administration/AdminUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect, type DashRowAction } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { getProgram, getCohort, getCohortSemesters } from '@services/academic/academic'
import {
  addCohortStudent,
  displayName,
  generateCohortOfferings,
  getCohortStudents,
  getCurriculum,
  getOfferings,
  getTerms,
  removeCohortStudent,
  updateCohortStudent,
} from '@services/academic/core'
import { cn } from '@/lib/utils'

// Statuses that withdraw current registrations and need a recorded reason.
const REASON_REQUIRED = ['deferred', 'suspended', 'withdrawn']
const MEMBERSHIP_NEXT: Record<string, string[]> = {
  active: ['deferred', 'suspended', 'withdrawn', 'completed'],
  deferred: ['active', 'withdrawn'],
  suspended: ['active', 'withdrawn'],
  completed: ['graduated', 'active'],
  withdrawn: [],
  graduated: [],
}
const GOLD = 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))]'
type Tab = 'students' | 'courses' | 'legacy'

function CohortDetail({ orgslug, programuuid, cohortuuid }: { orgslug: string; programuuid: string; cohortuuid: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const { ask, dialog } = useActionDialog()
  const program_uuid = `program_${programuuid}`
  const cohort_uuid = `cohort_${cohortuuid}`
  const [tab, setTab] = useState<Tab>('students')
  const [addOpen, setAddOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [transcriptFor, setTranscriptFor] = useState<any>(null)
  const [statusChange, setStatusChange] = useState<{ student: any; status: string } | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: program } = useQuery({ queryKey: ['academic', 'program', program_uuid], queryFn: () => getProgram(program_uuid, access_token), enabled: !!access_token })
  const { data: cohort } = useQuery({ queryKey: ['academic', 'cohort', cohort_uuid], queryFn: () => getCohort(cohort_uuid, access_token), enabled: !!access_token })
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['academic', 'cohort-students', cohort_uuid],
    queryFn: () => getCohortStudents(cohort_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: offerings = [], isLoading: loadingOfferings } = useQuery({
    queryKey: ['academic', 'offerings', orgId, 'cohort', cohort_uuid],
    queryFn: () => getOfferings(orgId, access_token, { cohort_uuid }),
    enabled: !!orgId && !!access_token,
  })
  const { data: semesters = [] } = useQuery({
    queryKey: ['academic', 'semesters', cohort_uuid],
    queryFn: () => getCohortSemesters(cohort_uuid, access_token),
    enabled: !!access_token,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohort', cohort_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohort-students', cohort_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'offerings', orgId] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohorts', program_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'overview'] })
  }

  const roster = students as any[]
  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter((s) => (statusFilter === 'all' || s.status === statusFilter) && (!q || `${displayName(s.user)} ${s.student_number} ${s.user?.email || ''}`.toLowerCase().includes(q)))
  }, [roster, query, statusFilter])
  const activeCount = roster.filter((s) => s.status === 'active').length
  const byTerm = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const o of offerings as any[]) (groups[o.term_code] ||= []).push(o)
    return Object.entries(groups)
  }, [offerings])
  const fmt = (v?: string) => (v ? new Date(v.length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  const removeRecord = async (s: any) => {
    const ok = await ask({
      title: t('academic.coh.remove_title', 'Remove {{name}} from this intake?', { name: displayName(s.user) }),
      message: t('academic.confirm_remove_student', 'Remove this admission record? Use “withdrawn” instead once the student has results.'),
      confirmText: t('academic.coh.remove', 'Remove'),
      tone: 'danger',
    })
    if (ok === null) return
    try {
      await removeCohortStudent(cohort_uuid, s.membership_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }
  const actionsFor = (s: any): DashRowAction[] => [
    { label: t('academic.transcript', 'Transcript'), icon: <FileText size={14} />, onSelect: () => setTranscriptFor(s) },
    ...(MEMBERSHIP_NEXT[s.status] || []).map((next) => ({
      label: t('academic.coh.set_status', 'Mark as {{status}}', { status: String(t(`academic.state_${next}`, next)).toLowerCase() }),
      onSelect: () => setStatusChange({ student: s, status: next }),
    })),
    { label: t('academic.coh.remove', 'Remove'), tone: 'danger' as const, onSelect: () => removeRecord(s) },
  ]

  const fill = cohort?.capacity ? Math.min(100, Math.round(((cohort.enrolled_count || 0) / cohort.capacity) * 100)) : null
  const tabs: { key: Tab; label: string; count: number; Icon: React.ElementType }[] = [
    { key: 'students', label: t('academic.tab_students', 'Students'), count: roster.length, Icon: Student },
    { key: 'courses', label: t('academic.coh.courses', 'Courses'), count: (offerings as any[]).length, Icon: ChalkboardTeacher },
    ...((semesters as any[]).length ? [{ key: 'legacy' as Tab, label: t('academic.legacy_semesters', 'Legacy semesters'), count: (semesters as any[]).length, Icon: ListChecks }] : []),
  ]

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: program?.name || t('academic.program'), href: getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`) },
          { label: cohort?.code || cohort?.name || t('academic.cohort') },
        ]}
      />
      <PostgradTabs orgslug={orgslug} />

      {/* Header */}
      <section className="dash-card mb-4 mt-2 rounded-[1.25rem] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {cohort?.code ? <span className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--dash-muted))]">{cohort.code}</span> : null}
              {cohort ? <StatusPill status={cohort.status} label={String(t(`academic.status_${cohort.status}`, cohort.status))} /> : null}
              {cohort ? (
                <StatusPill
                  status={cohort.admission_status === 'open' ? 'open' : 'closed'}
                  label={cohort.admission_status === 'open' ? t('academic.admissions_open', 'Admissions open') : t('academic.prog.admissions_closed_label', 'Admissions closed')}
                />
              ) : null}
            </div>
            <h1 className="mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl">{cohort?.name || '…'}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[hsl(var(--dash-muted))]">
              <Link href={getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`)} className="inline-flex items-center gap-1 hover:text-[hsl(var(--dash-ink))]">
                <GraduationCap size={14} /> {program?.name}
              </Link>
              {cohort?.intake_term_code ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDots size={14} /> {[cohort.intake_term_code, cohort.academic_year].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {cohort?.curriculum_uuid ? (
                <Link
                  href={getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}/curriculum/${cohort.curriculum_uuid.replace('curriculum_', '')}`)}
                  className="inline-flex items-center gap-1 hover:text-[hsl(var(--dash-ink))]"
                >
                  <ListChecks size={14} /> {t('academic.curriculum', 'Curriculum')} {cohort.curriculum_version}
                </Link>
              ) : null}
              {cohort?.coordinator ? (
                <span className="inline-flex items-center gap-1.5">
                  <PersonAvatar name={displayName(cohort.coordinator)} size={18} /> {displayName(cohort.coordinator)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 lg:w-[380px]">
            <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
              <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.tab_students', 'Students')}</p>
              <p className="text-lg font-semibold tabular-nums">
                {cohort?.enrolled_count ?? 0}
                {cohort?.capacity != null ? <span className="text-xs font-normal text-[hsl(var(--dash-muted))]"> / {cohort.capacity}</span> : null}
              </p>
              {fill != null ? (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white">
                  <div className={cn('h-full rounded-full', fill >= 100 ? 'bg-red-400' : GOLD)} style={{ width: `${fill}%` }} />
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
              <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.state_active', 'Active')}</p>
              <p className="text-lg font-semibold tabular-nums">{activeCount}</p>
            </div>
            <div className="rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
              <p className="text-[11px] text-[hsl(var(--dash-muted))]">{t('academic.coh.courses', 'Courses')}</p>
              <p className="text-lg font-semibold tabular-nums">{cohort?.offering_count ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      <div className={cn(TAB_TRACK, 'mb-5')} role="tablist">
        {tabs.map(({ key, label, count, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tabItemClass(tab === key, 'inline-flex items-center gap-1.5')}>
            <Icon size={15} weight={tab === key ? 'fill' : 'duotone'} />
            {label}
            <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', tab === key ? 'bg-white/15' : 'bg-[hsl(var(--dash-canvas))]')}>{count}</span>
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <DashDataTable
          rows={visibleStudents}
          rowKey={(s: any) => s.membership_uuid}
          loading={loadingStudents}
          onRowClick={(s: any) => setTranscriptFor(s)}
          actions={actionsFor}
          initialSort={{ key: 'student', dir: 'asc' }}
          itemLabel={(n) => t('academic.coh.students_count', '{{count}} students', { count: n })}
          toolbar={
            <>
              <ToolbarSearch value={query} onChange={setQuery} placeholder={t('academic.coh.search', 'Name or student number')} />
              <ToolbarSelect
                label={t('academic.status')}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: t('administration.common.all', 'All') },
                  ...['active', 'deferred', 'suspended', 'withdrawn', 'completed', 'graduated'].map((s) => ({ value: s, label: String(t(`academic.state_${s}`, s)) })),
                ]}
              />
            </>
          }
          toolbarEnd={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <GhostButton onClick={() => setAddOpen(true)}>
                <UserPlus size={14} /> {t('academic.add_student', 'Add student')}
              </GhostButton>
            </AuthenticatedClientElement>
          }
          empty={
            <AcademicEmptyState
              compact
              icon={<UsersThree size={24} />}
              title={query || statusFilter !== 'all' ? t('administration.common.no_matches', 'No matches') : t('academic.no_students_cohort', 'No students in this cohort yet.')}
              description={t('academic.cohort_students_desc', 'Admitting a student creates their academic record with a student number and registers them in the current required offerings.')}
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
            { key: 'courses', header: t('academic.current_courses', 'Current courses'), align: 'end', sortValue: (s: any) => s.enrolled_offerings, cell: (s: any) => <span className="tabular-nums">{s.enrolled_offerings}</span> },
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
      ) : null}

      {tab === 'courses' ? (
        <Section
          icon={<ChalkboardTeacher size={18} weight="duotone" />}
          title={t('academic.course_offerings', 'Course offerings')}
          description={t('academic.cohort_offerings_desc', 'Generated from the cohort’s curriculum for each term. Active students are registered in required courses automatically.')}
          action={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <GhostButton onClick={() => setGenerateOpen(true)} disabled={!cohort?.curriculum_uuid}>
                <MagicWand size={14} /> {t('academic.generate_offerings', 'Generate from curriculum')}
              </GhostButton>
            </AuthenticatedClientElement>
          }
        >
          {!cohort?.curriculum_uuid ? (
            <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              {t('academic.assign_curriculum_first', 'Assign a curriculum version to this cohort (Edit cohort) to generate its offerings.')}
            </p>
          ) : null}
          {byTerm.length === 0 ? (
            <OfferingsTable orgslug={orgslug} offerings={[]} loading={loadingOfferings} showCohort={false} />
          ) : (
            <div className="space-y-5">
              {byTerm.map(([term, list]) => (
                <div key={term}>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--dash-muted))]">
                    <CalendarDots size={13} /> {term}
                    <span className="h-px flex-1 bg-[hsl(var(--dash-border))]/70" />
                  </p>
                  <OfferingsTable orgslug={orgslug} offerings={list} showCohort={false} />
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {tab === 'legacy' ? (
        <Section title={t('academic.legacy_semesters', 'Legacy semesters')} description={t('academic.legacy_semesters_desc', 'Read-only structure from before course offerings. Its courses were migrated into offerings above.')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(semesters as any[]).map((s) => (
              <li key={s.semester_uuid}>
                <Link
                  className="flex items-center justify-between rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white px-4 py-3 text-sm font-medium hover:bg-[hsl(var(--dash-canvas))]/60"
                  href={getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}/cohort/${cohortuuid}/semester/${s.semester_uuid.replace('semester_', '')}`)}
                >
                  {s.name} <ArrowRight size={14} className="text-[hsl(var(--dash-muted))] rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <PostgradDrawer
        isDialogOpen={addOpen}
        onOpenChange={setAddOpen}
        icon={<UserPlus size={20} weight="duotone" />}
        dialogTitle={t('academic.add_student', 'Add student')}
        dialogDescription={t('academic.coh.add_desc', 'Admits a trainee directly, without an application. Use Admissions for the normal route.')}
        dialogContent={
          <AddStudentForm
            cohortUuid={cohort_uuid}
            onDone={() => {
              setAddOpen(false)
              refresh()
            }}
          />
        }
      />
      <PostgradDrawer
        isDialogOpen={!!statusChange}
        onOpenChange={(o: boolean) => !o && setStatusChange(null)}
        icon={<Student size={20} weight="duotone" />}
        dialogTitle={t('academic.change_student_status', 'Change student status')}
        dialogContent={
          statusChange ? (
            <StatusChangeForm
              cohortUuid={cohort_uuid}
              student={statusChange.student}
              status={statusChange.status}
              onDone={() => {
                setStatusChange(null)
                refresh()
              }}
            />
          ) : null
        }
      />
      <PostgradDrawer
        isDialogOpen={!!transcriptFor}
        onOpenChange={(o: boolean) => !o && setTranscriptFor(null)}
        minWidth="lg"
        icon={<FileText size={20} weight="duotone" />}
        dialogTitle={t('academic.transcript', 'Transcript')}
        dialogDescription={transcriptFor ? `${displayName(transcriptFor.user)} · ${transcriptFor.student_number}` : undefined}
        dialogContent={transcriptFor ? <TranscriptView membershipUuid={transcriptFor.membership_uuid} /> : null}
      />
      <PostgradDrawer
        isDialogOpen={generateOpen}
        onOpenChange={setGenerateOpen}
        icon={<MagicWand size={20} weight="duotone" />}
        dialogTitle={t('academic.generate_offerings', 'Generate from curriculum')}
        dialogDescription={t('academic.coh.generate_desc', 'Creates the term’s course offerings from the study plan and registers active students in the required ones. Running it again only adds what is missing.')}
        dialogContent={
          cohort?.curriculum_uuid ? (
            <GenerateForm
              cohortUuid={cohort_uuid}
              curriculumUuid={cohort.curriculum_uuid}
              onDone={() => {
                setGenerateOpen(false)
                refresh()
              }}
            />
          ) : null
        }
      />
      {dialog}
    </AcademicPageShell>
  )
}

function StatusChangeForm({ cohortUuid, student, status, onDone }: { cohortUuid: string; student: any; status: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const needsReason = REASON_REQUIRED.includes(status)
  const paused = t(
    'academic.status_effect_paused',
    'Current course registrations are withdrawn and program access is removed. They are restored when the student returns to active.'
  )
  const consequence: Record<string, string> = {
    deferred: paused,
    suspended: paused,
    withdrawn: t(
      'academic.status_effect_withdrawn',
      'This is final: current course registrations are withdrawn and program access is removed. Results already approved stay on the transcript.'
    ),
    active: t(
      'academic.status_effect_active',
      'Registrations withdrawn by the last deferral or suspension are restored, and the student is registered in any new required offerings. The cohort capacity applies.'
    ),
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (needsReason && !reason.trim()) return
    setSaving(true)
    try {
      await updateCohortStudent(cohortUuid, student.membership_uuid, status, access_token, reason.trim() || null)
      toast.success(t('academic.updated'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.coh.change', 'Change')} columns={1}>
        <div className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
          <PersonAvatar name={displayName(student.user)} size={32} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{displayName(student.user)}</p>
            <p className="font-mono text-[11px] text-[hsl(var(--dash-muted))]">{student.student_number}</p>
          </div>
          <StatusPill status={student.status} />
          <ArrowRight size={14} className="text-[hsl(var(--dash-muted))] rtl:rotate-180" />
          <StatusPill status={status} />
        </div>
        {consequence[status] ? (
          <p className={cn('rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed', status === 'withdrawn' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}>{consequence[status]}</p>
        ) : null}
        <Field label={needsReason ? t('academic.status_reason', 'Reason') : t('academic.status_reason_optional', 'Reason (optional)')} required={needsReason} hint={t('academic.adm.note_hint', 'Kept in the audit trail.')}>
          <textarea className={inputCls} rows={3} value={reason} required={needsReason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={needsReason && !reason.trim()} />
    </form>
  )
}

function AddStudentForm({ cohortUuid, onDone }: { cohortUuid: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [user, setUser] = useState<string | null>(null)
  const [label, setLabel] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const record = await addCohortStudent(cohortUuid, user, access_token)
      toast.success(t('academic.student_admitted', { number: record.student_number, defaultValue: `Admitted as ${record.student_number}` }))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.student', 'Student')} description={t('academic.student_number_auto', 'The student number is generated automatically.')} columns={1}>
        <Field label={t('academic.adm.applicant_account', 'Applicant account')} required>
          <CoordinatorPicker
            orgId={orgId}
            access_token={access_token}
            value={user}
            selectedLabel={label}
            onlyRoles={['role_global_user']}
            placeholder={t('academic.search_students', 'Search trainees…')}
            onChange={(uuid, l) => {
              setUser(uuid)
              setLabel(l)
            }}
          />
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={!user} submitLabel={t('academic.coh.admit', 'Admit')} />
    </form>
  )
}

function GenerateForm({ cohortUuid, curriculumUuid, onDone }: { cohortUuid: string; curriculumUuid: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [term, setTerm] = useState('')
  const [slot, setSlot] = useState('1-1')
  const [saving, setSaving] = useState(false)

  const { data: terms = [] } = useQuery({ queryKey: ['academic', 'terms', orgId], queryFn: () => getTerms(orgId, access_token), enabled: !!orgId && !!access_token })
  const { data: curriculum } = useQuery({ queryKey: ['academic', 'curriculum', curriculumUuid], queryFn: () => getCurriculum(curriculumUuid, access_token), enabled: !!access_token })
  const slots: { key: string; year: number; term: number; courses: any[] }[] = []
  ;(curriculum?.items || []).forEach((i: any) => {
    const key = `${i.year_no}-${i.term_no}`
    let s = slots.find((x) => x.key === key)
    if (!s) {
      s = { key, year: i.year_no, term: i.term_no, courses: [] }
      slots.push(s)
    }
    s.courses.push(i)
  })
  slots.sort((a, b) => a.year - b.year || a.term - b.term)
  const selected = slots.find((s) => s.key === slot)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !term) return
    setSaving(true)
    try {
      const result = await generateCohortOfferings(cohortUuid, { term_uuid: term, year_no: selected.year, term_no: selected.term }, access_token)
      toast.success(t('academic.offerings_generated', { count: result.length, defaultValue: `${result.length} offerings ready` }))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title={t('academic.curriculum_slot', 'Curriculum slot')} description={t('academic.coh.slot_hint', 'Which year and term of the study plan to run.')} columns={1}>
        {slots.length === 0 ? (
          <p className="text-sm text-[hsl(var(--dash-muted))]">{t('academic.coh.no_slots', 'The curriculum has no courses yet.')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {slots.map((s) => (
              <label key={s.key} className="cursor-pointer">
                <input type="radio" name="slot" className="peer sr-only" checked={slot === s.key} onChange={() => setSlot(s.key)} />
                <span className="block rounded-2xl border border-[hsl(var(--dash-border))] bg-white px-3 py-2.5 transition-all peer-checked:border-[hsl(var(--dash-ink))] peer-checked:shadow-[0_0_0_1px_hsl(var(--dash-ink))]">
                  <span className="block text-sm font-semibold">
                    {t('academic.year_n', { n: s.year, defaultValue: `Year ${s.year}` })} · {t('academic.term_n', { n: s.term, defaultValue: `Term ${s.term}` })}
                  </span>
                  <span className="block text-[11.5px] text-[hsl(var(--dash-muted))]">{t('academic.coh.n_courses', '{{count}} courses', { count: s.courses.length })}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {selected ? (
          <ul className="divide-y divide-[hsl(var(--dash-border))]/60 overflow-hidden rounded-2xl border border-[hsl(var(--dash-border))]/70">
            {selected.courses.map((c) => (
              <li key={c.curriculum_item_uuid} className="flex items-center gap-2 bg-white px-3 py-2 text-[13px]">
                <span className="rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 py-0.5 font-mono text-[10.5px] text-[hsl(var(--dash-muted))]">{c.course_code}</span>
                <span className="min-w-0 flex-1 truncate">{c.course_name}</span>
                <StatusPill status={c.requirement} />
              </li>
            ))}
          </ul>
        ) : null}
      </FormSection>
      <FormSection title={t('academic.term', 'Term')} columns={1}>
        <Field label={t('academic.term', 'Term')} required>
          <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} required>
            <option value="">—</option>
            {(terms as any[])
              .filter((tm) => tm.status !== 'closed')
              .map((tm) => (
                <option key={tm.term_uuid} value={tm.term_uuid}>
                  {tm.code} · {tm.name}
                </option>
              ))}
          </select>
        </Field>
      </FormSection>
      <SubmitRow saving={saving} disabled={!selected || !term} submitLabel={t('academic.coh.generate', 'Generate')} />
    </form>
  )
}

export default CohortDetail
