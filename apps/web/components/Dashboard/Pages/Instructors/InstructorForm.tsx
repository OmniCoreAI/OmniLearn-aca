'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { Field, FormActions, FormSection, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { GhostButton, IconButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  createInstructor,
  getInstructorCategories,
  updateInstructor,
  uploadInstructorImage,
} from '@services/instructors/instructors'

export const INSTRUCTOR_STATUSES = ['active', 'pending_approval', 'inactive', 'on_leave']
export const WEEKDAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']

export type AvailabilitySlot = { day: string; start: string; end: string }
export type Availability = { slots: AvailabilitySlot[]; notes?: string }

/** Weekly availability slots (day + time range), used by instructors and facilities. */
export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: Availability
  onChange: (_v: Availability) => void
}) {
  const { t } = useTranslation()
  const slots = value.slots || []
  const setSlot = (index: number, patch: Partial<AvailabilitySlot>) =>
    onChange({ ...value, slots: slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) })
  return (
    <div className="space-y-2">
      {slots.length === 0 && (
        <p className="text-xs text-[hsl(var(--dash-muted))]">{t('instructors.no_availability', 'No weekly availability set.')}</p>
      )}
      {slots.map((slot, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
          <select className={inputCls} value={slot.day} onChange={(e) => setSlot(index, { day: e.target.value })}>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {t(`instructors.day_${d}`, d)}
              </option>
            ))}
          </select>
          <input type="time" className={inputCls} value={slot.start} onChange={(e) => setSlot(index, { start: e.target.value })} />
          <input type="time" className={inputCls} value={slot.end} onChange={(e) => setSlot(index, { end: e.target.value })} />
          <IconButton
            type="button"
            tone="danger"
            onClick={() => onChange({ ...value, slots: slots.filter((_, i) => i !== index) })}
            aria-label={t('administration.common.delete', 'Delete')}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ))}
      <GhostButton
        type="button"
        onClick={() => onChange({ ...value, slots: [...slots, { day: 'sun', start: '09:00', end: '15:00' }] })}
      >
        <Plus className="h-3.5 w-3.5" /> {t('instructors.add_slot', 'Add time slot')}
      </GhostButton>
      <textarea
        className={inputCls}
        rows={2}
        value={value.notes || ''}
        placeholder={t('instructors.availability_notes', 'Notes (e.g. unavailable during Ramadan)')}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
      />
    </div>
  )
}

