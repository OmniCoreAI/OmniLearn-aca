'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getUriWithOrg } from '@services/config/config'
import { DataTable, tdCls } from '@components/Dashboard/Pages/Academic/AcademicUI'
import { useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import {
  AudienceResourceType,
  deleteNotificationOverride,
  getNotificationOverrides,
  getNotificationTemplates,
  setNotificationOverride,
} from '@services/administration/administration'
import { useEventLabel, useNotificationCatalog } from './CommunicationTabs'

/** Per course / program: use a specific template for an event instead of the academy default. */
export function NotificationOverridesPanel({
  orgslug,
  resourceType,
  resourceUuid,
}: {
  orgslug: string
  resourceType: AudienceResourceType
  resourceUuid: string
}) {
  const { t } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const queryClient = useQueryClient()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const { data: templates = [], error } = useQuery({
    queryKey: ['communication', 'templates', orgId, 'all'],
    queryFn: () => getNotificationTemplates(orgId, access_token),
    enabled: ready,
  })
  const overridesKey = ['communication', 'overrides', resourceType, resourceUuid]
  const { data: overrides = [] } = useQuery({
    queryKey: overridesKey,
    queryFn: () => getNotificationOverrides(resourceType, resourceUuid, access_token),
    enabled: ready && !!resourceUuid,
  })
  if (error) return null // no Communication rights

  const active = (templates as any[]).filter((tpl) => tpl.status === 'active')
  const rows = catalog.flatMap((event) =>
    (['email', 'sms'] as const)
      .map((channel) => ({
        event,
        channel,
        options: active.filter((tpl) => tpl.event_key === event.key && tpl.channel === channel),
        current: (overrides as any[]).find((o) => o.event_key === event.key && o.channel === channel),
      }))
      .filter((row) => row.options.length > 0 || row.current)
  )

  const change = async (row: any, templateUuid: string) => {
    try {
      if (!templateUuid) {
        if (row.current) await deleteNotificationOverride(row.current.override_uuid, access_token)
      } else {
        await setNotificationOverride(
          { resource_type: resourceType, resource_uuid: resourceUuid, event_key: row.event.key, channel: row.channel, template_uuid: templateUuid },
          access_token
        )
      }
      queryClient.invalidateQueries({ queryKey: overridesKey })
      toast.success(t('administration.common.updated', 'Saved'))
    } catch (err: any) {
      toast.error(err?.message || t('administration.common.save_failed', 'Could not save'))
    }
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-[hsl(var(--dash-muted))]">
        {t('delivery.no_templates', 'All messages use the academy defaults. Write alternative templates under')}{' '}
        <Link className="underline" href={getUriWithOrg(orgslug, '/dash/administration/communication')}>
          {t('administration.nav.communication', 'Communication')}
        </Link>
        .
      </p>
    )
  }
  return (
    <DataTable headers={[t('communication.event', 'Event'), t('delivery.channel', 'Channel'), t('delivery.template', 'Template')]}>
      {rows.map((row) => (
        <tr key={`${row.event.key}:${row.channel}`}>
          <td className={tdCls}>{eventLabel(row.event)}</td>
          <td className={tdCls}>{row.channel === 'sms' ? 'SMS' : t('communication.email', 'Email')}</td>
          <td className={tdCls}>
            <select
              className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-2 py-1.5 text-sm"
              value={row.current?.template_uuid || ''}
              onChange={(e) => change(row, e.target.value)}
            >
              <option value="">{t('certificates.academy_default', 'Academy default')}</option>
              {row.options.map((tpl: any) => (
                <option key={tpl.template_uuid} value={tpl.template_uuid}>
                  {tpl.name} ({tpl.language})
                </option>
              ))}
            </select>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}
