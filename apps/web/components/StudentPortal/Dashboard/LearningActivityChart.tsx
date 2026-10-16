'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRTL } from '@/lib/i18n'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLineUp, Fire } from '@phosphor-icons/react'
import { Segmented } from '@components/Dashboard/Home/HomeCard'
import type { LearnerDay, LearnerTotals } from '@/hooks/queries/useLearnerOverview'
import { cn } from '@/lib/utils'
import { GOLD, GOLD_RAMP, Panel, PanelHeader, useDuration, useFormats } from './ui'

type Range = '7' | '30' | '90'
type View = 'activity' | 'consistency'

const INK = 'hsl(220 10% 12%)'
const MUTED = 'hsl(220 9% 46%)'
const WEEKS = 12

/**
 * "Am I learning regularly?" — learning time per day with a running average,
 * or a 12-week heatmap with the current streak.
 */
export default function LearningActivityChart({
  days,
  totals,
  loading,
}: {
  days: LearnerDay[] | undefined
  totals: LearnerTotals | undefined
  loading: boolean
}) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const [view, setView] = useState<View>('activity')
  const [range, setRange] = useState<Range>('30')
  const slice = useMemo(() => (days ?? []).slice(-Number(range)), [days, range])
  const active = slice.filter((d) => d.lessons > 0).length

  return (
    <Panel aria-labelledby="activity-title" className="flex flex-col p-4 fit:h-full fit:min-h-0 fit:overflow-hidden">
      <PanelHeader
        id="activity-title"
        title={t('student_portal.chart.title', 'Learning activity')}
        subtitle={
          loading
            ? ' '
            : view === 'consistency'
              ? t('student_portal.consistency.subtitle', 'Active on {{count}} of the last 30 days', { count: totals?.active_days_30 ?? 0 })
              : active === 0
                ? t('student_portal.chart.question', 'Are you learning regularly?')
                : t('student_portal.chart.answer_short', 'You studied on {{active}} of the last {{days}} days', {
                    active: fmt.number(active),
                    days: fmt.number(slice.length),
                  })
        }
        icon={<ChartLineUp size={18} weight="duotone" />}
        action={
          <Segmented<View>
            value={view}
            onChange={setView}
            label={t('student_portal.chart.view', 'View')}
            options={[
              { value: 'activity', label: t('student_portal.chart.view_activity', 'Activity') },
              { value: 'consistency', label: t('student_portal.consistency.title', 'My consistency') },
            ]}
          />
        }
      />
      {loading ? (
        <div className="dash-shimmer mt-3 h-[300px] rounded-2xl fit:h-auto fit:flex-1" />
      ) : view === 'activity' ? (
        <ActivityView slice={slice} range={range} setRange={setRange} />
      ) : (
        <ConsistencyView days={days ?? []} totals={totals} />
      )}
    </Panel>
  )
}

