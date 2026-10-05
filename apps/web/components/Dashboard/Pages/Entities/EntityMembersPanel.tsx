'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Star, StarOff, Trash2, UserPlus } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, FormActions, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { CoordinatorPicker } from '@components/Dashboard/Pages/Academic/AcademicPeople'
import { PersonAvatar, useAdminContext, useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
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
  onCancel,
}: {
  entityUuid: string
  isAcademy: boolean
  member: any
  onDone: () => void
  onCancel: () => void
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
            <div className={TAB_TRACK} role="tablist">
              {(['new', 'existing'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={tabItemClass(mode === m, 'text-xs')}>
                  {m === 'new' ? t('entities.by_email', 'By name & email') : t('entities.existing_user', 'Existing platform user')}
                </button>
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
                <Field label={t('entities.first_name', 'First name')} required>
                  <input className={inputCls} required value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
                </Field>
                <Field label={t('entities.last_name', 'Last name')}>
                  <input className={inputCls} value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
                </Field>
                <Field label={t('entities.contact_email', 'Email')} required>
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
      <FormActions saving={saving} onCancel={onCancel} submitLabel={member ? t('academic.save', 'Save') : t('entities.add_member', 'Add member')} />
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
  const { confirm, dialog } = useConfirm()
  const positions = useEntityPositions(entityUuid)
  const groups = useEntityGroups(entityUuid).filter((g) => !g.managed)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [positionUuid, setPositionUuid] = useState('all')
  const [groupUuid, setGroupUuid] = useState('all')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const pick = (v: string) => (v === 'all' ? undefined : v)
  const params = {
    q: q.trim() || undefined,
    status: pick(status),
    position_uuid: pick(positionUuid),
    group_uuid: pick(groupUuid),
    page,
    limit: PAGE_SIZE,
  }
  const { data, isLoading } = useQuery({
    queryKey: ['entities', entityUuid, 'members', params],
    queryFn: () => getEntityMembers(entityUuid, access_token, params),
    enabled: ready,
  })
  const items = (data?.items || []) as any[]
  const total = data?.total || 0
  const filtering = !!q || status !== 'all' || positionUuid !== 'all' || groupUuid !== 'all'

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })
    onChanged?.()
  }
  const act = async (fn: () => Promise<any>, ok: string, ask?: { title: string; message: string; confirmText: string; tone?: 'warning' | 'info' }) => {
    if (ask && !(await confirm(ask))) return
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }
  const filterTo = (setter: (_v: string) => void) => (v: string) => {
    setter(v)
    setPage(1)
  }

  return (
    <div>
      <DashDataTable
        rows={items}
        rowKey={(m: any) => m.member_uuid}
        loading={isLoading}
        serverPaging={{ page, pageSize: PAGE_SIZE, total, onChange: setPage }}
        onRowClick={canManage ? (m: any) => { setEditing(m); setOpen(true) } : undefined}
        itemLabel={(n) => t('entities.members_count', '{{count}} members', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={q} onChange={filterTo(setQ)} placeholder={t('entities.search_members', 'Search by name, email or employee ID')} />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={filterTo(setStatus)}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'active', label: String(t('administration.common.status_active', 'Active')) },
                { value: 'inactive', label: String(t('administration.common.status_inactive', 'Inactive')) },
              ]}
            />
            {positions.length ? (
              <ToolbarSelect
                label={t('entities.position', 'Position')}
                value={positionUuid}
                onChange={filterTo(setPositionUuid)}
                options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...positions.map((p) => ({ value: p.position_uuid, label: p.name }))]}
              />
            ) : null}
            {groups.length ? (
              <ToolbarSelect
                label={t('entities.group', 'Group')}
                value={groupUuid}
                onChange={filterTo(setGroupUuid)}
                options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...groups.map((g) => ({ value: g.usergroup_uuid, label: g.name }))]}
              />
            ) : null}
          </>
        }
        toolbarEnd={
          canManage ? (
            <GhostButton onClick={() => { setEditing(null); setOpen(true) }}>
              <UserPlus className="h-3.5 w-3.5" /> {t('entities.add_member', 'Add member')}
            </GhostButton>
          ) : null
        }
        empty={
          <AcademicEmptyState
            compact
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('entities.no_members', 'No members yet.')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('entities.no_members_hint', 'Add people one by one or import them from Excel in the Imports tab.')
            }
          />
        }
        columns={[
          {
            key: 'member',
            header: t('entities.member', 'Member'),
            primary: true,
            cell: (m: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={personName(m.user)} size={32} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{personName(m.user)}</span>
                    {m.is_coordinator && (
                      <span className="shrink-0 rounded-full bg-[hsl(var(--dash-accent-soft))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-accent))]">
                        {t('entities.coordinator', 'Coordinator')}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-[hsl(var(--dash-muted))]">{m.email}</div>
                </div>
              </div>
            ),
          },
          { key: 'employee', header: t('entities.employee_id', 'Employee ID'), cell: (m: any) => <span className="font-mono text-xs">{m.employee_id || '—'}</span> },
          { key: 'position', header: t('entities.position', 'Position'), cell: (m: any) => m.position_name || <span className="text-[hsl(var(--dash-muted))]">—</span> },
          {
            key: 'groups',
            header: t('entities.groups', 'Groups'),
            hideBelow: 'lg',
            cell: (m: any) => {
              const list = (m.groups || []) as any[]
              if (!list.length) return <span className="text-[hsl(var(--dash-muted))]">—</span>
              return (
                <span className="flex items-center gap-1" title={list.map((g) => g.name).join(', ')}>
                  <span className="truncate rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px]">{list[0].name}</span>
                  {list.length > 1 ? <span className="text-[11px] text-[hsl(var(--dash-muted))]">+{list.length - 1}</span> : null}
                </span>
              )
            },
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            cell: (m: any) => <StatusPill status={m.status} label={String(t(`administration.common.status_${m.status}`, m.status))} />,
          },
        ]}
        actions={(m: any) => [
          ...(canManage && (!m.is_coordinator || isAcademy)
            ? [{ label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => { setEditing(m); setOpen(true) } }]
            : []),
          ...(isAcademy
            ? [
                m.is_coordinator
                  ? {
                      label: t('entities.remove_coordinator', 'Stop being coordinator'),
                      icon: <StarOff className="h-3.5 w-3.5" />,
                      onSelect: () => act(() => removeEntityCoordinator(entityUuid, m.member_uuid, access_token), t('administration.common.updated', 'Saved')),
                    }
                  : {
                      label: t('entities.make_coordinator', 'Make coordinator'),
                      icon: <Star className="h-3.5 w-3.5" />,
                      onSelect: () =>
                        act(() => assignEntityCoordinator(entityUuid, { user_uuid: m.user.user_uuid }, access_token), t('administration.common.updated', 'Saved'), {
                          title: t('entities.make_coordinator_title', 'Make {{name}} a coordinator?', { name: personName(m.user) }),
                          message: t('entities.confirm_make_coordinator', 'Make this member a coordinator of the entity? Trainees get the Entity Coordinator role.'),
                          confirmText: t('entities.make_coordinator', 'Make coordinator'),
                          tone: 'info',
                        }),
                    },
              ]
            : []),
          ...(canManage && (!m.is_coordinator || isAcademy)
            ? [
                {
                  label: t('entities.remove_member', 'Remove from entity'),
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  tone: 'danger' as const,
                  onSelect: () =>
                    act(() => removeEntityMember(entityUuid, m.member_uuid, access_token), t('administration.common.deleted', 'Deleted'), {
                      title: t('entities.remove_member_title', 'Remove {{name}}?', { name: personName(m.user) }),
                      message: t('entities.confirm_remove_member', 'Remove this member from the entity? Their account stays; they leave the entity’s groups.'),
                      confirmText: t('entities.remove_member_short', 'Remove'),
                    }),
                },
              ]
            : []),
        ]}
      />

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
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false)
              refresh()
            }}
          />
        }
      />
      {dialog}
    </div>
  )
}
