'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { isRTL } from '@/lib/i18n'
import { LayoutGroup, MotionConfig, motion } from 'motion/react'
import { CaretLeft, Lifebuoy, SignOut, SquaresFour } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import OrgLogo from '@components/Dashboard/Shared/OrgLogo'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@components/ui/tooltip'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import useStudentNav, { type StudentNavItem } from './useStudentNav'

const tooltipCls = 'z-tooltip border-transparent bg-[hsl(0_0%_8%)] px-2 py-1 text-xs text-white shadow-lg'

/**
 * Dark academy sidebar of the student portal: brand on top, the learner's
 * pages, then their account. Sits on the reading-start side (right in Arabic).
 */
export default function StudentSidebar({
  orgslug,
  collapsed,
  onToggle,
  onHelp,
  onSignOut,
  showStaffLink,
}: {
  orgslug: string
  collapsed: boolean
  onToggle?: () => void
  onHelp: () => void
  onSignOut: () => void
  showStaffLink: boolean
}) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const { main, explore, account } = useStudentNav(orgslug)

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="student-sidebar">
        <TooltipProvider delayDuration={0}>
          <nav
            aria-label={t('student_portal.nav.label', 'Student navigation')}
            style={{ zIndex: 'var(--z-nav-menu)' }}
            className={cn(
              'sticky top-0 h-dvh shrink-0 self-start p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed ? 'w-[92px]' : 'w-[272px]'
            )}
          >
            <div className="relative flex h-full flex-col rounded-[1.75rem] bg-[linear-gradient(180deg,hsl(220_8%_11%),hsl(220_10%_6%))] text-white shadow-[0_24px_60px_-28px_hsl(220_30%_5%/0.7)] ring-1 ring-white/[0.06]">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.55)] to-transparent" />

              {onToggle ? (
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label={collapsed ? t('common.expand', 'Expand') : t('common.collapse', 'Collapse')}
                  aria-expanded={!collapsed}
                  className="absolute -end-2.5 top-[38px] z-10 flex h-7 w-5 items-center justify-center rounded-lg border border-white/10 bg-[hsl(220_8%_14%)] text-white/60 shadow-sm transition-all hover:scale-110 hover:text-white"
                >
                  <CaretLeft size={12} weight="bold" className={cn('transition-transform rtl:rotate-180', collapsed && 'rotate-180 rtl:rotate-0')} />
                </button>
              ) : null}

              {/* Academy */}
              <Link
                href={getUriWithOrg(orgslug, '/')}
                aria-label={org?.name}
                className={cn('flex shrink-0 items-center gap-3 pt-5 transition-opacity hover:opacity-85', collapsed ? 'justify-center px-2' : 'px-5')}
              >
                <OrgLogo org={org} className={collapsed ? 'h-11 w-11' : 'h-12 w-12'} fallbackClassName="bg-white/10 text-[hsl(43_80%_64%)] text-base" />
                {!collapsed && (
                  <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug tracking-tight [overflow-wrap:anywhere]">{org?.name}</span>
                )}
              </Link>
              <div className="mx-5 mt-5 h-px shrink-0 bg-white/[0.08]" aria-hidden="true" />

              <div className={cn('flex-1 overflow-y-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', collapsed ? 'px-2' : 'px-3')}>
                <ul className="space-y-1">
                  {main.map((item) => (
                    <li key={item.key}>
                      <SideLink item={item} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>

                {explore.length > 0 && (
                  <>
                    <GroupLabel label={t('student_portal.nav.explore', 'Explore')} collapsed={collapsed} />
                    <ul className="space-y-1">
                      {explore.map((item) => (
                        <li key={item.key}>
                          <SideLink item={item} collapsed={collapsed} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* Account */}
              <div className={cn('shrink-0 pb-4', collapsed ? 'px-2' : 'px-3')}>
                <div className="mx-2 mb-3 h-px bg-white/[0.08]" aria-hidden="true" />
                <ul className="space-y-1">
                  {account.map((item) => (
                    <li key={item.key}>
                      <SideLink item={item} collapsed={collapsed} />
                    </li>
                  ))}
                  <li>
                    <SideButton label={t('student_portal.nav.help', 'Help & support')} collapsed={collapsed} onClick={onHelp} Icon={Lifebuoy} />
                  </li>
                  {showStaffLink ? (
                    <li>
                      <SideLink
                        item={{ key: 'staff', href: '/dash', label: t('student_portal.nav.staff_dashboard', 'Staff dashboard'), Icon: SquaresFour, active: false }}
                        collapsed={collapsed}
                      />
                    </li>
                  ) : null}
                  <li>
                    <SideButton label={t('user.sign_out', 'Sign out')} collapsed={collapsed} onClick={onSignOut} Icon={SignOut} danger />
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </TooltipProvider>
      </LayoutGroup>
    </MotionConfig>
  )
}

function GroupLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-3 h-px w-6 bg-white/10" aria-hidden="true" />
  return <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold text-white/35">{label}</p>
}

const itemCls = (collapsed: boolean) =>
  cn(
    'group/item relative flex items-center rounded-2xl text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43_80%_60%)]/70',
    collapsed ? 'mx-auto h-11 w-11 justify-center' : 'h-11 w-full gap-3 px-3.5'
  )

function WithTooltip({ collapsed, label, children }: { collapsed: boolean; label: string; children: React.ReactElement }) {
  const { i18n } = useTranslation()
  if (!collapsed) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {/* Towards the page: left of a right-hand (RTL) sidebar, right of a left-hand one. */}
      <TooltipContent side={isRTL(i18n.language) ? 'left' : 'right'} className={tooltipCls}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function SideLink({ item, collapsed }: { item: StudentNavItem; collapsed: boolean }) {
  const { Icon, active } = item
  return (
    <WithTooltip collapsed={collapsed} label={item.label}>
      <Link
        href={item.href}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(itemCls(collapsed), active ? 'text-[hsl(220_10%_8%)]' : 'text-white/65 hover:bg-white/[0.06] hover:text-white')}
      >
        {/* One gold pill glides to whichever page is open. */}
        {active && (
          <motion.span
            layoutId="student-nav-active"
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,hsl(43_88%_62%),hsl(39_78%_48%))] shadow-[0_10px_24px_-10px_hsl(43_85%_50%/0.8)]"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        <Icon size={20} weight={active ? 'fill' : 'regular'} className="relative shrink-0" />
        {!collapsed && <span className="relative min-w-0 flex-1 truncate">{item.label}</span>}
      </Link>
    </WithTooltip>
  )
}

function SideButton({
  label,
  collapsed,
  onClick,
  Icon,
  danger = false,
}: {
  label: string
  collapsed: boolean
  onClick: () => void
  Icon: React.ElementType
  danger?: boolean
}) {
  return (
    <WithTooltip collapsed={collapsed} label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={collapsed ? label : undefined}
        className={cn(itemCls(collapsed), danger ? 'text-white/65 hover:bg-[hsl(351_70%_50%/0.14)] hover:text-[hsl(351_90%_78%)]' : 'text-white/65 hover:bg-white/[0.06] hover:text-white')}
      >
        <Icon size={20} className={cn('relative shrink-0', danger && 'rtl:rotate-180')} />
        {!collapsed && <span className="relative min-w-0 flex-1 truncate text-start">{label}</span>}
      </button>
    </WithTooltip>
  )
}
