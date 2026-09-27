'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTabs } from '@components/Dashboard/Pages/Administration/AdminUI'

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
    <div className="mb-6 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={
            value === tab.id
              ? 'whitespace-nowrap rounded-full bg-[hsl(var(--dash-canvas))] px-4 py-2 text-sm font-medium text-[hsl(var(--dash-ink))]'
              : 'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
