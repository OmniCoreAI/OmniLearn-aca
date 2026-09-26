'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { DotsThree } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { CountUp, Stagger, StaggerItem } from '@components/Dashboard/Shared/DashMotion'
import { STAT_TONES, STAT_TONE_CYCLE, type StatTone } from './dashPalette'

export type DashStat = {
  key: string
  label: string
  /** Numbers count up and compact past 10k (12.4K); strings render as-is (e.g. money). */
  value: number | string
  hint?: string
  icon: React.ElementType
  href?: string
  tone?: StatTone
  /** Oldest → newest series for the glass variant's sparkline. */
  trend?: number[]
  /** This period vs. the previous one, shown as a change chip (glass variant). */
  delta?: { current: number; previous: number; label?: string }
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

const SPARK_W = 76
const SPARK_H = 26

/** Tiny area sparkline (plain SVG — no chart library on the critical path). */
function Sparkline({ values, color, id }: { values: number[]; color: string; id: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const step = SPARK_W / (values.length - 1)
  const pts = values.map((v, i) => [+(i * step).toFixed(1), +(SPARK_H - 3 - (v / max) * (SPARK_H - 6)).toFixed(1)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')
  const area = `${line}L${SPARK_W},${SPARK_H}L0,${SPARK_H}Z`
  const [lx, ly] = pts[pts.length - 1]!
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true" className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill={color} stroke="white" strokeWidth={1.5} />
    </svg>
  )
}

/** Orb gradients per tone for the glass variant. */
const ORB: Record<StatTone, { from: string; to: string; line: string }> = {
  rose: { from: 'hsl(351 80% 62%)', to: 'hsl(351 84% 42%)', line: 'hsl(351 80% 50%)' },
  stone: { from: 'hsl(0 0% 22%)', to: 'hsl(0 0% 6%)', line: 'hsl(0 0% 20%)' },
  gold: { from: 'hsl(43 85% 60%)', to: 'hsl(36 75% 40%)', line: 'hsl(43 78% 46%)' },
  sand: { from: 'hsl(30 70% 60%)', to: 'hsl(24 65% 40%)', line: 'hsl(28 68% 48%)' },
}

function GlassStatCard({ stat, index, fit, error }: { stat: DashStat; index: number; fit: boolean; error: boolean }) {
  const { t, i18n } = useTranslation()
  const tone = stat.tone ?? STAT_TONE_CYCLE[index % STAT_TONE_CYCLE.length]!
  const orb = ORB[tone]
  const Icon = stat.icon
  const body = (
    <div
      className={cn(
        'dash-glass group relative flex h-full items-center gap-4 overflow-hidden rounded-[1.5rem] p-5 transition-transform duration-300 hover:-translate-y-0.5',
        fit && 'fit:gap-3 fit:px-4 fit:py-2.5'
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full opacity-[0.16] blur-2xl transition-opacity group-hover:opacity-25"
        style={{ background: orb.from }}
      />
      <span
        className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.45)]', fit && 'fit:h-10 fit:w-10 fit:rounded-xl')}
        style={{ background: `linear-gradient(145deg, ${orb.from}, ${orb.to})` }}
      >
        <Icon size={22} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[hsl(var(--dash-muted))]">{stat.label}</p>
        <div className="flex items-baseline gap-2">
          <p className={cn('text-[1.75rem] font-semibold leading-tight tracking-tight tabular-nums text-[hsl(var(--dash-ink))]', fit && 'fit:text-[1.4rem]')}>
            {error ? '—' : <StatValue value={stat.value} locale={i18n.language} />}
          </p>
          {!error && stat.delta ? <DeltaChip current={stat.delta.current} previous={stat.delta.previous} /> : null}
        </div>
        <p className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
          {error ? t('dashboard.stats.load_error', "Couldn't load") : stat.delta?.label ?? stat.hint}
        </p>
      </div>
      {!error && stat.trend ? (
        <span className={cn('pointer-events-none absolute bottom-3 end-4', fit && 'fit:bottom-2')}>
          <Sparkline values={stat.trend} color={orb.line} id={`spark-${stat.key}`} />
        </span>
      ) : null}
    </div>
  )
  return stat.href ? (
    <Link href={stat.href} className="block h-full rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--dash-accent))]/50">
      {body}
    </Link>
  ) : (
    body
  )
}

/**
 * Row of pastel stat cards — the dashboard home's look, shared by every admin
 * page. `density="fit"` is the home's compact variant for its one-screen layout.
 */
export default function DashStatCards({
  stats,
  loading = false,
  error = false,
  density = 'comfortable',
  variant = 'pastel',
  className,
}: {
  stats: DashStat[]
  loading?: boolean
  error?: boolean
  density?: 'comfortable' | 'fit'
  /** "glass": frosted cards with an icon orb, change chip and sparkline (dashboard home). */
  variant?: 'pastel' | 'glass'
  className?: string
}) {
  const { t, i18n } = useTranslation()
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
      {stats.map(({ key, label, value, hint, icon: Icon, href, tone }, i) => {
        const style = STAT_TONES[tone ?? STAT_TONE_CYCLE[i % STAT_TONE_CYCLE.length]!]
        return (
          <StaggerItem key={key}>
            {loading ? (
              <div className={cn('dash-shimmer rounded-[var(--dash-radius)]', fit ? 'h-[112px] fit:h-[66px]' : 'h-[104px]')} />
            ) : variant === 'glass' ? (
              <GlassStatCard stat={stats[i]!} index={i} fit={fit} error={error} />
            ) : (
              <div
                className={cn(
                  'relative flex h-full items-center gap-4 rounded-[var(--dash-radius)] p-5',
                  fit && 'fit:gap-3 fit:px-4 fit:py-2.5'
                )}
                style={{ background: style.bg }}
              >
                <span
                  className={cn(
                    'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_hsl(0_0%_8%/0.06)]',
                    fit && 'fit:h-10 fit:w-10 fit:rounded-xl'
                  )}
                >
                  <Icon size={24} weight="regular" style={{ color: style.icon }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--dash-ink))]/80">{label}</p>
                  <p
                    className={cn(
                      'mt-0.5 truncate font-semibold leading-tight tracking-tight tabular-nums text-[hsl(var(--dash-ink))]',
                      // Pre-formatted strings are usually money ("EGP 12,345.00"): one step smaller so they fit.
                      typeof value === 'string' ? 'text-[1.35rem]' : 'text-[1.75rem]',
                      fit && 'fit:mt-0 fit:text-[1.35rem]'
                    )}
                    title={typeof value === 'string' ? value : undefined}
                  >
                    {error ? '—' : <StatValue value={value} locale={i18n.language} />}
                  </p>
                  {(hint || error) && (
                    <p className="truncate text-[11px] text-[hsl(var(--dash-ink))]/60">
                      {error ? t('dashboard.stats.load_error', "Couldn't load") : hint}
                    </p>
                  )}
                </div>
                {href && (
                  <Link
                    href={href}
                    aria-label={t('dashboard.home.view_all', 'View All')}
                    title={t('dashboard.home.view_all', 'View All')}
                    className={cn(
                      'absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-[hsl(var(--dash-muted))] transition-colors hover:bg-white hover:text-[hsl(var(--dash-ink))]',
                      fit && 'fit:top-2.5 fit:h-7 fit:w-7'
                    )}
                  >
                    <DotsThree size={20} weight="bold" />
                  </Link>
                )}
              </div>
            )}
          </StaggerItem>
        )
      })}
    </Stagger>
  )
}
