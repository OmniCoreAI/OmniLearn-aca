'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { User, Lock, ShoppingBag, Settings } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import UserAvatar from '@components/Objects/UserAvatar'
import { getUriWithOrg } from '@services/config/config'

interface AccountSidebarProps {
  orgslug: string
  currentSubpage: string
}

export const ACCOUNT_NAV_ITEMS = [
  { id: 'general', icon: Settings, labelKey: 'account.general', descKey: 'account.nav_desc.general', descFallback: 'Name, email, photo and bio' },
  { id: 'profile', icon: User, labelKey: 'account.profile', descKey: 'account.nav_desc.profile', descFallback: 'Your public profile page' },
  { id: 'security', icon: Lock, labelKey: 'account.security', descKey: 'account.nav_desc.security', descFallback: 'Password and sign-in' },
  { id: 'purchases', icon: ShoppingBag, labelKey: 'account.purchases', descKey: 'account.nav_desc.purchases', descFallback: 'Orders and receipts' },
]

export function AccountSidebar({ orgslug, currentSubpage }: AccountSidebarProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const user = session?.data?.user
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[hsl(var(--dash-border))]/70 bg-white shadow-[0_1px_2px_hsl(220_30%_20%/0.04)]">
      <div className="flex items-center gap-3 p-4">
        <span className="relative shrink-0 rounded-full ring-2 ring-white shadow-[0_4px_12px_-4px_hsl(220_30%_20%/0.35)]">
          <UserAvatar border="border-0" rounded="rounded-full" width={44} />
          <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold capitalize text-[hsl(var(--dash-ink))]">{name}</p>
          <p className="truncate text-xs text-[hsl(var(--dash-muted))]">@{user?.username}</p>
        </div>
      </div>
      <div className="mx-4 h-px bg-[hsl(var(--dash-border))]/70" />
      <nav className="space-y-1 p-2" aria-label={t('account.title')}>
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = currentSubpage === item.id
          return (
            <Link
              key={item.id}
              href={getUriWithOrg(orgslug, `/account/${item.id}`)}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-200 ${
                isActive ? 'bg-[hsl(var(--dash-accent-soft))]' : 'hover:bg-[hsl(var(--dash-canvas))]'
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,hsl(43_85%_60%),hsl(40_78%_49%))] text-[hsl(var(--dash-ink))] shadow-[0_6px_14px_-6px_hsl(43_80%_45%/0.8)]'
                    : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))] group-hover:bg-white group-hover:text-[hsl(var(--dash-ink))]'
                }`}
              >
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[hsl(var(--dash-ink))]">{t(item.labelKey)}</span>
                <span className="block truncate text-[11px] text-[hsl(var(--dash-muted))]">{t(item.descKey, item.descFallback)}</span>
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default AccountSidebar
