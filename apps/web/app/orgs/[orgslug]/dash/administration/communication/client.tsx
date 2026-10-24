'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AcademicPageShell, AcademicHeader } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { AdminBreadcrumbs } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CommunicationTabs } from '@components/Dashboard/Pages/Communication/CommunicationTabs'
import { TemplatesByEvent } from '@components/Dashboard/Pages/Communication/TemplatesByEvent'

function CommunicationEmailPage({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  return (
    <AcademicPageShell>
      <AdminBreadcrumbs orgslug={orgslug} items={[{ label: t('administration.nav.communication', 'Communication') }]} />
      <AcademicHeader
        title={t('administration.nav.communication', 'Communication')}
        subtitle={t('communication.subtitle', 'Email and SMS messages the academy sends — written once with variables and reused everywhere.')}
      />
      <CommunicationTabs orgslug={orgslug} />
      <TemplatesByEvent channel="email" />
    </AcademicPageShell>
  )
}

export default CommunicationEmailPage
