'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTabs } from '@components/Dashboard/Pages/Administration/AdminUI'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { cn } from '@/lib/utils'

export function EntitiesTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const base = '/dash/administration/entities'
  return (
    <AdminTabs
      orgslug={orgslug}
      tabs={[
        { href: base, label: t('administration.nav.entities', 'Entities'), exact: true },
        { href: `${base}/positions`, label: t('entities.positions', 'Positions') },
        { href: `${base}/types`, label: t('administration.lookups.kind_entity_type', 'Entity types') },
      ]}
    />
  )
}

/** In-page tab switcher (entity detail + coordinator portal). */
export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (_v: T) => void
}) {
  return (
    <div className={cn(TAB_TRACK, 'mb-5')} role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)} className={tabItemClass(value === tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
