'use client'

import React, { useId, useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ tokens */

/** Academy gold, dark enough for 3:1 marks on white. */
export const GOLD = 'hsl(40 78% 42%)'
export const GOLD_LIGHT = 'hsl(43 88% 60%)'
export const TRACK = 'hsl(220 14% 93%)'
/** Sequential gold ramp (light → dark) for intensity, e.g. the consistency heatmap. */
export const GOLD_RAMP = ['hsl(220 14% 94%)', 'hsl(43 75% 86%)', 'hsl(43 78% 70%)', 'hsl(41 80% 54%)', 'hsl(38 82% 38%)']

/* ----------------------------------------------------------------- formats */

/** Locale for numbers and dates in the portal: the UI language, always with Latin digits. */
export function useFormats() {
  const { i18n } = useTranslation()
  const locale = `${i18n.language.split('-')[0]}-u-nu-latn`
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    return {
      locale,
      number: (n: number) => number.format(n),
      date: (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, opts),
      time: (d: Date) => d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
      /** "2 hours ago", "yesterday", "3 days ago". */
      ago: (iso: string | null | undefined) => {
        if (!iso) return ''
        const diff = (new Date(iso).getTime() - Date.now()) / 1000
        const abs = Math.abs(diff)
        if (abs < 60) return rtf.format(0, 'second')
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
        if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour')
        if (abs < 86_400 * 30) return rtf.format(Math.round(diff / 86_400), 'day')
        if (abs < 86_400 * 365) return rtf.format(Math.round(diff / (86_400 * 30)), 'month')
        return rtf.format(Math.round(diff / (86_400 * 365)), 'year')
      },
    }
  }, [locale])
}

/** "45 min" / "1 h 20 min" in the UI language. */
export function useDuration() {
  const { t } = useTranslation()
  const fmt = useFormats()
  return (minutes: number) =>
    minutes >= 60
      ? t('student_portal.chart.hours_minutes', '{{h}} h {{m}} min', { h: fmt.number(Math.floor(minutes / 60)), m: fmt.number(minutes % 60) })
      : t('student_portal.minutes', '{{count}} min', { count: minutes })
}

export const strip = (uuid: string, prefix: string) => uuid.replace(`${prefix}_`, '')
export const coursePath = (courseUuid: string) => `/course/${strip(courseUuid, 'course')}`
export const lessonPath = (courseUuid: string, activityUuid: string) =>
  `${coursePath(courseUuid)}/activity/${strip(activityUuid, 'activity')}`

/* ------------------------------------------------------------------ layout */

/** White dashboard surface: 1px border, very soft shadow, 20px radius. */
export function Panel({ className, children, as: Tag = 'section', ...rest }: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' }) {
  return (
    <Tag
      className={cn(
        'rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white shadow-[0_1px_2px_hsl(220_30%_10%/0.04),0_12px_32px_-20px_hsl(220_30%_10%/0.14)]',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function PanelHeader({
  id,
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  id?: string
  title: string
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/75">{icon}</span>
        ) : null}
        <div className="min-w-0">
          <h2 id={id} className="text-[16.5px] font-bold tracking-tight text-[hsl(var(--dash-ink))]">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-[hsl(var(--dash-muted))]">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

/** "View all ←" — the arrow points along the reading direction. */
export function ViewAll({ href, label }: { href: string; label?: string }) {
  const { t } = useTranslation()
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-[hsl(var(--dash-border))] px-3 py-1.5 text-[12.5px] font-semibold text-[hsl(var(--dash-ink))]/80 transition-colors hover:border-[hsl(var(--dash-ink))]/20 hover:text-[hsl(var(--dash-ink))]"
    >
      {label || t('student_portal.view_all', 'View all')}
      <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-8 text-center', className)}>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
        {icon}
      </span>
      <p className="mt-3 text-[15px] font-semibold text-[hsl(var(--dash-ink))]">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-[hsl(var(--dash-muted))]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function GoldButton({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(43_90%_62%),hsl(39_82%_47%))] px-6 py-3 text-[15px] font-bold text-[hsl(220_10%_8%)] shadow-[0_12px_28px_-12px_hsl(43_85%_45%/0.85),inset_0_1px_0_hsl(0_0%_100%/0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_hsl(43_85%_45%/0.95),inset_0_1px_0_hsl(0_0%_100%/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43_85%_50%)] focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </Link>
  )
}

/** Small rounded status pill. */
export function Pill({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'gold' | 'green' | 'blue' | 'purple' | 'red'; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]',
    gold: 'bg-[hsl(43_85%_92%)] text-[hsl(36_80%_28%)]',
    green: 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_26%)]',
    blue: 'bg-[hsl(212_75%_94%)] text-[hsl(212_65%_36%)]',
    purple: 'bg-[hsl(268_60%_95%)] text-[hsl(268_45%_40%)]',
    red: 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]',
  }
  return <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', tones[tone], className)}>{children}</span>
}

