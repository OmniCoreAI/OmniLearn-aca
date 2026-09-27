'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Copy, Pencil, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { GhostButton, IconButton, StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  NotificationChannel,
  deleteNotificationTemplate,
  duplicateNotificationTemplate,
  getNotificationTemplates,
  updateNotificationTemplate,
} from '@services/administration/administration'
import { useEventLabel, useNotificationCatalog } from './CommunicationTabs'
import { TemplateEditor } from './TemplateEditor'

export function TemplatesByEvent({ channel }: { channel: NotificationChannel }) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const [editing, setEditing] = useState<{ template: any; eventKey?: string } | null>(null)
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['communication', 'templates', orgId, channel],
    queryFn: () => getNotificationTemplates(orgId, access_token, { channel }),
    enabled: ready,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['communication'] })

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

  if (isLoading) return <div className="dash-shimmer h-48 rounded-[var(--dash-radius)]" />

  return (
    <div className="space-y-3">
      {catalog.map((event) => {
        const list = (templates as any[]).filter((tpl) => tpl.event_key === event.key)
        const hasDefault = list.some((tpl) => tpl.is_default_for_event && tpl.status === 'active')
        const enabledByDefault = event.default_channels?.[channel]
        return (
          <section key={event.key} className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{eventLabel(event)}</h3>
                  {hasDefault ? (
                    <span className="rounded-full bg-[hsl(var(--dash-tile-mint))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-tile-mint-fg))]">
                      {t('communication.custom', 'Custom')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-muted))]">
                      {t('communication.builtin', 'Built-in')}
                    </span>
                  )}
                  {event.required && channel === 'email' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--dash-tile-lavender))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--dash-tile-lavender-fg))]">
                      <ShieldCheck className="h-3 w-3" /> {t('communication.always_sent', 'Always sent')}
                    </span>
                  )}
                  {!enabledByDefault && !event.required && (
                    <span className="text-[10px] text-[hsl(var(--dash-muted))]">{t('communication.off_by_default', 'off by default — enable in Notification settings')}</span>
                  )}
                </div>
                <p className="text-xs text-[hsl(var(--dash-muted))]">{event.description}</p>
              </div>
              <GhostButton onClick={() => setEditing({ template: null, eventKey: event.key })}>
                <Plus className="h-3.5 w-3.5" /> {t('communication.new_template', 'New template')}
              </GhostButton>
            </div>
            {list.length > 0 && (
              <div className="mt-3 divide-y divide-[hsl(var(--dash-border))] rounded-xl border border-[hsl(var(--dash-border))]">
                {list.map((tpl) => (
                  <div key={tpl.template_uuid} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {tpl.is_default_for_event && <Star className="h-3.5 w-3.5 text-amber-500" />}
                      <span className="font-medium">{tpl.name}</span>
                      <span className="text-xs uppercase text-[hsl(var(--dash-muted))]">{tpl.language}</span>
                      <StatusPill status={tpl.status} label={String(t(`administration.common.status_${tpl.status}`, tpl.status))} />
                      {tpl.override_count > 0 && (
                        <span className="text-xs text-[hsl(var(--dash-muted))]">
                          · {tpl.override_count} {t('communication.courses_use_it', 'course(s) use it')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      {!tpl.is_default_for_event && (
                        <IconButton
                          title={String(t('communication.make_default', 'Use for this event'))}
                          onClick={() => act(() => updateNotificationTemplate(tpl.template_uuid, { is_default_for_event: true, status: 'active' }, access_token), t('administration.common.updated', 'Saved'))}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </IconButton>
                      )}
                      <IconButton title={String(t('administration.common.edit', 'Edit'))} onClick={() => setEditing({ template: tpl })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        title={String(t('communication.duplicate', 'Duplicate'))}
                        onClick={() => act(() => duplicateNotificationTemplate(tpl.template_uuid, access_token), t('administration.common.created', 'Created'))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        title={String(t('administration.common.delete', 'Delete'))}
                        onClick={() =>
                          act(
                            () => deleteNotificationTemplate(tpl.template_uuid, access_token),
                            t('administration.common.deleted', 'Deleted'),
                            t('communication.confirm_delete', 'Delete this template? The built-in message is used again where it was the default.')
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
      <Modal
        isDialogOpen={!!editing}
        onOpenChange={(o: boolean) => !o && setEditing(null)}
        minWidth="xl"
        dialogTitle={editing?.template ? editing.template.name : t('communication.new_template', 'New template')}
        dialogContent={
          editing && (
            <TemplateEditor
              key={editing.template?.template_uuid || editing.eventKey}
              channel={channel}
              template={editing.template}
              eventKey={editing.eventKey}
              onDone={() => {
                setEditing(null)
                refresh()
              }}
            />
          )
        }
      />
    </div>
  )
}
