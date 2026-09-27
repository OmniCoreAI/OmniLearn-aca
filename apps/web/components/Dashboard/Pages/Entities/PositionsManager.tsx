'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, SubmitRow, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, GhostButton, IconButton, StatusPill, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  createPosition,
  deletePosition,
  getEntityOptions,
  getPositions,
  updatePosition,
} from '@services/administration/administration'

function PositionForm({ position, entityUuid, onDone }: { position: any; entityUuid?: string; onDone: () => void }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const { data: entities = [] } = useQuery({
    queryKey: ['administration', 'entity-options', orgId],
    queryFn: () => getEntityOptions(orgId, access_token),
    enabled: ready && !entityUuid && !position,
  })
  const [form, setForm] = useState({
    name: position?.name || '',
    code: position?.code || '',
    description: position?.description || '',
    status: position?.status || 'active',
    entity_uuid: entityUuid || '',
  })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, code: form.code || undefined, entity_uuid: form.entity_uuid || undefined }
      if (position) await updatePosition(position.position_uuid, payload, access_token)
      else await createPosition(orgId, payload, access_token)
      toast.success(position ? t('administration.common.updated', 'Saved') : t('administration.common.created', 'Created'))
      onDone()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label={t('administration.common.name', 'Name')}>
            <input className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Manager" />
          </Field>
        </div>
        <Field label={t('administration.common.code', 'Code')}>
          <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('administration.common.code_auto', 'Auto')} />
        </Field>
      </div>
      {!position && !entityUuid && (
        <Field label={t('entities.position_scope', 'Used by')}>
          <select className={inputCls} value={form.entity_uuid} onChange={(e) => setForm({ ...form, entity_uuid: e.target.value })}>
            <option value="">{t('entities.all_entities', 'All entities')}</option>
            {(entities as any[]).map((o) => (
              <option key={o.entity_uuid} value={o.entity_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t('administration.common.status', 'Status')}>
        <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {['active', 'inactive'].map((s) => (
            <option key={s} value={s}>
              {String(t(`administration.common.status_${s}`, s))}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('administration.common.description', 'Description')}>
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <SubmitRow saving={saving} />
    </form>
  )
}

/** Positions (Manager, Engineer…). Without ``entityUuid`` it lists every position. */
export function PositionsManager({ entityUuid, canManage = true }: { entityUuid?: string; canManage?: boolean }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const key = entityUuid ? ['entities', entityUuid, 'positions'] : ['administration', 'positions', orgId]
  const { data: positions = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getPositions(orgId, access_token, entityUuid),
    enabled: ready,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entities'] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'positions', orgId] })
  }
  const remove = async (p: any) => {
    if (!window.confirm(t('entities.confirm_delete_position', 'Delete this position? Members keep their membership without a position, and training assigned to it is withdrawn.'))) return
    try {
      await deletePosition(p.position_uuid, access_token)
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
          <GhostButton onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5" /> {t('entities.new_position', 'New position')}
          </GhostButton>
        </div>
      )}
      <DataTable
        headers={[
          t('administration.common.name', 'Name'),
          t('administration.common.code', 'Code'),
          t('entities.position_scope', 'Used by'),
          t('entities.members', 'Members'),
          t('administration.common.status', 'Status'),
          '',
        ]}
        empty={isLoading ? '…' : t('entities.no_positions', 'No positions yet.')}
      >
        {(positions as any[]).map((p) => (
          <tr key={p.position_uuid}>
            <td className={tdCls}>
              <div className="font-medium">{p.name}</div>
              {p.description && <div className="text-xs text-[hsl(var(--dash-muted))]">{p.description}</div>}
            </td>
            <td className={`${tdCls} font-mono text-xs`}>{p.code}</td>
            <td className={tdCls}>{p.entity_name || t('entities.all_entities', 'All entities')}</td>
            <td className={tdCls}>{p.member_count}</td>
            <td className={tdCls}>
              <StatusPill status={p.status} label={String(t(`administration.common.status_${p.status}`, p.status))} />
            </td>
            <td className={`${tdCls} whitespace-nowrap text-end`}>
              {canManage && (!entityUuid || p.entity_uuid === entityUuid) && (
                <>
                  <IconButton title={String(t('administration.common.edit', 'Edit'))} onClick={() => { setEditing(p); setOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton tone="danger" title={String(t('administration.common.delete', 'Delete'))} onClick={() => remove(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="md"
        dialogTitle={editing ? editing.name : t('entities.new_position', 'New position')}
        dialogContent={
          <PositionForm
            key={editing?.position_uuid || 'new'}
            position={editing}
            entityUuid={entityUuid}
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
