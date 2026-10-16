'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowLeft, ArrowUp, CaretDown, CaretUp, DownloadSimple, Printer, Minus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'

/* ----------------------------------------------------------------- formats */

export function useReportFormats(currency = 'EGP') {
  const { i18n } = useTranslation()
  const locale = `${i18n.language.split('-')[0]}-u-nu-latn`
  return useMemo(() => {
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    const moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
    return {
      locale,
      number: (n: number) => num.format(n ?? 0),
      money: (n: number) => moneyFmt.format(n ?? 0),
      compact: (n: number) => compact.format(n ?? 0),
      pct: (n: number) => `${num.format(n ?? 0)}%`,
      month: (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
      day: (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    }
  }, [locale, currency])
}

/* ------------------------------------------------------------------- range */

export type RangePreset = 'this_month' | 'last_3' | 'last_6' | 'last_12' | 'this_year' | 'custom'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function presetRange(preset: Exclude<RangePreset, 'custom'>, today = new Date()) {
  const end = iso(today)
  const monthsBack = { this_month: 0, last_3: 2, last_6: 5, last_12: 11 } as const
  if (preset === 'this_year') return { from: `${today.getFullYear()}-01-01`, to: end }
  return { from: iso(new Date(today.getFullYear(), today.getMonth() - monthsBack[preset], 1)), to: end }
}

/** The report's date range, kept in the URL (?range=last_12 or ?from=…&to=…) so links can be shared. */
export function useReportRange() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const from = params.get('from')
  const to = params.get('to')
  const preset = (from && to ? 'custom' : (params.get('range') as RangePreset)) || 'last_12'
  const range = preset === 'custom' && from && to ? { from, to } : presetRange(preset === 'custom' ? 'last_12' : preset)

  const set = (next: { preset: RangePreset; from?: string; to?: string }) => {
    const q = new URLSearchParams(params.toString())
    q.delete('from')
    q.delete('to')
    q.delete('range')
    if (next.preset === 'custom' && next.from && next.to) {
      q.set('from', next.from)
      q.set('to', next.to)
    } else if (next.preset !== 'last_12') {
      q.set('range', next.preset)
    }
    router.replace(`${pathname}${q.toString() ? `?${q}` : ''}`, { scroll: false })
  }
  return { preset, range, set }
}

export function RangePicker({ value }: { value: ReturnType<typeof useReportRange> }) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState(value.preset === 'custom')
  const [from, setFrom] = useState(value.range.from)
  const [to, setTo] = useState(value.range.to)
  const presets: [Exclude<RangePreset, 'custom'>, string][] = [
    ['this_month', t('reports.range.this_month', 'This month')],
    ['last_3', t('reports.range.last_3', '3 months')],
    ['last_6', t('reports.range.last_6', '6 months')],
    ['last_12', t('reports.range.last_12', '12 months')],
    ['this_year', t('reports.range.this_year', 'This year')],
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div role="tablist" aria-label={t('reports.range.label', 'Period')} className="inline-flex flex-wrap rounded-full bg-white p-1 shadow-[0_1px_2px_hsl(220_30%_10%/0.05)] ring-1 ring-[hsl(var(--dash-border))]">
        {presets.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={!custom && value.preset === key}
            onClick={() => {
              setCustom(false)
              value.set({ preset: key })
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              !custom && value.preset === key ? 'bg-[hsl(var(--dash-ink))] text-white' : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={custom}
          onClick={() => setCustom(true)}
          className={cn(
            'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            custom ? 'bg-[hsl(var(--dash-ink))] text-white' : 'text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))]'
          )}
        >
          {t('reports.range.custom', 'Custom')}
        </button>
      </div>
      {custom ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (from && to && from <= to) value.set({ preset: 'custom', from, to })
          }}
        >
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label={t('reports.range.from', 'From')} className="h-9 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3 text-[12.5px]" />
          <span className="text-[hsl(var(--dash-muted))]">–</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label={t('reports.range.to', 'To')} className="h-9 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3 text-[12.5px]" />
          <button type="submit" className="h-9 rounded-full bg-[hsl(var(--dash-ink))] px-3.5 text-[12.5px] font-semibold text-white">
            {t('reports.range.apply', 'Apply')}
          </button>
        </form>
      ) : null}
    </div>
  )
}

