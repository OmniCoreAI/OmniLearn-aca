'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getFinanceSummary } from '@services/finance/ledger'
import { cn } from '@/lib/utils'
import { ChartTooltip, HomeCard, RangeSelect, Segmented } from './HomeCard'
import { HOME_COLORS, monthLabel, useHomeOverview } from './homeData'

type View = 'learning' | 'revenue'
type Series = 'primary' | 'secondary'
type Row = { key: string; label: string; primary: number; secondary: number }

const ALL_ON: Record<Series, boolean> = { primary: true, secondary: true }
const COLORS: Record<View, Record<Series, string>> = {
  learning: { primary: HOME_COLORS.goldDeep, secondary: HOME_COLORS.ink },
  revenue: { primary: HOME_COLORS.goldDeep, secondary: HOME_COLORS.red },
}

function monthKeys(count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

const compact = (value: number, locale?: string) =>
  new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)

/** Headline number above the chart; the two series ones double as legend toggles. */
function Kpi({
  label,
  value,
  color,
  on,
  onToggle,
}: {
  label: string
  value: string
  color?: string
  on?: boolean
  onToggle?: () => void
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
        {color ? <span className="h-2 w-2 rounded-full" style={{ background: color, opacity: on === false ? 0.35 : 1 }} /> : null}
        <span className={cn('truncate', on === false && 'line-through')}>{label}</span>
      </span>
      <span
        className={cn(
          'mt-0.5 block truncate text-lg font-semibold leading-tight tabular-nums text-[hsl(var(--dash-ink))] fit:text-base',
          on === false && 'opacity-40'
        )}
      >
        {value}
      </span>
    </>
  )
  const base = 'min-w-0 rounded-xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2 text-start fit:py-1.5'
  return onToggle ? (
    <button type="button" aria-pressed={on} onClick={onToggle} className={cn(base, 'transition-colors hover:bg-[hsl(var(--dash-canvas))]')}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  )
}

/**
 * One chart for the academy's two stories — learning (enrollments vs.
 * completions) and money (income vs. expenses) — with headline numbers on top.
 * Revenue is only fetched once someone opens that tab.
 */
