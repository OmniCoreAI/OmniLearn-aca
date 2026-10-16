'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { DotsThreeCircle, Lifebuoy, SignOut, SquaresFour } from '@phosphor-icons/react'
import { Sheet, SheetContent, SheetHeader } from '@components/ui/sheet'
import { cn } from '@/lib/utils'
import useStudentNav, { type StudentNavItem } from './useStudentNav'

const PRIMARY = ['home', 'courses', 'calendar', 'certificates']

/** Phones: four destinations in a bottom bar, everything else under "More". */
export default function StudentBottomNav({
  orgslug,
  onHelp,
  onSignOut,
  showStaffLink,
}: {
  orgslug: string
  onHelp: () => void
  onSignOut: () => void
  showStaffLink: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { main, explore, account } = useStudentNav(orgslug)
  const primary = PRIMARY.map((key) => main.find((i) => i.key === key)).filter(Boolean) as StudentNavItem[]
  const rest = [...main.filter((i) => !PRIMARY.includes(i.key)), ...explore]
  const moreActive = [...rest, ...account].some((i) => i.active)

  const tab = (active: boolean) =>
    cn(
      'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-colors',
      active ? 'text-[hsl(43_85%_62%)]' : 'text-white/60 hover:text-white'
    )

  return (
    <>
      <nav
        aria-label={t('student_portal.nav.label', 'Student navigation')}
        style={{ zIndex: 'var(--z-nav)' }}
        className="fixed inset-x-3 bottom-3 rounded-[1.4rem] bg-[linear-gradient(180deg,hsl(220_8%_12%),hsl(220_10%_7%))] px-1.5 py-1 shadow-[0_18px_40px_-16px_hsl(220_30%_5%/0.7)] ring-1 ring-white/[0.06] pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      >
        <ul className="flex items-stretch">
          {primary.map(({ key, href, label, Icon, active }) => (
            <li key={key} className="flex min-w-0 flex-1">
              <Link href={href} aria-current={active ? 'page' : undefined} className={tab(active)}>
                {active ? <span aria-hidden="true" className="absolute top-0.5 h-1 w-6 rounded-full bg-[hsl(43_85%_58%)]" /> : null}
                <Icon size={22} weight={active ? 'fill' : 'regular'} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          ))}
          <li className="flex min-w-0 flex-1">
            <button type="button" onClick={() => setOpen(true)} className={tab(moreActive)} aria-haspopup="dialog">
              {moreActive ? <span aria-hidden="true" className="absolute top-0.5 h-1 w-6 rounded-full bg-[hsl(43_85%_58%)]" /> : null}
              <DotsThreeCircle size={22} weight={moreActive ? 'fill' : 'regular'} />
              <span>{t('student_portal.nav.more', 'More')}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent width="sm:max-w-[380px]">
          <SheetHeader title={t('student_portal.nav.more', 'More')} />
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <SheetList items={rest} onPick={() => setOpen(false)} />
            <div className="my-3 h-px bg-[hsl(var(--dash-border))]" />
            <SheetList items={account} onPick={() => setOpen(false)} />
            <ul className="mt-1 space-y-1">
              <li>
                <button type="button" onClick={() => { setOpen(false); onHelp() }} className={sheetItem(false)}>
                  <Lifebuoy size={20} />
                  {t('student_portal.nav.help', 'Help & support')}
                </button>
              </li>
              {showStaffLink ? (
                <li>
                  <Link href="/dash" className={sheetItem(false)} onClick={() => setOpen(false)}>
                    <SquaresFour size={20} />
                    {t('student_portal.nav.staff_dashboard', 'Staff dashboard')}
                  </Link>
                </li>
              ) : null}
              <li>
                <button type="button" onClick={onSignOut} className={cn(sheetItem(false), 'text-[hsl(var(--dash-warn))] hover:bg-[hsl(var(--dash-warn-soft))]')}>
                  <SignOut size={20} className="rtl:rotate-180" />
                  {t('user.sign_out', 'Sign out')}
                </button>
              </li>
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

const sheetItem = (active: boolean) =>
  cn(
    'flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-start text-[15px] font-medium transition-colors',
    active ? 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-ink))]/80 hover:bg-[hsl(var(--dash-canvas))]'
  )

function SheetList({ items, onPick }: { items: StudentNavItem[]; onPick: () => void }) {
  return (
    <ul className="space-y-1">
      {items.map(({ key, href, label, Icon, active }) => (
        <li key={key}>
          <Link href={href} onClick={onPick} aria-current={active ? 'page' : undefined} className={sheetItem(active)}>
            <Icon size={20} weight={active ? 'fill' : 'regular'} className={active ? 'text-[hsl(var(--dash-accent))]' : undefined} />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