/* ----------------------------------------------------------------- actions */

export function ReportActions({ onExport }: { onExport?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 print:hidden">
      {onExport ? (
        <button type="button" onClick={onExport} className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[hsl(var(--dash-ink))]/80 hover:text-[hsl(var(--dash-ink))]">
          <DownloadSimple size={15} /> {t('reports.export_csv', 'Export CSV')}
        </button>
      ) : null}
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-3.5 py-2 text-[12.5px] font-semibold text-white">
        <Printer size={15} /> {t('reports.print', 'Print / PDF')}
      </button>
    </div>
  )
}

/** CSV with a BOM so Excel opens Arabic text correctly. */
export function exportCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  downloadCsv(filename, '﻿' + toCsv(headers, rows))
}

/* -------------------------------------------------------------- KPI cards */

export function Kpi({
  label,
  value,
  current,
  previous,
  hint,
  invert = false,
  icon,
}: {
  label: string
  value: string
  current?: number
  previous?: number
  hint?: string
  /** For costs: going up is bad. */
  invert?: boolean
  icon?: React.ReactNode
}) {
  const { t } = useTranslation()
  const fmt = useReportFormats()
  const hasDelta = current !== undefined && previous !== undefined
  const change = hasDelta ? (previous ? ((current! - previous!) / Math.abs(previous!)) * 100 : current ? 100 : 0) : 0
  const good = invert ? change < 0 : change > 0
  return (
    <div className="flex min-w-0 flex-col rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-4 shadow-[0_1px_2px_hsl(220_30%_10%/0.04)] print:break-inside-avoid print:shadow-none">
      <div className="flex items-center gap-2">
        {icon ? <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))]/70">{icon}</span> : null}
        <p className="line-clamp-2 min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-[hsl(var(--dash-muted))]" title={label}>{label}</p>
      </div>
      <p
        className={cn(
          'mt-2.5 truncate font-bold leading-none tracking-tight tabular-nums text-[hsl(var(--dash-ink))]',
          // Long amounts (currency + thousands) step down so they fit six across.
          value.length > 13 ? 'text-[1.15rem]' : value.length > 10 ? 'text-[1.35rem]' : 'text-[1.6rem]'
        )}
        title={value}
      >
        {value}
      </p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5 text-[11.5px]">
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold tabular-nums',
              change === 0 ? 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]' : good ? 'bg-[hsl(152_45%_92%)] text-[hsl(152_60%_26%)]' : 'bg-[hsl(var(--dash-warn-soft))] text-[hsl(var(--dash-warn))]'
            )}
          >
            {change === 0 ? <Minus size={10} weight="bold" /> : change > 0 ? <ArrowUp size={10} weight="bold" /> : <ArrowDown size={10} weight="bold" />}
            {fmt.number(Math.abs(Math.round(change * 10) / 10))}%
          </span>
        ) : null}
        <span className="line-clamp-2 text-[hsl(var(--dash-muted))]">{hint ?? (hasDelta ? t('reports.vs_previous', 'vs. previous period') : '')}</span>
      </div>
    </div>
  )
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6', className)}>{children}</div>
}

/* ----------------------------------------------------------------- panels */

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-[1.25rem] border border-[hsl(var(--dash-border))]/80 bg-white p-5 shadow-[0_1px_2px_hsl(220_30%_10%/0.04)] print:break-inside-avoid print:shadow-none', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15.5px] font-bold tracking-tight text-[hsl(var(--dash-ink))]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-[hsl(var(--dash-muted))]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-[hsl(var(--dash-canvas))] px-4 py-8 text-center text-[13px] text-[hsl(var(--dash-muted))]">{children}</p>
}

