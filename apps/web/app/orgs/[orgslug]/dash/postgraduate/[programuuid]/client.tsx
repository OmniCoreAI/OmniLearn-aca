'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Plus, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicGrid,
  AcademicGridSkeleton,
  AcademicEmptyState,
  AcademicCard,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { AdmissionSettings } from '@components/Dashboard/Pages/Academic/AdmissionSettings'
import {
  DataTable,
  GhostButton,
  PostgradTabs,
  Section,
  Stat,
  StatusPill,
  tdCls,
  useAcademicContext,
} from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  getProgram,
  getProgramCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
} from '@services/academic/academic'
import {
  cloneCurriculum,
  createCurriculum,
  displayName,
  getProgramCurricula,
  getTerms,
  stripPrefix,
} from '@services/academic/core'

const STATUSES = ['upcoming', 'active', 'completed', 'archived']
const STATUS_BADGE: Record<string, string> = {
  upcoming: 'bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]',
  active: 'bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]',
  completed: 'bg-[hsl(var(--dash-tile-sky))] text-[hsl(var(--dash-tile-sky-fg))]',
  archived: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
}

function ProgramDetail({ orgslug, programuuid }: { orgslug: string; programuuid: string }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const queryClient = useQueryClient()
  const program_uuid = `program_${programuuid}`

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [curriculumModal, setCurriculumModal] = useState<null | { cloneFrom?: any }>(null)

  const { data: program } = useQuery({
    queryKey: ['academic', 'program', program_uuid],
    queryFn: () => getProgram(program_uuid, access_token),
    enabled: !!access_token,
  })

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ['academic', 'cohorts', program_uuid],
    queryFn: () => getProgramCohorts(program_uuid, access_token),
    enabled: !!access_token,
    staleTime: 30_000,
  })

  const { data: curricula = [] } = useQuery({
    queryKey: ['academic', 'curricula', program_uuid],
    queryFn: () => getProgramCurricula(program_uuid, access_token),
    enabled: !!access_token,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'cohorts', program_uuid] })
    queryClient.invalidateQueries({ queryKey: ['academic', 'curricula', program_uuid] })
  }

  const handleDelete = async (c: any) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteCohort(c.cohort_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  const duration = (months?: number | null) =>
    months ? t('academic.n_months', { count: months, defaultValue: `${months} months` }) : '—'

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('academic.postgraduate_studies'),
            href: getUriWithOrg(orgslug, '/dash/postgraduate'),
            icon: <GraduationCap size={14} />,
          },
          { label: program?.name || t('academic.program') },
        ]}
      />
      <AcademicHeader
        title={program?.name || t('academic.program')}
        subtitle={[program?.code, program ? t(`academic.level_${program.program_level}`) : null]
          .filter(Boolean)
          .join(' · ')}
      />
      <PostgradTabs orgslug={orgslug} />

      <div className="space-y-6">
        <Section title={t('academic.overview', 'Overview')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label={t('academic.code')} value={program?.code} />
            <Stat label={t('academic.status')} value={<StatusPill status={program?.status} />} />
            <Stat label={t('academic.faculty', 'Faculty / School')} value={program?.faculty} />
            <Stat label={t('academic.department', 'Department')} value={program?.department} />
            <Stat label={t('academic.min_credits', 'Minimum credits')} value={program?.min_credits} />
            <Stat label={t('academic.duration', 'Duration')} value={duration(program?.duration_months)} />
            <Stat label={t('academic.max_duration', 'Maximum duration')} value={duration(program?.max_duration_months)} />
            <Stat
              label={t('academic.coordinator')}
              value={program?.coordinator ? displayName(program.coordinator) : '—'}
            />
            <Stat label={t('academic.cohorts')} value={cohorts.length} />
            <Stat
              label={t('academic.active_curriculum', 'Active curriculum')}
              value={curricula.find((c: any) => c.status === 'active')?.version || '—'}
            />
          </div>
          {program?.description && (
            <p className="mt-3 text-sm text-[hsl(var(--dash-muted))]">{program.description}</p>
          )}
        </Section>

        <Section
          title={t('academic.curricula', 'Curricula')}
          description={t(
            'academic.curricula_desc',
            'Versioned study plans. Each cohort follows one version, so changing the plan for a new intake never rewrites older cohorts.'
          )}
          action={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <GhostButton onClick={() => setCurriculumModal({})}>
                <Plus className="h-3.5 w-3.5" /> {t('academic.new_curriculum', 'New version')}
              </GhostButton>
            </AuthenticatedClientElement>
          }
        >
          <DataTable
            headers={[
              t('academic.version', 'Version'),
              t('academic.status'),
              t('academic.courses_count', 'Courses'),
              t('academic.credits', 'Credits'),
              t('academic.cohorts'),
              '',
            ]}
            empty={t('academic.no_curricula', 'No curriculum yet — create version 1 to define the study plan.')}
          >
            {curricula.map((c: any) => (
              <tr key={c.curriculum_uuid}>
                <td className={tdCls}>
                  <Link
                    className="font-semibold hover:text-[hsl(var(--dash-accent))]"
                    href={getUriWithOrg(
                      orgslug,
                      `/dash/postgraduate/${programuuid}/curriculum/${stripPrefix(c.curriculum_uuid, 'curriculum')}`
                    )}
                  >
                    {c.version}
                  </Link>
                  <div className="text-xs text-[hsl(var(--dash-muted))]">{c.name}</div>
                </td>
                <td className={tdCls}>
                  <StatusPill status={c.status} />
                </td>
                <td className={tdCls}>{c.items.length}</td>
                <td className={tdCls}>
                  {c.total_credits}
                  <span className="text-xs text-[hsl(var(--dash-muted))]">
                    {' '}
                    ({t('academic.required_short', 'req')} {c.required_credits} · {t('academic.elective_short', 'elec')}{' '}
                    {c.elective_credits})
                  </span>
                </td>
                <td className={tdCls}>{c.cohort_count}</td>
                <td className={`${tdCls} text-right`}>
                  <GhostButton onClick={() => setCurriculumModal({ cloneFrom: c })}>
                    <Copy className="h-3.5 w-3.5" /> {t('academic.clone_version', 'Clone')}
                  </GhostButton>
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <AdmissionSettings programUuid={program_uuid} />

        <Section
          title={t('academic.cohorts')}
          description={t('academic.cohorts_desc', 'Intakes of this program. Each cohort follows one curriculum version.')}
          action={
            <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
              <button
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
                className="flex items-center gap-2 rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white transition-all hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> {t('academic.new_cohort')}
              </button>
            </AuthenticatedClientElement>
          }
        >
          {isLoading && <AcademicGridSkeleton count={4} />}
          <AcademicGrid>
            {!isLoading && cohorts.length === 0 && (
              <AcademicEmptyState title={t('academic.no_cohorts')} description={t('academic.no_cohorts_desc')} />
            )}
            {cohorts.map((c: any) => (
              <AcademicCard
                key={c.cohort_uuid}
                orgslug={orgslug}
                href={`/dash/postgraduate/${programuuid}/cohort/${c.cohort_uuid.replace('cohort_', '')}`}
                title={c.code ? `${c.code} · ${c.name}` : c.name}
                subtitle={[
                  c.intake_term_code && `${t('academic.intake', 'Intake')} ${c.intake_term_code}`,
                  c.curriculum_version && `${t('academic.curriculum', 'Curriculum')} ${c.curriculum_version}`,
                  c.description,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                badges={[
                  { label: t(`academic.status_${c.status}`), className: STATUS_BADGE[c.status] },
                  ...(c.admission_status === 'open'
                    ? [{ label: t('academic.admissions_open', 'Admissions open'), className: 'bg-emerald-100 text-emerald-800' }]
                    : []),
                  ...(c.academic_year
                    ? [{ label: c.academic_year, className: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]' }]
                    : []),
                  {
                    label: `${c.enrolled_count ?? 0}${c.capacity != null ? `/${c.capacity}` : ''} ${t('academic.students_short', 'students')}`,
                    className: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
                  },
                ]}
                footerLabel={t('academic.cohort', 'Cohort')}
                onEdit={() => {
                  setEditing(c)
                  setModalOpen(true)
                }}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </AcademicGrid>
        </Section>
      </div>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={editing ? t('academic.edit') : t('academic.create_cohort')}
        dialogContent={
          <CohortForm
            programUuid={program_uuid}
            programCode={program?.code}
            curricula={curricula}
            cohort={editing}
            onDone={() => {
              setModalOpen(false)
              refresh()
            }}
          />
        }
      />
      <Modal
        isDialogOpen={!!curriculumModal}
        onOpenChange={(open: boolean) => !open && setCurriculumModal(null)}
        minWidth="sm"
        dialogTitle={
          curriculumModal?.cloneFrom
            ? t('academic.clone_curriculum', 'Clone curriculum {{version}}', { version: curriculumModal.cloneFrom.version })
            : t('academic.new_curriculum', 'New version')
        }
        dialogContent={
          <CurriculumForm
            programUuid={program_uuid}
            cloneFrom={curriculumModal?.cloneFrom}
            onDone={() => {
              setCurriculumModal(null)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function CurriculumForm({
  programUuid,
  cloneFrom,
  onDone,
}: {
  programUuid: string
  cloneFrom?: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { access_token } = useAcademicContext()
  const [version, setVersion] = useState(`${new Date().getFullYear()}.1`)
  const [name, setName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (cloneFrom) {
        await cloneCurriculum(cloneFrom.curriculum_uuid, { version, name: name || null }, access_token)
      } else {
        await createCurriculum(
          programUuid,
          { version, name: name || null, effective_date: effectiveDate || null },
          access_token
        )
      }
      toast.success(t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.version', 'Version')}>
          <input className={inputCls} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2026.1" required />
        </Field>
        {!cloneFrom && (
          <Field label={t('academic.effective_date', 'Effective date')}>
            <input type="date" className={inputCls} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label={t('academic.name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {cloneFrom
          ? t('academic.clone_curriculum_hint', 'The new draft copies every course slot of the source version.')
          : t('academic.new_curriculum_hint', 'Starts as a draft. Add courses, then activate it.')}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}

function CohortForm({
  programUuid,
  programCode,
  curricula,
  cohort,
  onDone,
}: {
  programUuid: string
  programCode?: string | null
  curricula: any[]
  cohort: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAcademicContext()
  const [name, setName] = useState(cohort?.name || '')
  const [description, setDescription] = useState(cohort?.description || '')
  const [status, setStatus] = useState(cohort?.status || 'upcoming')
  const [admissionStatus, setAdmissionStatus] = useState(cohort?.admission_status || 'closed')
  const [intakeTerm, setIntakeTerm] = useState<string>(cohort?.intake_term_uuid || '')
  const [curriculum, setCurriculum] = useState<string>(
    cohort?.curriculum_uuid || curricula.find((c) => c.status === 'active')?.curriculum_uuid || ''
  )
  const [capacity, setCapacity] = useState<string>(cohort?.capacity != null ? String(cohort.capacity) : '')
  const [startDate, setStartDate] = useState(cohort?.start_date || '')
  const [endDate, setEndDate] = useState(cohort?.end_date || '')
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(cohort?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(
    cohort?.coordinator ? displayName(cohort.coordinator) : undefined
  )
  const [saving, setSaving] = useState(false)

  const { data: terms = [] } = useQuery({
    queryKey: ['academic', 'terms', orgId],
    queryFn: () => getTerms(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })

  const selectedTerm = terms.find((tm: any) => tm.term_uuid === intakeTerm)
  const codePreview =
    cohort?.code ||
    (programCode && (selectedTerm?.code?.slice(-4) || startDate?.slice(0, 4))
      ? `${programCode}-${selectedTerm?.code?.slice(-4) || startDate.slice(0, 4)}`
      : null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = {
        name,
        description,
        status,
        capacity: capacity === '' ? null : Number(capacity),
        start_date: startDate || null,
        end_date: endDate || null,
        coordinator_uuid: coordinatorUuid || '',
        intake_term_uuid: intakeTerm || null,
        admission_status: admissionStatus,
      }
      if (!cohort || curriculum !== (cohort?.curriculum_uuid || '')) payload.curriculum_uuid = curriculum || null
      if (cohort) {
        await updateCohort(cohort.cohort_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createCohort(programUuid, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || (cohort ? t('academic.update_failed') : t('academic.create_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.name')}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Fall 2026 intake" />
        </Field>
        <Field label={t('academic.cohort_code', 'Cohort code')}>
          <div className="flex h-[38px] items-center rounded-lg border border-dashed border-[hsl(var(--dash-border))] px-3 text-sm text-[hsl(var(--dash-muted))]">
            {codePreview || t('academic.code_generated', 'Generated automatically')}
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.intake_term', 'Intake term')}>
          <select className={inputCls} value={intakeTerm} onChange={(e) => setIntakeTerm(e.target.value)}>
            <option value="">—</option>
            {terms.map((tm: any) => (
              <option key={tm.term_uuid} value={tm.term_uuid}>
                {tm.code} · {tm.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.curriculum_version', 'Curriculum version')}>
          <select
            className={inputCls}
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value)}
            disabled={!!cohort && cohort.offering_count > 0}
          >
            <option value="">—</option>
            {curricula
              .filter((c) => c.status !== 'retired' || c.curriculum_uuid === curriculum)
              .map((c) => (
                <option key={c.curriculum_uuid} value={c.curriculum_uuid}>
                  {c.version} ({t(`academic.state_${c.status}`, c.status)})
                </option>
              ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.status_${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.capacity')}>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder={t('academic.unlimited')}
          />
        </Field>
      </div>
      <Field label={t('academic.admission_status', 'Admissions')}>
        <select className={inputCls} value={admissionStatus} onChange={(e) => setAdmissionStatus(e.target.value)}>
          <option value="closed">{t('academic.admissions_closed_opt', 'Closed — not accepting applications')}</option>
          <option value="open">{t('academic.admissions_open_opt', 'Open — accepting applications')}</option>
        </select>
      </Field>
      <Field label={t('academic.coordinator')}>
        <CoordinatorPicker
          orgId={orgId!}
          access_token={access_token}
          value={coordinatorUuid}
          selectedLabel={coordinatorLabel}
          onChange={(uuid, label) => {
            setCoordinatorUuid(uuid)
            setCoordinatorLabel(label)
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.expected_end_date', 'Expected end date')}>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.description')}>
        <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default ProgramDetail