function ActivityView({ slice, range, setRange }: { slice: LearnerDay[]; range: Range; setRange: (_r: Range) => void }) {
  const { t, i18n } = useTranslation()
  const fmt = useFormats()
  const duration = useDuration()
  const rtl = isRTL(i18n.language)
  const weekly = range === '90'

  // Daily bars for a week or a month; three months read better as weekly totals.
  const data = useMemo(() => {
    const points = slice.map((d) => ({ ...d, ts: new Date(`${d.date}T00:00:00`).getTime() }))
    const buckets = weekly
      ? Array.from({ length: Math.ceil(points.length / 7) }, (_, i) => {
          const week = points.slice(Math.max(0, points.length - (i + 1) * 7), points.length - i * 7)
          return { date: week[0].date, ts: week[0].ts, lessons: week.reduce((n, d) => n + d.lessons, 0), minutes: week.reduce((n, d) => n + d.minutes, 0) }
        }).reverse()
      : points
    // Running average over the previous 7 days (or 4 weeks) — the trend line.
    const span = weekly ? 4 : 7
    return buckets.map((d, i, all) => {
      const window = all.slice(Math.max(0, i - span + 1), i + 1)
      return {
        ...d,
        avg: Math.round(window.reduce((n, w) => n + w.minutes, 0) / window.length),
        label: fmt.date(new Date(d.ts), range === '7' ? { weekday: 'short' } : { day: 'numeric', month: 'short' }),
      }
    })
  }, [slice, weekly, range, fmt])

  const totalMinutes = slice.reduce((n, d) => n + d.minutes, 0)
  const totalLessons = slice.reduce((n, d) => n + d.lessons, 0)
  const empty = totalLessons === 0
  const showHours = Math.max(0, ...data.map((d) => d.minutes)) >= 120
  const summary = [
    { key: 'total', label: t('student_portal.chart.total', 'Total'), value: duration(totalMinutes) },
    { key: 'avg', label: t('student_portal.chart.daily_avg', 'Daily average'), value: duration(Math.round(totalMinutes / Math.max(1, slice.length))) },
    { key: 'lessons', label: t('student_portal.chart.lessons', 'Lessons'), value: fmt.number(totalLessons) },
  ]

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {summary.map((s) => (
            <div key={s.key} className="flex items-baseline gap-1.5">
              <dt className="text-[11.5px] text-[hsl(var(--dash-muted))]">{s.label}</dt>
              <dd className="text-[14px] font-bold tabular-nums text-[hsl(var(--dash-ink))]">{s.value}</dd>
            </div>
          ))}
        </dl>
        <Segmented<Range>
          value={range}
          onChange={setRange}
          label={t('student_portal.chart.range', 'Time range')}
          options={[
            { value: '7', label: t('student_portal.chart.last_7', 'Last 7 days') },
            { value: '30', label: t('student_portal.chart.last_30', 'Last 30 days') },
            { value: '90', label: t('student_portal.chart.last_90', 'Last 3 months') },
          ]}
        />
      </div>

      <div className="relative mt-3 h-[220px] fit:h-auto fit:min-h-[120px] fit:flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 2, left: 2, bottom: 0 }} barCategoryGap={range === '7' ? '28%' : '18%'}>
            <defs>
              <linearGradient id="student-activity-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(43 90% 60%)" />
                <stop offset="100%" stopColor={GOLD} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(220 14% 92%)" />
            {/* Time runs in the reading direction: newest at the reading end. */}
            <XAxis
              dataKey="label"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tick={{ fill: MUTED, fontSize: 10.5 }}
              interval="preserveStartEnd"
              minTickGap={range === '30' ? 24 : 4}
              tickMargin={6}
            />
            <YAxis
              orientation={rtl ? 'right' : 'left'}
              width={30}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: MUTED, fontSize: 10.5 }}
              tickFormatter={(v: number) => (showHours ? fmt.number(Math.round((v / 60) * 10) / 10) : fmt.number(v))}
            />
            <Tooltip
              cursor={{ fill: 'hsl(220 14% 50% / 0.07)', radius: 6 }}
              content={({ active: on, payload }) => {
                const p = on && payload?.length ? (payload[0].payload as (typeof data)[number]) : null
                if (!p) return null
                return (
                  <div className="min-w-[180px] rounded-2xl border border-[hsl(var(--dash-border))] bg-white px-3.5 py-3 text-xs shadow-[0_16px_40px_-14px_hsl(220_30%_10%/0.35)]">
                    <p className="mb-2 font-bold text-[hsl(var(--dash-ink))]">
                      {weekly
                        ? t('student_portal.chart.week_of', 'Week of {{date}}', { date: fmt.date(new Date(p.ts), { day: 'numeric', month: 'long' }) })
                        : fmt.date(new Date(p.ts), { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <Row color={GOLD} label={t('student_portal.chart.learning_time', 'Learning time')} value={duration(p.minutes)} />
                    <Row color="transparent" label={t('student_portal.chart.lessons', 'Lessons')} value={fmt.number(p.lessons)} />
                    <div className="my-2 h-px bg-[hsl(var(--dash-border))]" />
                    <Row color={INK} line label={t('student_portal.chart.average', 'Average')} value={duration(p.avg)} />
                  </div>
                )
              }}
            />
            <Bar dataKey="minutes" fill="url(#student-activity-bar)" radius={[5, 5, 2, 2]} maxBarSize={range === '7' ? 36 : 14} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke={INK} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, fill: INK, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {empty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 text-center backdrop-blur-[1px]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[hsl(var(--dash-muted))] shadow-sm ring-1 ring-[hsl(var(--dash-border))]">
              <ChartLineUp size={18} weight="duotone" />
            </span>
            <p className="mt-2 text-[13.5px] font-semibold text-[hsl(var(--dash-ink))]">{t('student_portal.empty.no_activity_title', 'No activity yet')}</p>
            <p className="mt-0.5 max-w-xs text-[12px] text-[hsl(var(--dash-muted))]">{t('student_portal.chart.empty_hint', 'Complete a lesson and your learning time will show up here.')}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--dash-muted))]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GOLD }} />
          {showHours
            ? weekly ? t('student_portal.chart.unit_hours_week', 'Hours per week') : t('student_portal.chart.unit_hours_day', 'Hours per day')
            : weekly ? t('student_portal.chart.unit_minutes_week', 'Minutes per week') : t('student_portal.chart.unit_minutes_day', 'Minutes per day')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: INK }} />
          {weekly ? t('student_portal.chart.avg_4w', '4-week average') : t('student_portal.chart.avg_7d', '7-day average')}
        </span>
        <span className="ms-auto">{t('student_portal.estimated', 'Estimated')}</span>
      </div>
    </div>
  )
}

