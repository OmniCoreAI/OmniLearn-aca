'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, HomeCard, RangeSelect, chartTooltipStyle } from './HomeCard'
import { HOME_COLORS, monthLabel, useHomeOverview } from './homeData'

/** Month-over-month change badge drawn above each bar. */
function ChangeBadge(props: any) {
  const { x, y, width, value } = props
  if (value === null || value === undefined || !isFinite(value)) return null
  const up = value >= 0
  const text = `${up ? '↗' : '↘'} ${Math.abs(value)}%`
  const w = Math.max(34, text.length * 5.6)
  return (
    <g transform={`translate(${x + width / 2 - w / 2}, ${y - 22})`}>
      <rect width={w} height={15} rx={7.5} fill={up ? HOME_COLORS.goldSoft : HOME_COLORS.roseSoft} />
      <text
        x={w / 2}
        y={10.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill={up ? HOME_COLORS.goldDeep : HOME_COLORS.red}
      >
        {text}
      </text>
    </g>
  )
}

export default function EnrollmentTrendsChart() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useHomeOverview()
  const [months, setMonths] = useState(7)

  const rows = useMemo(() => {
    const trend = data?.enrollment_trend ?? []
    return trend
      .map((r, i) => {
        const prev = i > 0 ? trend[i - 1]!.enrollments : null
        const change = prev ? Math.round(((r.enrollments - prev) / prev) * 1000) / 10 : null
        return { ...r, label: monthLabel(r.month, i18n.language), change }
      })
      .slice(-months)
  }, [data, months, i18n.language])

  const peak = Math.max(0, ...rows.map((r) => r.enrollments))
  const hasData = peak > 0

  return (
    <HomeCard
      title={t('dashboard.home.enrollment_trends.title', 'Enrollment Trends')}
      action={
        <RangeSelect
          label={t('dashboard.home.range', 'Range')}
          value={months}
          onChange={setMonths}
          options={[
            { value: 7, label: t('dashboard.home.last_n_months', 'Last {{count}} months', { count: 7 }) },
            { value: 12, label: t('dashboard.home.last_n_months', 'Last {{count}} months', { count: 12 }) },
          ]}
        />
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
            <BarChart data={rows} margin={{ top: 24, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={HOME_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: HOME_COLORS.muted }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: HOME_COLORS.muted }}
              />
              <Tooltip
                cursor={{ fill: HOME_COLORS.stoneSoft, radius: 10 } as any}
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [
                  Number(value).toLocaleString(i18n.language),
                  name === 'enrollments'
                    ? t('dashboard.home.enrollment_trends.enrollments', 'Enrollments')
                    : t('dashboard.home.enrollment_trends.completions', 'Completions'),
                ]}
              />
              <Bar dataKey="enrollments" radius={[10, 10, 10, 10]} maxBarSize={36} animationDuration={500}>
                {rows.map((r) => (
                  <Cell key={r.month} fill={r.enrollments === peak ? HOME_COLORS.gold : HOME_COLORS.rose} />
                ))}
                <LabelList dataKey="change" content={<ChangeBadge />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </HomeCard>
  )
}
