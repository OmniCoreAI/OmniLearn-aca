'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Lock, Pencil, Plus, Trash2, Users } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, GhostButton, IconButton, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { SearchBox, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  createEntityGroup,
  deleteEntityGroup,
  getEntityMembers,
  setEntityGroupMembers,
  updateEntityGroup,
} from '@services/administration/administration'
import { personName, useEntityGroups } from './EntityMembersPanel'

export const ENTITY_GROUP_TYPES = ['general', 'department']

function GroupForm({ entityUuid, group, onDone }: { entityUuid: string; group: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { access_token } = useAdminContext()
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    group_type: group?.group_type || 'general',
    status: group?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (group) await updateEntityGroup(entityUuid, group.usergroup_uuid, form, access_token)
      else await createEntityGroup(entityUuid, form, access_token)
      toast.success(group ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('administration.common.name', 'Name')}>
        <input className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IT Department" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('entities.group_type', 'Type')}>
          <select className={inputCls} value={form.group_type} onChange={(e) => setForm({ ...form, group_type: e.target.value })}>
            {ENTITY_GROUP_TYPES.map((g) => (
              <option key={g} value={g}>
                {String(t(`entities.group_type_${g}`, g))}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('administration.common.status', 'Status')}>
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {['active', 'inactive'].map((s) => (
              <option key={s} value={s}>
                {String(t(`administration.common.status_${s}`, s))}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('administration.common.description', 'Description')}>
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

function GroupMembersForm({ entityUuid, group, onDone }: { entityUuid: string; group: any; onDone: () => void }) {
  const { t } = useTranslation()
  const { access_token, ready } = useAdminContext()
  const [q, setQ] = useState('')
  const { data: all } = useQuery({
    queryKey: ['entities', entityUuid, 'members', 'all-active'],
    queryFn: () => getEntityMembers(entityUuid, access_token, { status: 'active', limit: 200 }),
    enabled: ready,
  })
  const { data: current, isSuccess } = useQuery({
    queryKey: ['entities', entityUuid, 'members', 'group', group.usergroup_uuid],
    queryFn: () => getEntityMembers(entityUuid, access_token, { group_uuid: group.usergroup_uuid, limit: 200 }),
    enabled: ready,
  })
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const chosen = selected ?? new Set<string>(((current?.items || []) as any[]).map((m) => m.member_uuid))
  const [saving, setSaving] = useState(false)
  const needle = q.trim().toLowerCase()
  const members = ((all?.items || []) as any[]).filter(
    (m) => !needle || `${personName(m.user)} ${m.email || ''} ${m.employee_id || ''}`.toLowerCase().includes(needle)
  )

  const toggle = (uuid: string, on: boolean) => {
    const next = new Set(chosen)
    if (on) next.add(uuid)
    else next.delete(uuid)
    setSelected(next)
  }
  const save = async () => {
    setSaving(true)
    try {
      await setEntityGroupMembers(entityUuid, group.usergroup_uuid, Array.from(chosen), access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder={t('entities.search_members', 'Search by name, email or employee ID')} />
      <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-[hsl(var(--dash-border))] p-2">
        {!isSuccess && <div className="p-2 text-xs">…</div>}
        {isSuccess && members.length === 0 && (
          <div className="p-2 text-xs text-[hsl(var(--dash-muted))]">{t('entities.no_members', 'No members yet.')}</div>
        )}
        {members.map((m) => (
          <label key={m.member_uuid} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[hsl(var(--dash-canvas))]">
            <input type="checkbox" checked={chosen.has(m.member_uuid)} onChange={(e) => toggle(m.member_uuid, e.target.checked)} />
            <span className="font-medium">{personName(m.user)}</span>
            <span className="text-xs text-[hsl(var(--dash-muted))]">
              {[m.position_name, m.employee_id].filter(Boolean).join(' · ')}
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[hsl(var(--dash-muted))]">
          {chosen.size} {t('entities.selected', 'selected')}
        </span>
        <GhostButton onClick={save} disabled={saving}>
          {saving ? '…' : t('academic.save', 'Save')}
        </GhostButton>
      </div>
    </div>
  )
}

export function EntityGroupsPanel({ entityUuid, canManage }: { entityUuid: string; canManage: boolean }) {
  const { t } = useTranslation()
  const { access_token } = useAdminContext()
  const queryClient = useQueryClient()
  const groups = useEntityGroups(entityUuid)
  const [editing, setEditing] = useState<any>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [membersOf, setMembersOf] = useState<any>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['entities', entityUuid] })

  const remove = async (g: any) => {
    if (!window.confirm(t('entities.confirm_delete_group', 'Delete this group? Training assigned to it is withdrawn from its members.'))) return
    try {
      await deleteEntityGroup(entityUuid, g.usergroup_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }

  return (
    <div>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <GhostButton onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5" /> {t('entities.new_group', 'New group')}
          </GhostButton>
        </div>
      )}
      <DataTable
        headers={[t('administration.common.name', 'Name'), t('entities.group_type', 'Type'), t('entities.members', 'Members'), t('administration.common.status', 'Status'), '']}
        empty={t('entities.no_groups', 'No groups yet.')}
      >
        {groups.map((g) => (
          <tr key={g.usergroup_uuid}>
            <td className={tdCls}>
              <div className="flex items-center gap-1.5 font-medium">
                {g.managed && <Lock className="h-3.5 w-3.5 text-[hsl(var(--dash-muted))]" />}
                {g.name}
              </div>
              {g.managed ? (
                <div className="text-xs text-[hsl(var(--dash-muted))]">{t('entities.all_members_group', 'Every active member — maintained automatically')}</div>
              ) : (
                g.description && <div className="text-xs text-[hsl(var(--dash-muted))]">{g.description}</div>
              )}
            </td>
            <td className={tdCls}>{String(t(`entities.group_type_${g.group_type}`, g.group_type))}</td>
            <td className={tdCls}>{g.member_count}</td>
            <td className={tdCls}>
              <StatusPill status={g.status} label={String(t(`administration.common.status_${g.status}`, g.status))} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-end`}>
              {canManage && !g.managed && (
                <>
                  <IconButton title={String(t('entities.manage_group_members', 'Choose members'))} onClick={() => setMembersOf(g)}>
                    <Users className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton title={String(t('administration.common.edit', 'Edit'))} onClick={() => { setEditing(g); setFormOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton tone="danger" title={String(t('administration.common.delete', 'Delete'))} onClick={() => remove(g)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal
        isDialogOpen={formOpen}
        onOpenChange={setFormOpen}
        minWidth="md"
        dialogTitle={editing ? editing.name : t('entities.new_group', 'New group')}
        dialogContent={
          <GroupForm
            key={editing?.usergroup_uuid || 'new'}
            entityUuid={entityUuid}
            group={editing}
            onDone={() => {
              setFormOpen(false)
              refresh()
            }}
          />
        }
      />
      <Modal
        isDialogOpen={!!membersOf}
        onOpenChange={(o: boolean) => !o && setMembersOf(null)}
        minWidth="md"
        dialogTitle={membersOf ? `${t('entities.manage_group_members', 'Choose members')} · ${membersOf.name}` : ''}
        dialogContent={
          membersOf && (
            <GroupMembersForm
              key={membersOf.usergroup_uuid}
              entityUuid={entityUuid}
              group={membersOf}
              onDone={() => {
                setMembersOf(null)
                refresh()
              }}
            />
          )
        }
      />
    </div>
  )
}