/** 12-week heatmap (columns are weeks, newest at the reading end) with the streak. */
function ConsistencyView({ days, totals }: { days: LearnerDay[]; totals: LearnerTotals | undefined }) {
  const { t } = useTranslation()
  const fmt = useFormats()
  const duration = useDuration()

  const weeks = useMemo(() => {
    const recent = days.slice(-(WEEKS * 7))
    if (!recent.length) return []
    const first = new Date(`${recent[0].date}T00:00:00`)
    const padded: (LearnerDay | null)[] = [...Array(first.getDay()).fill(null), ...recent]
    const cols: (LearnerDay | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7))
    return cols.slice(-WEEKS)
  }, [days])
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const level = (m: number) => (m <= 0 ? 0 : Math.min(4, Math.ceil((m / max) * 4)))
  const weekdayNames = Array.from({ length: 7 }, (_, i) => fmt.date(new Date(2026, 0, 4 + i), { weekday: 'narrow' }))

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(30_95%_95%),hsl(43_90%_92%))] px-3 py-1.5 text-[13px] font-bold text-[hsl(var(--dash-ink))]">
          <Fire size={16} weight="fill" className="text-[hsl(24_90%_52%)]" />
          {t('student_portal.stats.days', '{{count}} days', { count: totals?.streak_days ?? 0 })}
          <span className="font-medium text-[hsl(var(--dash-ink))]/60">{t('student_portal.consistency.current_streak', 'Current learning streak')}</span>
        </span>
        <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-3 py-1.5 text-[12px] font-semibold text-[hsl(var(--dash-muted))]">
          {t('student_portal.consistency.best', 'Best')}: {t('student_portal.stats.days', '{{count}} days', { count: totals?.best_streak_days ?? 0 })}
        </span>
      </div>

      <div className="mt-3 flex min-h-[150px] flex-1 gap-2" role="img" aria-label={t('student_portal.consistency.heatmap_label', 'Learning time per day over the last 12 weeks')}>
        <div className="grid shrink-0 grid-rows-7 gap-[3px] text-[10px] text-[hsl(var(--dash-muted))]">
          {weekdayNames.map((n, i) => (
            <span key={i} className="flex items-center">{i % 2 === 1 ? n : ''}</span>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))` }}>
          {weeks.flatMap((col, ci) =>
            Array.from({ length: 7 }).map((_, ri) => {
              const d = col[ri]
              return (
                <span
                  key={`${ci}-${ri}`}
                  title={d ? `${fmt.date(new Date(`${d.date}T00:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })}: ${duration(d.minutes)}` : undefined}
                  className="min-h-[8px] rounded-[4px]"
                  style={{ background: d ? GOLD_RAMP[level(d.minutes)] : 'transparent' }}
                />
              )
            })
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10.5px] text-[hsl(var(--dash-muted))]">
        <span>{t('student_portal.consistency.weeks_ago', '12 weeks ago')}</span>
        <span className="inline-flex items-center gap-1">
          {t('student_portal.consistency.less', 'Less')}
          {GOLD_RAMP.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
          ))}
          {t('student_portal.consistency.more', 'More')}
        </span>
      </div>
    </div>
  )
}

function Row({ color, label, value, line = false }: { color: string; label: string; value: string; line?: boolean }) {
  return (
    <p className="mt-1 flex items-center justify-between gap-4 first:mt-0">
      <span className="inline-flex items-center gap-1.5 text-[hsl(var(--dash-muted))]">
        <span className={cn(line ? 'h-0 w-3 border-t-2 border-dashed' : 'h-2 w-2 rounded-[3px]')} style={line ? { borderColor: color } : { background: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{value}</span>
    </p>
  )
}
