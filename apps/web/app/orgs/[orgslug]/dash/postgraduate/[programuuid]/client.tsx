'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicGrid,
  AcademicEmptyState,
  AcademicCard,
} from '@components/Dashboard/Pages/Academic/AcademicShared'
import { Field, SubmitRow, inputCls } from '../client'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import {
  getProgram,
  getProgramCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
} from '@services/academic/academic'

const STATUSES = ['upcoming', 'active', 'completed', 'archived']
const STATUS_BADGE: Record<string, string> = {
  upcoming: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-500',
}

function ProgramDetail({ orgslug, programuuid }: { orgslug: string; programuuid: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const program_uuid = `program_${programuuid}`

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'cohorts', program_uuid] })

  const handleDelete = async (c: any) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteCohort(c.cohort_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

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
        subtitle={t('academic.cohorts')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="programs" orgId={orgId!}>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="rounded-lg bg-black text-white text-xs font-bold px-5 py-2 flex items-center gap-2 nice-shadow hover:scale-105 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.new_cohort')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <AcademicGrid>
        {!isLoading && cohorts.length === 0 && (
          <AcademicEmptyState title={t('academic.no_cohorts')} description={t('academic.no_cohorts_desc')} />
        )}
        {cohorts.map((c: any) => (
          <AcademicCard
            key={c.cohort_uuid}
            orgslug={orgslug}
            href={`/dash/postgraduate/${programuuid}/cohort/${c.cohort_uuid.replace('cohort_', '')}`}
            title={c.name}
            subtitle={c.description}
            badges={[
              { label: t(`academic.status_${c.status}`), className: STATUS_BADGE[c.status] },
              ...(c.academic_year ? [{ label: c.academic_year, className: 'bg-slate-100 text-slate-600' }] : []),
              {
                label: `${c.enrolled_count ?? 0}${c.capacity != null ? `/${c.capacity}` : ''} ${t('academic.enrolled_short')}`,
                className: 'bg-gray-100 text-gray-600',
              },
            ]}
            onEdit={() => {
              setEditing(c)
              setModalOpen(true)
            }}
            onDelete={() => handleDelete(c)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="sm"
        dialogTitle={editing ? t('academic.edit') : t('academic.create_cohort')}
        dialogContent={
          <CohortForm
            programUuid={program_uuid}
            access_token={access_token}
            cohort={editing}
            onDone={() => {
              setModalOpen(false)
              refresh()
            }}
          />
        }
      />
    </AcademicPageShell>
  )
}

function CohortForm({
  programUuid,
  access_token,
  cohort,
  onDone,
}: {
  programUuid: string
  access_token: string
  cohort: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const [name, setName] = useState(cohort?.name || '')
  const [description, setDescription] = useState(cohort?.description || '')
  const [status, setStatus] = useState(cohort?.status || 'upcoming')
  const [academicYear, setAcademicYear] = useState(cohort?.academic_year || '')
  const [capacity, setCapacity] = useState<string>(cohort?.capacity != null ? String(cohort.capacity) : '')
  const [startDate, setStartDate] = useState(cohort?.start_date || '')
  const [endDate, setEndDate] = useState(cohort?.end_date || '')
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(cohort?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(
    cohort?.coordinator ? `${cohort.coordinator.first_name || ''} ${cohort.coordinator.last_name || ''}`.trim() || cohort.coordinator.username : undefined
  )
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        status,
        academic_year: academicYear || null,
        capacity: capacity === '' ? null : Number(capacity),
        start_date: startDate || null,
        end_date: endDate || null,
        coordinator_uuid: coordinatorUuid || '',
      }
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
      <Field label={t('academic.name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.academic_year')}>
          <input className={inputCls} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025/2026" />
        </Field>
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.status_${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
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
        <Field label={t('academic.capacity')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.end_date')}>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t('academic.description')}>
        <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default ProgramDetail
