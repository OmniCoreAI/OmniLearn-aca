'use client'

import React from 'react'
import Link from 'next/link'
import { CaretDown, DotsThree } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/** White card surface used by every dashboard-home widget. */
export function HomeCard({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'dash-card flex min-h-0 min-w-0 flex-col rounded-[1.5rem] p-5 fit:h-full fit:px-4 fit:py-3',
        className
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3 fit:mb-1.5 fit:min-h-7">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{title}</h2>
          {subtitle ? <div className="mt-0.5 truncate text-[11px] text-[hsl(var(--dash-muted))]">{subtitle}</div> : null}
        </div>
        {action}
      </header>
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Compact pill select for "Last 7 months" style ranges. */
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
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const next = options.find((o) => String(o.value) === e.target.value)
          if (next) onChange(next.value)
        }}
        className="cursor-pointer appearance-none rounded-full border border-[hsl(var(--dash-border))] bg-white py-1 pe-6 ps-2.5 text-[11px] font-medium text-[hsl(var(--dash-ink))]/80 shadow-[0_1px_2px_hsl(0_0%_8%/0.05)] transition-colors hover:bg-[hsl(var(--dash-canvas))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/40 fit:py-0.5"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown size={11} weight="bold" className="pointer-events-none absolute end-2 text-[hsl(var(--dash-muted))]" aria-hidden="true" />
    </label>
  )
}

/** Two-to-four option switch (chart series, ranges). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string; dot?: string }[]
  onChange: (_value: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex shrink-0 rounded-full bg-[hsl(var(--dash-canvas))] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all fit:px-2 fit:py-0.5',
            value === o.value
              ? 'bg-[hsl(var(--dash-ink))] text-white shadow-sm'
              : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
          )}
        >
          {o.dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.dot }} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CardMenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))] fit:h-7 fit:w-7"
    >
      <DotsThree size={20} weight="bold" />
    </Link>
  )
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))]/50 px-6 text-center text-xs leading-relaxed text-[hsl(var(--dash-muted))] fit:min-h-0 fit:flex-1',
        className
      )}
    >
      {children}
    </div>
  )
}

type TooltipRow = { label: string; value: string; color?: string }

/** Surface for floating overlays (chart tooltips, hover bubbles) inside a card. */
export const POP_SURFACE =
  'border border-[hsl(var(--dash-border))] bg-white shadow-[0_12px_32px_-8px_hsl(220_30%_10%/0.18)]'

/**
 * Tooltip for Recharts. `rows` maps the hovered payload to display rows, so
 * each chart decides its own labels and number format.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  rows,
  title,
}: {
  active?: boolean
  label?: string | number
  payload?: any[]
  rows: (_payload: any[]) => TooltipRow[]
  title?: (_label: string | number | undefined, _payload: any[]) => string
}) {
  if (!active || !payload?.length) return null
  const lines = rows(payload)
  return (
    <div className={cn(POP_SURFACE, 'min-w-[150px] rounded-2xl px-3 py-2.5 text-xs')}>
      <p className="mb-1.5 font-semibold text-[hsl(var(--dash-ink))]">{title ? title(label, payload) : label}</p>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[hsl(var(--dash-muted))]">
              {l.color ? <span className="h-2 w-2 rounded-full" style={{ background: l.color }} /> : null}
              {l.label}
            </span>
            <span className="font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{l.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
