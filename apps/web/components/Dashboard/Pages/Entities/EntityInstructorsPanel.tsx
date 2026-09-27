'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, GhostButton, Section, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getEntityInstructors, inviteEntityInstructor } from '@services/administration/administration'
import { personName } from './EntityMembersPanel'

/** Coordinator view: propose instructors; the academy approves them and sets their rate. */
export function EntityInstructorsPanel({ entityUuid }: { entityUuid: string }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', specializations: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const { data: instructors = [] } = useQuery({
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
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Section title={t('entities.instructors.proposed', 'Instructors you proposed')} className="lg:col-span-2">
        <DataTable headers={[t('instructors.title', 'Instructors'), t('entities.instructors.expertise', 'Expertise'), t('administration.common.status', 'Status')]} empty={t('entities.no_instructors', 'No instructors linked to this entity.')}>
          {(instructors as any[]).map((i) => (
            <tr key={i.instructor_uuid}>
              <td className={tdCls}>
                <div className="font-medium">{personName(i.user)}</div>
                <div className="text-xs text-[hsl(var(--dash-muted))]">{i.email}</div>
              </td>
              <td className={`${tdCls} text-xs`}>{(i.specializations || []).join(', ') || '—'}</td>
              <td className={tdCls}>
                <StatusPill status={i.status === 'pending_approval' ? 'pending' : i.status} label={String(t(`instructors.status_${i.status}`, i.status))} />
              </td>
            </tr>
          ))}
        </DataTable>
      </Section>
      <Section
        title={t('entities.instructors.invite', 'Propose an instructor')}
        description={t('entities.instructors.invite_desc', 'The academy reviews the proposal, sets the category and rate, then activates the instructor.')}
      >
        <form onSubmit={invite} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} required placeholder={String(t('entities.first_name', 'First name'))} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input className={inputCls} placeholder={String(t('entities.last_name', 'Last name'))} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <input className={inputCls} type="email" required placeholder={String(t('entities.contact_email', 'Email'))} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inputCls} placeholder={String(t('entities.contact_phone', 'Phone'))} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Field label={t('entities.instructors.expertise', 'Expertise')}>
            <input className={inputCls} placeholder="Networks, Cybersecurity" value={form.specializations} onChange={(e) => setForm({ ...form, specializations: e.target.value })} />
          </Field>
          <textarea className={inputCls} rows={3} placeholder={String(t('entities.instructors.bio', 'Short bio'))} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <div className="flex justify-end">
            <GhostButton type="submit" disabled={saving}>
              <UserPlus className="h-3.5 w-3.5" /> {saving ? '…' : t('entities.instructors.send', 'Send for approval')}
            </GhostButton>
          </div>
        </form>
      </Section>
    </div>
  )
}
