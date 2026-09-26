'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, UserPlus, Wand2, Trash2, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getUriWithOrg } from '@services/config/config'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { OfferingsTable } from '@components/Dashboard/Pages/Academic/OfferingsTable'
import { TranscriptView } from '@components/Dashboard/Pages/Academic/TranscriptView'
import {
  DataTable,
  GhostButton,
  IconButton,
  PostgradTabs,
  Section,
  Stat,
  StatusPill,
  selectCls,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
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

function CohortDetail({
  orgslug,
  programuuid,
  cohortuuid,
}: {
  orgslug: string
  programuuid: string
  cohortuuid: string
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const program_uuid = `program_${programuuid}`
  const cohort_uuid = `cohort_${cohortuuid}`
  const [addOpen, setAddOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [transcriptFor, setTranscriptFor] = useState<any>(null)
  const [statusChange, setStatusChange] = useState<{ student: any; status: string } | null>(null)

  const { data: program } = useQuery({
    queryKey: ['academic', 'program', program_uuid],
    queryFn: () => getProgram(program_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: cohort } = useQuery({
    queryKey: ['academic', 'cohort', cohort_uuid],
    queryFn: () => getCohort(cohort_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: students = [] } = useQuery({
    queryKey: ['academic', 'cohort-students', cohort_uuid],
    queryFn: () => getCohortStudents(cohort_uuid, access_token),
    enabled: !!access_token,
  })
  const { data: offerings = [] } = useQuery({
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
  }

  const act = async (fn: () => Promise<any>, ok = t('academic.updated')) => {
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.update_failed'))
    }
  }

  // Offerings grouped by term, in term order.
  const byTerm: Record<string, any[]> = {}
  offerings.forEach((o: any) => {
    byTerm[o.term_code] = byTerm[o.term_code] || []
    byTerm[o.term_code].push(o)
  })

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          { label: t('academic.postgraduate_studies'), href: getUriWithOrg(orgslug, '/dash/postgraduate'), icon: <GraduationCap size={14} /> },
          { label: program?.name || t('academic.program'), href: getUriWithOrg(orgslug, `/dash/postgraduate/${programuuid}`) },
          { label: cohort?.code || cohort?.name || t('academic.cohort') },
        ]}
      />
      <AcademicHeader
        title={cohort ? (cohort.code ? `${cohort.code} · ${cohort.name}` : cohort.name) : t('academic.cohort')}
        subtitle={program?.name}
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label={t('academic.status')} value={<StatusPill status={cohort?.status} />} />
          <Stat label={t('academic.cohort_code', 'Cohort code')} value={cohort?.code} />
          <Stat label={t('academic.intake', 'Intake')} value={cohort?.intake_term_code} />
          <Stat label={t('academic.academic_year')} value={cohort?.academic_year} />
          <Stat
            label={t('academic.curriculum', 'Curriculum')}
            value={
              cohort?.curriculum_uuid ? (
                <Link
                  className="hover:text-[hsl(var(--dash-accent))]"
                  href={getUriWithOrg(
                    orgslug,
                    `/dash/postgraduate/${programuuid}/curriculum/${cohort.curriculum_uuid.replace('curriculum_', '')}`
                  )}
                >
                  {cohort.curriculum_version}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <Stat
            label={t('academic.tab_students', 'Students')}
            value={`${cohort?.enrolled_count ?? 0}${cohort?.capacity != null ? `/${cohort.capacity}` : ''}`}
          />
          <Stat label={t('academic.offerings_count', 'Offerings')} value={cohort?.offering_count} />
          <Stat label={t('academic.coordinator')} value={cohort?.coordinator ? displayName(cohort.coordinator) : '—'} />
        </div>

        <Section
          title={t('academic.course_offerings', 'Course offerings')}
          description={t(
            'academic.cohort_offerings_desc',
            'Generated from the cohort’s curriculum for each term. Active students are registered in required courses automatically.'
          )}
          action={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <GhostButton onClick={() => setGenerateOpen(true)} disabled={!cohort?.curriculum_uuid}>
                <Wand2 className="h-3.5 w-3.5" /> {t('academic.generate_offerings', 'Generate from curriculum')}
              </GhostButton>
            </AuthenticatedClientElement>
          }
        >
          {!cohort?.curriculum_uuid && (
            <p className="mb-3 text-sm text-[hsl(var(--dash-muted))]">
              {t('academic.assign_curriculum_first', 'Assign a curriculum version to this cohort (Edit cohort) to generate its offerings.')}
            </p>
          )}
          {Object.keys(byTerm).length === 0 ? (
            <OfferingsTable orgslug={orgslug} offerings={[]} />
          ) : (
            <div className="space-y-4">
              {Object.entries(byTerm).map(([term, list]) => (
                <div key={term}>
                  <div className="mb-2 font-mono text-xs font-semibold text-[hsl(var(--dash-muted))]">{term}</div>
                  <OfferingsTable orgslug={orgslug} offerings={list} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t('academic.tab_students', 'Students')}
          description={t(
            'academic.cohort_students_desc',
            'Admitting a student creates their academic record with a student number and registers them in the current required offerings.'
          )}
          action={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <GhostButton onClick={() => setAddOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> {t('academic.add_student', 'Add student')}
              </GhostButton>
            </AuthenticatedClientElement>
          }
        >
          <DataTable
            headers={[
              t('academic.student_number', 'Student no.'),
              t('academic.student', 'Student'),
              t('academic.current_courses', 'Current courses'),
              t('academic.admitted', 'Admitted'),
              t('academic.status'),
              '',
            ]}
            empty={t('academic.no_students_cohort', 'No students in this cohort yet.')}
          >
            {students.map((s: any) => (
              <tr key={s.membership_uuid}>
                <td className={`${tdCls} font-mono text-xs font-semibold`}>{s.student_number}</td>
                <td className={tdCls}>
                  <div className="font-medium">{displayName(s.user)}</div>
                  <div className="text-xs text-[hsl(var(--dash-muted))]">{s.user.email}</div>
                </td>
                <td className={tdCls}>{s.enrolled_offerings}</td>
                <td className={`${tdCls} text-xs`}>{s.admitted_at?.slice(0, 10)}</td>
                <td className={tdCls}>
                  <StatusPill status={s.status} />
                  {s.status_reason && (
                    <div className="mt-1 max-w-[14rem] truncate text-[11px] text-[hsl(var(--dash-muted))]" title={s.status_reason}>
                      {s.status_reason}
                    </div>
                  )}
                </td>
                <td className={`${tdCls} whitespace-nowrap text-right`}>
                  <IconButton onClick={() => setTranscriptFor(s)} aria-label={t('academic.transcript', 'Transcript')}>
                    <FileText className="h-4 w-4" />
                  </IconButton>
                  {(MEMBERSHIP_NEXT[s.status] || []).length > 0 && (
                    <select
                      className={selectCls('py-1 text-xs')}
                      value=""
                      onChange={(e) => e.target.value && setStatusChange({ student: s, status: e.target.value })}
                    >
                      <option value="">{t('academic.change_status', 'Change status…')}</option>
                      {MEMBERSHIP_NEXT[s.status].map((st) => (
                        <option key={st} value={st}>
                          {t(`academic.state_${st}`, st)}
                        </option>
                      ))}
                    </select>
                  )}
                  <IconButton
                    tone="danger"
                    onClick={() =>
                      window.confirm(
                        t('academic.confirm_remove_student', 'Remove this admission record? Use “withdrawn” instead once the student has results.')
                      ) && act(() => removeCohortStudent(cohort_uuid, s.membership_uuid, access_token), t('academic.deleted'))
                    }
                    aria-label={t('academic.delete', 'Delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>

        {semesters.length > 0 && (
          <Section
            title={t('academic.legacy_semesters', 'Legacy semesters')}
            description={t(
              'academic.legacy_semesters_desc',
              'Read-only structure from before course offerings. Its courses were migrated into offerings above.'
            )}
          >
            <ul className="space-y-1 text-sm">
              {semesters.map((s: any) => (
                <li key={s.semester_uuid}>
                  <Link
                    className="hover:text-[hsl(var(--dash-accent))]"
                    href={getUriWithOrg(
                      orgslug,
                      `/dash/postgraduate/${programuuid}/cohort/${cohortuuid}/semester/${s.semester_uuid.replace('semester_', '')}`
                    )}
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <Modal
        isDialogOpen={addOpen}
        onOpenChange={setAddOpen}
        minWidth="sm"
        dialogTitle={t('academic.add_student', 'Add student')}
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
      <Modal
        isDialogOpen={!!statusChange}
        onOpenChange={(o: boolean) => !o && setStatusChange(null)}
        minWidth="sm"
        dialogTitle={t('academic.change_student_status', 'Change student status')}
        dialogContent={
          statusChange && (
            <StatusChangeForm
              cohortUuid={cohort_uuid}
              student={statusChange.student}
              status={statusChange.status}
              onDone={() => {
                setStatusChange(null)
                refresh()
              }}
            />
          )
        }
      />
      <Modal
        isDialogOpen={!!transcriptFor}
        onOpenChange={(o: boolean) => !o && setTranscriptFor(null)}
        minWidth="lg"
        dialogTitle={t('academic.transcript', 'Transcript')}
        dialogContent={transcriptFor && <TranscriptView membershipUuid={transcriptFor.membership_uuid} />}
      />
      <Modal
        isDialogOpen={generateOpen}
        onOpenChange={setGenerateOpen}
        minWidth="sm"
        dialogTitle={t('academic.generate_offerings', 'Generate from curriculum')}
        dialogContent={
          cohort?.curriculum_uuid && (
            <GenerateForm
              cohortUuid={cohort_uuid}
              curriculumUuid={cohort.curriculum_uuid}
              onDone={() => {
                setGenerateOpen(false)
                refresh()
              }}
            />
          )
        }
      />
    </AcademicPageShell>
  )
}

function StatusChangeForm({
  cohortUuid,
  student,
  status,
  onDone,
}: {
  cohortUuid: string
  student: any
  status: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const needsReason = REASON_REQUIRED.includes(status)

  const consequence: Record<string, string> = {
    deferred: t(
      'academic.status_effect_paused',
      'Current course registrations are withdrawn and program access is removed. They are restored when the student returns to active.'
    ),
    suspended: t(
      'academic.status_effect_paused',
      'Current course registrations are withdrawn and program access is removed. They are restored when the student returns to active.'
    ),
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
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-xs font-semibold">{student.student_number}</span>
        <span>{displayName(student.user)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <StatusPill status={student.status} />
        <span aria-hidden>→</span>
        <StatusPill status={status} />
      </div>
      {consequence[status] && (
        <p className="rounded-lg bg-[hsl(var(--dash-canvas))] px-3 py-2 text-xs text-[hsl(var(--dash-muted))]">
          {consequence[status]}
        </p>
      )}
      <Field label={needsReason ? t('academic.status_reason', 'Reason') : t('academic.status_reason_optional', 'Reason (optional)')}>
        <textarea
          className={inputCls}
          rows={3}
          value={reason}
          required={needsReason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <SubmitRow saving={saving} />
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
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.student', 'Student')}>
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
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t('academic.student_number_auto', 'The student number is generated automatically.')}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}

function GenerateForm({
  cohortUuid,
  curriculumUuid,
  onDone,
}: {
  cohortUuid: string
  curriculumUuid: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [term, setTerm] = useState('')
  const [slot, setSlot] = useState('1-1')
  const [saving, setSaving] = useState(false)

  const { data: terms = [] } = useQuery({
    queryKey: ['academic', 'terms', orgId],
    queryFn: () => getTerms(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const { data: curriculum } = useQuery({
    queryKey: ['academic', 'curriculum', curriculumUuid],
    queryFn: () => getCurriculum(curriculumUuid, access_token),
    enabled: !!access_token,
  })
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
  const selected = slots.find((s) => s.key === slot)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !term) return
    setSaving(true)
    try {
      const result = await generateCohortOfferings(
        cohortUuid,
        { term_uuid: term, year_no: selected.year, term_no: selected.term },
        access_token
      )
      toast.success(t('academic.offerings_generated', { count: result.length, defaultValue: `${result.length} offerings ready` }))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.curriculum_slot', 'Curriculum slot')}>
        <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value)}>
          {slots.map((s) => (
            <option key={s.key} value={s.key}>
              {t('academic.year_n', { n: s.year, defaultValue: `Year ${s.year}` })} ·{' '}
              {t('academic.term_n', { n: s.term, defaultValue: `Term ${s.term}` })} ({s.courses.length})
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <ul className="rounded-lg bg-[hsl(var(--dash-canvas))] p-3 text-xs">
          {selected.courses.map((c) => (
            <li key={c.curriculum_item_uuid}>
              <span className="font-mono">{c.course_code}</span> {c.course_name} ·{' '}
              {t(`academic.state_${c.requirement}`, c.requirement)}
            </li>
          ))}
        </ul>
      )}
      <Field label={t('academic.term', 'Term')}>
        <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} required>
          <option value="">—</option>
          {terms
            .filter((tm: any) => tm.status !== 'closed')
            .map((tm: any) => (
              <option key={tm.term_uuid} value={tm.term_uuid}>
                {tm.code} · {tm.name}
              </option>
            ))}
        </select>
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default CohortDetail
