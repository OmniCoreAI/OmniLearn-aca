'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTabs } from '@components/Dashboard/Pages/Administration/AdminUI'

export function SettingsTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <AdminTabs
      orgslug={orgslug}
      tabs={[
        { href: '/dash/administration/settings', label: t('administration.settings.tab_categories', 'Categories'), exact: true },
        { href: '/dash/administration/settings/finance', label: t('administration.settings.tab_finance', 'Currencies & taxes') },
      ]}
    />
  )
}