/** Ranked list with horizontal bars (no pie charts). */
export function BarList({ rows, format, color = 'hsl(40 78% 45%)', empty }: { rows: { label: string; value: number; share?: number; hint?: string }[]; format: (_n: number) => string; color?: string; empty: string }) {
  const fmt = useReportFormats()
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-[hsl(var(--dash-ink))]" dir="auto" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-bold text-[hsl(var(--dash-ink))]">{format(r.value)}</span>
              {r.share !== undefined ? <span className="ms-1.5 text-[11.5px] text-[hsl(var(--dash-muted))]">{fmt.pct(r.share)}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[hsl(220_14%_94%)]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
          {r.hint ? <p className="mt-0.5 text-[11.5px] text-[hsl(var(--dash-muted))]">{r.hint}</p> : null}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ table */

export type Column<T> = {
  key: string
  label: string
  value: (_row: T) => string | number
  render?: (_row: T) => React.ReactNode
  numeric?: boolean
}

export function ReportTable<T>({ columns, rows, empty, initialSort, footer }: { columns: Column<T>[]; rows: T[]; empty: string; initialSort?: string; footer?: React.ReactNode }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort ?? columns[0].key, dir: -1 })
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    return [...rows].sort((a, b) => {
      const x = col.value(a)
      const y = col.value(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
    })
  }, [rows, columns, sort])
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('border-b border-[hsl(var(--dash-border))] pb-2.5 font-semibold text-[hsl(var(--dash-muted))]', c.numeric ? 'text-end' : 'text-start')}>
                <button
                  type="button"
                  onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((s.dir * -1) as 1 | -1) : -1 }))}
                  className="inline-flex items-center gap-1 text-[12px] hover:text-[hsl(var(--dash-ink))] print:pointer-events-none"
                >
                  {c.label}
                  {sort.key === c.key ? sort.dir === -1 ? <CaretDown size={11} weight="bold" /> : <CaretUp size={11} weight="bold" /> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-[hsl(var(--dash-canvas))]/60">
              {columns.map((c) => (
                <td key={c.key} className={cn('border-b border-[hsl(var(--dash-border))]/60 py-2.5 align-middle', c.numeric ? 'text-end tabular-nums' : 'text-start')}>
                  {c.render ? c.render(row) : c.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  )
}

/* -------------------------------------------------------------- page bits */

export function ReportTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (_v: T) => void; tabs: [T, string][] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-[0_1px_2px_hsl(220_30%_10%/0.05)] ring-1 ring-[hsl(var(--dash-border))] print:hidden">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors',
            value === key ? 'bg-[linear-gradient(135deg,hsl(43_88%_60%),hsl(39_80%_47%))] text-[hsl(220_10%_8%)] shadow-sm' : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function RangeCaption({ from, to, previousFrom, previousTo }: { from: string; to: string; previousFrom: string; previousTo: string }) {
  const { t } = useTranslation()
  const fmt = useReportFormats()
  return (
    <p className="text-[12.5px] text-[hsl(var(--dash-muted))]">
      {t('reports.period', 'Period: {{from}} – {{to}}', { from: fmt.day(from), to: fmt.day(to) })}
      <span className="mx-1.5">·</span>
      {t('reports.compared_with', 'compared with {{from}} – {{to}}', { from: fmt.day(previousFrom), to: fmt.day(previousTo) })}
    </p>
  )
}

export function ReportLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dash-shimmer h-[118px] rounded-[1.25rem]" />
        ))}
      </div>
      <div className="dash-shimmer h-[320px] rounded-[1.25rem]" />
    </div>
  )
}

export function ReportError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-2xl border border-[hsl(var(--dash-warn))]/25 bg-[hsl(var(--dash-warn-soft))] px-4 py-3 text-[13.5px] text-[hsl(var(--dash-warn))]">
      {t('reports.load_error', 'This report could not be loaded.')}{' '}
      <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
        {t('reports.retry', 'Retry')}
      </button>
    </div>
  )
}

export function BackToReports() {
  const { t } = useTranslation()
  return (
    <Link href="/dash/reports" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[hsl(var(--dash-muted))] hover:text-[hsl(var(--dash-ink))] print:hidden">
      <ArrowLeft size={13} weight="bold" className="rtl:rotate-180" />
      {t('reports.all_reports', 'All reports')}
    </Link>
  )
}