const splitList = (raw: string) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export function InstructorForm({
  orgId,
  access_token,
  instructor,
  onDone,
  onCancel,
}: {
  orgId: number
  access_token: string
  instructor: any
  onDone: (_result?: any) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const isEdit = !!instructor

  const { data: categories = [] } = useQuery({
    queryKey: ['instructor-categories', orgId],
    queryFn: () => getInstructorCategories(orgId, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [userUuid, setUserUuid] = useState<string | null>(instructor?.user?.user_uuid || null)
  const [userLabel, setUserLabel] = useState<string | undefined>(
    instructor?.user
      ? `${instructor.user.first_name || ''} ${instructor.user.last_name || ''}`.trim() || instructor.user.username
      : undefined
  )
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '' })
  const [categoryUuid, setCategoryUuid] = useState<string>(instructor?.category?.category_uuid || '')
  const [department, setDepartment] = useState(instructor?.department || '')
  const [languages, setLanguages] = useState((instructor?.languages || []).join(', '))
  const [specializations, setSpecializations] = useState((instructor?.specializations || []).join(', '))
  const [bio, setBio] = useState(instructor?.bio || '')
  const [hourlyRate, setHourlyRate] = useState<string>(instructor?.hourly_rate != null ? String(instructor.hourly_rate) : '')
  const [phone, setPhone] = useState(instructor?.contact_info?.phone || '')
  const [email, setEmail] = useState(instructor?.contact_info?.email || '')
  const [status, setStatus] = useState(instructor?.status || 'active')
  const [availability, setAvailability] = useState<Availability>(instructor?.availability || { slots: [] })
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedCategory = (categories as any[]).find((c) => c.category_uuid === categoryUuid)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const validate = () => {
    const next: Record<string, string> = {}
    if (!isEdit && mode === 'existing' && !userUuid) next.user = t('instructors.pick_user', 'Select a user for the instructor')
    if (!isEdit && mode === 'new') {
      if (!newUser.first_name.trim()) next.first_name = t('administration.validation.required', 'Required')
      if (!EMAIL_RE.test(newUser.email.trim())) next.account_email = t('administration.validation.email', 'Enter a valid email address')
    }
    if (email && !EMAIL_RE.test(email.trim())) next.contact_email = t('administration.validation.email', 'Enter a valid email address')
    if (hourlyRate !== '' && (isNaN(Number(hourlyRate)) || Number(hourlyRate) < 0))
      next.rate = t('administration.validation.non_negative', 'Enter a number of 0 or more')
    const badSlot = (availability.slots || []).find((sl) => sl.start && sl.end && sl.end <= sl.start)
    if (badSlot) next.availability = t('administration.validation.time_range', 'Each slot must end after it starts')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const contact_info: Record<string, string> = {}
      if (phone) contact_info.phone = phone
      if (email) contact_info.email = email
      const payload: any = {
        category_uuid: categoryUuid || null,
        department: department || null,
        languages: splitList(languages),
        specializations: splitList(specializations),
        bio: bio || null,
        availability,
        contact_info,
        hourly_rate: hourlyRate === '' ? null : Number(hourlyRate),
        status,
      }
      let saved: any
      if (isEdit) {
        saved = await updateInstructor(instructor.instructor_uuid, payload, access_token)
      } else if (mode === 'new') {
        saved = await createInstructor(orgId, { ...payload, new_user: { ...newUser, phone: phone || undefined } }, access_token)
      } else {
        saved = await createInstructor(orgId, { ...payload, user_uuid: userUuid }, access_token)
      }
      if (image && saved?.instructor_uuid) {
        await uploadInstructorImage(saved.instructor_uuid, image, access_token)
      }
      toast.success(isEdit ? t('academic.updated') : t('academic.created'))
      onDone(saved)
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  const effectiveHint =
    hourlyRate !== ''
      ? t('instructors.rate_override_active', 'Overrides the category rate for this instructor.')
      : selectedCategory?.hourly_rate != null
        ? t('instructors.rate_uses_category', 'Empty — uses the category rate: {{rate}} {{currency}}/h', {
            rate: selectedCategory.hourly_rate,
            currency: selectedCategory.currency || '',
          })
        : t('instructors.rate_override_hint', 'Leave empty to use the category rate. A value here overrides it.')

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {!isEdit && (
        <FormSection
          title={t('instructors.section_account', 'Account')}
          description={t('instructors.section_account_desc', 'An instructor extends a platform user. Pick one or create a new login.')}
          columns={1}
        >
          <div className={TAB_TRACK} role="tablist">
            {(['existing', 'new'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={tabItemClass(mode === m, 'text-xs')}>
                {m === 'existing' ? t('instructors.mode_existing', 'Existing user') : t('instructors.mode_new', 'New user account')}
              </button>
            ))}
          </div>
          {mode === 'existing' ? (
            <Field label={t('instructors.user', 'User')} required error={errors.user}>
              <CoordinatorPicker
                orgId={orgId}
                access_token={access_token}
                value={userUuid}
                selectedLabel={userLabel}
                onChange={(uuid, label) => {
                  setUserUuid(uuid)
                  setUserLabel(label)
                }}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('instructors.first_name', 'First name')} required error={errors.first_name}>
                <input className={inputCls} aria-invalid={!!errors.first_name} value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} />
              </Field>
              <Field label={t('instructors.last_name', 'Last name')}>
                <input className={inputCls} value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} />
              </Field>
              <Field
                label={t('instructors.account_email', 'Login email')}
                required
                error={errors.account_email}
                hint={t('instructors.new_user_hint', 'An account is created with the Instructor role and a one-time temporary password.')}
                className="sm:col-span-2"
              >
                <input type="email" className={inputCls} aria-invalid={!!errors.account_email} value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </Field>
            </div>
          )}
        </FormSection>
      )}

      <FormSection title={t('instructors.section_basic', 'Basic information')}>
        <Field label={t('instructors.phone', 'Phone')}>
          <input type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('instructors.contact_email', 'Contact email')} error={errors.contact_email} hint={t('instructors.contact_email_hint', 'Shown to coordinators; can differ from the login email.')}>
          <input type="email" className={inputCls} aria-invalid={!!errors.contact_email} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('instructors.profile_image', 'Profile image')} hint={t('instructors.profile_image_hint', 'Square JPG or PNG works best.')} className="sm:col-span-2">
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-[hsl(var(--dash-muted))] file:me-3 file:rounded-full file:border-0 file:bg-[hsl(var(--dash-canvas))] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[hsl(var(--dash-ink))]"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
        </Field>
      </FormSection>

      <FormSection title={t('instructors.section_professional', 'Professional information')}>
        <Field label={t('instructors.category', 'Category')} hint={t('instructors.category_hint', 'Sets the default hourly rate.')}>
          <select className={inputCls} value={categoryUuid} onChange={(e) => setCategoryUuid(e.target.value)}>
            <option value="">{t('instructors.no_category', 'No category')}</option>
            {(categories as any[])
              .filter((c) => c.status !== 'inactive' || c.category_uuid === categoryUuid)
              .map((c) => (
                <option key={c.category_uuid} value={c.category_uuid}>
                  {c.name}
                  {c.hourly_rate != null ? ` — ${c.hourly_rate} ${c.currency || ''}` : ''}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('instructors.rate_override', 'Hourly rate override')} hint={effectiveHint} error={errors.rate}>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            aria-invalid={!!errors.rate}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder={selectedCategory?.hourly_rate != null ? String(selectedCategory.hourly_rate) : '0'}
          />
        </Field>
        <Field label={t('instructors.specializations', 'Expertise / specializations')} hint={t('administration.common.comma_hint', 'Separate with commas.')}>
          <input className={inputCls} value={specializations} onChange={(e) => setSpecializations(e.target.value)} placeholder="Cybersecurity, AI" />
        </Field>
        <Field label={t('instructors.languages', 'Languages')} hint={t('administration.common.comma_hint', 'Separate with commas.')}>
          <input className={inputCls} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Arabic, English" />
        </Field>
        <Field label={t('instructors.department', 'Department')}>
          <input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection
        title={t('instructors.availability', 'Weekly availability')}
        description={t('instructors.availability_desc', 'Used when scheduling sessions for this instructor.')}
        columns={1}
      >
        <AvailabilityEditor value={availability} onChange={setAvailability} />
        {errors.availability ? <p role="alert" className="text-xs font-medium text-[hsl(var(--dash-warn))]">{errors.availability}</p> : null}
      </FormSection>

      <FormSection title={t('instructors.section_additional', 'Additional information')}>
        <Field label={t('instructors.bio', 'Profile / description')} className="sm:col-span-2">
          <textarea className={inputCls} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <Field label={t('instructors.status', 'Status')} hint={t('instructors.status_hint', 'Inactive instructors keep their history but can’t be assigned.')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {INSTRUCTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`instructors.status_${s}`, s.replace('_', ' ')) as string}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormActions
        saving={saving}
        onCancel={onCancel}
        sticky={!!onCancel}
        submitLabel={isEdit ? t('academic.save', 'Save') : t('instructors.create', 'Create instructor')}
      />
    </form>
  )
}
