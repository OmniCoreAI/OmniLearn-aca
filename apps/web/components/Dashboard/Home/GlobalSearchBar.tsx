'use client'

import React, { useEffect, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useCommandPalette } from '@components/Dashboard/CommandPalette/CommandPaletteContext'

/**
 * Skillio-style global search bar. Opens the command palette
 * (which searches courses, pages, and actions across the dashboard).
 */
export default function GlobalSearchBar({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { setOpen } = useCommandPalette()
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('dashboard.search.trigger', 'Search')}
      className={
        'group flex h-11 w-full items-center gap-3 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-4 text-left shadow-[0_1px_2px_hsl(245_25%_13%/0.04)] transition-all duration-200 hover:border-[hsl(var(--dash-accent))]/35 hover:shadow-[0_4px_16px_hsl(var(--dash-accent)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/30 ' +
        (className ?? '')
      }
    >
      <MagnifyingGlass
        size={16}
        className="shrink-0 text-[hsl(var(--dash-muted))] transition-colors group-hover:text-[hsl(var(--dash-accent))]"
      />
      <span className="flex-1 truncate text-sm text-[hsl(var(--dash-muted))]">
        {t('dashboard.search.global_placeholder', 'Search by topic, title, or name...')}
      </span>
      <kbd className="hidden h-5 shrink-0 items-center rounded-md bg-[hsl(var(--dash-canvas))] px-1.5 font-sans text-[10.5px] font-medium leading-none tracking-wide text-[hsl(var(--dash-muted))] sm:inline-flex">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}
