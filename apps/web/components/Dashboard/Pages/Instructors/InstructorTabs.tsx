'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import { TAB_TRACK, tabItemClass } from '@components/Dashboard/Shared/dashStyles'
import { cn } from '@/lib/utils'

export function InstructorTabs({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const pathname = usePathname() || ''

  const tabs = [
    { href: '/dash/instructors', label: t('instructors.directory', 'Directory'), exact: true },
    { href: '/dash/instructors/categories', label: t('instructors.categories', 'Categories & Rates') },
    { href: '/dash/instructors/finance', label: t('instructors.finance', 'Finance') },
  ]

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname.endsWith(href) : pathname.includes(href)

  return (
    <div className={cn(TAB_TRACK, 'mb-6')}>
      {tabs.map((tab) => {
        const active = isActive(tab.href, tab.exact)
        return (
          <Link
            key={tab.href}
            href={getUriWithOrg(orgslug, tab.href)}
            className={tabItemClass(active)}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
