'use client'

import React from 'react'
import Link from 'next/link'
import { CaretDown, DotsThree } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function HomeCard({
  title,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-col rounded-[var(--dash-radius)] bg-[hsl(var(--dash-surface))] p-5 fit:h-full fit:px-4 fit:py-3 shadow-[0_1px_2px_hsl(0_0%_8%/0.04),0_0_0_1px_hsl(var(--dash-border)/0.6)]',
        className
      )}
    >
      <header className="mb-4 flex items-center justify-between gap-3 fit:mb-1.5 fit:min-h-7">
        <h2 className="text-[15px] font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{title}</h2>
        {action}
      </header>
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Compact pill select used for "Last 7 months" / "This week" style ranges. */
export function RangeSelect<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (_value: T) => void
  label: string
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const next = options.find((o) => String(o.value) === e.target.value)
          if (next) onChange(next.value)
        }}
        className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pe-6 ps-2 fit:py-0.5 text-xs font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/30"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown
        size={12}
        weight="bold"
        className="pointer-events-none absolute end-2 text-[hsl(var(--dash-muted))]"
        aria-hidden="true"
      />
    </label>
  )
}

export function CardMenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 fit:h-7 fit:w-7 items-center justify-center rounded-lg text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
    >
      <DotsThree size={20} weight="bold" />
    </Link>
  )
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[160px] items-center justify-center rounded-2xl fit:min-h-0 fit:flex-1 bg-[hsl(var(--dash-canvas))] px-6 text-center text-xs leading-relaxed text-[hsl(var(--dash-muted))]',
        className
      )}
    >
      {children}
    </div>
  )
}

export const chartTooltipStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid hsl(40 14% 88%)',
  boxShadow: '0 8px 24px hsl(0 0% 8% / 0.08)',
  fontSize: 12,
  padding: '6px 10px',
}
