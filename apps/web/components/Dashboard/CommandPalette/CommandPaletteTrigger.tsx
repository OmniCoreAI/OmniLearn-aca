'use client'
import React, { useEffect, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useCommandPalette } from './CommandPaletteContext'

interface Props {
  isCollapsed?: boolean
}

export default function CommandPaletteTrigger({ isCollapsed = false }: Props) {
  const { t } = useTranslation()
  const { setOpen } = useCommandPalette()
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    }
  }, [])

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('dashboard.search.trigger')}
        className="flex h-9 w-full items-center justify-center rounded-lg text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-accent))]"
      >
        <MagnifyingGlass size={16} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('dashboard.search.trigger')}
      className="group flex h-9 w-full items-center gap-2.5 rounded-full border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] px-3 text-left transition-colors hover:border-[hsl(var(--dash-accent))]/25 hover:bg-[hsl(var(--dash-accent-soft))]"
    >
      <MagnifyingGlass size={14} className="shrink-0 text-[hsl(var(--dash-muted))] group-hover:text-[hsl(var(--dash-accent))]" />
      <span className="flex-1 text-[12.5px] font-normal text-[hsl(var(--dash-muted))] group-hover:text-[hsl(var(--dash-ink))]">
        {t('dashboard.search.trigger')}
      </span>
      <kbd className="hidden sm:inline-flex h-[18px] shrink-0 items-center rounded bg-[hsl(var(--dash-canvas))] px-1.5 font-sans text-[10.5px] font-medium leading-none tracking-wide text-[hsl(var(--dash-muted))]">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}
