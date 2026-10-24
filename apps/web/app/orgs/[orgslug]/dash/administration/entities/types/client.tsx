'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, LookupManager } from '@components/Dashboard/Pages/Administration/AdminUI'
import { EntitiesTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'

function EntityTypesPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.entities', 'Entities'), href: '/dash/administration/entities' }, { label: t('administration.lookups.kind_entity_type', 'Entity types') }]} />
      <AcademicHeader title={t('administration.nav.entities', 'Entities')} subtitle={t('entities.subtitle', 'Ministries, universities and companies the academy trains for — with their members, groups and coordinators.')} />
      <EntitiesTabs orgslug={orgslug} />
      <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4 sm:p-5">
        <LookupManager kind="entity_type" description={t('administration.lookups.hint_entity_type', 'Ministry, university, company…')} />
      </section>
    </AcademicPageShell>
  )
}

export default EntityTypesPage
