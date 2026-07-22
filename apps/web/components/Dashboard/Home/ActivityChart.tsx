'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAnalyticsPipe } from '@components/Dashboard/Analytics/useAnalyticsDashboard'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const shortDate = (v: string) =>
  new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function ActivityChart() {
  const { t } = useTranslation()
  const { data, isLoading } = useAnalyticsPipe('daily_active_users', { days: '30' })
  const rows = data?.data ?? []

  return (
    <section className="rounded-[var(--dash-radius)] border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] p-5 shadow-[0_1px_2px_hsl(245_25%_13%/0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[hsl(var(--dash-ink))]">
          {t('dashboard.home.activity', 'Activity')}
        </h3>
        <span className="rounded-full bg-[hsl(var(--dash-canvas))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--dash-muted))]">
          {t('dashboard.home.last_30_days', 'Last 30 days')}
        </span>
      </div>

      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-xl" />
      ) : rows.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-[hsl(var(--dash-muted))]">
          {t('dashboard.home.no_data_yet', 'No data yet')}
        </div>
      ) : (
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="homeActivityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(262 83% 58%)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(262 83% 58%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(248 20% 93%)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(246 10% 55%)' }}
                tickFormatter={shortDate}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(246 10% 55%)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: '1px solid hsl(248 20% 91%)',
                  boxShadow: '0 8px 24px hsl(245 25% 13% / 0.08)',
                  fontSize: 12,
                }}
                labelFormatter={(label) =>
                  new Date(label).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }
                formatter={(value = 0) => [
                  `${Number(value).toLocaleString()}`,
                  t('dashboard.home.active_users', 'Active users'),
                ]}
              />
              <Area
                type="monotone"
                dataKey="dau"
                stroke="hsl(262 83% 58%)"
                strokeWidth={2.5}
                fill="url(#homeActivityGradient)"
                dot={false}
                animationDuration={450}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
