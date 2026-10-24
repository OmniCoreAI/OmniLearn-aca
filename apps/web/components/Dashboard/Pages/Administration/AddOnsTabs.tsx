'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTabs } from '@components/Dashboard/Pages/Administration/AdminUI'

export function AddOnsTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const base = '/dash/administration/add-ons'
  return (
    <AdminTabs
      orgslug={orgslug}
      tabs={[
        { href: base, label: t('administration.nav.addons', 'Add-ons'), exact: true },
        { href: `${base}/categories`, label: t('administration.lookups.kind_addon_category', 'Add-on categories') },
        { href: `${base}/selections`, label: t('administration.addons.tab_selections', 'Participant selections') },
      ]}
    />
  )
}
