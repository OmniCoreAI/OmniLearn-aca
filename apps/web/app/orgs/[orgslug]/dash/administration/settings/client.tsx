'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import {
  AdminBreadcrumbs,
  LookupManager,
  lookupKindLabel,
} from '@components/Dashboard/Pages/Administration/AdminUI'
import { SettingsTabs } from '@components/Dashboard/Pages/Administration/SettingsTabs'
import { LOOKUP_KINDS, LookupKind } from '@services/administration/administration'
import { cn } from '@/lib/utils'

const KIND_HINTS: Record<LookupKind, { key: string; fallback: string }> = {
  course_category: { key: 'administration.lookups.hint_course_category', fallback: 'Group courses and training programs (e.g. Aviation Safety, Management).' },
  facility_type: { key: 'administration.lookups.hint_facility_type', fallback: 'Kinds of rooms: training room, lecture hall, computer lab…' },
  equipment: { key: 'administration.lookups.hint_equipment', fallback: 'Equipment a room can offer: projector, whiteboard, sound system…' },
  location_type: { key: 'administration.lookups.hint_location_type', fallback: 'Buildings, branches, campuses and training centers.' },
  addon_category: { key: 'administration.lookups.hint_addon_category', fallback: 'Meals, materials, transportation, accommodation…' },
  entity_type: { key: 'administration.lookups.hint_entity_type', fallback: 'Ministries, government entities, universities, companies…' },
}

function GeneralConfiguration({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<LookupKind>('course_category')

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.settings', 'General Configuration') }]} />
      <AcademicHeader
        title={t('administration.nav.settings', 'General Configuration')}
        subtitle={t('administration.settings.subtitle', 'Categories, currencies and taxes reused across the whole academy.')}
      />
      <SettingsTabs orgslug={orgslug} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label={t('administration.settings.tab_categories', 'Categories')}>
          {LOOKUP_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-start text-sm transition-colors',
                k === kind
                  ? 'bg-[hsl(var(--dash-accent-soft))] font-medium text-[hsl(var(--dash-accent))]'
                  : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-surface))] hover:text-[hsl(var(--dash-ink))]'
              )}
            >
              {lookupKindLabel(t, k)}
            </button>
          ))}
        </nav>
        <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4 sm:p-5">
          <LookupManager key={kind} kind={kind} description={t(KIND_HINTS[kind].key, KIND_HINTS[kind].fallback)} />
        </section>
      </div>
    </AcademicPageShell>
  )
}

export default GeneralConfiguration
