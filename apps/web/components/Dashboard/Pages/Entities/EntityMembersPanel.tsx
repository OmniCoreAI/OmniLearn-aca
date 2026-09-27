'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Star, StarOff, Trash2, UserPlus } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, GhostButton, IconButton, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { SearchBox, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  addEntityMember,
  assignEntityCoordinator,
  getEntityGroups,
  getEntityMembers,
  getPositions,
  removeEntityCoordinator,
  removeEntityMember,
  updateEntityMember,
} from '@services/administration/administration'

export const personName = (u: any) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username : '—')

const PAGE_SIZE = 50

export function useEntityPositions(entityUuid: string) {
  const { orgId, access_token, ready } = useAdminContext()
  const { data = [] } = useQuery({
    queryKey: ['entities', entityUuid, 'positions'],
    queryFn: () => getPositions(orgId, access_token, entityUuid),
    enabled: ready && !!entityUuid,
  })
  return (data as any[]).filter((p) => p.status === 'active')
}

export function useEntityGroups(entityUuid: string) {
  const { access_token, ready } = useAdminContext()
  const { data = [] } = useQuery({
    queryKey: ['entities', entityUuid, 'groups'],
    queryFn: () => getEntityGroups(entityUuid, access_token),
    enabled: ready && !!entityUuid,
  })
  return data as any[]
}

/** Shows the one-time password of an account created on the fly. */
export function announceTemporaryPassword(t: any, saved: any) {
  if (!saved?.temporary_password) return
  window.alert(
    `${t('entities.temp_password', 'Account created. Share this one-time password securely; it must be changed at first sign-in:')}\n\n${saved.email}\n${saved.temporary_password}`
  )
}

