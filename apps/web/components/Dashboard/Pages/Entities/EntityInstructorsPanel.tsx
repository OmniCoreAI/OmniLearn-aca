'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'
import { ChalkboardTeacher } from '@phosphor-icons/react'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminCard, PersonAvatar, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getEntityInstructors, inviteEntityInstructor } from '@services/administration/administration'
import { personName } from './EntityMembersPanel'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Coordinator view: propose instructors; the academy approves them and sets their rate. */
export function EntityInstructorsPanel({ entityUuid }: { entityUuid: string }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', specializations: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'proposed-instructors'],
    queryFn: () => getEntityInstructors(entityUuid, access_token),
    enabled: ready,
  })
  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await inviteEntityInstructor(
        entityUuid,
        { ...form, specializations: form.specializations.split(/[,،;]/).map((s) => s.trim()).filter(Boolean) },
        access_token
      )
      toast.success(t('entities.instructors.invited', 'Sent to the academy for approval'))
      setForm({ first_name: '', last_name: '', email: '', phone: '', specializations: '', bio: '' })
      queryClient.invalidateQueries({ queryKey: ['entities', entityUuid, 'proposed-instructors'] })
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  const emailError = form.email && !EMAIL_RE.test(form.email) ? String(t('administration.validation.email', 'Enter a valid email')) : undefined
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <DashDataTable
          rows={instructors as any[]}
          rowKey={(i: any) => i.instructor_uuid}
          loading={isLoading}
          initialSort={{ key: 'name', dir: 'asc' }}
          itemLabel={(n) => t('instructors.count', '{{count}} instructors', { count: n })}
          toolbar={<span className="text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('entities.instructors.proposed', 'Instructors you proposed')}</span>}
          empty={
            <AcademicEmptyState
              compact
              icon={<ChalkboardTeacher size={24} />}
              title={t('entities.no_instructors', 'No instructors linked to this entity.')}
              description={t('entities.instructors.invite_desc', 'The academy reviews the proposal, sets the category and rate, then activates the instructor.')}
            />
          }
          columns={[
            {
              key: 'name',
              header: t('instructors.instructor', 'Instructor'),
              primary: true,
              sortValue: (i: any) => personName(i.user),
              cell: (i: any) => (
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar name={personName(i.user)} size={32} />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate font-medium">{personName(i.user)}</div>
                    <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{i.email}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'expertise',
              header: t('entities.instructors.expertise', 'Expertise'),
              hideOnMobile: true,
              cell: (i: any) => <span className="line-clamp-1 text-[13px]">{(i.specializations || []).join(', ') || '—'}</span>,
            },
            {
              key: 'status',
              header: t('administration.common.status', 'Status'),
              sortValue: (i: any) => i.status,
              cell: (i: any) => <StatusPill status={i.status === 'pending_approval' ? 'pending' : i.status} label={String(t(`instructors.status_${i.status}`, i.status))} />,
            },
          ]}
        />
      </div>
      <AdminCard
        title={t('entities.instructors.invite', 'Propose an instructor')}
        description={t('entities.instructors.invite_desc', 'The academy reviews the proposal, sets the category and rate, then activates the instructor.')}
      >
        <form onSubmit={invite} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('entities.first_name', 'First name')} required>
              <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field label={t('entities.last_name', 'Last name')}>
              <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
          </div>
          <Field label={t('entities.contact_email', 'Email')} required error={emailError}>
            <input className={inputCls} type="email" aria-invalid={!!emailError} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t('entities.contact_phone', 'Phone')}>
            <input className={inputCls} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t('entities.instructors.expertise', 'Expertise')} hint={t('administration.common.comma_hint', 'Separate with commas.')}>
            <input className={inputCls} placeholder="Networks, Cybersecurity" value={form.specializations} onChange={(e) => setForm({ ...form, specializations: e.target.value })} />
          </Field>
          <Field label={t('entities.instructors.bio', 'Short bio')}>
            <textarea className={inputCls} rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !form.first_name.trim() || !form.email || !!emailError}
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> {saving ? t('academic.saving', 'Saving…') : t('entities.instructors.send', 'Send for approval')}
            </button>
          </div>
        </form>
      </AdminCard>
    </div>
  )
}
