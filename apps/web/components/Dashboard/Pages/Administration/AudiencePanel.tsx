'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, RefreshCw, Trash2, X } from 'lucide-react'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { DataTable, GhostButton, IconButton, Section, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { SearchBox, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  AudienceResourceType,
  createAudienceAssignment,
  deleteAudienceAssignment,
  getAudienceOptions,
  getEntityOptions,
  getResourceAudience,
  resyncResourceAudience,
} from '@services/administration/administration'

export function audienceTypeLabel(t: TFunction, type: string): string {
  const labels: Record<string, [string, string]> = {
    entity: ['entities.audience.entity', 'Entity (all members)'],
    usergroup: ['entities.audience.usergroup', 'Group'],
    position: ['entities.audience.position', 'Position'],
    cohort: ['entities.audience.cohort', 'Cohort'],
    user: ['entities.audience.user', 'Person'],
  }
  const [key, fallback] = labels[type] || [type, type]
  return String(t(key, fallback))
}

export type AudienceChoice = { audience_type: string; audience_uuid: string; name: string; detail?: string; entity_uuid?: string }

/** Search entities, groups, positions, cohorts and people (``entityUuid`` scopes to one entity). */
export function AudiencePicker({
  value,
  onChange,
  entityUuid,
}: {
  value: AudienceChoice | null
  onChange: (_v: AudienceChoice | null) => void
  entityUuid?: string
}) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const [q, setQ] = useState('')
  const { data: options = [], isFetching } = useQuery({
    queryKey: ['audience', 'options', orgId, entityUuid, q],
    queryFn: () => getAudienceOptions(orgId, access_token, { q: q.trim() || undefined, entity_uuid: entityUuid }),
    enabled: ready && !value,
    staleTime: 10_000,
  })
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 py-2 text-sm">
        <span>
          <span className="me-2 text-xs text-[hsl(var(--dash-muted))]">{audienceTypeLabel(t, value.audience_type)}</span>
          <span className="font-medium">{value.name}</span>
          {value.detail && <span className="ms-2 text-xs text-[hsl(var(--dash-muted))]">{value.detail}</span>}
        </span>
        <IconButton type="button" onClick={() => onChange(null)} aria-label="clear">
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    )
  }
  const grouped: Record<string, AudienceChoice[]> = {}
  ;(options as AudienceChoice[]).forEach((o) => {
    ;(grouped[o.audience_type] ||= []).push(o)
  })
  return (
    <div>
      <SearchBox value={q} onChange={setQ} placeholder={t('entities.audience.search', 'Search entities, groups, positions or people')} />
      <div className="-mt-2 max-h-64 overflow-y-auto rounded-xl border border-[hsl(var(--dash-border))] p-1">
        {isFetching && <div className="px-2 py-1 text-xs">…</div>}
        {!isFetching && (options as any[]).length === 0 && (
          <div className="px-2 py-1 text-xs text-[hsl(var(--dash-muted))]">{t('entities.audience.none_found', 'Nothing found')}</div>
        )}
        {['entity', 'usergroup', 'position', 'cohort', 'user'].map((type) =>
          grouped[type]?.length ? (
            <div key={type}>
              <div className="px-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--dash-muted))]">
                {audienceTypeLabel(t, type)}
              </div>
              {grouped[type].map((o) => (
                <button
                  key={`${o.audience_type}:${o.audience_uuid}`}
                  type="button"
                  onClick={() => onChange(o)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-start text-sm hover:bg-[hsl(var(--dash-canvas))]"
                >
                  <span className="font-medium">{o.name}</span>
                  {o.detail && <span className="text-xs text-[hsl(var(--dash-muted))]">{o.detail}</span>}
                </button>
              ))}
            </div>
          ) : null
        )}
      </div>
      {!q && (
        <p className="mt-1 text-[11px] text-[hsl(var(--dash-muted))]">{t('entities.audience.people_hint', 'Type a name or email to find people.')}</p>
      )}
    </div>
  )
}