function MemberForm({
  entityUuid,
  isAcademy,
  member,
  onDone,
}: {
  entityUuid: string
  isAcademy: boolean
  member: any
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { orgId, access_token } = useAdminContext()
  const positions = useEntityPositions(entityUuid)
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed && g.status === 'active')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [userUuid, setUserUuid] = useState<string | null>(null)
  const [userLabel, setUserLabel] = useState<string | undefined>()
  const [person, setPerson] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [form, setForm] = useState({
    position_uuid: member?.position_uuid || '',
    employee_id: member?.employee_id || '',
    status: member?.status || 'active',
  })
  const [groupUuids, setGroupUuids] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (member) {
        await updateEntityMember(entityUuid, member.member_uuid, form, access_token)
      } else {
        if (mode === 'existing' && !userUuid) throw new Error(String(t('entities.pick_user', 'Choose a user')))
        const saved = await addEntityMember(
          entityUuid,
          {
            ...(mode === 'existing' ? { user_uuid: userUuid } : { new_user: person }),
            position_uuid: form.position_uuid || undefined,
            employee_id: form.employee_id || undefined,
            group_uuids: groupUuids,
          },
          access_token
        )
        announceTemporaryPassword(t, saved)
      }
      toast.success(member ? t('administration.common.updated', 'Saved') : t('entities.member_added', 'Member added'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!member && (
        <>
          {isAcademy && (
            <div className="flex gap-2">
              {(['new', 'existing'] as const).map((m) => (
                <GhostButton
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={mode === m ? 'bg-[hsl(var(--dash-canvas))]' : ''}
                >
                  {m === 'new' ? t('entities.by_email', 'By name & email') : t('entities.existing_user', 'Existing platform user')}
                </GhostButton>
              ))}
            </div>
          )}
          {mode === 'existing' && isAcademy ? (
            <Field label={t('entities.user', 'User')}>
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
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t('entities.first_name', 'First name')}>
                  <input className={inputCls} required value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
                </Field>
                <Field label={t('entities.last_name', 'Last name')}>
                  <input className={inputCls} value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
                </Field>
                <Field label={t('entities.contact_email', 'Email')}>
                  <input className={inputCls} type="email" required value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
                </Field>
                <Field label={t('entities.contact_phone', 'Phone')}>
                  <input className={inputCls} value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-[hsl(var(--dash-muted))]">
                {t('entities.by_email_hint', 'If someone in the academy already uses this email, they are added as they are; otherwise an account is created.')}
              </p>
            </>
          )}
        </>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('entities.position', 'Position')}>
          <select className={inputCls} value={form.position_uuid} onChange={(e) => setForm({ ...form, position_uuid: e.target.value })}>
            <option value="">—</option>
            {positions.map((p) => (
              <option key={p.position_uuid} value={p.position_uuid}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('entities.employee_id', 'Employee ID')}>
          <input className={inputCls} value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
        </Field>
      </div>
      {member ? (
        <Field label={t('administration.common.status', 'Status')}>
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {['active', 'inactive'].map((s) => (
              <option key={s} value={s}>
                {String(t(`administration.common.status_${s}`, s))}
              </option>
            ))}
          </select>
          {form.status === 'inactive' && (
            <p className="mt-1 text-xs text-[hsl(var(--dash-muted))]">
              {t('entities.deactivate_hint', 'Inactive members leave all of this entity’s groups and lose the training assigned through them.')}
            </p>
          )}
        </Field>
      ) : (
        groups.length > 0 && (
          <Field label={t('entities.groups', 'Groups')}>
            <div className="flex flex-wrap gap-3">
              {groups.map((g) => (
                <label key={g.usergroup_uuid} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={groupUuids.includes(g.usergroup_uuid)}
                    onChange={(e) =>
                      setGroupUuids(e.target.checked ? [...groupUuids, g.usergroup_uuid] : groupUuids.filter((u) => u !== g.usergroup_uuid))
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </Field>
        )
      )}
      <SubmitRow saving={saving} />
    </form>
  )
}

export function EntityMembersPanel({
  entityUuid,
  isAcademy,
  canManage,
  onChanged,
}: {
  entityUuid: string
  isAcademy: boolean
  canManage: boolean
  onChanged?: () => void
}) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const positions = useEntityPositions(entityUuid)
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [positionUuid, setPositionUuid] = useState('')
  const [groupUuid, setGroupUuid] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const params = { q: q.trim() || undefined, status: status || undefined, position_uuid: positionUuid || undefined, group_uuid: groupUuid || undefined, page, limit: PAGE_SIZE }
  const { data, isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'members', params],
    queryFn: () => getEntityMembers(entityUuid, access_token, params),
    enabled: ready,
  })
  const items = (data?.items || []) as any[]
  const total = data?.total || 0

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
    onChanged?.()
  }

  const act = async (fn: () => Promise<any>, ok: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder={t('entities.search_members', 'Search by name, email or employee ID')} />
        </div>
        <select className={`${inputCls} mb-4 w-40`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">{t('entities.all_statuses', 'All statuses')}</option>
          <option value="active">{String(t('administration.common.status_active', 'active'))}</option>
          <option value="inactive">{String(t('administration.common.status_inactive', 'inactive'))}</option>
        </select>
        <select className={`${inputCls} mb-4 w-44`} value={positionUuid} onChange={(e) => { setPositionUuid(e.target.value); setPage(1) }}>
          <option value="">{t('entities.all_positions', 'All positions')}</option>
          {positions.map((p) => (
            <option key={p.position_uuid} value={p.position_uuid}>{p.name}</option>
          ))}
        </select>
        <select className={`${inputCls} mb-4 w-44`} value={groupUuid} onChange={(e) => { setGroupUuid(e.target.value); setPage(1) }}>
          <option value="">{t('entities.all_groups', 'All groups')}</option>
          {groups.map((g) => (
            <option key={g.usergroup_uuid} value={g.usergroup_uuid}>{g.name}</option>
          ))}
        </select>
        {canManage && (
          <GhostButton className="mb-4" onClick={() => { setEditing(null); setOpen(true) }}>
            <UserPlus className="h-3.5 w-3.5" /> {t('entities.add_member', 'Add member')}
          </GhostButton>
        )}
      </div>

      <DataTable
        headers={[
          t('entities.member', 'Member'),
          t('entities.employee_id', 'Employee ID'),
          t('entities.position', 'Position'),
          t('entities.groups', 'Groups'),
          t('administration.common.status', 'Status'),
          '',
        ]}
        empty={isLoading ? '…' : t('entities.no_members', 'No members yet.')}
      >
        {items.map((m) => (
          <tr key={m.member_uuid}>
            <td className={tdCls}>
              <div className="flex items-center gap-1.5 font-medium">
                {personName(m.user)}
                {m.is_coordinator && (
                  <span className="rounded-full bg-[hsl(var(--dash-tile-lavender))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-tile-lavender-fg))]">
                    {t('entities.coordinator', 'Coordinator')}
                  </span>
                )}
              </div>
              <div className="text-xs text-[hsl(var(--dash-muted))]">{m.email}</div>
            </td>
            <td className={tdCls}>{m.employee_id || '—'}</td>
            <td className={tdCls}>{m.position_name || '—'}</td>
            <td className={`${tdCls} text-xs`}>{(m.groups || []).map((g: any) => g.name).join(', ') || '—'}</td>
            <td className={tdCls}>
              <StatusPill status={m.status} label={String(t(`administration.common.status_${m.status}`, m.status))} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-end`}>
              {isAcademy &&
                (m.is_coordinator ? (
                  <IconButton
                    title={String(t('entities.remove_coordinator', 'Stop being coordinator'))}
                    onClick={() => act(() => removeEntityCoordinator(entityUuid, m.member_uuid, access_token), t('administration.common.updated', 'Saved'))}
                  >
                    <StarOff className="h-3.5 w-3.5" />
                  </IconButton>
                ) : (
                  <IconButton
                    title={String(t('entities.make_coordinator', 'Make coordinator'))}
                    onClick={() =>
                      act(
                        () => assignEntityCoordinator(entityUuid, { user_uuid: m.user.user_uuid }, access_token),
                        t('administration.common.updated', 'Saved'),
                        t('entities.confirm_make_coordinator', 'Make this member a coordinator of the entity? Trainees get the Entity Coordinator role.')
                      )
                    }
                  >
                    <Star className="h-3.5 w-3.5" />
                  </IconButton>
                ))}
              {canManage && (!m.is_coordinator || isAcademy) && (
                <>
                  <IconButton title={String(t('administration.common.edit', 'Edit'))} onClick={() => { setEditing(m); setOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    tone="danger"
                    title={String(t('entities.remove_member', 'Remove from entity'))}
                    onClick={() =>
                      act(
                        () => removeEntityMember(entityUuid, m.member_uuid, access_token),
                        t('administration.common.deleted', 'Deleted'),
                        t('entities.confirm_remove_member', 'Remove this member from the entity? Their account stays; they leave the entity’s groups.')
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <GhostButton disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</GhostButton>
          <span>
            {page} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <GhostButton disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>›</GhostButton>
        </div>
      )}

      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        dialogTitle={editing ? personName(editing.user) : t('entities.add_member', 'Add member')}
        dialogContent={
          <MemberForm
            key={editing?.member_uuid || 'new'}
            entityUuid={entityUuid}
            isAcademy={isAcademy}
            member={editing}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
    </div>
  )
}
