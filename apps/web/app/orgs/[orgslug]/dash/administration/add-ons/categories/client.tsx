'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs, LookupManager } from '@components/Dashboard/Pages/Administration/AdminUI'
import { AddOnsTabs } from '@components/Dashboard/Pages/Administration/AddOnsTabs'

function AddOnCategoriesPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[
          { label: t('administration.nav.addons', 'Add-ons'), href: '/dash/administration/add-ons' },
          { label: t('administration.lookups.kind_addon_category', 'Add-on categories') },
        ]}
      />
      <AcademicHeader title={t('administration.nav.addons', 'Add-ons')} subtitle={t('administration.addons.subtitle', 'Optional items and services priced once and attached to courses, programs and registrations.')} />
      <AddOnsTabs orgslug={orgslug} />
      <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4 sm:p-5">
        <LookupManager kind="addon_category" description={t('administration.lookups.hint_addon_category', 'Meals, materials, transportation, accommodation…')} />
      </section>
    </AcademicPageShell>
  )
}

export default AddOnCategoriesPage
