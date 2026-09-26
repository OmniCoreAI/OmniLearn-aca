'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DeltaChip } from '@components/Dashboard/Shared/DashStatCards'
import { EmptyState, GlassTooltip, HomeCard, RangeSelect, Segmented } from './HomeCard'
import { HOME_COLORS, monthLabel, useHomeOverview } from './homeData'

type Metric = 'enrollments' | 'completions'

const BAR_COLOR: Record<Metric, { base: string; peak: string }> = {
  enrollments: { base: HOME_COLORS.rose, peak: HOME_COLORS.gold },
  completions: { base: HOME_COLORS.stone, peak: HOME_COLORS.goldDeep },
}

export default function EnrollmentTrendsChart() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const [months, setMonths] = useState(7)
  const [metric, setMetric] = useState<Metric>('enrollments')
  const [hovered, setHovered] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const rows = useMemo(
    () =>
      (data?.enrollment_trend ?? []).slice(-months).map((r) => ({ ...r, label: monthLabel(r.month, i18n.language) })),
    [data, months, i18n.language]
  )

  const values = rows.map((r) => r[metric])
  const peak = Math.max(0, ...values)
  const hasData = rows.some((r) => r.enrollments > 0 || r.completions > 0)
  const current = values.at(-1) ?? 0
  const previous = values.at(-2) ?? 0
  const metricLabel =
    metric === 'enrollments'
      ? t('dashboard.home.enrollment_trends.enrollments', 'Enrollments')
      : t('dashboard.home.enrollment_trends.completions', 'Completions')

  return (
    <HomeCard
      title={t('dashboard.home.enrollment_trends.title', 'Enrollment Trends')}
      subtitle={
        hasData ? (
          <span className="inline-flex items-center gap-1.5">
            {t('dashboard.home.enrollment_trends.this_month', '{{count}} this month', { count: current })}
            <DeltaChip current={current} previous={previous} />
          </span>
        ) : undefined
      }
      action={
        <div className="flex items-center gap-1.5">
          <Segmented
            label={t('dashboard.home.enrollment_trends.metric', 'Metric')}
            value={metric}
            onChange={(m) => startTransition(() => setMetric(m))}
            options={[
              { value: 'enrollments', label: t('dashboard.home.enrollment_trends.enrollments', 'Enrollments') },
              { value: 'completions', label: t('dashboard.home.enrollment_trends.completions', 'Completions') },
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
      {isLoading ? (
        <div className="dash-shimmer h-[254px] rounded-2xl fit:min-h-0 fit:flex-1" />
      ) : !hasData ? (
        <EmptyState className="h-[254px]">
          {t('dashboard.home.enrollment_trends.empty', 'Enrollments will appear here as learners join courses.')}
        </EmptyState>
      ) : (
        <div className="h-[254px] fit:min-h-0 fit:flex-1" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} onMouseLeave={() => setHovered(null)}>
              <CartesianGrid stroke={HOME_COLORS.grid} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: HOME_COLORS.muted }} dy={6} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: HOME_COLORS.muted }} />
              <Tooltip
                cursor={false}
                content={(props: any) => (
                  <GlassTooltip
                    {...props}
                    rows={(payload) => {
                      const r = payload[0]?.payload ?? {}
                      return [
                        {
                          label: t('dashboard.home.enrollment_trends.enrollments', 'Enrollments'),
                          value: Number(r.enrollments ?? 0).toLocaleString(i18n.language),
                          color: HOME_COLORS.rose,
                        },
                        {
                          label: t('dashboard.home.enrollment_trends.completions', 'Completions'),
                          value: Number(r.completions ?? 0).toLocaleString(i18n.language),
                          color: HOME_COLORS.stone,
                        },
                        {
                          label: t('dashboard.home.enrollment_trends.new_members', 'New members'),
                          value: Number(r.members ?? 0).toLocaleString(i18n.language),
                        },
                      ]
                    }}
                  />
                )}
              />
              <Bar
                dataKey={metric}
                name={metricLabel}
                radius={[10, 10, 10, 10]}
                maxBarSize={36}
                animationDuration={450}
                onMouseEnter={(_: unknown, index: number) => setHovered(index)}
              >
                {rows.map((r, i) => (
                  <Cell
                    key={r.month}
                    fill={r[metric] === peak && peak > 0 ? BAR_COLOR[metric].peak : BAR_COLOR[metric].base}
                    fillOpacity={hovered === null || hovered === i ? 1 : 0.35}
                    style={{ transition: 'fill-opacity 160ms ease' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </HomeCard>
  )
}