/** Options shared by the academy and coordinator assignment forms. */
export function AssignmentOptions({
  value,
  onChange,
}: {
  value: { auto_enroll: boolean; due_date: string; notify: boolean }
  onChange: (_v: { auto_enroll: boolean; due_date: string; notify: boolean }) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.auto_enroll} onChange={(e) => onChange({ ...value, auto_enroll: e.target.checked })} />
        {t('entities.audience.auto_enroll', 'Enroll them automatically')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.notify} onChange={(e) => onChange({ ...value, notify: e.target.checked })} />
        {t('entities.audience.notify', 'Notify them')}
      </label>
      <Field label={t('entities.audience.due_date', 'Due date')}>
        <input type="date" className={inputCls} value={value.due_date} onChange={(e) => onChange({ ...value, due_date: e.target.value })} />
      </Field>
    </div>
  )
}

export function AssignmentRows({
  assignments,
  onRemove,
  showMode = true,
}: {
  assignments: any[]
  onRemove?: (_a: any) => void
  showMode?: boolean
}) {
  const { t } = useTranslation()
  return (
    <DataTable
      headers={[
        t('entities.audience.audience', 'Audience'),
        ...(showMode ? [t('entities.audience.mode', 'Mode')] : []),
        t('entities.members', 'Members'),
        t('entities.audience.options', 'Options'),
        '',
      ]}
      empty={t('entities.audience.none', 'Not assigned to anyone yet.')}
    >
      {assignments.map((a) => (
        <tr key={a.assignment_uuid}>
          <td className={tdCls}>
            <div className="text-xs text-[hsl(var(--dash-muted))]">{audienceTypeLabel(t, a.audience_type)}</div>
            <div className="font-medium">{a.audience_name || '—'}</div>
            {a.entity_name && a.audience_type !== 'entity' && (
              <div className="text-xs text-[hsl(var(--dash-muted))]">{a.entity_name}</div>
            )}
          </td>
          {showMode && (
            <td className={tdCls}>
              <span
                className={
                  a.mode === 'available'
                    ? 'rounded-full bg-[hsl(var(--dash-tile-amber))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-tile-amber-fg))]'
                    : 'rounded-full bg-[hsl(var(--dash-tile-mint))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--dash-tile-mint-fg))]'
                }
              >
                {String(t(`entities.audience.mode_${a.mode}`, a.mode))}
              </span>
            </td>
          )}
          <td className={tdCls}>{a.mode === 'available' ? '—' : a.member_count}</td>
          <td className={`${tdCls} text-xs`}>
            {[
              a.auto_enroll ? t('entities.audience.auto_enroll_short', 'auto-enroll') : null,
              a.notify ? t('entities.audience.notify_short', 'notify') : null,
              a.due_date ? `${t('entities.audience.due', 'due')} ${a.due_date}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </td>
          <td className={`${tdCls} text-end`}>
            {onRemove && (
              <IconButton tone="danger" title={String(t('entities.audience.remove', 'Remove assignment'))} onClick={() => onRemove(a)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

/** Academy view: who a course / training program is assigned or made available to. */
export function AudiencePanel({
  resourceType,
  resourceUuid,
  isPublic,
}: {
  resourceType: AudienceResourceType
  resourceUuid: string
  /** Public resources stay open to everyone whatever the assignments. */
  isPublic?: boolean
}) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const key = ['audience', resourceType, resourceUuid]
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => getResourceAudience(resourceType, resourceUuid, access_token),
    enabled: ready && !!resourceUuid,
  })
  const { data: entities = [] } = useQuery({
    queryKey: ['administration', 'entity-options', orgId],
    queryFn: () => getEntityOptions(orgId, access_token),
    enabled: ready,
  })
  const [choice, setChoice] = useState<AudienceChoice | null>(null)
  const [mode, setMode] = useState<'assigned' | 'available'>('assigned')
  const [scope, setScope] = useState('')
  const [opts, setOpts] = useState({ auto_enroll: false, due_date: '', notify: true })
  const [saving, setSaving] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  if (error) return null // no permission to manage audiences
  const canBeAvailable = choice?.audience_type === 'entity'

  const add = async () => {
    if (!choice) return
    setSaving(true)
    try {
      await createAudienceAssignment(
        {
          resource_type: resourceType,
          resource_uuid: resourceUuid,
          audience_type: choice.audience_type,
          audience_uuid: choice.audience_uuid,
          entity_uuid: choice.audience_type === 'position' ? scope || undefined : undefined,
          mode: canBeAvailable ? mode : 'assigned',
          auto_enroll: opts.auto_enroll,
          due_date: opts.due_date || undefined,
          notify: opts.notify,
        },
        access_token
      )
      toast.success(t('entities.audience.added', 'Assigned'))
      setChoice(null)
      setScope('')
      setMode('assigned')
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    } finally {
      setSaving(false)
    }
  }
  const remove = async (a: any) => {
    const msg =
      a.mode === 'available'
        ? t('entities.audience.confirm_remove_available', 'Withdraw from this entity? Anything its coordinators assigned from it is withdrawn too.')
        : t('entities.audience.confirm_remove', 'Remove this assignment? Its members lose access unless another assignment covers them.')
    if (!window.confirm(msg)) return
    try {
      await deleteAudienceAssignment(a.assignment_uuid, access_token)
      toast.success(t('administration.common.deleted', 'Deleted'))
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.delete_failed', 'Could not delete'))
    }
  }
  const resync = async () => {
    try {
      const result = await resyncResourceAudience(resourceType, resourceUuid, access_token)
      toast.success(`${t('entities.audience.resynced', 'Re-applied')} · ${result?.covered_users ?? 0}`)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  return (
    <Section
      title={t('entities.audience.title', 'Assign to audiences')}
      description={t(
        'entities.audience.desc',
        'Assign to entities, groups, positions, cohorts or people. Assigning restricts access to those audiences; "available" lets an entity’s coordinator assign it to their own people.'
      )}
      action={
        <GhostButton onClick={resync}>
          <RefreshCw className="h-3.5 w-3.5" /> {t('entities.audience.resync', 'Re-apply')}
        </GhostButton>
      }
    >
      {isPublic && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-[hsl(var(--dash-canvas))] px-3 py-2 text-xs text-[hsl(var(--dash-muted))]">
          <AlertTriangle className="h-4 w-4" />
          {t('entities.audience.public_note', 'Access is public, so everyone can open it. Switch to "Users only" for assignments to restrict access.')}
        </div>
      )}
      {data && !data.published && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-[hsl(var(--dash-tile-amber))] px-3 py-2 text-xs text-[hsl(var(--dash-tile-amber-fg))]">
          <AlertTriangle className="h-4 w-4" />
          {t('entities.audience.unpublished', 'Not published yet — assigned members can only open it once it is published.')}
        </div>
      )}
      {isLoading ? (
        <div className="dash-shimmer h-24 rounded-xl" />
      ) : (
        <>
          <AssignmentRows assignments={data?.assignments || []} onRemove={remove} />
          {!!data?.covered_users && (
            <p className="mt-2 text-xs text-[hsl(var(--dash-muted))]">
              {data.covered_users} {t('entities.audience.covered', 'people have access through these assignments')}
            </p>
          )}
          {!!data?.other_groups?.length && (
            <p className="mt-2 text-xs text-[hsl(var(--dash-muted))]">
              {t('entities.audience.other_groups', 'Also linked to user groups directly:')}{' '}
              {data.other_groups.map((g: any) => g.name).join(', ')}
            </p>
          )}
        </>
      )}

      <div className="mt-4 space-y-3 rounded-xl border border-dashed border-[hsl(var(--dash-border))] p-3">
        <AudiencePicker value={choice} onChange={setChoice} />
        {choice && (
          <>
            {canBeAvailable && (
              <div className="flex flex-wrap gap-2">
                {(['assigned', 'available'] as const).map((m) => (
                  <GhostButton key={m} type="button" onClick={() => setMode(m)} className={mode === m ? 'bg-[hsl(var(--dash-canvas))]' : ''}>
                    {String(t(`entities.audience.mode_${m}_long`, m === 'assigned' ? 'Assign to every member' : 'Make available to its coordinator'))}
                  </GhostButton>
                ))}
              </div>
            )}
            {choice.audience_type === 'position' && !choice.entity_uuid && (
              <Field label={t('entities.audience.position_scope', 'Only in entity')}>
                <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="">{t('entities.all_entities', 'All entities')}</option>
                  {(entities as any[]).map((o) => (
                    <option key={o.entity_uuid} value={o.entity_uuid}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {!(canBeAvailable && mode === 'available') && <AssignmentOptions value={opts} onChange={setOpts} />}
            <div className="flex justify-end">
              <GhostButton onClick={add} disabled={saving}>
                {saving ? '…' : t('entities.audience.assign', 'Assign')}
              </GhostButton>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
