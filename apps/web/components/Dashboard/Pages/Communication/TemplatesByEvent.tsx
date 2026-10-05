'use client'
import { EnvelopeSimple } from '@phosphor-icons/react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Copy, Mail, MessageSquare, Pencil, Plus, Power, ShieldCheck, Sparkles, Star, Trash2 } from 'lucide-react'
import { GhostButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminDrawer, formatAdminDate, useAdminContext, useConfirm } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  NotificationChannel,
  deleteNotificationTemplate,
  duplicateNotificationTemplate,
  getNotificationTemplates,
  updateNotificationTemplate,
} from '@services/administration/administration'
import { useEventLabel, useNotificationCatalog } from './CommunicationTabs'
import { TemplateEditor } from './TemplateEditor'

type Row =
  | { kind: 'template'; key: string; event: any; tpl: any }
  | { kind: 'builtin'; key: string; event: any; tpl: null }

export function TemplatesByEvent({ channel }: { channel: NotificationChannel }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<{ template: any; eventKey?: string } | null>(null)
  const [query, setQuery] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [source, setSource] = useState('all')
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['communication', 'templates', orgId, channel],
    queryFn: () => getNotificationTemplates(orgId, access_token, { channel }),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['communication'] })

  const act = async (fn: () => Promise<any>, ok: string, ask?: { title: string; message: string; confirmText: string }) => {
    if (ask && !(await confirm(ask))) return
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  // One row per custom template; message types still on the built-in text get
  // a single "Built-in" row so every event is visible and customizable.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const event of catalog) {
      const list = (templates as any[]).filter((tpl) => tpl.event_key === event.key)
      if (list.length) list.forEach((tpl) => out.push({ kind: 'template', key: tpl.template_uuid, event, tpl }))
      else out.push({ kind: 'builtin', key: `builtin:${event.key}`, event, tpl: null })
    }
    return out
  }, [catalog, templates])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (eventFilter === 'all' || r.event.key === eventFilter) &&
        (source === 'all' || (source === 'custom' ? r.kind === 'template' : r.kind === 'builtin')) &&
        (!q || `${r.tpl?.name || ''} ${eventLabel(r.event)} ${r.event.description || ''}`.toLowerCase().includes(q))
    )
  }, [rows, query, eventFilter, source, eventLabel])
  const filtering = !!query || eventFilter !== 'all' || source !== 'all'
  const customCount = rows.filter((r) => r.kind === 'template').length

  const deliveryBadge = (event: any) =>
    event.required && channel === 'email' ? (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-[hsl(var(--dash-ink))]">
        <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--dash-accent))]" /> {t('communication.always_sent', 'Always sent')}
      </span>
    ) : event.default_channels?.[channel] ? (
      <span className="whitespace-nowrap text-[11px] text-[hsl(var(--dash-ink))]">{t('communication.on_by_default', 'On by default')}</span>
    ) : (
      <span className="whitespace-nowrap text-[11px] text-[hsl(var(--dash-muted))]">{t('communication.off_by_default_short', 'Off by default')}</span>
    )

  return (
    <div>
      <DashDataTable
        rows={visible}
        rowKey={(r: Row) => r.key}
        loading={isLoading}
        pageSize={30}
        onRowClick={(r: Row) => setEditing(r.kind === 'template' ? { template: r.tpl } : { template: null, eventKey: r.event.key })}
        itemLabel={() => t('communication.custom_count', '{{count}} customized', { count: customCount })}
        toolbar={
          <>
            <ToolbarSearch value={query} onChange={setQuery} placeholder={t('communication.search', 'Search templates')} />
            <ToolbarSelect
              label={t('communication.used_for', 'Used for')}
              value={eventFilter}
              onChange={setEventFilter}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...catalog.map((ev) => ({ value: ev.key, label: eventLabel(ev) }))]}
            />
            <ToolbarSelect
              label={t('communication.source', 'Source')}
              value={source}
              onChange={setSource}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'custom', label: t('communication.custom', 'Custom') },
                { value: 'builtin', label: t('communication.builtin', 'Built-in') },
              ]}
            />
          </>
        }
        toolbarEnd={
          <GhostButton onClick={() => setEditing({ template: null, eventKey: eventFilter !== 'all' ? eventFilter : undefined })}>
            <Plus className="h-3.5 w-3.5" /> {t('communication.new_template', 'New template')}
          </GhostButton>
        }
        empty={
          <AcademicEmptyState
            compact
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('communication.none', 'No message types')}
            description={t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('communication.template', 'Template'),
            primary: true,
            sortValue: (r: Row) => r.tpl?.name || '',
            cell: (r: Row) =>
              r.kind === 'template' ? (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]">
                    {channel === 'sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{r.tpl.name}</span>
                      {r.tpl.is_default_for_event ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" /> : null}
                    </div>
                    <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                      {r.tpl.override_count > 0
                        ? t('communication.courses_use_it', '{{count}} course(s) use it', { count: r.tpl.override_count })
                        : r.tpl.is_default_for_event
                          ? t('communication.sent_for_event', 'Sent for this event')
                          : t('communication.custom_template', 'Custom template')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t('communication.builtin_message', 'Built-in message')}</div>
                    <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{t('communication.builtin_hint', 'Customize to change the wording')}</div>
                  </div>
                </div>
              ),
          },
          {
            key: 'event',
            header: t('communication.used_for', 'Used for'),
            sortValue: (r: Row) => eventLabel(r.event),
            cell: (r: Row) => (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-medium">{eventLabel(r.event)}</div>
                <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">{r.event.description}</div>
              </div>
            ),
          },
          {
            key: 'language',
            header: t('communication.language', 'Language'),
            hideBelow: 'lg',
            cell: (r: Row) => (r.tpl ? <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[11px] font-semibold uppercase">{r.tpl.language}</span> : <span className="text-[hsl(var(--dash-muted))]">—</span>),
          },
          { key: 'delivery', header: t('communication.delivery', 'Delivery'), hideBelow: 'lg', cell: (r: Row) => deliveryBadge(r.event) },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            sortValue: (r: Row) => (r.tpl ? r.tpl.status : 'builtin'),
            cell: (r: Row) =>
              r.tpl ? (
                <StatusPill status={r.tpl.status} label={String(t(`administration.common.status_${r.tpl.status}`, r.tpl.status))} />
              ) : (
                <StatusPill status="default" label={String(t('communication.builtin', 'Built-in'))} />
              ),
          },
          {
            key: 'updated',
            header: t('communication.last_updated', 'Last updated'),
            hideBelow: 'xl',
            sortValue: (r: Row) => r.tpl?.update_date || '',
            cell: (r: Row) => <span className="whitespace-nowrap text-[13px] text-[hsl(var(--dash-muted))]">{r.tpl ? formatAdminDate(r.tpl.update_date, i18n.language) : '—'}</span>,
          },
        ]}
        actions={(r: Row) =>
          r.kind === 'builtin'
            ? [{ label: t('communication.customize', 'Customize'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => setEditing({ template: null, eventKey: r.event.key }) }]
            : [
                { label: t('administration.common.edit', 'Edit'), icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => setEditing({ template: r.tpl }) },
                ...(!r.tpl.is_default_for_event
                  ? [
                      {
                        label: t('communication.make_default', 'Use for this event'),
                        icon: <Star className="h-3.5 w-3.5" />,
                        onSelect: () =>
                          act(() => updateNotificationTemplate(r.tpl.template_uuid, { is_default_for_event: true, status: 'active' }, access_token), t('administration.common.updated', 'Saved')),
                      },
                    ]
                  : []),
                {
                  label: r.tpl.status === 'active' ? t('administration.common.deactivate', 'Deactivate') : t('administration.common.activate', 'Activate'),
                  icon: <Power className="h-3.5 w-3.5" />,
                  onSelect: () =>
                    act(
                      () => updateNotificationTemplate(r.tpl.template_uuid, { status: r.tpl.status === 'active' ? 'inactive' : 'active' }, access_token),
                      t('administration.common.updated', 'Saved')
                    ),
                },
                {
                  label: t('communication.duplicate', 'Duplicate'),
                  icon: <Copy className="h-3.5 w-3.5" />,
                  onSelect: () => act(() => duplicateNotificationTemplate(r.tpl.template_uuid, access_token), t('administration.common.created', 'Created')),
                },
                {
                  label: t('administration.common.delete', 'Delete'),
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  tone: 'danger' as const,
                  onSelect: () =>
                    act(() => deleteNotificationTemplate(r.tpl.template_uuid, access_token), t('administration.common.deleted', 'Deleted'), {
                      title: t('communication.delete_title', 'Delete {{name}}?', { name: r.tpl.name }),
                      message: t('communication.confirm_delete', 'Delete this template? The built-in message is used again where it was the default.'),
                      confirmText: t('administration.common.delete', 'Delete'),
                    }),
                },
              ]
        }
      />
      <AdminDrawer
        icon={<EnvelopeSimple size={20} weight="duotone" />}
        open={!!editing}
        onOpenChange={(o: boolean) => !o && setEditing(null)}
        width="sm:max-w-[1100px]"
        title={editing?.template ? editing.template.name : t('communication.new_template', 'New template')}
        description={
          channel === 'sms'
            ? t('communication.editor_desc_sms', 'Write the SMS once; variables are filled in for each recipient.')
            : t('communication.editor_desc_email', 'Write the email once; variables are filled in for each recipient.')
        }
      >
        {editing ? (
          <TemplateEditor
            key={editing.template?.template_uuid || editing.eventKey || 'new'}
            channel={channel}
            template={editing.template}
            eventKey={editing.eventKey}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null)
              refresh()
            }}
          />
        ) : null}
      </AdminDrawer>
      {dialog}
    </div>
  )
}
