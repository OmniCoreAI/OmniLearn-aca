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
import { Field, SubmitRow, inputCls } from '../postgraduate/client'
import {
  getTrainingPrograms,
  createTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram,
} from '@services/academic/academic'

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
              className="rounded-lg bg-black text-white text-xs font-bold px-5 py-2 flex items-center gap-2 nice-shadow hover:scale-105 transition-all"
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
            badges={[
              { label: t(`academic.type_${p.training_type}`), className: 'bg-orange-100 text-orange-700' },
              p.published
                ? { label: t('academic.published'), className: 'bg-green-100 text-green-700' }
                : { label: t('academic.draft'), className: 'bg-gray-100 text-gray-500' },
            ]}
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
        minWidth="sm"
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
  const [type, setType] = useState(program?.training_type || 'workshop')
  const [location, setLocation] = useState(program?.location || '')
  const [startDate, setStartDate] = useState(program?.start_date || '')
  const [endDate, setEndDate] = useState(program?.end_date || '')
  const [published, setPublished] = useState(program?.published ?? false)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        training_type: type,
        location,
        start_date: startDate || null,
        end_date: endDate || null,
        published,
        public: published,
      }
      if (program) {
        await updateTrainingProgram(program.trainingprogram_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createTrainingProgram(orgId, payload, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch {
      toast.error(program ? t('academic.update_failed') : t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('academic.name')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={t('academic.type')}>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`academic.type_${ty}`)}
            </option>
          ))}
        </select>
      </Field>
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
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t('academic.published')}
      </label>
      <SubmitRow saving={saving} />
    </form>
  )
}

export default TrainingProgramsHome
