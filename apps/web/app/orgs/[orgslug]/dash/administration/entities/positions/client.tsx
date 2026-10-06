'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs } from '@components/Dashboard/Pages/Administration/AdminUI'
import { EntitiesTabs } from '@components/Dashboard/Pages/Entities/EntitiesTabs'
import { PositionsManager } from '@components/Dashboard/Pages/Entities/PositionsManager'

function PositionsPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.entities', 'Entities'), href: '/dash/administration/entities' }, { label: t('entities.positions', 'Positions') }]} />
      <AcademicHeader
        title={t('entities.positions', 'Positions')}
        subtitle={t('entities.positions_desc', 'Job positions (Manager, Engineer…) shared by every entity or specific to one. Training can be assigned to a position.')}
      />
      <EntitiesTabs orgslug={orgslug} />
      <PositionsManager />
    </AcademicPageShell>
  )
}

export default PositionsPage
