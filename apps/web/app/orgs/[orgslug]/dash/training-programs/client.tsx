'use client'
import React, { useState } from 'react'
import { Award, Plus } from 'lucide-react'
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
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { Field, SubmitRow, inputCls } from '../postgraduate/client'
import {
  getTrainingPrograms,
  createTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram,
} from '@services/academic/academic'
import { getTrainingProgramThumbnailMediaDirectory } from '@services/media/media'

const TYPES = [
  'training_course',
  'workshop',
  'event',
  'bootcamp',
  'conference',
  'seminar',
  'certification_program',
]

function TrainingProgramsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['academic', 'training-programs', orgId],
    queryFn: () => getTrainingPrograms(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'training-programs', orgId] })

  const handleDelete = async (p: any) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteTrainingProgram(p.trainingprogram_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  const badgesFor = (p: any) => {
    const badges: { label: string; className?: string }[] = [
      { label: t(`academic.type_${p.training_type}`), className: 'bg-orange-100 text-orange-700' },
      p.is_paid
        ? { label: t('academic.paid'), className: 'bg-indigo-100 text-indigo-700' }
        : { label: t('academic.free'), className: 'bg-teal-100 text-teal-700' },
      p.published
        ? { label: t('academic.published'), className: 'bg-green-100 text-green-700' }
        : { label: t('academic.draft'), className: 'bg-gray-100 text-gray-500' },
    ]
    if (p.in_plan === false) badges.push({ label: t('academic.out_of_plan'), className: 'bg-orange-100 text-orange-700' })
    return badges
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('academic.training_programs'),
            href: getUriWithOrg(orgslug, '/dash/training-programs'),
            icon: <Award size={14} />,
          },
        ]}
      />
      <AcademicHeader
        title={t('academic.training_programs')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="training_programs" orgId={orgId!}>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.new_training_program')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <AcademicGrid>
        {!isLoading && programs.length === 0 && (
          <AcademicEmptyState
            title={t('academic.no_training_programs')}
            description={t('academic.no_training_programs_desc')}
          />
        )}
        {programs.map((p: any) => (
          <AcademicCard
            key={p.trainingprogram_uuid}
            orgslug={orgslug}
            href={`/dash/training-programs/${p.trainingprogram_uuid.replace('trainingprogram_', '')}`}
            title={p.name}
            subtitle={p.description}
            badges={badgesFor(p)}
            thumbnailUrl={
              p.thumbnail_image && org?.org_uuid
                ? getTrainingProgramThumbnailMediaDirectory(
                    org.org_uuid,
                    p.trainingprogram_uuid,
                    p.thumbnail_image
                  )
                : null
            }
            footerLabel={String(t(`academic.type_${p.training_type}`, { defaultValue: p.training_type }))}
            onEdit={() => {
              setEditing(p)
              setModalOpen(true)
            }}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={editing ? t('academic.edit') : t('academic.create_training_program')}
        dialogContent={
          <TrainingProgramForm
            orgId={orgId!}
            access_token={access_token}
            program={editing}
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

function TrainingProgramForm({
  orgId,
  access_token,
  program,
  onDone,
}: {
  orgId: number
  access_token: string
  program: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(program?.name || '')
  const [description, setDescription] = useState(program?.description || '')
  const [code, setCode] = useState(program?.code || '')
  const [type, setType] = useState(program?.training_type || 'workshop')
  const [capacity, setCapacity] = useState<string>(program?.capacity != null ? String(program.capacity) : '')
  const [isPaid, setIsPaid] = useState(program?.is_paid ?? false)
  const [price, setPrice] = useState<string>(program?.price != null ? String(program.price) : '')
  const [currency, setCurrency] = useState(program?.currency || 'USD')
  const [inPlan, setInPlan] = useState(program?.in_plan ?? true)
  const [location, setLocation] = useState(program?.location || '')
  const [startDate, setStartDate] = useState(program?.start_date || '')
  const [endDate, setEndDate] = useState(program?.end_date || '')
  const [published, setPublished] = useState(program?.published ?? false)
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(program?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(
    program?.coordinator
      ? `${program.coordinator.first_name || ''} ${program.coordinator.last_name || ''}`.trim() ||
          program.coordinator.username
      : undefined
  )
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        code,
        training_type: type,
        capacity: capacity === '' ? null : Number(capacity),
        is_paid: isPaid,
        price: isPaid && price !== '' ? Number(price) : null,
        currency: isPaid ? currency : null,
        in_plan: inPlan,
        location,
        start_date: startDate || null,
        end_date: endDate || null,
        published,
        public: published,
        coordinator_uuid: coordinatorUuid || '',
      }
      if (program) {
        await updateTrainingProgram(program.trainingprogram_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createTrainingProgram(orgId, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || (program ? t('academic.update_failed') : t('academic.create_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.name')}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('academic.code')}>
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
      </div>

      <Field label={t('academic.type')}>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`academic.type_${ty}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('academic.coordinator')}>
        <CoordinatorPicker
          orgId={orgId}
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
        <Field label={t('academic.currency')}>
          <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!isPaid} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
          {t('academic.paid')}
        </label>
        <Field label={t('academic.price')}>
          <input type="number" min={0} step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} disabled={!isPaid} />
        </Field>
      </div>

      <Field label={t('academic.location')}>
        <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>

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

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={inPlan} onChange={(e) => setInPlan(e.target.checked)} />
          {t('academic.in_plan')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          {t('academic.published')}
        </label>
      </div>

      <SubmitRow saving={saving} />
    </form>
  )
}

export default TrainingProgramsHome
