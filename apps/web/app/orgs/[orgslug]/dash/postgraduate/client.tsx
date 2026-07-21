'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Image as ImageIcon } from 'lucide-react'
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
import {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  uploadProgramImage,
} from '@services/academic/academic'
import { getProgramThumbnailMediaDirectory } from '@services/media/media'

const LEVELS = [
  { value: 'phd', labelKey: 'academic.level_phd' },
  { value: 'masters', labelKey: 'academic.level_masters' },
  { value: 'diploma', labelKey: 'academic.level_diploma' },
]

const PROGRAM_STATUSES = ['draft', 'active', 'suspended', 'archived']

const LEVEL_BADGE: Record<string, string> = {
  phd: 'bg-purple-100 text-purple-700',
  masters: 'bg-blue-100 text-blue-700',
  diploma: 'bg-emerald-100 text-emerald-700',
}

const PROGRAM_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-amber-100 text-amber-700',
  archived: 'bg-gray-200 text-gray-600',
}

function ProgramsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['academic', 'programs', orgId],
    queryFn: () => getPrograms(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic', 'programs', orgId] })

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (p: any) => {
    setEditing(p)
    setModalOpen(true)
  }

  const handleDelete = async (p: any) => {
    if (!window.confirm(t('academic.confirm_delete'))) return
    try {
      await deleteProgram(p.program_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  const badgesFor = (p: any) => {
    const badges: { label: string; className?: string }[] = [
      { label: t(`academic.level_${p.program_level}`), className: LEVEL_BADGE[p.program_level] },
      { label: t(`academic.pstatus_${p.status || 'draft'}`), className: PROGRAM_STATUS_BADGE[p.status || 'draft'] },
      p.is_paid
        ? { label: t('academic.paid'), className: 'bg-indigo-100 text-indigo-700' }
        : { label: t('academic.free'), className: 'bg-teal-100 text-teal-700' },
    ]
    if (p.in_plan === false) badges.push({ label: t('academic.out_of_plan'), className: 'bg-orange-100 text-orange-700' })
    return badges
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
        ]}
      />
      <AcademicHeader
        title={t('academic.postgraduate_studies')}
        subtitle={t('academic.programs')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="programs" orgId={orgId!}>
            <button
              onClick={openCreate}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.new_program')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <AcademicGrid>
        {!isLoading && programs.length === 0 && (
          <AcademicEmptyState title={t('academic.no_programs')} description={t('academic.no_programs_desc')} />
        )}
        {programs.map((p: any) => (
          <AcademicCard
            key={p.program_uuid}
            orgslug={orgslug}
            href={`/dash/postgraduate/${p.program_uuid.replace('program_', '')}`}
            title={p.name}
            subtitle={p.description}
            badges={badgesFor(p)}
            thumbnailUrl={
              p.thumbnail_image && org?.org_uuid
                ? getProgramThumbnailMediaDirectory(
                    org.org_uuid,
                    p.program_uuid,
                    p.thumbnail_image
                  )
                : null
            }
            footerLabel={String(t(`academic.level_${p.program_level}`, { defaultValue: p.program_level }))}
            onEdit={() => openEdit(p)}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={editing ? t('academic.edit') : t('academic.create_program')}
        dialogContent={
          <ProgramForm
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

function ProgramForm({
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
  const [level, setLevel] = useState(program?.program_level || 'masters')
  const [status, setStatus] = useState(program?.status || 'draft')
  const [capacity, setCapacity] = useState<string>(program?.capacity != null ? String(program.capacity) : '')
  const [isPaid, setIsPaid] = useState(program?.is_paid ?? false)
  const [price, setPrice] = useState<string>(program?.price != null ? String(program.price) : '')
  const [currency, setCurrency] = useState(program?.currency || 'USD')
  const [inPlan, setInPlan] = useState(program?.in_plan ?? true)
  const [startDate, setStartDate] = useState(program?.start_date || '')
  const [endDate, setEndDate] = useState(program?.end_date || '')
  const [published, setPublished] = useState(program?.published ?? false)
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(program?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(
    program?.coordinator ? `${program.coordinator.first_name || ''} ${program.coordinator.last_name || ''}`.trim() || program.coordinator.username : undefined
  )
  const [saving, setSaving] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        code,
        program_level: level,
        status,
        capacity: capacity === '' ? null : Number(capacity),
        is_paid: isPaid,
        price: isPaid && price !== '' ? Number(price) : null,
        currency: isPaid ? currency : null,
        in_plan: inPlan,
        start_date: startDate || null,
        end_date: endDate || null,
        published,
        public: published,
        coordinator_uuid: coordinatorUuid || '',
      }
      if (program) {
        await updateProgram(program.program_uuid, payload, access_token)
        if (thumbnailFile) {
          await uploadProgramImage(program.program_uuid, 'thumbnail', thumbnailFile, access_token)
        }
        toast.success(t('academic.updated'))
      } else {
        const created = await createProgram(orgId, payload, access_token)
        const uuid = created?.program_uuid
        if (uuid && thumbnailFile) {
          await uploadProgramImage(uuid, 'thumbnail', thumbnailFile, access_token)
        }
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || (program ? t('academic.update_failed') : t('academic.create_failed')))
    } finally {
      setSaving(false)
    }
  }

  const handleImage = async (kind: 'thumbnail' | 'banner', file?: File) => {
    if (!file) return
    if (kind === 'thumbnail') {
      setThumbnailFile(file)
      setThumbnailPreview(URL.createObjectURL(file))
      return
    }
    if (!program) return
    try {
      await uploadProgramImage(program.program_uuid, kind, file, access_token)
      toast.success(t('academic.image_uploaded'))
    } catch {
      toast.error(t('academic.image_failed'))
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

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.level')}>
          <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.labelKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {PROGRAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.pstatus_${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

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

      <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
        <div className="space-y-2">
          <ImageField label={t('academic.thumbnail')} onFile={(f) => handleImage('thumbnail', f)} />
          {thumbnailPreview ? (
            <div
              className="aspect-video rounded-lg border border-[hsl(var(--dash-border))] bg-cover bg-center"
              style={{ backgroundImage: `url(${thumbnailPreview})` }}
            />
          ) : (
            <p className="text-xs text-[hsl(var(--dash-muted))]">
              {t(
                'academic.thumbnail_on_create',
                'Add a cover image — your program will show as a card like courses.'
              )}
            </p>
          )}
        </div>
        {program ? (
          <ImageField label={t('academic.banner')} onFile={(f) => handleImage('banner', f)} />
        ) : null}
      </div>

      <SubmitRow saving={saving} />
    </form>
  )
}

function ImageField({ label, onFile }: { label: string; onFile: (f?: File) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <label className="flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-gray-400">
        <ImageIcon className="w-4 h-4" />
        <span className="truncate">{label}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
    </div>
  )
}

export const inputCls =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

export function SubmitRow({ saving }: { saving: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end pt-2">
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-[hsl(var(--dash-accent))] text-white text-sm font-bold rounded-lg disabled:opacity-50"
      >
        {saving ? '…' : t('academic.save')}
      </button>
    </div>
  )
}

export default ProgramsHome
