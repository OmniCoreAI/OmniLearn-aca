'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/** One clickable line in a workspace-home list (an offering, a course, a member…). */
export function WorkRow({
  href,
  icon: Icon,
  title,
  meta,
  badge,
  tone = 'plain',
  action,
}: {
  href: string
  icon: React.ElementType
  title: React.ReactNode
  meta?: React.ReactNode
  badge?: React.ReactNode
  tone?: 'plain' | 'urgent'
  action?: string
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
          tone === 'urgent'
            ? 'border border-orange-200 bg-orange-50/70 hover:bg-orange-50'
            : 'bg-[hsl(var(--dash-canvas))]/60 hover:bg-[hsl(var(--dash-canvas))]'
        )}
      >
        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            tone === 'urgent' ? 'bg-white text-orange-600' : 'bg-white text-[hsl(var(--dash-accent))]'
          )}
        >
          <Icon size={18} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-[hsl(var(--dash-ink))]">{title}</span>
          {meta ? <span className="block truncate text-[12px] text-[hsl(var(--dash-muted))]">{meta}</span> : null}
        </span>
        {badge}
        {action ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[hsl(var(--dash-ink))]/80 group-hover:text-[hsl(var(--dash-ink))]">
            {action} <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
          </span>
        ) : (
          <ArrowRight
            size={14}
            weight="bold"
            className="shrink-0 text-[hsl(var(--dash-muted))] opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
          />
        )}
      </Link>
    </li>
  )
}

export function WorkBadge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'accent' | 'warn' }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone === 'accent' && 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-tile-mint-fg))]',
        tone === 'warn' && 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]',
        tone === 'muted' && 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
      )}
    >
      {children}
    </span>
  )
}

export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[hsl(var(--dash-muted))] transition-colors hover:text-[hsl(var(--dash-ink))]"
    >
      {label} <ArrowRight size={12} weight="bold" className="rtl:rotate-180" />
    </Link>
  )
}

export function WorkListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="dash-shimmer h-[58px] rounded-2xl" />
      ))}
    </div>
  )
}

/** Format an ISO date (or date-time) as a short local date; '' when missing. */
export function shortDate(value: string | null | undefined, locale: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}
