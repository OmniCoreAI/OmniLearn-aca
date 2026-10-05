'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { approveInstructor, getInstructorCategories } from '@services/instructors/instructors'

/** Academy approval of an instructor invited by an entity coordinator: set category + rate. */
export function ApproveInstructorForm({
  orgId,
  access_token,
  instructor,
  onDone,
}: {
  orgId: number
  access_token: string
  instructor: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { data: categories = [] } = useQuery({
    queryKey: ['instructor-categories', orgId],
    queryFn: () => getInstructorCategories(orgId, access_token),
    enabled: !!orgId && !!access_token,
  })
  const [categoryUuid, setCategoryUuid] = useState(instructor?.category?.category_uuid || '')
  const [rate, setRate] = useState(instructor?.hourly_rate != null ? String(instructor.hourly_rate) : '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await approveInstructor(
        instructor.instructor_uuid,
        { category_uuid: categoryUuid || null, hourly_rate: rate === '' ? null : Number(rate) },
        access_token
      )
      toast.success(t('instructors.approved', 'Instructor approved'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {instructor?.entity && (
        <p className="text-sm text-[hsl(var(--dash-muted))]">
          {t('instructors.invited_by_entity', 'Invited by entity')}: <strong>{instructor.entity.name}</strong>
        </p>
      )}
      <Field label={t('instructors.category', 'Category')}>
        <select className={inputCls} value={categoryUuid} onChange={(e) => setCategoryUuid(e.target.value)}>
          <option value="">{t('instructors.no_category', 'No category')}</option>
          {(categories as any[])
            .filter((c) => c.status !== 'inactive')
            .map((c) => (
              <option key={c.category_uuid} value={c.category_uuid}>
                {c.name}
                {c.hourly_rate != null ? ` — ${c.hourly_rate} ${c.currency || ''}` : ''}
              </option>
            ))}
        </select>
      </Field>
      <Field label={t('instructors.rate_override', 'Hourly rate override')}>
        <input type="number" min={0} step="0.01" className={inputCls} value={rate} onChange={(e) => setRate(e.target.value)} />
      </Field>
      <p className="text-[11px] text-[hsl(var(--dash-muted))]">
        {t('instructors.approve_hint', 'Approving activates the profile and grants the Instructor role.')}
      </p>
      <SubmitRow saving={saving} />
    </form>
  )
}
