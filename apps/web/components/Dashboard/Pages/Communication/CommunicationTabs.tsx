'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AdminTabs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { getNotificationCatalog } from '@services/administration/administration'

export function CommunicationTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const base = '/dash/administration/communication'
  return (
    <AdminTabs
      orgslug={orgslug}
      tabs={[
        { href: base, label: t('communication.tab_email', 'Email templates'), exact: true },
        { href: `${base}/sms`, label: t('communication.tab_sms', 'SMS templates') },
        { href: `${base}/settings`, label: t('communication.tab_settings', 'Notification settings') },
        { href: `${base}/log`, label: t('communication.tab_log', 'Delivery log') },
      ]}
    />
  )
}

export function useNotificationCatalog() {
  const { orgId, access_token, ready } = useAdminContext()
  const { data = [] } = useQuery({
    queryKey: ['communication', 'catalog', orgId],
    queryFn: () => getNotificationCatalog(orgId, access_token),
    enabled: ready,
  })
  return data as any[]
}

/** Event label in the UI language. */
export function useEventLabel() {
  const { i18n } = useTranslation()
  const isArabic = (i18n.language || '').startsWith('ar')
  return (event: any) => (event ? (isArabic && event.label_ar) || event.label : '—')
}
