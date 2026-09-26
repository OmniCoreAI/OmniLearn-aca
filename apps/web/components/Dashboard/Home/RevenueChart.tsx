'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getFinanceSummary } from '@services/finance/ledger'
import { EmptyState, GlassTooltip, HomeCard, LegendToggle, RangeSelect } from './HomeCard'
import { HOME_COLORS, monthLabel } from './homeData'

function monthKeys(count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

const compact = (value: number, locale?: string) =>
  new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)

type Series = 'income' | 'expense'
const ALL_ON: Record<Series, boolean> = { income: true, expense: true }

export default function RevenueChart() {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [months, setMonths] = useState(7)
  const [shown, setShown] = useState(ALL_ON)
  const [, startTransition] = useTransition()

  // Fetch the widest range once; the picker only slices it.
  const keys12 = useMemo(() => monthKeys(12), [])
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-home', 'revenue', org?.id, keys12[0]],
    queryFn: () => getFinanceSummary(org.id, token, { date_from: `${keys12[0]}-01` }),
    enabled: !!token && !!org?.id,
    staleTime: 60_000,
    retry: false,
  })

  const currency = data?.currency || 'USD'
  const { rows, totals } = useMemo(() => {
    const byMonth: Record<string, { income: number; expense: number }> = {}
    for (const d of data?.daily ?? []) {
      const key = d.date.slice(0, 7)
      const bucket = (byMonth[key] ??= { income: 0, expense: 0 })
      bucket.income += Number(d.revenue) || 0
      bucket.expense += Number(d.expenses) || 0
    }
    const list = keys12.slice(-months).map((key) => ({
      key,
      label: monthLabel(key, i18n.language),
      income: Math.round(byMonth[key]?.income ?? 0),
      expense: Math.round(byMonth[key]?.expense ?? 0),
    }))
    const income = list.reduce((s, r) => s + r.income, 0)
    const expense = list.reduce((s, r) => s + r.expense, 0)
    return { rows: list, totals: { income, expense, net: income - expense } }
  }, [data, keys12, months, i18n.language])

  const hasData = rows.some((r) => r.income > 0 || r.expense > 0)
  const money = (v: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  const toggle = (s: Series) => setShown((prev) => ({ ...prev, [s]: !prev[s] }))

  return (
    <HomeCard
      title={t('dashboard.home.revenue.title', 'Revenue')}
      subtitle={
        hasData
          ? t('dashboard.home.revenue.summary', '{{income}} in · {{net}} net', {
              income: money(totals.income),
              net: money(totals.net),
            })
          : undefined
      }
      action={
        <div className="flex items-center gap-1">
          <div className="hidden items-center sm:flex">
            <LegendToggle
              label={t('dashboard.home.revenue.income', 'Income')}
              color={HOME_COLORS.gold}
              on={shown.income}
              onToggle={() => toggle('income')}
            />
            <LegendToggle
              label={t('dashboard.home.revenue.expense', 'Expense')}
              color={HOME_COLORS.ink}
              dashed
              on={shown.expense}
              onToggle={() => toggle('expense')}
            />
          </div>
          <RangeSelect
            label={t('dashboard.home.range', 'Range')}
            value={months}
            onChange={(v) => startTransition(() => setMonths(v))}
            options={[
              { value: 7, label: t('dashboard.home.last_n_months', 'Last {{count}} months', { count: 7 }) },
              { value: 12, label: t('dashboard.home.last_n_months', 'Last {{count}} months', { count: 12 }) },
            ]}
          />
        </div>
      }
    >
      {isLoading ? (
        <div className="dash-shimmer h-[230px] rounded-2xl fit:min-h-0 fit:flex-1" />
      ) : isError || !hasData ? (
        <EmptyState className="h-[230px]">
          {isError
            ? t('dashboard.home.revenue.unavailable', 'Revenue is unavailable for your role.')
            : t('dashboard.home.revenue.empty', 'No income or expenses recorded in this period yet.')}
        </EmptyState>
      ) : (
        <div className="h-[230px] fit:min-h-0 fit:flex-1" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="homeRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={HOME_COLORS.gold} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={HOME_COLORS.gold} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={HOME_COLORS.grid} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: HOME_COLORS.muted }} dy={6} />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                tick={{ fontSize: 11, fill: HOME_COLORS.muted }}
                tickFormatter={(v) => compact(Number(v), i18n.language)}
              />
              <Tooltip
                cursor={{ stroke: HOME_COLORS.goldDeep, strokeDasharray: '4 4' }}
                content={(props: any) => (
                  <GlassTooltip
                    {...props}
                    rows={(payload) => {
                      const r = payload[0]?.payload ?? {}
                      return [
                        { label: t('dashboard.home.revenue.income', 'Income'), value: money(r.income ?? 0), color: HOME_COLORS.gold },
                        { label: t('dashboard.home.revenue.expense', 'Expense'), value: money(r.expense ?? 0), color: HOME_COLORS.ink },
                        { label: t('dashboard.home.revenue.net', 'Net'), value: money((r.income ?? 0) - (r.expense ?? 0)) },
                      ]
                    }}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="income"
                hide={!shown.income}
                stroke={HOME_COLORS.gold}
                strokeWidth={2.5}
                fill="url(#homeRevenueFill)"
                activeDot={{ r: 5, fill: HOME_COLORS.gold, stroke: '#fff', strokeWidth: 2 }}
                animationDuration={500}
              />
              <Line
                type="monotone"
                dataKey="expense"
                hide={!shown.expense}
                stroke={HOME_COLORS.ink}
                strokeWidth={2}
                strokeDasharray="6 6"
                dot={false}
                activeDot={{ r: 4, fill: HOME_COLORS.ink, stroke: '#fff', strokeWidth: 2 }}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </HomeCard>
  )
}
