'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTabs } from '@components/Dashboard/Pages/Administration/AdminUI'

export function FacilitiesTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const base = '/dash/administration/facilities'
  return (
    <AdminTabs
      orgslug={orgslug}
      tabs={[
        { href: base, label: t('administration.facilities.tab_facilities', 'Facilities'), exact: true },
        { href: `${base}/calendar`, label: t('administration.halls.calendar', 'Hall calendar') },
        { href: `${base}/locations`, label: t('administration.facilities.tab_locations', 'Locations') },
        { href: `${base}/types`, label: t('administration.lookups.kind_facility_type', 'Facility types') },
        { href: `${base}/equipment`, label: t('administration.lookups.kind_equipment', 'Equipment') },
      ]}
    />
  )
}
