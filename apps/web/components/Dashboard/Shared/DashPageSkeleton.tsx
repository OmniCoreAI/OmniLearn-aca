'use client'

import React from 'react'
import { cn } from '@/lib/utils'

function Shimmer({ className }: { className?: string }) {
  return <div className={cn('dash-shimmer rounded-lg', className)} />
}

/**
 * Content-area dashboard skeleton (never full-screen).
 * Used by route `loading.tsx` so section switches feel instant.
 */
export default function DashPageSkeleton({
  cards = 4,
  showChart = true,
}: {
  cards?: number
  showChart?: boolean
}) {
  return (
    <div className="min-h-full w-full animate-[fadeIn_0.25s_ease-out] bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 pb-10 pt-8 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Shimmer className="h-8 w-48 rounded-xl" />
            <Shimmer className="h-4 w-72 max-w-full rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-9 w-28 rounded-full" />
            <Shimmer className="h-9 w-24 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <Shimmer key={i} className="h-[88px] rounded-[var(--dash-radius)]" />
          ))}
        </div>

        {showChart ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Shimmer className="h-[280px] rounded-[var(--dash-radius)] xl:col-span-2" />
            <Shimmer className="h-[280px] rounded-[var(--dash-radius)]" />
          </div>
        ) : null}

        <div className="space-y-3 rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-4">
          <Shimmer className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-4 w-3/5 max-w-md" />
                <Shimmer className="h-3 w-2/5 max-w-xs" />
              </div>
              <Shimmer className="h-7 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
