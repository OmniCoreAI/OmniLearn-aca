'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { UserPlus, X } from 'lucide-react'
import { inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, IconButton, Section, Stat, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { useAdminContext, useLookupLabel } from '@components/Dashboard/Pages/Administration/AdminUI'
import { assignEntityCoordinator, removeEntityCoordinator, updateEntity } from '@services/administration/administration'
import { CoordinatorPermissionsEditor } from './EntityForm'
import { announceTemporaryPassword, personName } from './EntityMembersPanel'

function CoordinatorAssignForm({ entityUuid, onDone }: { entityUuid: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [userUuid, setUserUuid] = useState<string | null>(null)
  const [label, setLabel] = useState<string | undefined>()
  const [person, setPerson] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const saved = await assignEntityCoordinator(
        entityUuid,
        mode === 'existing' ? { user_uuid: userUuid } : { new_user: person },
        access_token
      )
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
    <div className="space-y-3 rounded-xl border border-dashed border-[hsl(var(--dash-border))] p-3">
      <div className="flex gap-2">
        {(['existing', 'new'] as const).map((m) => (
          <GhostButton key={m} type="button" onClick={() => setMode(m)} className={mode === m ? 'bg-[hsl(var(--dash-canvas))]' : ''}>
            {m === 'new' ? t('entities.new_person', 'New person') : t('entities.existing_user', 'Existing platform user')}
          </GhostButton>
        ))}
      </div>
      {mode === 'existing' ? (
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
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder={String(t('entities.first_name', 'First name'))} value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
          <input className={inputCls} placeholder={String(t('entities.last_name', 'Last name'))} value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
          <input className={inputCls} type="email" placeholder={String(t('entities.contact_email', 'Email'))} value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
          <input className={inputCls} placeholder={String(t('entities.contact_phone', 'Phone'))} value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} />
        </div>
      )}
      <p className="text-xs text-[hsl(var(--dash-muted))]">
        {t('entities.coordinator_role_hint', 'Trainees get the Entity Coordinator role; academy admins keep theirs. Coordinators only ever see this entity.')}
      </p>
      <div className="flex justify-end">
        <GhostButton onClick={save} disabled={saving || (mode === 'existing' ? !userUuid : !person.email || !person.first_name)}>
          {saving ? '…' : t('entities.make_coordinator', 'Make coordinator')}
        </GhostButton>
      </div>
    </div>
  )
}

export function EntityOverview({ entity, isAcademy }: { entity: any; isAcademy: boolean }) {
  const { t } = useTranslation()
  const { access_token } = useAdminContext()
  const queryClient = useQueryClient()
  const label = useLookupLabel()
  const [assigning, setAssigning] = useState(false)
  const [permissions, setPermissions] = useState(entity.coordinator_permissions)
  const [savingPerms, setSavingPerms] = useState(false)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entities', entity.entity_uuid] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'entity', entity.entity_uuid] })
  }

  const removeCoordinator = async (userUuid: string) => {
    if (!window.confirm(t('entities.confirm_remove_coordinator', 'Stop this person coordinating the entity? They stay a member.'))) return
    try {
      await removeEntityCoordinator(entity.entity_uuid, userUuid, access_token)
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Section title={t('entities.details', 'Details')} className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label={t('entities.type', 'Entity type')} value={entity.entity_type ? label(entity.entity_type) : '—'} />
          <Stat label={t('administration.common.code', 'Code')} value={entity.code} />
          <Stat label={t('administration.common.status', 'Status')} value={<StatusPill status={entity.status} label={String(t(`administration.common.status_${entity.status}`, entity.status))} />} />
          <Stat label={t('entities.members', 'Members')} value={entity.member_count} />
          <Stat label={t('entities.groups', 'Groups')} value={entity.group_count} />
          <Stat label={t('entities.parent', 'Part of')} value={entity.parent_name || '—'} />
          <Stat label={t('entities.contact_name', 'Contact person')} value={entity.contact_name || '—'} />
          <Stat label={t('entities.contact_email', 'Email')} value={entity.contact_email || '—'} />
          <Stat label={t('entities.contact_phone', 'Phone')} value={entity.contact_phone || '—'} />
        </div>
        {(entity.address || entity.city || entity.country) && (
          <p className="mt-3 text-sm">{[entity.address, entity.city, entity.country].filter(Boolean).join(', ')}</p>
        )}
        {entity.description && <p className="mt-3 whitespace-pre-line text-sm">{entity.description}</p>}
      </Section>

      <div className="space-y-6">
        <Section
          title={t('entities.coordinators', 'Coordinators')}
          action={
            isAcademy && (
              <GhostButton onClick={() => setAssigning(!assigning)}>
                <UserPlus className="h-3.5 w-3.5" /> {t('entities.add', 'Add')}
              </GhostButton>
            )
          }
        >
          <div className="space-y-1.5">
            {(entity.coordinators || []).length === 0 && (
              <p className="text-xs text-[hsl(var(--dash-muted))]">{t('entities.no_coordinators', 'No coordinator yet.')}</p>
            )}
            {(entity.coordinators || []).map((c: any) => (
              <div key={c.user_uuid} className="flex items-center justify-between rounded-lg bg-[hsl(var(--dash-canvas))] px-3 py-1.5 text-sm">
                <span className="font-medium">{personName(c)}</span>
                {isAcademy && (
                  <IconButton tone="danger" title={String(t('entities.remove_coordinator', 'Stop being coordinator'))} onClick={() => removeCoordinator(c.user_uuid)}>
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
          {assigning && (
            <div className="mt-3">
              <CoordinatorAssignForm
                entityUuid={entity.entity_uuid}
                onDone={() => {
                  setAssigning(false)
                  refresh()
                }}
              />
            </div>
          )}
        </Section>

        <Section title={t('entities.coordinator_permissions', 'What coordinators of this entity can do')}>
          <CoordinatorPermissionsEditor value={permissions} onChange={isAcademy ? setPermissions : undefined} disabled={!isAcademy} />
          {isAcademy && (
            <div className="mt-3 flex justify-end">
              <GhostButton onClick={savePermissions} disabled={savingPerms}>
                {savingPerms ? '…' : t('academic.save', 'Save')}
              </GhostButton>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
