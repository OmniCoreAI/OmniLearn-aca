'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { CountUp, Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'
import { STAT_TONE_CYCLE, type StatTone } from './dashPalette'

export type DashStat = {
  key: string
  label: string
  /** Numbers count up and compact past 10k (12.4K); strings render as-is (e.g. money). */
  value: number | string
  hint?: string
  icon: React.ElementType
  href?: string
  tone?: StatTone
  /** Oldest → newest series for the sparkline along the card's bottom edge. */
  trend?: number[]
  /** This period vs. the previous one, shown as a change chip. */
  delta?: { current: number; previous: number; label?: string }
  /** 0–1 share drawn as a progress bar in place of the sparkline. */
  progress?: number
}

const COMPACT_FROM = 10_000

function StatValue({ value, locale }: { value: number | string; locale: string }) {
  if (typeof value === 'string') return <>{value}</>
  if (Math.abs(value) >= COMPACT_FROM) {
    return <>{new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</>
  }
  return <CountUp value={value} />
}

/** "▲ 12%" / "▼ 8%" / "▲ new" change chip vs. the previous period. */
export function DeltaChip({ current, previous, className }: { current: number; previous: number; className?: string }) {
  if (!current && !previous) return null
  const pct = previous ? Math.round(((current - previous) / previous) * 100) : null
  const up = pct === null ? current > 0 : pct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        up ? 'bg-emerald-500/12 text-emerald-700' : 'bg-[hsl(var(--dash-warn))]/10 text-[hsl(var(--dash-warn))]',
        className
      )}
    >
      {pct === null ? '▲ new' : `${up ? '▲' : '▼'} ${Math.abs(pct)}%`}
    </span>
  )
}

const STRIP_W = 100
const STRIP_H = 32

/**
 * Full-width area sparkline along a card's bottom edge (plain SVG — no chart
 * library on the critical path). It stretches horizontally; the stroke stays
 * crisp via non-scaling-stroke. Segments are smoothed with midpoint curves.
 */
function AreaStrip({ values, color, id, className }: { values: number[]; color: string; id: string; className?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const step = STRIP_W / (values.length - 1)
  const pts = values.map((v, i) => [+(i * step).toFixed(2), +(STRIP_H - 2 - (v / max) * (STRIP_H - 8)).toFixed(2)] as const)
  let line = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!
    const [x1, y1] = pts[i]!
    const mid = +((x0 + x1) / 2).toFixed(2)
    line += `C${mid},${y0} ${mid},${y1} ${x1},${y1}`
  }
  const area = `${line}L${STRIP_W},${STRIP_H}L0,${STRIP_H}Z`
  return (
    <svg
      viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('block h-8 w-full', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Icon tile tint, accent colour and gradient per tone. */
const ACCENT: Record<StatTone, { tint: string; line: string; from: string; to: string }> = {
  rose: { tint: 'hsl(351 72% 95%)', line: 'hsl(351 80% 50%)', from: 'hsl(351 80% 62%)', to: 'hsl(351 84% 44%)' },
  stone: { tint: 'hsl(220 14% 94%)', line: 'hsl(0 0% 14%)', from: 'hsl(0 0% 30%)', to: 'hsl(0 0% 8%)' },
  gold: { tint: 'hsl(43 80% 93%)', line: 'hsl(43 78% 46%)', from: 'hsl(43 85% 60%)', to: 'hsl(38 76% 44%)' },
  sand: { tint: 'hsl(30 70% 94%)', line: 'hsl(28 68% 46%)', from: 'hsl(32 75% 60%)', to: 'hsl(24 65% 42%)' },
}

function ElevatedStatCard({ stat, index, fit, error }: { stat: DashStat; index: number; fit: boolean; error: boolean }) {
  const { t, i18n } = useTranslation()
  const tone = stat.tone ?? STAT_TONE_CYCLE[index % STAT_TONE_CYCLE.length]!
  const accent = ACCENT[tone]
  const Icon = stat.icon
  const progress = stat.progress === undefined ? null : Math.max(0, Math.min(1, stat.progress))
  const body = (
    <div
      className={cn(
        'dash-card group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] pt-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_hsl(220_30%_10%/0.35)]',
        fit && 'fit:pt-3'
      )}
    >
      <div className={cn('flex items-center gap-2.5 px-4', fit && 'fit:px-3.5')}>
        <span
          className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', fit && 'fit:h-7 fit:w-7')}
          style={{ background: accent.tint, color: accent.line }}
        >
          <Icon size={17} weight="duotone" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[hsl(var(--dash-muted))]">{stat.label}</p>
        {stat.href ? (
          <ArrowUpRight
            size={14}
            weight="bold"
            className="shrink-0 text-[hsl(var(--dash-muted))] opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100"
          />
        ) : null}
      </div>
      <div className={cn('mt-2.5 flex min-w-0 items-baseline gap-2 px-4', fit && 'fit:mt-1.5 fit:px-3.5')}>
        <p
          className={cn(
            'shrink-0 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-[hsl(var(--dash-ink))]',
            fit && 'fit:text-[1.5rem]'
          )}
        >
          {error ? '—' : <StatValue value={stat.value} locale={i18n.language} />}
        </p>
        {!error && stat.delta ? <DeltaChip current={stat.delta.current} previous={stat.delta.previous} /> : null}
        <p className="min-w-0 truncate text-[11px] text-[hsl(var(--dash-muted))]">
          {error ? t('dashboard.stats.load_error', "Couldn't load") : stat.delta?.label ?? stat.hint}
        </p>
      </div>
      <div className="mt-auto pt-2.5">
        {error ? (
          <div className="h-2" />
        ) : progress !== null ? (
          <div className={cn('px-4 pb-4 pt-2', fit && 'fit:px-3.5 fit:pb-3.5')}>
            <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${progress * 100}%`, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
              />
            </div>
          </div>
        ) : stat.trend ? (
          <AreaStrip values={stat.trend} color={accent.line} id={`strip-${stat.key}`} className={cn(fit && 'fit:h-7')} />
        ) : (
          <div className="h-2" />
        )}
      </div>
    </div>
  )
  return stat.href ? (
    <Link
      href={stat.href}
      className="block h-full rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/50"
    >
      {body}
    </Link>
  ) : (
    body
  )
}

/**
 * Row of stat cards — the dashboard home's KPI look, shared by every admin
 * page: white card, tinted icon tile, big number, hint or change chip, and an
 * optional sparkline or progress bar. `density="fit"` is the home's compact
 * variant for its one-screen layout.
 */
export default function DashStatCards({
  stats,
  loading = false,
  error = false,
  density = 'comfortable',
  className,
}: {
  stats: DashStat[]
  loading?: boolean
  error?: boolean
  density?: 'comfortable' | 'fit'
  className?: string
}) {
  const fit = density === 'fit'
  const cols =
    stats.length >= 5
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5'
      : stats.length === 4
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        : stats.length === 3
          ? 'grid-cols-1 sm:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2'

  return (
    <Stagger className={cn('grid gap-4', cols, className)} staggerDelay={0.05}>
      {stats.map((stat, i) => (
        <StaggerItem key={stat.key}>
          {loading ? (
            <div className={cn('dash-shimmer rounded-[1.25rem]', fit ? 'h-[118px] fit:h-[96px]' : 'h-[112px]')} />
          ) : (
            <ElevatedStatCard stat={stat} index={i} fit={fit} error={error} />
          )}
        </StaggerItem>
      ))}
    </Stagger>
  )
}
