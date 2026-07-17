'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
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
    <div className="mb-6 flex items-center gap-1 rounded-full bg-[hsl(var(--dash-surface))] p-1 border border-[hsl(var(--dash-border))] w-fit max-w-full overflow-x-auto">
      {tabs.map((tab) => {
        const active = isActive(tab.href, tab.exact)
        return (
          <Link
            key={tab.href}
            href={getUriWithOrg(orgslug, tab.href)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]'
                : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
