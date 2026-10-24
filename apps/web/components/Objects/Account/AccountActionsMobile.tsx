'use client'
import React from 'react'
import Link from 'next/link'
import { ACCOUNT_NAV_ITEMS } from './AccountSidebar'
import { getUriWithOrg } from '@services/config/config'
import { useTranslation } from 'react-i18next'

interface AccountActionsMobileProps {
  orgslug: string
  currentSubpage: string
}

export function AccountActionsMobile({ orgslug, currentSubpage }: AccountActionsMobileProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label="Account mobile actions" className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-4 rounded-2xl border border-[hsl(var(--dash-border))]/70 bg-white/95 p-1.5 shadow-[0_12px_32px_-12px_hsl(220_30%_20%/0.35)] backdrop-blur-sm">
        <div className="flex items-center justify-around">
          {ACCOUNT_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentSubpage === item.id
            return (
              <Link
                key={item.id}
                href={getUriWithOrg(orgslug, `/account/${item.id}`)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  isActive
                    ? 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-ink))]'
                    : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[hsl(var(--dash-accent))]' : ''} />
                <span className="text-[10px] font-medium truncate max-w-[60px]">
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default AccountActionsMobile
