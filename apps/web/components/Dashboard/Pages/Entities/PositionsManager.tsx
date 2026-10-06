'use client'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { IdentificationBadge } from '@phosphor-icons/react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Field, FormActions, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { useAdminContext, useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
import { createPosition, deletePosition, getEntityOptions, getPositions, updatePosition } from '@services/administration/administration'

function PositionForm({ position, entityUuid, onDone, onCancel }: { position: any; entityUuid?: string; onDone: () => void; onCancel: () => void }) {
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
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError(String(t('administration.validation.required', 'Required')))
      return
    }
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
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('administration.common.name', 'Name')} required error={error} className="sm:col-span-2">
          <input
            className={inputCls}
            value={form.name}
            aria-invalid={!!error}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              setError('')
            }}
            placeholder={String(t('entities.position_placeholder', 'e.g. Manager'))}
          />
        </Field>
        <Field label={t('administration.common.code', 'Code')}>
          <input className={`${inputCls} font-mono`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('administration.common.code_auto', 'Auto')} />
        </Field>
      </div>
      {!position && !entityUuid ? (
        <Field label={t('entities.position_scope', 'Used by')} hint={t('entities.position_scope_hint', 'Shared positions are available in every entity.')}>
          <select className={inputCls} value={form.entity_uuid} onChange={(e) => setForm({ ...form, entity_uuid: e.target.value })}>
            <option value="">{t('entities.all_entities', 'All entities')}</option>
            {(entities as any[]).map((o) => (
              <option key={o.entity_uuid} value={o.entity_uuid}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label={t('administration.common.status', 'Status')}>
        <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="active">{t('academic.state_active', 'Active')}</option>
          <option value="inactive">{t('administration.common.status_inactive', 'Inactive')}</option>
        </select>
      </Field>
      <Field label={t('administration.common.description', 'Description')}>
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

/** Positions (Manager, Engineer…). Without ``entityUuid`` it lists every position. */
export function PositionsManager({ entityUuid, canManage = true }: { entityUuid?: string; canManage?: boolean }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [status, setStatus] = useState('all')
  const key = entityUuid ? ['entities', entityUuid, 'positions'] : ['administration', 'positions', orgId]
  const { data: positions = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getPositions(orgId, access_token, entityUuid),
    enabled: ready,
  })
  const all = positions as any[]
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entities'] })
    queryClient.invalidateQueries({ queryKey: ['administration', 'positions', orgId] })
  }
  const openForm = (p: any) => {
    setEditing(p)
    setOpen(true)
  }
  // Inside an organization, shared positions are listed but managed centrally.
  const editable = (p: any) => canManage && (!entityUuid || p.entity_uuid === entityUuid)

  const remove = async (p: any) => {
    const ok = await confirm({
      title: t('entities.delete_position_title', 'Delete {{name}}?', { name: p.name }),
      message: t('entities.confirm_delete_position', 'Delete this position? Members keep their membership without a position, and training assigned to it is withdrawn.'),
      confirmText: t('administration.common.delete', 'Delete'),
    })
    if (!ok) return
    try {
      await deletePosition(p.position_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const toggle = async (p: any) => {
    try {
      await updatePosition(p.position_uuid, { status: p.status === 'active' ? 'inactive' : 'active' }, access_token)
      toast.success(t('administration.common.updated', 'Saved'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  const scopeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of all) if (p.entity_uuid) seen.set(p.entity_uuid, p.entity_name)
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [all])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (scope === 'all' || (scope === 'shared' ? !p.entity_uuid : p.entity_uuid === scope)) &&
        (!q || `${p.name} ${p.code} ${p.description || ''}`.toLowerCase().includes(q))
    )
  }, [all, query, scope, status])
  const filtering = !!query || scope !== 'all' || status !== 'all'

  const newButton = canManage ? (
    <button
      type="button"
      onClick={() => openForm(null)}
      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
    >
      <Plus className="h-3.5 w-3.5" /> {t('entities.new_position', 'New position')}
    </button>
  ) : null

  return (
    <>
      <DashDataTable
        rows={visible}
        rowKey={(p: any) => p.position_uuid}
        loading={isLoading}
        onRowClick={(p: any) => (editable(p) ? openForm(p) : undefined)}
        initialSort={{ key: 'name', dir: 'asc' }}
        itemLabel={(n) => t('entities.positions_count', '{{count}} positions', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('entities.search_positions', 'Search positions')} />
            {!entityUuid ? (
              <ToolbarSelect
                label={t('entities.position_scope', 'Used by')}
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'all', label: t('administration.common.all', 'All') },
                  { value: 'shared', label: t('entities.shared_positions', 'Shared') },
                  ...scopeOptions,
                ]}
              />
            ) : null}
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'active', label: t('academic.state_active', 'Active') },
                { value: 'inactive', label: t('administration.common.status_inactive', 'Inactive') },
              ]}
            />
          </>
        }
        toolbarEnd={newButton}
        empty={
          <AcademicEmptyState
            compact
            icon={<IdentificationBadge size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('entities.no_positions', 'No positions yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('entities.no_positions_hint', 'Positions such as Manager or Engineer let you assign training to everyone in that role.')
            }
            action={filtering ? undefined : newButton}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('administration.common.name', 'Name'),
            primary: true,
            sortValue: (p: any) => p.name,
            cell: (p: any) => (
              <div className="min-w-0 leading-tight">
                <div className="truncate font-medium">{p.name}</div>
                <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                  <span className="font-mono">{p.code}</span>
                  {p.description ? ` · ${p.description}` : ''}
                </div>
              </div>
            ),
          },
          {
            key: 'scope',
            header: t('entities.position_scope', 'Used by'),
            sortValue: (p: any) => p.entity_name || '',
            cell: (p: any) =>
              p.entity_name ? (
                <span className="text-[13px]">{p.entity_name}</span>
              ) : (
                <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--dash-muted))]">{t('entities.all_entities', 'All entities')}</span>
              ),
          },
          { key: 'members', header: t('entities.members', 'Members'), align: 'end', sortValue: (p: any) => p.member_count, cell: (p: any) => <span className="tabular-nums">{p.member_count}</span> },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (p: any) => p.status,
            cell: (p: any) => <StatusPill status={p.status} label={String(t(`administration.common.status_${p.status}`, p.status))} />,
          },
        ]}
        actions={(p: any) =>
          editable(p)
            ? [
                { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => openForm(p) },
                {
                  label: p.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
                  icon: <Power className="h-3.5 w-3.5" />,
                  onSelect: () => toggle(p),
                },
                { label: t('administration.common.delete', 'Delete'), icon: <Trash2 className="h-3.5 w-3.5" />, tone: 'danger' as const, onSelect: () => remove(p) },
              ]
            : []
        }
      />
      <Modal
        isDialogOpen={open}
        onOpenChange={setOpen}
        minWidth="sm"
        dialogTitle={editing ? `${t('administration.common.edit', 'Edit')} ${editing.name}` : t('entities.new_position', 'New position')}
        dialogContent={
          open ? (
            <PositionForm
              key={editing?.position_uuid || 'new'}
              position={editing}
              entityUuid={entityUuid}
              onCancel={() => setOpen(false)}
              onDone={() => {
                setOpen(false)
                refresh()
              }}
            />
          ) : null
        }
      />
      {dialog}
    </>
  )
}
