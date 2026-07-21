'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getStripeOverview,
  getStripeChargesForAnalytics,
  getOrgCustomers,
} from '@services/payments/payments'
import { getInstructorFinanceSummary } from '@services/instructors/instructors'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { Button } from '@components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Download,
  Percent,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  DateRangeKey,
  StripeCharge,
  aggregateFinanceKpis,
  buildDailySeries,
  buildOfferRevenueRows,
  buildStatusSlices,
  filterChargesByRange,
} from '@/lib/finance/aggregate'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'

function fmt(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: any
  color: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center space-x-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-900 tracking-tight truncate">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 min-h-[300px] overflow-hidden min-w-0">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  )
}

const RANGES: { id: DateRangeKey; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
]

function StripeUnavailable() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl py-10 text-center space-y-1">
      <AlertCircle size={20} className="mx-auto text-gray-400" />
      <p className="text-sm text-gray-500">
        Could not reach Stripe. Check your connection or configuration.
      </p>
    </div>
  )
}

export default function FinanceOverviewTab({
  orgId,
  accessToken,
}: {
  orgId: number
  accessToken: string
}) {
  const [range, setRange] = useState<DateRangeKey>('30d')

  const overviewQuery = useQuery({
    queryKey: ['stripe', 'overview', orgId],
    queryFn: () => getStripeOverview(orgId, accessToken),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
  })

  const chargesQuery = useQuery({
    queryKey: ['stripe', 'charges-analytics', orgId],
    queryFn: () => getStripeChargesForAnalytics(orgId, accessToken),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
  })

  const customersQuery = useQuery({
    queryKey: ['payments', 'customers', orgId, 'finance'],
    queryFn: () => getOrgCustomers(orgId, accessToken),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
  })

  const instructorQuery = useQuery({
    queryKey: ['instructor-finance', 'summary', orgId],
    queryFn: () => getInstructorFinanceSummary(orgId, accessToken),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
    retry: false,
  })

  const isLoading = overviewQuery.isLoading || chargesQuery.isLoading
  const hasHardError = overviewQuery.isError && chargesQuery.isError

  const overview = overviewQuery.data as any
  const allCharges: StripeCharge[] = useMemo(() => {
    const fromAnalytics = (chargesQuery.data || []) as StripeCharge[]
    if (fromAnalytics.length) return fromAnalytics
    return (overview?.recent_charges || []) as StripeCharge[]
  }, [chargesQuery.data, overview])

  const filteredCharges = useMemo(
    () => filterChargesByRange(allCharges, range),
    [allCharges, range],
  )

  const instructorCost = Number(instructorQuery.data?.total_amount) || 0

  const kpis = useMemo(
    () => aggregateFinanceKpis(filteredCharges, overview || null, instructorCost),
    [filteredCharges, overview, instructorCost],
  )

  const daily = useMemo(() => buildDailySeries(filteredCharges, range), [filteredCharges, range])
  const statusSlices = useMemo(() => buildStatusSlices(filteredCharges), [filteredCharges])
  const offerRows = useMemo(
    () => buildOfferRevenueRows(customersQuery.data || []),
    [customersQuery.data],
  )

  const recent = useMemo(
    () =>
      [...filteredCharges]
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .slice(0, 12),
    [filteredCharges],
  )

  const exportSummary = () => {
    const csv = toCsv(
      ['metric', 'value', 'currency', 'range'],
      [
        ['gross_revenue', kpis.grossRevenue.toFixed(2), kpis.currency, range],
        ['refunded', kpis.refunded.toFixed(2), kpis.currency, range],
        ['net_collected', kpis.netCollected.toFixed(2), kpis.currency, range],
        ['instructor_cost', kpis.instructorCost.toFixed(2), kpis.currency, range],
        ['estimated_profit', kpis.estimatedProfit.toFixed(2), kpis.currency, range],
        ['estimated_margin_pct', kpis.estimatedMargin.toFixed(2), '%', range],
        ['mrr', kpis.mrr.toFixed(2), kpis.currency, range],
        ['arr', kpis.arr.toFixed(2), kpis.currency, range],
        ['active_subscribers', kpis.activeSubscribers, '', range],
        ['total_customers', kpis.totalCustomers, '', range],
        ['churn_30d', kpis.churn30d, '', range],
        ['paid_count', kpis.paidCount, '', range],
        ['failed_count', kpis.failedCount, '', range],
        ['success_rate_pct', kpis.successRate.toFixed(2), '%', range],
        ['average_order_value', kpis.averageOrderValue.toFixed(2), kpis.currency, range],
      ],
    )
    downloadCsv(`finance_summary_${range}.csv`, csv)
  }

  const exportDaily = () => {
    const csv = toCsv(
      ['date', 'gross', 'refunded', 'net', 'transactions', 'currency'],
      daily.map((d) => [
        d.date,
        d.gross.toFixed(2),
        d.refunded.toFixed(2),
        d.net.toFixed(2),
        d.count,
        kpis.currency,
      ]),
    )
    downloadCsv(`finance_daily_${range}.csv`, csv)
  }

  const exportTransactions = () => {
    const csv = toCsv(
      ['date', 'customer', 'email', 'amount', 'refunded', 'currency', 'status', 'description'],
      filteredCharges.map((ch) => [
        ch.created,
        ch.customer?.name || '',
        ch.customer?.email || '',
        Number(ch.amount) || 0,
        Number(ch.amount_refunded) || 0,
        (ch.currency || kpis.currency).toUpperCase(),
        ch.paid ? 'paid' : ch.status || '',
        ch.description || '',
      ]),
    )
    downloadCsv(`finance_transactions_${range}.csv`, csv)
  }

  const exportOffers = () => {
    const csv = toCsv(
      ['offer', 'type', 'enrollments', 'estimated_revenue', 'currency'],
      offerRows.map((r) => [r.offer, r.type, r.count, r.revenue.toFixed(2), r.currency]),
    )
    downloadCsv(`finance_offers_${range}.csv`, csv)
  }

  if (isLoading) return <PageLoading />
  if (hasHardError) return <StripeUnavailable />

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportSummary}>
            <Download size={14} className="mr-1.5" /> Summary CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportDaily}>
            <Download size={14} className="mr-1.5" /> Daily CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportTransactions}>
            <Download size={14} className="mr-1.5" /> Transactions CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportOffers}>
            <Download size={14} className="mr-1.5" /> Offers CSV
          </Button>
        </div>
      </div>

      {/* KPI cards — revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <MetricCard
          label="Gross revenue"
          value={fmt(kpis.grossRevenue, kpis.currency)}
          sub={`${kpis.paidCount} paid transactions`}
          icon={DollarSign}
          color="bg-green-100 text-green-600"
        />
        <MetricCard
          label="Refunds"
          value={fmt(kpis.refunded, kpis.currency)}
          sub={`${kpis.refundCount} refunded charges`}
          icon={TrendingDown}
          color="bg-purple-100 text-purple-600"
        />
        <MetricCard
          label="Net collected"
          value={fmt(kpis.netCollected, kpis.currency)}
          sub="Gross − refunds"
          icon={Wallet}
          color="bg-emerald-100 text-emerald-600"
        />
        <MetricCard
          label="Avg. order value"
          value={fmt(kpis.averageOrderValue, kpis.currency)}
          sub={`${kpis.successRate.toFixed(0)}% success rate`}
          icon={Activity}
          color="bg-sky-100 text-sky-600"
        />
      </div>

      {/* KPI cards — recurring + profit */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard
          label="MRR"
          value={fmt(kpis.mrr, kpis.currency)}
          icon={TrendingUp}
          color="bg-blue-100 text-blue-600"
        />
        <MetricCard
          label="ARR"
          value={fmt(kpis.arr, kpis.currency)}
          icon={TrendingUp}
          color="bg-indigo-100 text-indigo-600"
        />
        <MetricCard
          label="Active subscribers"
          value={String(kpis.activeSubscribers)}
          icon={RefreshCcw}
          color="bg-violet-100 text-violet-600"
        />
        <MetricCard
          label="Customers"
          value={String(kpis.totalCustomers)}
          icon={Users}
          color="bg-purple-100 text-purple-600"
        />
        <MetricCard
          label="Instructor cost"
          value={fmt(kpis.instructorCost, kpis.currency)}
          sub={instructorQuery.isError ? 'Unavailable' : 'From work logs'}
          icon={Users}
          color="bg-amber-100 text-amber-700"
        />
        <MetricCard
          label="Est. profit"
          value={fmt(kpis.estimatedProfit, kpis.currency)}
          sub={`${kpis.estimatedMargin.toFixed(0)}% margin · excl. Stripe fees`}
          icon={Percent}
          color={
            kpis.estimatedProfit >= 0
              ? 'bg-teal-100 text-teal-700'
              : 'bg-red-100 text-red-600'
          }
        />
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        Estimated profit = net collected − instructor delivery cost. Stripe processor fees, taxes,
        and other expenses are not included yet. Churned (30d): {kpis.churn30d}.
      </p>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartCard
            title="Revenue over time"
            subtitle="Gross, refunds, and net collected by day"
          >
            {daily.every((d) => d.gross === 0 && d.refunded === 0) ? (
              <div className="h-52 flex items-center justify-center text-sm text-gray-300">
                No transactions in this range
              </div>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="#9ca3af"
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#9ca3af"
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        fmt(Number(value) || 0, kpis.currency),
                        name,
                      ]}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #f3f4f6',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="gross"
                      name="Gross"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="transparent"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="refunded"
                      name="Refunds"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fill="transparent"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#netGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Payment status mix" subtitle="Share of charges by outcome">
          {statusSlices.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-300">
              No status data
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {statusSlices.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Daily gross vs refunds"
          subtitle="Bar comparison for the selected period"
        >
          {daily.every((d) => d.gross === 0 && d.refunded === 0) ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-300">
              No data
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      fmt(Number(value) || 0, kpis.currency),
                      name,
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #f3f4f6',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="gross" name="Gross" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="refunded" name="Refunds" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Revenue by offer"
          subtitle="Estimated from active/completed enrollments"
        >
          {offerRows.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-300">
              No offer enrollments yet
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={offerRows.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 8, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="offer"
                    width={110}
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    formatter={(value: any) => fmt(Number(value) || 0, kpis.currency)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6' }}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Offer table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">Offer performance</span>
          <span className="text-xs text-gray-400">From enrollments</span>
        </div>
        {offerRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No offers with enrollments</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Est. revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerRows.map((row) => (
                <TableRow key={`${row.offer}-${row.type}`}>
                  <TableCell className="font-medium">{row.offer}</TableCell>
                  <TableCell className="capitalize text-sm text-gray-600">{row.type}</TableCell>
                  <TableCell>{row.count}</TableCell>
                  <TableCell className="font-semibold">
                    {fmt(row.revenue, row.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">Recent transactions</span>
          <span className="text-xs text-gray-400">
            Showing {recent.length} of {filteredCharges.length} in range
          </span>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No transactions yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((ch) => (
              <div
                key={ch.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      ch.paid ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {ch.paid ? (
                      <CheckCircle2 size={13} className="text-green-600" />
                    ) : (
                      <AlertCircle size={13} className="text-red-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {ch.customer?.name ?? ch.customer?.email ?? ch.customer?.id ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-400">{fmtDate(ch.created)}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  {(Number(ch.amount_refunded) || 0) > 0 && (
                    <span className="text-xs text-purple-600">
                      −{fmt(Number(ch.amount_refunded), ch.currency || kpis.currency)}
                    </span>
                  )}
                  <span className="font-semibold text-gray-900">
                    {fmt(Number(ch.amount) || 0, ch.currency || kpis.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
