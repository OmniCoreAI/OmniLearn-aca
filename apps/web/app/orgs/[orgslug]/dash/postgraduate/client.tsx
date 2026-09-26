'use client'
import React, { useState } from 'react'
import { GraduationCap, Plus, Image as ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import { GraduationCap as GraduationCapIcon, CheckCircle, Books, Certificate } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import {
  AcademicPageShell,
  AcademicHeader,
  AcademicGrid,
  AcademicGridSkeleton,
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
import { getGradeScales, suggestProgramCode } from '@services/academic/core'
import { PostgradTabs } from '@components/Dashboard/Pages/Academic/AcademicUI'

const LEVELS = [
  { value: 'phd', labelKey: 'academic.level_phd' },
  { value: 'masters', labelKey: 'academic.level_masters' },
  { value: 'diploma', labelKey: 'academic.level_diploma' },
]

const PROGRAM_STATUSES = ['draft', 'active', 'suspended', 'archived']

const LEVEL_BADGE: Record<string, string> = {
  phd: 'bg-[hsl(var(--dash-tile-lavender))] text-[hsl(var(--dash-tile-lavender-fg))]',
  masters: 'bg-[hsl(var(--dash-tile-sky))] text-[hsl(var(--dash-tile-sky-fg))]',
  diploma: 'bg-emerald-100 text-emerald-700',
}

const PROGRAM_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
  active: 'bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]',
  suspended: 'bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]',
  archived: 'bg-[hsl(var(--dash-border))] text-[hsl(var(--dash-muted))]',
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
    if (
      !window.confirm(
        t(
          'academic.confirm_delete_program',
          'Delete this program? Deletion is only possible while none of its cohorts has official results or admission decisions; otherwise archive it.'
        )
      )
    )
      return
    try {
      await deleteProgram(p.program_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('academic.delete_failed'))
    }
  }

  const badgesFor = (p: any) => {
    const badges: { label: string; className?: string }[] = [
      { label: t(`academic.level_${p.program_level}`), className: LEVEL_BADGE[p.program_level] },
      { label: t(`academic.pstatus_${p.status || 'draft'}`), className: PROGRAM_STATUS_BADGE[p.status || 'draft'] },
    ]
    if (p.in_plan === false) badges.push({ label: t('academic.out_of_plan'), className: 'bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]' })
    return badges
  }

  const stats = {
    active: programs.filter((p: any) => p.status === 'active').length,
    drafts: programs.filter((p: any) => (p.status || 'draft') === 'draft').length,
    phd: programs.filter((p: any) => p.program_level === 'phd').length,
    graduate: programs.filter((p: any) => p.program_level === 'phd' || p.program_level === 'masters').length,
    diploma: programs.filter((p: any) => p.program_level === 'diploma').length,
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
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-[hsl(var(--dash-ink))] flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('academic.new_program')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <DashStatCards
        className="mb-6"
        loading={isLoading}
        stats={[
          { key: 'total', label: t('academic.stats.programs', 'Programs'), value: programs.length, icon: GraduationCapIcon, tone: 'rose' },
          { key: 'active', label: t('academic.stats.active', 'Active'), value: stats.active, hint: t('academic.stats.drafts_hint', '{{count}} drafts', { count: stats.drafts }), icon: CheckCircle, tone: 'stone' },
          { key: 'graduate', label: t('academic.stats.masters_phd', "Master's & PhD"), value: stats.graduate, hint: t('academic.stats.phd_hint', '{{count}} PhD', { count: stats.phd }), icon: Books, tone: 'gold' },
          { key: 'diploma', label: t('academic.stats.diplomas', 'Diplomas'), value: stats.diploma, icon: Certificate, tone: 'sand' },
        ]}
      />

      <PostgradTabs orgslug={orgslug} />

      {isLoading && <AcademicGridSkeleton />}
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
            subtitle={[p.code, p.department, p.description].filter(Boolean).join(' · ')}
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
  const [inPlan, setInPlan] = useState(program?.in_plan ?? true)
  const [gradeScale, setGradeScale] = useState<string>(program?.grade_scale_uuid || '')
  const { data: gradeScales = [] } = useQuery({
    queryKey: ['academic', 'grade-scales', orgId],
    queryFn: () => getGradeScales(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const [faculty, setFaculty] = useState(program?.faculty || '')
  const [department, setDepartment] = useState(program?.department || '')
  const [minCredits, setMinCredits] = useState<string>(program?.min_credits != null ? String(program.min_credits) : '')
  const [durationMonths, setDurationMonths] = useState<string>(
    program?.duration_months != null ? String(program.duration_months) : ''
  )
  const [maxDurationMonths, setMaxDurationMonths] = useState<string>(
    program?.max_duration_months != null ? String(program.max_duration_months) : ''
  )
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
        code: code.trim() || null,
        program_level: level,
        status,
        faculty: faculty || null,
        department: department || null,
        min_credits: minCredits === '' ? null : Number(minCredits),
        duration_months: durationMonths === '' ? null : Number(durationMonths),
        max_duration_months: maxDurationMonths === '' ? null : Number(maxDurationMonths),
        grade_scale_uuid: gradeScale || '',
        capacity: capacity === '' ? null : Number(capacity),
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
          <input
            className={inputCls}
            value={code}
            placeholder={suggestProgramCode(level, department || 'AI')}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">
            {t('academic.program_code_hint', 'Format [DEGREE]-[FIELD], e.g. MSC-AI. Validated and unique.')}
            {!code && department && (
              <button
                type="button"
                className="ms-1 font-semibold text-[hsl(var(--dash-accent))]"
                onClick={() => setCode(suggestProgramCode(level, department))}
              >
                {t('academic.use_suggestion', 'Use')} {suggestProgramCode(level, department)}
              </button>
            )}
          </p>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('academic.faculty', 'Faculty / School')}>
          <input className={inputCls} value={faculty} onChange={(e) => setFaculty(e.target.value)} />
        </Field>
        <Field label={t('academic.department', 'Department')}>
          <input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
      </div>

      <Field label={t('academic.grade_scale', 'Grade scale')}>
        <select className={inputCls} value={gradeScale} onChange={(e) => setGradeScale(e.target.value)}>
          <option value="">{t('academic.org_default_scale', 'Organization default')}</option>
          {(gradeScales as any[]).map((gs) => (
            <option key={gs.grade_scale_uuid} value={gs.grade_scale_uuid}>
              {gs.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t('academic.min_credits', 'Minimum credits')}>
          <input type="number" min={0} step="0.5" className={inputCls} value={minCredits} onChange={(e) => setMinCredits(e.target.value)} />
        </Field>
        <Field label={t('academic.duration_months', 'Duration (months)')}>
          <input type="number" min={1} className={inputCls} value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
        </Field>
        <Field label={t('academic.max_duration_months', 'Max duration (months)')}>
          <input type="number" min={1} className={inputCls} value={maxDurationMonths} onChange={(e) => setMaxDurationMonths(e.target.value)} />
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

      <Field label={t('academic.capacity')}>
        <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('academic.unlimited')} />
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
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--dash-ink))]">
          <input type="checkbox" checked={inPlan} onChange={(e) => setInPlan(e.target.checked)} />
          {t('academic.in_plan')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--dash-ink))]">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          {t('academic.published')}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-[hsl(var(--dash-border))] pt-3 sm:grid-cols-2">
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

function ImageField({ label, onFile }: { label: string; onFile: (_f?: File) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[hsl(var(--dash-ink))]">{label}</label>
      <label className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--dash-surface))] border border-dashed border-[hsl(var(--dash-border))] rounded-lg text-sm text-[hsl(var(--dash-muted))] cursor-pointer hover:border-[hsl(var(--dash-accent))]/50">
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

export default ProgramsHome
