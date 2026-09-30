'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, Phone, UserPlus, X } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { AdminCard, DetailItem, PersonAvatar, useAdminContext, useConfirm, useLookupLabel } from '@components/Dashboard/Pages/Administration/AdminUI'
import { assignEntityCoordinator, removeEntityCoordinator, updateEntity } from '@services/administration/administration'
import { cn } from '@/lib/utils'
import { CoordinatorPermissionsEditor } from './EntityForm'
import { announceTemporaryPassword, personName } from './EntityMembersPanel'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function CoordinatorAssignForm({ entityUuid, onDone, onCancel }: { entityUuid: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [userUuid, setUserUuid] = useState<string | null>(null)
  const [label, setLabel] = useState<string | undefined>()
  const [person, setPerson] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const emailError = person.email && !EMAIL_RE.test(person.email) ? String(t('administration.validation.email', 'Enter a valid email')) : undefined
  const canSave = mode === 'existing' ? !!userUuid : !!person.first_name.trim() && !!person.email && !emailError
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    try {
      const saved = await assignEntityCoordinator(entityUuid, mode === 'existing' ? { user_uuid: userUuid } : { new_user: person }, access_token)
      announceTemporaryPassword(t, saved)
      toast.success(t('entities.coordinator_assigned', 'Coordinator assigned'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className={cn(TAB_TRACK, 'flex w-full p-0.5 shadow-none')} role="tablist">
        {(['existing', 'new'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={tabItemClass(mode === m, 'flex-1 justify-center py-1.5 text-xs')}>
            {m === 'new' ? t('entities.new_person', 'New person') : t('entities.existing_user', 'Existing platform user')}
          </button>
        ))}
      </div>
      {mode === 'existing' ? (
        <Field label={t('entities.person', 'Person')} required>
          <CoordinatorPicker
            orgId={orgId}
            access_token={access_token}
            value={userUuid}
            selectedLabel={label}
            onChange={(uuid, l) => {
              setUserUuid(uuid)
              setLabel(l)
            }}
          />
        </Field>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('entities.first_name', 'First name')} required>
            <input className={inputCls} value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
          </Field>
          <Field label={t('entities.last_name', 'Last name')}>
            <input className={inputCls} value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
          </Field>
          <Field label={t('entities.contact_email', 'Email')} required error={emailError}>
            <input className={inputCls} type="email" aria-invalid={!!emailError} value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
          </Field>
          <Field label={t('entities.contact_phone', 'Phone')}>
            <input className={inputCls} inputMode="tel" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} />
          </Field>
        </div>
      )}
      <p className="rounded-xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2 text-xs text-[hsl(var(--dash-muted))]">
        {t('entities.coordinator_role_hint', 'Trainees get the Entity Coordinator role; academy admins keep theirs. Coordinators only ever see this organization.')}
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-sm font-medium text-[hsl(var(--dash-ink))] hover:bg-[hsl(var(--dash-canvas))]"
        >
          {t('administration.common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || !canSave}
          className="rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t('academic.saving', 'Saving…') : t('entities.make_coordinator', 'Make coordinator')}
        </button>
      </div>
    </form>
  )
}

export function EntityOverview({ entity, isAcademy }: { entity: any; isAcademy: boolean }) {
  const { t } = useTranslation()
  const { access_token } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const { confirm, dialog } = useConfirm()
  const [assigning, setAssigning] = useState(false)
  const [permissions, setPermissions] = useState(entity.coordinator_permissions)
  const [savingPerms, setSavingPerms] = useState(false)
  const permsDirty = JSON.stringify(permissions) !== JSON.stringify(entity.coordinator_permissions)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entities', entity.entity_uuid] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'entity', entity.entity_uuid] })
  }

  const removeCoordinator = async (c: any) => {
    const ok = await confirm({
      title: t('entities.remove_coordinator_title', 'Stop {{name}} coordinating?', { name: personName(c) }),
      message: t('entities.confirm_remove_coordinator', 'They stay a member of the organization but lose coordinator access.'),
      confirmText: t('entities.remove_coordinator', 'Stop being coordinator'),
    })
    if (!ok) return
    try {
      await removeEntityCoordinator(entity.entity_uuid, c.user_uuid, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const savePermissions = async () => {
    setSavingPerms(true)
    try {
      await updateEntity(entity.entity_uuid, { coordinator_permissions: permissions }, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSavingPerms(false)
    }
  }
  const address = [entity.address, entity.city, entity.country].filter(Boolean).join(', ')

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <AdminCard title={t('entities.details', 'Details')}>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <DetailItem label={t('entities.type_short', 'Type')}>{entity.entity_type ? label(entity.entity_type) : null}</DetailItem>
            <DetailItem label={t('administration.common.code', 'Code')}>{entity.code ? <span className="font-mono">{entity.code}</span> : null}</DetailItem>
            <DetailItem label={t('entities.parent', 'Part of')}>{entity.parent_name}</DetailItem>
            <DetailItem label={t('entities.contact_name', 'Contact person')}>{entity.contact_name}</DetailItem>
            <DetailItem label={t('entities.contact_email', 'Email')}>
              {entity.contact_email ? (
                <a href={`mailto:${entity.contact_email}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="h-3.5 w-3.5 text-[hsl(var(--dash-muted))]" /> {entity.contact_email}
                </a>
              ) : null}
            </DetailItem>
            <DetailItem label={t('entities.contact_phone', 'Phone')}>
              {entity.contact_phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-[hsl(var(--dash-muted))]" /> {entity.contact_phone}
                </span>
              ) : null}
            </DetailItem>
            <div className="sm:col-span-3">
              <DetailItem label={t('entities.address', 'Address')}>{address}</DetailItem>
            </div>
          </dl>
          {entity.description ? <p className="mt-5 whitespace-pre-line border-t border-[hsl(var(--dash-border))] pt-4 text-sm leading-relaxed">{entity.description}</p> : null}
        </AdminCard>

        <AdminCard
          title={t('entities.coordinator_permissions', 'What coordinators can do')}
          description={t('entities.coordinator_permissions_desc', 'Applies to every coordinator of this organization.')}
          action={
            isAcademy && permsDirty ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPermissions(entity.coordinator_permissions)} className="rounded-full px-3 py-1.5 text-xs font-medium text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))]">
                  {t('administration.common.discard', 'Discard')}
                </button>
                <button
                  type="button"
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="rounded-full bg-[hsl(var(--dash-ink))] px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {savingPerms ? t('academic.saving', 'Saving…') : t('academic.save', 'Save')}
                </button>
              </div>
            ) : null
          }
        >
          <CoordinatorPermissionsEditor value={permissions} onChange={isAcademy ? setPermissions : undefined} disabled={!isAcademy} />
        </AdminCard>
      </div>

      <AdminCard
        title={t('entities.coordinators', 'Coordinators')}
        description={t('entities.coordinators_desc', 'They follow this organization’s people and training.')}
        action={
          isAcademy ? (
            <button
              type="button"
              onClick={() => setAssigning(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              <UserPlus className="h-3.5 w-3.5" /> {t('entities.add', 'Add')}
            </button>
          ) : null
        }
      >
        {(entity.coordinators || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-6 text-center">
            <p className="text-sm font-medium">{t('entities.no_coordinators', 'No coordinator yet')}</p>
            <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">{t('entities.no_coordinators_hint', 'A coordinator can add members, assign training and follow progress.')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--dash-border))]">
            {(entity.coordinators || []).map((c: any) => (
              <li key={c.user_uuid} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <PersonAvatar name={personName(c)} size={34} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-medium">{personName(c)}</div>
                  {c.email ? <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{c.email}</div> : null}
                </div>
                {isAcademy ? (
                  <button
                    type="button"
                    title={String(t('entities.remove_coordinator', 'Stop being coordinator'))}
                    aria-label={String(t('entities.remove_coordinator', 'Stop being coordinator'))}
                    onClick={() => removeCoordinator(c)}
                    className="rounded-full p-1.5 text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-warn))]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <Modal
        isDialogOpen={assigning}
        onOpenChange={setAssigning}
        minWidth="sm"
        dialogTitle={t('entities.add_coordinator', 'Add a coordinator')}
        dialogContent={
          assigning ? (
            <CoordinatorAssignForm
              entityUuid={entity.entity_uuid}
              onCancel={() => setAssigning(false)}
              onDone={() => {
                setAssigning(false)
                refresh()
              }}
            />
          ) : null
        }
      />
      {dialog}
    </div>
  )
}
