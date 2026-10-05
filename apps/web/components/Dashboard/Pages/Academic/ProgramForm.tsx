'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ImageSquare } from '@phosphor-icons/react'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { CurrencySelect, useFinanceDefaults } from '@components/Dashboard/Pages/Administration/AdminUI'
import { Switch } from '@components/ui/switch'
import { createProgram, updateProgram, uploadProgramImage } from '@services/academic/academic'
import { getProgramBannerMediaDirectory, getProgramThumbnailMediaDirectory } from '@services/media/media'
import { getGradeScales, suggestProgramCode } from '@services/academic/core'
import { cn } from '@/lib/utils'

/* The create/edit form of a postgraduate program, used by the programs list and the program page. */

const LEVELS = ['phd', 'masters', 'diploma'] as const
const STATUSES = ['active', 'draft', 'suspended', 'archived'] as const

const switchCls = 'data-[state=checked]:bg-[hsl(var(--dash-ink))] data-[state=unchecked]:bg-[hsl(var(--dash-border))]'

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (_v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[hsl(var(--dash-ink))]">{label}</span>
        {hint ? <span className="block text-[11px] text-[hsl(var(--dash-muted))]">{hint}</span> : null}
      </span>
      <Switch className={switchCls} checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/** Image picker with a live preview; also shows the current image when editing. */
function ImageDrop({ label, hint, preview, onFile }: { label: string; hint?: string; preview?: string | null; onFile: (_f?: File) => void }) {
  return (
    <label className="group block cursor-pointer">
      <span className="mb-1 block text-sm font-medium text-[hsl(var(--dash-ink))]">{label}</span>
      <span
        className={cn(
          'relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-dashed transition-colors',
          preview ? 'border-transparent' : 'border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/60 group-hover:border-[hsl(var(--dash-accent))]/50'
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <ImageSquare size={18} className="me-1.5" /> {label}
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-[hsl(var(--dash-muted))]">
            <ImageSquare size={24} weight="duotone" />
            <span className="text-xs">{hint}</span>
          </span>
        )}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  )
}

export function ProgramForm({
  orgId,
  orgUuid,
  access_token,
  program,
  onDone,
  onCancel,
}: {
  orgId: number
  orgUuid?: string
  access_token: string
  program: any
  onDone: () => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const financeDefaults = useFinanceDefaults()
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
  const [durationMonths, setDurationMonths] = useState<string>(program?.duration_months != null ? String(program.duration_months) : '')
  const [maxDurationMonths, setMaxDurationMonths] = useState<string>(program?.max_duration_months != null ? String(program.max_duration_months) : '')
  const [startDate, setStartDate] = useState(program?.start_date || '')
  const [endDate, setEndDate] = useState(program?.end_date || '')
  const [isPaid, setIsPaid] = useState<boolean>(program?.is_paid ?? false)
  const [price, setPrice] = useState<string>(program?.price != null ? String(program.price) : '')
  const [currency, setCurrency] = useState(program?.currency || financeDefaults.default_currency)
  const [published, setPublished] = useState(program?.published ?? false)
  const [coordinatorUuid, setCoordinatorUuid] = useState<string | null>(program?.coordinator?.user_uuid || null)
  const [coordinatorLabel, setCoordinatorLabel] = useState<string | undefined>(
    program?.coordinator ? `${program.coordinator.first_name || ''} ${program.coordinator.last_name || ''}`.trim() || program.coordinator.username : undefined
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    program?.thumbnail_image && orgUuid ? getProgramThumbnailMediaDirectory(orgUuid, program.program_uuid, program.thumbnail_image) : null
  )
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    program?.banner_image && orgUuid ? getProgramBannerMediaDirectory(orgUuid, program.program_uuid, program.banner_image) : null
  )
  const suggestion = suggestProgramCode(level, department || 'AI')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    const required = String(t('administration.validation.required', 'Required'))
    const nonNegative = String(t('administration.validation.non_negative', 'Enter a number of 0 or more'))
    if (!name.trim()) next.name = required
    if (startDate && endDate && endDate < startDate) next.endDate = String(t('administration.validation.date_range', 'End date must be on or after the start date'))
    for (const [key, value] of Object.entries({ minCredits, durationMonths, maxDurationMonths, capacity })) {
      if (value !== '' && Number(value) < 0) next[key] = nonNegative
    }
    if (durationMonths !== '' && maxDurationMonths !== '' && Number(maxDurationMonths) < Number(durationMonths)) {
      next.maxDurationMonths = String(t('postgrad.max_duration_error', 'Must be at least the normal duration'))
    }
    if (isPaid && (price === '' || Number(price) < 0)) next.price = String(t('postgrad.fee_required', 'Enter the fee for a paid program'))
    setErrors(next)
    if (Object.keys(next).length) return
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
      let uuid = program?.program_uuid
      if (program) {
        await updateProgram(program.program_uuid, payload, access_token)
      } else {
        const created = await createProgram(orgId, payload, access_token)
        uuid = created?.program_uuid
      }
      if (uuid && thumbnailFile) await uploadProgramImage(uuid, 'thumbnail', thumbnailFile, access_token)
      if (uuid && bannerFile) await uploadProgramImage(uuid, 'banner', bannerFile, access_token)
      toast.success(program ? t('academic.updated') : t('academic.created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || (program ? t('academic.update_failed') : t('academic.create_failed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormSection title={t('administration.form.basic', 'Basic information')}>
        <Field label={t('academic.name')} required error={errors.name} className="sm:col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        </Field>
        <Field label={t('academic.level')}>
          <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`academic.level_${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('academic.status')} hint={t('postgrad.status_hint', 'Active programs accept applications and cohorts')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`academic.pstatus_${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('academic.code')}
          className="sm:col-span-2"
          hint={
            <>
              {t('academic.program_code_hint', 'Format [DEGREE]-[FIELD], e.g. MSC-AI. Validated and unique.')}
              {!code ? (
                <button type="button" className="ms-1 font-semibold text-[hsl(var(--dash-accent))] hover:underline" onClick={() => setCode(suggestion)}>
                  {t('academic.use_suggestion', 'Use')} {suggestion}
                </button>
              ) : null}
            </>
          }
        >
          <input className={cn(inputCls, 'font-mono')} value={code} placeholder={suggestion} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </Field>
        <Field label={t('academic.description')} className="sm:col-span-2">
          <textarea className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
      </FormSection>

      <FormSection title={t('postgrad.section_structure', 'Academic structure')} description={t('postgrad.section_structure_desc', 'Where it sits and what it takes to graduate.')}>
        <Field label={t('academic.faculty', 'Faculty / School')}>
          <input className={inputCls} value={faculty} onChange={(e) => setFaculty(e.target.value)} />
        </Field>
        <Field label={t('academic.department', 'Department')}>
          <input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label={t('academic.grade_scale', 'Grade scale')} className="sm:col-span-2">
          <select className={inputCls} value={gradeScale} onChange={(e) => setGradeScale(e.target.value)}>
            <option value="">{t('academic.org_default_scale', 'Organization default')}</option>
            {(gradeScales as any[]).map((gs) => (
              <option key={gs.grade_scale_uuid} value={gs.grade_scale_uuid}>
                {gs.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
          <Field label={t('academic.min_credits', 'Minimum credits')} error={errors.minCredits}>
            <input type="number" min={0} step="0.5" className={inputCls} value={minCredits} onChange={(e) => setMinCredits(e.target.value)} aria-invalid={!!errors.minCredits} />
          </Field>
          <Field label={t('academic.duration_months', 'Duration (months)')} error={errors.durationMonths}>
            <input type="number" min={1} className={inputCls} value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} aria-invalid={!!errors.durationMonths} />
          </Field>
          <Field label={t('academic.max_duration_months', 'Max duration (months)')} error={errors.maxDurationMonths}>
            <input type="number" min={1} className={inputCls} value={maxDurationMonths} onChange={(e) => setMaxDurationMonths(e.target.value)} aria-invalid={!!errors.maxDurationMonths} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={t('postgrad.section_intake', 'Intake and capacity')}>
        <Field label={t('academic.start_date')}>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('academic.end_date')} error={errors.endDate}>
          <input type="date" className={inputCls} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} aria-invalid={!!errors.endDate} />
        </Field>
        <Field label={t('academic.capacity')} error={errors.capacity} hint={t('training.capacity_hint', 'Leave empty for open seats')}>
          <input type="number" min={0} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-invalid={!!errors.capacity} />
        </Field>
      </FormSection>

      <FormSection title={t('postgrad.section_fees', 'Tuition')} columns={1}>
        <SwitchRow label={t('academic.paid')} hint={t('postgrad.paid_hint', 'Students pay a program fee')} checked={isPaid} onChange={setIsPaid} />
        {isPaid ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('postgrad.fee', 'Fee')} required error={errors.price}>
              <input type="number" min={0} step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!errors.price} />
            </Field>
            <Field label={t('academic.currency')}>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </Field>
          </div>
        ) : null}
      </FormSection>

      <FormSection title={t('training.section_settings', 'Coordination and visibility')} columns={1}>
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
        <SwitchRow label={t('academic.in_plan')} hint={t('training.in_plan_hint', 'Counts toward this year’s training plan')} checked={inPlan} onChange={setInPlan} />
        <SwitchRow label={t('academic.published')} hint={t('postgrad.published_hint', 'Shown to applicants in the catalog')} checked={published} onChange={setPublished} />
      </FormSection>

      <FormSection title={t('postgrad.section_images', 'Images')} description={t('postgrad.images_desc', 'The cover shows on cards; the banner tops the program page.')}>
        <ImageDrop
          label={t('academic.thumbnail')}
          hint={t('postgrad.cover_hint', 'Add a cover image')}
          preview={thumbnailPreview}
          onFile={(f) => {
            if (!f) return
            setThumbnailFile(f)
            setThumbnailPreview(URL.createObjectURL(f))
          }}
        />
        <ImageDrop
          label={t('academic.banner')}
          hint={t('postgrad.banner_hint', 'Add a wide banner')}
          preview={bannerPreview}
          onFile={(f) => {
            if (!f) return
            setBannerFile(f)
            setBannerPreview(URL.createObjectURL(f))
          }}
        />
      </FormSection>

      <FormActions saving={saving} onCancel={onCancel} sticky={!!onCancel} />
    </form>
  )
}
