'use client'
import React, { useState } from 'react'
import { Users as ChalkboardTeacher, Plus } from 'lucide-react'
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
import { InstructorTabs } from '@components/Dashboard/Pages/Instructors/InstructorTabs'
import { Field, SubmitRow, inputCls } from '../postgraduate/client'
import {
  getInstructors,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  getInstructorCategories,
} from '@services/instructors/instructors'

const STATUSES = ['active', 'inactive', 'on_leave']

function InstructorsHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const access_token = session.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['instructors', orgId],
    queryFn: () => getInstructors(orgId!, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['instructors', orgId] })

  const handleDelete = async (i: any) => {
    if (!window.confirm(t('instructors.confirm_delete', 'Remove this instructor?'))) return
    try {
      await deleteInstructor(i.instructor_uuid, access_token)
      toast.success(t('academic.deleted'))
      refresh()
    } catch {
      toast.error(t('academic.delete_failed'))
    }
  }

  const nameOf = (i: any) =>
    `${i.user?.first_name || ''} ${i.user?.last_name || ''}`.trim() || i.user?.username || '—'

  const badgesFor = (i: any) => {
    const badges: { label: string; className?: string }[] = []
    if (i.category?.name)
      badges.push({ label: i.category.name, className: 'bg-indigo-100 text-indigo-700' })
    if (i.department) badges.push({ label: i.department, className: 'bg-gray-100 text-gray-600' })
    const statusCls: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-500',
      on_leave: 'bg-amber-100 text-amber-700',
    }
    badges.push({
      label: t(`instructors.status_${i.status}`, i.status) as string,
      className: statusCls[i.status] || 'bg-gray-100 text-gray-600',
    })
    return badges
  }

  return (
    <AcademicPageShell>
      <Breadcrumbs
        items={[
          {
            label: t('instructors.title', 'Instructors'),
            href: getUriWithOrg(orgslug, '/dash/instructors'),
            icon: <ChalkboardTeacher size={14} />,
          },
        ]}
      />
      <AcademicHeader
        title={t('instructors.title', 'Instructors')}
        subtitle={t('instructors.subtitle', 'Manage instructors, categories and finance')}
        action={
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="instructors" orgId={orgId!}>
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="rounded-full bg-[hsl(var(--dash-accent))] px-5 py-2 text-xs font-semibold text-white flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('instructors.new_instructor', 'New Instructor')}
            </button>
          </AuthenticatedClientElement>
        }
      />

      <InstructorTabs orgslug={orgslug} />

      <AcademicGrid>
        {!isLoading && instructors.length === 0 && (
          <AcademicEmptyState
            title={t('instructors.none', 'No instructors yet')}
            description={t('instructors.none_desc', 'Add an instructor to start tracking hours and cost.')}
          />
        )}
        {instructors.map((i: any) => (
          <AcademicCard
            key={i.instructor_uuid}
            orgslug={orgslug}
            href={'/dash/instructors'}
            title={nameOf(i)}
            subtitle={i.user?.email || (i.contact_info?.email ?? '')}
            badges={badgesFor(i)}
            onEdit={() => {
              setEditing(i)
              setModalOpen(true)
            }}
            onDelete={() => handleDelete(i)}
          />
        ))}
      </AcademicGrid>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minWidth="md"
        dialogTitle={editing ? t('instructors.edit', 'Edit Instructor') : t('instructors.new_instructor', 'New Instructor')}
        dialogContent={
          <InstructorForm
            orgId={orgId!}
            access_token={access_token}
            instructor={editing}
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

function InstructorForm({
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
  const isEdit = !!instructor

  const { data: categories = [] } = useQuery({
    queryKey: ['instructor-categories', orgId],
    queryFn: () => getInstructorCategories(orgId, access_token),
    enabled: !!orgId && !!access_token,
    staleTime: 30_000,
  })

  const [userUuid, setUserUuid] = useState<string | null>(instructor?.user?.user_uuid || null)
  const [userLabel, setUserLabel] = useState<string | undefined>(
    instructor?.user
      ? `${instructor.user.first_name || ''} ${instructor.user.last_name || ''}`.trim() ||
          instructor.user.username
      : undefined
  )
  const [categoryUuid, setCategoryUuid] = useState<string>(instructor?.category?.category_uuid || '')
  const [department, setDepartment] = useState(instructor?.department || '')
  const [languages, setLanguages] = useState((instructor?.languages || []).join(', '))
  const [hourlyRate, setHourlyRate] = useState<string>(
    instructor?.hourly_rate != null ? String(instructor.hourly_rate) : ''
  )
  const [phone, setPhone] = useState(instructor?.contact_info?.phone || '')
  const [email, setEmail] = useState(instructor?.contact_info?.email || '')
  const [status, setStatus] = useState(instructor?.status || 'active')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEdit && !userUuid) {
      toast.error(t('instructors.pick_user', 'Select a user for the instructor'))
      return
    }
    setSaving(true)
    try {
      const contact_info: Record<string, string> = {}
      if (phone) contact_info.phone = phone
      if (email) contact_info.email = email
      const langs = languages
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
      const payload: any = {
        category_uuid: categoryUuid || null,
        department: department || null,
        languages: langs,
        contact_info,
        hourly_rate: hourlyRate === '' ? null : Number(hourlyRate),
        status,
      }
      if (isEdit) {
        await updateInstructor(instructor.instructor_uuid, payload, access_token)
        toast.success(t('academic.updated'))
      } else {
        await createInstructor(orgId, { ...payload, user_uuid: userUuid }, access_token)
        toast.success(t('academic.created'))
      }
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('academic.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isEdit && (
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
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('instructors.category', 'Category')}>
          <select className={inputCls} value={categoryUuid} onChange={(e) => setCategoryUuid(e.target.value)}>
            <option value="">{t('instructors.no_category', 'No category')}</option>
            {categories.map((c: any) => (
              <option key={c.category_uuid} value={c.category_uuid}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('instructors.status', 'Status')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`instructors.status_${s}`, s) as string}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('instructors.department', 'Department')}>
          <input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label={t('instructors.fallback_rate', 'Fallback hourly rate')}>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder={t('instructors.rate_from_category', 'Uses category rate if empty')}
          />
        </Field>
      </div>

      <Field label={t('instructors.languages', 'Languages (comma separated)')}>
        <input
          className={inputCls}
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          placeholder="English, Arabic"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('instructors.phone', 'Phone')}>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('instructors.contact_email', 'Contact email')}>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <SubmitRow saving={saving} />
    </form>
  )
}

export default InstructorsHome
