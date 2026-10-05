'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, LookupManager } from '@components/Dashboard/Pages/Administration/AdminUI'
import { FacilitiesTabs } from '@components/Dashboard/Pages/Administration/FacilitiesTabs'

function EquipmentPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.facilities', 'Facilities & Rooms'), href: '/dash/administration/facilities' }, { label: t('administration.lookups.kind_equipment', 'Equipment') }]} />
      <AcademicHeader title={t('administration.nav.facilities', 'Facilities & Rooms')} subtitle={t('administration.facilities.subtitle', 'Rooms, halls and labs with capacity, equipment, availability and cost.')} />
      <FacilitiesTabs orgslug={orgslug} />
      <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4 sm:p-5">
        <LookupManager kind="equipment" description={t('administration.lookups.hint_equipment', 'Equipment a room can offer: projector, whiteboard, sound system…')} />
      </section>
    </AcademicPageShell>
  )
}

export default EquipmentPage
