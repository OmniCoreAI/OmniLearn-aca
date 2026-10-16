'use client'

import { useMemo } from 'react'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Inclusive report ranges for the home widgets. The reports API compares each
 * range with the previous one of equal length, which feeds the change chips.
 * Built once per mount so every widget shares the same query keys.
 */
export function useHomeRanges() {
  return useMemo(() => {
    const today = new Date()
    const last30 = { from: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), to: iso(today) }
    // Six calendar months, this one included — the finance mini chart's bars.
    const last6Months = { from: iso(new Date(today.getFullYear(), today.getMonth() - 5, 1)), to: iso(today) }
    return { last30, last6Months }
  }, [])
}