export default function PerformanceChart() {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const { data: overview, isLoading: overviewLoading } = useHomeOverview()
  const [view, setView] = useState<View>('learning')
  const [months, setMonths] = useState(7)
  const [shown, setShown] = useState(ALL_ON)
  const [, startTransition] = useTransition()

  const keys12 = useMemo(() => monthKeys(12), [])
  const finance = useQuery({
    queryKey: ['dashboard-home', 'revenue', org?.id, keys12[0]],
    queryFn: () => getFinanceSummary(org.id, token, { date_from: `${keys12[0]}-01` }),
    enabled: view === 'revenue' && !!token && !!org?.id,
    staleTime: 60_000,
    retry: false,
  })
  const currency = finance.data?.currency || 'USD'

  const rows: Row[] = useMemo(() => {
    const keys = keys12.slice(-months)
    if (view === 'learning') {
      const byMonth = new Map((overview?.enrollment_trend ?? []).map((r) => [r.month, r]))
      return keys.map((key) => ({
        key,
        label: monthLabel(key, i18n.language),
        primary: byMonth.get(key)?.enrollments ?? 0,
        secondary: byMonth.get(key)?.completions ?? 0,
      }))
    }
    const byMonth: Record<string, { income: number; expense: number }> = {}
    for (const d of finance.data?.daily ?? []) {
      const bucket = (byMonth[d.date.slice(0, 7)] ??= { income: 0, expense: 0 })
      bucket.income += Number(d.revenue) || 0
      bucket.expense += Number(d.expenses) || 0
    }
    return keys.map((key) => ({
      key,
      label: monthLabel(key, i18n.language),
      primary: Math.round(byMonth[key]?.income ?? 0),
      secondary: Math.round(byMonth[key]?.expense ?? 0),
    }))
  }, [view, months, keys12, overview, finance.data, i18n.language])

  const sum = (k: Series) => rows.reduce((s, r) => s + r[k], 0)
  const primaryTotal = sum('primary')
  const secondaryTotal = sum('secondary')
  const hasData = primaryTotal > 0 || secondaryTotal > 0
  const loading = view === 'learning' ? overviewLoading : finance.isLoading
  const unavailable = view === 'revenue' && finance.isError

  const number = (v: number) => v.toLocaleString(i18n.language)
  const money = (v: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  const fmt = view === 'learning' ? number : money
  const colors = COLORS[view]
  const labels =
    view === 'learning'
      ? {
          primary: t('dashboard.home.enrollment_trends.enrollments', 'Enrollments'),
          secondary: t('dashboard.home.enrollment_trends.completions', 'Completions'),
          derived: t('dashboard.home.stats.completion_rate', 'Completion Rate'),
        }
      : {
          primary: t('dashboard.home.revenue.income', 'Income'),
          secondary: t('dashboard.home.revenue.expense', 'Expense'),
          derived: t('dashboard.home.revenue.net', 'Net'),
        }
  const derive = (primary: number, secondary: number) =>
    view === 'learning' ? `${primary ? Math.round((secondary / primary) * 100) : 0}%` : money(primary - secondary)
  const toggle = (s: Series) => setShown((prev) => ({ ...prev, [s]: !prev[s] }))
  const emptyNote = unavailable
    ? t('dashboard.home.revenue.unavailable', 'Revenue is unavailable for your role.')
    : view === 'learning'
      ? t('dashboard.home.enrollment_trends.empty', 'Enrollments will appear here as learners join courses.')
      : t('dashboard.home.revenue.empty', 'No income or expenses recorded in this period yet.')

  return (
    <HomeCard
      title={t('dashboard.home.performance.title', 'Performance')}
      subtitle={t('dashboard.home.last_n_months', 'Last {{count}} months', { count: months })}
      action={
        <div className="flex items-center gap-1.5">
          <Segmented
            label={t('dashboard.home.performance.view', 'View')}
            value={view}
            onChange={(v) =>
              startTransition(() => {
                setView(v)
                setShown(ALL_ON)
              })
            }
            options={[
              { value: 'learning', label: t('dashboard.home.performance.learning', 'Learning') },
              { value: 'revenue', label: t('dashboard.home.revenue.title', 'Revenue') },
            ]}
          />
          <RangeSelect
            label={t('dashboard.home.range', 'Range')}
            value={months}
            onChange={(v) => startTransition(() => setMonths(v))}
            options={[
              { value: 7, label: t('dashboard.home.last_n_months_short', '{{count}}M', { count: 7 }) },
              { value: 12, label: t('dashboard.home.last_n_months_short', '{{count}}M', { count: 12 }) },
            ]}
          />
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Kpi
          label={labels.primary}
          value={unavailable ? '—' : fmt(primaryTotal)}
          color={colors.primary}
          on={shown.primary}
          onToggle={() => toggle('primary')}
        />
        <Kpi
          label={labels.secondary}
          value={unavailable ? '—' : fmt(secondaryTotal)}
          color={colors.secondary}
          on={shown.secondary}
          onToggle={() => toggle('secondary')}
        />
        <Kpi label={labels.derived} value={unavailable ? '—' : derive(primaryTotal, secondaryTotal)} />
      </div>

      <div className="relative mt-3 h-[220px] fit:mt-2 fit:h-auto fit:min-h-0 fit:flex-1" dir="ltr">
        {loading ? (
          <div className="dash-shimmer h-full rounded-2xl" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 6, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="homePerformanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={HOME_COLORS.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: HOME_COLORS.muted }} dy={6} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={view === 'revenue' ? 44 : 32}
                  tick={{ fontSize: 11, fill: HOME_COLORS.muted }}
                  tickFormatter={(v) => compact(Number(v), i18n.language)}
                />
                {hasData ? (
                  <Tooltip
                    cursor={{ stroke: HOME_COLORS.stone, strokeDasharray: '4 4' }}
                    content={(props: any) => (
                      <ChartTooltip
                        {...props}
                        rows={(payload) => {
                          const r: Row = payload[0]?.payload
                          return [
                            { label: labels.primary, value: fmt(r?.primary ?? 0), color: colors.primary },
                            { label: labels.secondary, value: fmt(r?.secondary ?? 0), color: colors.secondary },
                            { label: labels.derived, value: derive(r?.primary ?? 0, r?.secondary ?? 0) },
                          ]
                        }}
                      />
                    )}
                  />
                ) : null}
                <Area
                  type="monotone"
                  dataKey="primary"
                  hide={!shown.primary}
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  fill="url(#homePerformanceFill)"
                  activeDot={{ r: 5, fill: colors.primary, stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="secondary"
                  hide={!shown.secondary}
                  stroke={colors.secondary}
                  strokeWidth={2}
                  strokeDasharray={view === 'revenue' ? '6 6' : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: colors.secondary, stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={500}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {!hasData ? (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[80%] -translate-y-1/2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3 py-1.5 text-center text-[11px] text-[hsl(var(--dash-muted))] shadow-sm">
                {emptyNote}
              </p>
            ) : null}
          </>
        )}
      </div>
    </HomeCard>
  )
}
