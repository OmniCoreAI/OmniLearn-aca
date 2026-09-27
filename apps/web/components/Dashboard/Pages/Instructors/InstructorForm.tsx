'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, IconButton } from '@components/Dashboard/Pages/Academic/AcademicUI'
import {
  createInstructor,
  getInstructorCategories,
  updateInstructor,
  uploadInstructorImage,
} from '@services/instructors/instructors'
import { cn } from '@/lib/utils'

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
}: {
  orgId: number
  access_token: string
  instructor: any
  onDone: (_result?: any) => void
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
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', phone: '' })
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

  const selectedCategory = (categories as any[]).find((c) => c.category_uuid === categoryUuid)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEdit && mode === 'existing' && !userUuid) {
      toast.error(t('instructors.pick_user', 'Select a user for the instructor'))
      return
    }
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
        saved = await createInstructor(orgId, { ...payload, new_user: newUser }, access_token)
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

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isEdit && (
        <div className="space-y-3">
          <div className="flex w-fit gap-1 rounded-full border border-[hsl(var(--dash-border))] p-1">
            {(['existing', 'new'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  mode === m ? 'bg-[hsl(var(--dash-accent))] text-white' : 'text-[hsl(var(--dash-muted))]'
                )}
              >
                {m === 'existing'
                  ? t('instructors.mode_existing', 'Existing user')
                  : t('instructors.mode_new', 'New user account')}
              </button>
            ))}
          </div>
          {mode === 'existing' ? (
            <Field label={t('instructors.user', 'User')}>
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
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-[hsl(var(--dash-border))] p-3 sm:grid-cols-2">
              <Field label={t('instructors.first_name', 'First name')}>
                <input className={inputCls} required value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} />
              </Field>
              <Field label={t('instructors.last_name', 'Last name')}>
                <input className={inputCls} required value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} />
              </Field>
              <Field label={t('instructors.account_email', 'Login email')}>
                <input type="email" className={inputCls} required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </Field>
              <Field label={t('instructors.phone', 'Phone')}>
                <input className={inputCls} value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
              </Field>
              <p className="text-[11px] text-[hsl(var(--dash-muted))] sm:col-span-2">
                {t(
                  'instructors.new_user_hint',
                  'An account is created with the Instructor role and a one-time temporary password.'
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('instructors.category', 'Category')}>
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
        <Field label={t('instructors.status', 'Status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {INSTRUCTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`instructors.status_${s}`, s.replace('_', ' ')) as string}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('instructors.rate_override', 'Hourly rate override')}>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder={
              selectedCategory?.hourly_rate != null
                ? `${t('instructors.category_default', 'Category default')}: ${selectedCategory.hourly_rate} ${selectedCategory.currency || ''}`
                : t('instructors.rate_from_category', 'Uses category rate if empty')
            }
          />
          <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">
            {t('instructors.rate_override_hint', 'Leave empty to use the category rate. A value here overrides it.')}
          </p>
        </Field>
        <Field label={t('instructors.department', 'Department')}>
          <input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('instructors.specializations', 'Expertise / specializations (comma separated)')}>
          <input className={inputCls} value={specializations} onChange={(e) => setSpecializations(e.target.value)} placeholder="Cybersecurity, AI" />
        </Field>
        <Field label={t('instructors.languages', 'Languages (comma separated)')}>
          <input className={inputCls} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Arabic" />
        </Field>
      </div>

      <Field label={t('instructors.bio', 'Profile / description')}>
        <textarea className={inputCls} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('instructors.phone', 'Phone')}>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('instructors.contact_email', 'Contact email')}>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <Field label={t('instructors.profile_image', 'Profile image')}>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-[hsl(var(--dash-muted))] file:me-3 file:rounded-full file:border-0 file:bg-[hsl(var(--dash-accent-soft))] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[hsl(var(--dash-accent))]"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
        />
      </Field>

      <Field label={t('instructors.availability', 'Weekly availability')}>
        <AvailabilityEditor value={availability} onChange={setAvailability} />
      </Field>

      <SubmitRow saving={saving} />
    </form>
  )
}