/* ------------------------------------------------------------ micro charts */

/** Horizontal progress bar. Fills from the reading-start side (right in RTL). */
export function ProgressBar({ value, className, tone = 'gold' }: { value: number; className?: string; tone?: 'gold' | 'green' | 'light' }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn('h-2 overflow-hidden rounded-full', tone === 'light' ? 'bg-white/15' : 'bg-[hsl(220_14%_93%)]', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          tone === 'green'
            ? 'bg-[hsl(152_55%_40%)]'
            : 'bg-[linear-gradient(90deg,hsl(39_82%_45%),hsl(43_90%_60%))] rtl:bg-[linear-gradient(270deg,hsl(39_82%_45%),hsl(43_90%_60%))]'
        )}
        style={{ width: `${Math.max(value > 0 ? 3 : 0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/**
 * Circular progress. Starts at 12 o'clock and runs in the reading direction
 * (clockwise in LTR, counter-clockwise in RTL).
 */
export function Ring({
  value,
  size = 72,
  stroke = 8,
  color = GOLD,
  track = TRACK,
  children,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 rtl:-scale-y-100" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Tiny area sparkline; the newest value sits at the reading end. */
export function Sparkline({ values, height = 44, className }: { values: number[]; height?: number; className?: string }) {
  const id = useId()
  const w = 120
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => [i * step, height - 4 - (v / max) * (height - 8)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${height} L0,${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn('w-full rtl:-scale-x-100', className)} style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity={0.22} />
          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={GOLD} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {last ? <circle cx={last[0]} cy={last[1]} r={3} fill={GOLD} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  )
}

/** Small column chart (e.g. the last 7 days); the last bar is highlighted. */
export function MiniBars({
  values,
  labels,
  height = 48,
  tone = 'dark',
  highlightLast = true,
  titles,
}: {
  values: number[]
  labels?: string[]
  height?: number
  tone?: 'dark' | 'light'
  highlightLast?: boolean
  titles?: string[]
}) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex w-full items-end gap-1.5">
      {values.map((v, i) => {
        const last = highlightLast && i === values.length - 1
        const h = v > 0 ? Math.max(6, (v / max) * height) : 4
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={titles?.[i]}>
            <div className="flex w-full items-end justify-center" style={{ height }}>
              <div
                className={cn(
                  'w-full max-w-[16px] rounded-[4px] transition-[height] duration-700',
                  v === 0
                    ? tone === 'light' ? 'bg-white/12' : 'bg-[hsl(220_14%_92%)]'
                    : last
                      ? 'bg-[linear-gradient(180deg,hsl(43_92%_62%),hsl(39_82%_46%))]'
                      : tone === 'light' ? 'bg-white/35' : 'bg-[hsl(43_70%_78%)]'
                )}
                style={{ height: h }}
              />
            </div>
            {labels ? (
              <span className={cn('max-w-full truncate text-[10px] font-medium', tone === 'light' ? (last ? 'text-white' : 'text-white/50') : last ? 'text-[hsl(var(--dash-ink))]' : 'text-[hsl(var(--dash-muted))]')}>
                {labels[i]}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Up/down change badge against the previous period. */
export function Delta({ now, before, format }: { now: number; before: number; format: (_n: number) => string }) {
  const diff = now - before
  const tone = diff > 0 ? 'green' : diff < 0 ? 'neutral' : 'neutral'
  return (
    <Pill tone={tone} className="tabular-nums">
      {diff > 0 ? '↑' : diff < 0 ? '↓' : ''}
      {diff === 0 ? '±0' : `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))}`}
    </Pill>
  )
}
