'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight } from '@phosphor-icons/react'
import { useReport } from '@services/reports/reports'
import { useReportFormats } from '@components/Dashboard/Reports/ReportKit'
import { DeltaChip } from '@components/Dashboard/Shared/DashStatCards'
import { HOME_COLORS, monthLabel } from './homeData'
import { HomeCard } from './HomeCard'
import { useHomeRanges } from './homeReports'

export function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]"
    >
      {label}
      <ArrowUpRight size={12} className="rtl:-scale-x-100" />
    </Link>
  )
}

/** Six months of money in and out: net profit up top, monthly bars below. */
export default function FinanceSnapshot() {
  const { t, i18n } = useTranslation()
  const { last6Months } = useHomeRanges()
  const { data, isLoading, isError } = useReport('financial', last6Months)
  const fmt = useReportFormats(data?.currency)
  const months = data?.monthly ?? []
  const costs = (m: (typeof months)[number]) => m.expenses + m.instructor_cost
  const peak = Math.max(1, ...months.map((m) => Math.max(m.revenue - m.refunds, costs(m))))
  const profit = data?.totals.net_profit ?? 0

  return (
    <HomeCard
      title={t('dashboard.home.finance.title', 'Finance')}
      subtitle={t('dashboard.home.finance.subtitle', 'Last 6 months')}
      action={<CardLink href="/dash/reports/financial" label={t('dashboard.home.open_report', 'Report')} />}
    >
      {isLoading ? (
        <div className="dash-shimmer h-[220px] rounded-2xl fit:h-auto fit:min-h-0 fit:flex-1" />
      ) : isError || !data ? (
        <p className="text-xs text-[hsl(var(--dash-muted))]">{t('dashboard.stats.load_error', "Couldn't load")}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[hsl(var(--dash-muted))]">{t('dashboard.home.finance.net_profit', 'Net profit')}</p>
              <p
                className="mt-0.5 truncate text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums"
                style={{ color: profit < 0 ? HOME_COLORS.red : HOME_COLORS.ink }}
              >
                {fmt.money(profit)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <DeltaChip current={data.totals.net_profit} previous={data.previous.net_profit} />
              <span className="text-[11px] text-[hsl(var(--dash-muted))]">
                {t('dashboard.home.finance.margin', '{{pct}} margin', { pct: fmt.pct(data.totals.margin_pct) })}
              </span>
            </div>
          </div>

          {/* Revenue (gold) beside costs (ink) per month. */}
          <div className="mt-4 flex min-h-[110px] flex-1 items-end gap-2" dir="ltr" role="img" aria-label={t('dashboard.home.finance.chart_label', 'Revenue and costs by month')}>
            {months.map((m) => (
              <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end justify-center gap-[3px]">
                  <span
                    className="w-full max-w-3 rounded-t-md"
                    style={{ height: `${((m.revenue - m.refunds) / peak) * 100}%`, minHeight: 2, background: `linear-gradient(to top, ${HOME_COLORS.goldDeep}, ${HOME_COLORS.gold})` }}
                    title={`${fmt.month(m.month)} · ${fmt.money(m.revenue - m.refunds)}`}
                  />
                  <span
                    className="w-full max-w-3 rounded-t-md"
                    style={{ height: `${(costs(m) / peak) * 100}%`, minHeight: 2, background: HOME_COLORS.ink }}
                    title={`${fmt.month(m.month)} · ${fmt.money(costs(m))}`}
                  />
                </div>
                <span className="truncate text-[10px] text-[hsl(var(--dash-muted))]">{monthLabel(m.month, i18n.language)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: t('dashboard.home.finance.revenue', 'Revenue'), value: data.totals.net_revenue, color: HOME_COLORS.gold },
              { label: t('dashboard.home.finance.costs', 'Costs'), value: data.totals.total_costs, color: HOME_COLORS.ink },
            ].map((row) => (
              <div key={row.label} className="rounded-xl bg-[hsl(var(--dash-canvas))]/70 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--dash-muted))]">
                  <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                  {row.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[hsl(var(--dash-ink))]">{fmt.money(row.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </HomeCard>
  )
}
