'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { isRTL } from '@/lib/i18n'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReportFormats } from './ReportKit'

export type Series = {
  key: string
  label: string
  color: string
  kind: 'bar' | 'line'
  /** Bars sharing a stack id are stacked. */
  stack?: string
  dashed?: boolean
}

/**
 * Month-by-month chart: bars and/or lines on one axis, a legend for every
 * series, a crosshair tooltip, and time flowing in the reading direction.
 */
export default function MonthlyChart<T extends { month: string }>({
  data,
  series,
  format,
  height = 280,
}: {
  data: T[]
  series: Series[]
  format: (_n: number) => string
  height?: number
}) {
  const { t, i18n } = useTranslation()
  const fmt = useReportFormats()
  const rtl = isRTL(i18n.language)
  const rows = data.map((d) => ({ ...d, label: fmt.month(d.month) }))
  const empty = data.every((d) => series.every((s) => !Number((d as Record<string, unknown>)[s.key])))

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[hsl(var(--dash-muted))]">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            {s.kind === 'bar' ? (
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            ) : (
              <span className="h-0 w-4 border-t-2" style={{ borderColor: s.color, borderStyle: s.dashed ? 'dashed' : 'solid' }} />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative" style={{ height }}>
        {empty ? (
          <p className="absolute inset-0 z-[1] flex items-center justify-center text-[13px] text-[hsl(var(--dash-muted))]">
            <span className="rounded-full bg-white/90 px-4 py-2 shadow-sm ring-1 ring-[hsl(var(--dash-border))]">{t('reports.no_data_period', 'No data for this period yet.')}</span>
          </p>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 4, left: 4, bottom: 0 }} barGap={3} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="hsl(220 14% 92%)" />
            <XAxis dataKey="label" reversed={rtl} tickLine={false} axisLine={false} tick={{ fill: 'hsl(220 9% 46%)', fontSize: 11 }} tickMargin={8} interval="preserveStartEnd" minTickGap={8} />
            <YAxis orientation={rtl ? 'right' : 'left'} width={56} tickLine={false} axisLine={false} tick={{ fill: 'hsl(220 9% 46%)', fontSize: 11 }} tickFormatter={(v: number) => fmt.compact(v)} allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
            <Tooltip
              cursor={{ fill: 'hsl(220 14% 50% / 0.07)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="min-w-[180px] rounded-2xl border border-[hsl(var(--dash-border))] bg-white px-3.5 py-3 text-xs shadow-[0_16px_40px_-14px_hsl(220_30%_10%/0.35)]">
                    <p className="mb-2 font-bold text-[hsl(var(--dash-ink))]">{label}</p>
                    {series.map((s) => {
                      const p = payload.find((x) => x.dataKey === s.key)
                      return (
                        <p key={s.key} className="mt-1 flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-[hsl(var(--dash-muted))]">
                            <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
                            {s.label}
                          </span>
                          <span className="font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{format(Number(p?.value ?? 0))}</span>
                        </p>
                      )
                    })}
                  </div>
                ) : null
              }
            />
            {series.map((s) =>
              s.kind === 'bar' ? (
                <Bar key={s.key} dataKey={s.key} fill={s.color} stackId={s.stack} radius={s.stack ? [0, 0, 0, 0] : [4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              ) : (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * Report series colours, always assigned in this order (validated together for
 * colour-blind separation and 3:1 contrast on white): gold, blue, rose, green.
 */
export const SERIES = {
  gold: '#b07a10',
  blue: '#2b75ca',
  rose: '#d9688a',
  green: '#227a52',
}
