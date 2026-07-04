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
import {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
} from '@services/academic/academic'

const LEVELS = [
  { value: 'phd', labelKey: 'academic.level_phd' },
  { value: 'masters', labelKey: 'academic.level_masters' },
  { value: 'diploma', labelKey: 'academic.level_diploma' },
]

const LEVEL_BADGE: Record<string, string> = {
  phd: 'bg-purple-100 text-purple-700',
  masters: 'bg-blue-100 text-blue-700',
  diploma: 'bg-emerald-100 text-emerald-700',
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
              className="rounded-lg bg-black text-white text-xs font-bold px-5 py-2 flex items-center gap-2 nice-shadow hover:scale-105 transition-all"
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
            badges={[
              { label: t(`academic.level_${p.program_level}`), className: LEVEL_BADGE[p.program_level] },
              p.published
                ? { label: t('academic.published'), className: 'bg-green-100 text-green-700' }
                : { label: t('academic.draft'), className: 'bg-gray-100 text-gray-500' },
            ]}
            onEdit={() => openEdit(p)}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="sm"
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
  const [published, setPublished] = useState(program?.published ?? false)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name, description, code, program_level: level, published, public: published }
      if (program) {
        await updateProgram(program.program_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createProgram(orgId, payload, access_token)
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
      <Field label={t('academic.level')}>
        <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {t(l.labelKey)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('academic.code')}>
        <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
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

export const inputCls =
  'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black'

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
        className="px-4 py-2 bg-black text-white text-sm font-bold rounded-lg disabled:opacity-50"
      >
        {saving ? '…' : t('academic.save')}
      </button>
    </div>
  )
}

export default ProgramsHome
