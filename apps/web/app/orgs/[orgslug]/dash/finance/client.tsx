'use client'

import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Download,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  Activity,
} from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getFinanceSummary,
  listCourseProfits,
  listFinanceEntries,
  type FinanceEntryPayload,
  type FinanceLedgerEntry,
} from '@services/finance/ledger'
import { getOffers } from '@services/payments/offers'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'
import {
  CoursesProfitPanel,
  PayrollPanel,
  ProfitLossPanel,
  RefundsPanel,
} from './reports'

type RangeKey = '7d' | '30d' | '90d' | 'all'
type SectionTab = 'overview' | 'pl' | 'courses' | 'payroll' | 'refunds'

const REVENUE_CATEGORIES = [
  'tuition',
  'subscription',
  'registration',
  'offer',
  'donation',
  'other',
]
const EXPENSE_CATEGORIES = [
  'marketing',
  'rent',
  'salaries',
  'tools',
  'travel',
  'other',
]

function fmt(amount: number, currency = 'EGP') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'EGP').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function rangeBounds(key: RangeKey): { date_from?: string; date_to?: string } {
  if (key === 'all') return {}
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  return {
    date_from: start.toISOString().slice(0, 10),
    date_to: end.toISOString().slice(0, 10),
  }
}

const BRAND = {
  gold: '#c9a227',
  red: '#ce1126',
  black: '#111111',
  muted: '#6b6b6b',
  grid: '#e8e2d4',
  tick: '#6b6b6b',
} as const

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
    <div className="dash-lift dash-glass flex items-center gap-4 rounded-[var(--dash-radius)] px-5 py-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xl font-bold tracking-tight text-[hsl(var(--dash-ink))]">{value}</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--dash-muted))]">
          {label}
        </div>
        {sub && <div className="mt-0.5 text-xs text-[hsl(var(--dash-muted))]/75">{sub}</div>}
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
    <div className="dash-glass min-h-[300px] min-w-0 overflow-hidden rounded-[var(--dash-radius)] p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">{subtitle}</p>
          ) : null}
        </div>
        <span className="mt-0.5 h-1.5 w-8 shrink-0 rounded-full bg-gradient-to-r from-[hsl(var(--dash-accent))] via-white to-[hsl(var(--dash-warn))]" />
      </div>
      {children}
    </div>
  )
}

/** Segmented pill tabs used for section / range / type filters. */
function PillGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (_v: T) => void
}) {
  return (
    <div className="dash-glass flex w-fit items-center gap-1 overflow-x-auto rounded-full p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-200 ${
            value === id
              ? 'bg-[hsl(var(--dash-ink))] text-[hsl(var(--auth-gold))] shadow-[0_4px_14px_hsl(0_0%_0%/0.18)]'
              : 'text-[hsl(var(--dash-muted))] hover:bg-[hsl(var(--dash-accent-soft))] hover:text-[hsl(var(--dash-ink))]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Shimmer skeleton shown while the overview data loads. */
function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="dash-shimmer h-9 w-64 rounded-full" />
        <div className="dash-shimmer h-9 w-44 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="dash-shimmer h-[84px] rounded-[var(--dash-radius)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="dash-shimmer h-[280px] rounded-[var(--dash-radius)] xl:col-span-2" />
        <div className="dash-shimmer h-[280px] rounded-[var(--dash-radius)]" />
      </div>
      <div className="dash-shimmer h-64 rounded-[var(--dash-radius)]" />
    </div>
  )
}

function EntryForm({
  orgId,
  accessToken,
  onDone,
}: {
  orgId: number
  accessToken: string
  onDone: () => void
}) {
  const [form, setForm] = useState<FinanceEntryPayload>({
    entry_type: 'revenue',
    category: 'tuition',
    title: '',
    amount: 0,
    currency: 'EGP',
    entry_date: todayISO(),
    payment_method: 'cash',
    status: 'recorded',
  })
  const [saving, setSaving] = useState(false)

  const { data: offers } = useQuery({
    queryKey: ['finance-offers-optional', orgId],
    queryFn: async () => {
      try {
        return await getOffers(orgId, accessToken)
      } catch {
        return []
      }
    },
    enabled: !!orgId && !!accessToken,
    staleTime: 60_000,
    retry: false,
  })

  const categories = form.entry_type === 'revenue' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES
  const inputCls =
    'w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30 focus:border-[hsl(var(--dash-accent))]/50'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!(Number(form.amount) >= 0)) {
      toast.error('Amount must be >= 0')
      return
    }
    setSaving(true)
    try {
      await createFinanceEntry(
        orgId,
        {
          ...form,
          amount: Number(form.amount),
          offer_uuid: form.offer_uuid || undefined,
        },
        accessToken
      )
      toast.success('Entry saved')
      onDone()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Type</span>
          <select
            className={inputCls}
            value={form.entry_type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                entry_type: e.target.value as 'revenue' | 'expense',
                category: e.target.value === 'revenue' ? 'tuition' : 'other',
              }))
            }
          >
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Category</span>
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-[hsl(var(--dash-muted))]">Title</span>
        <input
          className={inputCls}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
          placeholder="e.g. July cohort tuition"
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Amount</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Currency</span>
          <select
            className={inputCls}
            value={form.currency === 'USD' ? 'USD' : 'EGP'}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            <option value="EGP">Egyptian Pound (EGP)</option>
            <option value="USD">US Dollar (USD)</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Date</span>
          <input
            type="date"
            className={inputCls}
            value={form.entry_date}
            onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
            required
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Payment method</span>
          <select
            className={inputCls}
            value={form.payment_method || 'cash'}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="check">Check</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-[hsl(var(--dash-muted))]">Linked offer (optional)</span>
          <select
            className={inputCls}
            value={form.offer_uuid || ''}
            onChange={(e) => setForm((f) => ({ ...f, offer_uuid: e.target.value || undefined }))}
          >
            <option value="">None</option>
            {(Array.isArray(offers) ? offers : []).map((o: any) => (
              <option key={o.offer_uuid || o.id} value={o.offer_uuid || o.id}>
                {o.name || o.offer_uuid}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-[hsl(var(--dash-muted))]">Notes</span>
        <textarea
          className={inputCls}
          rows={3}
          value={form.description || ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="dash-lift inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-5 py-2 text-sm font-semibold text-[hsl(var(--auth-gold))] shadow-[0_4px_14px_hsl(0_0%_0%/0.2)] hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </form>
  )
}

export default function FinanceClient({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const orgId = org?.id as number | undefined
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  const [range, setRange] = useState<RangeKey>('30d')
  const [section, setSection] = useState<SectionTab>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'revenue' | 'expense'>('all')

  const bounds = useMemo(() => rangeBounds(range), [range])

  const summaryQuery = useQuery({
    queryKey: ['finance-summary', orgId, bounds.date_from, bounds.date_to],
    queryFn: () =>
      getFinanceSummary(orgId!, accessToken!, {
        date_from: bounds.date_from,
        date_to: bounds.date_to,
        include_instructor_cost: true,
      }),
    enabled: !!orgId && !!accessToken && section === 'overview',
    staleTime: 15_000,
  })

  const entriesQuery = useQuery({
    queryKey: ['finance-entries', orgId, bounds.date_from, bounds.date_to, typeFilter],
    queryFn: () =>
      listFinanceEntries(orgId!, accessToken!, {
        date_from: bounds.date_from,
        date_to: bounds.date_to,
        entry_type: typeFilter === 'all' ? undefined : typeFilter,
      }),
    enabled: !!orgId && !!accessToken && section === 'overview',
    staleTime: 15_000,
  })

  const coursesQuery = useQuery({
    queryKey: ['finance-courses-overview', orgId, bounds.date_from, bounds.date_to],
    queryFn: () =>
      listCourseProfits(orgId!, accessToken!, {
        date_from: bounds.date_from,
        date_to: bounds.date_to,
      }),
    enabled: !!orgId && !!accessToken && section === 'overview',
    staleTime: 15_000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance-summary', orgId] })
    queryClient.invalidateQueries({ queryKey: ['finance-entries', orgId] })
    queryClient.invalidateQueries({ queryKey: ['finance-pl', orgId] })
    queryClient.invalidateQueries({ queryKey: ['finance-courses', orgId] })
    queryClient.invalidateQueries({ queryKey: ['finance-courses-overview', orgId] })
    queryClient.invalidateQueries({ queryKey: ['finance-refunds', orgId] })
    queryClient.invalidateQueries({ queryKey: ['finance-payroll', orgId] })
  }

  const summary = summaryQuery.data
  const entries = (entriesQuery.data || []) as FinanceLedgerEntry[]
  const currency = summary?.currency || 'EGP'

  const pieData = useMemo(() => {
    const cats = summary?.by_category || []
    return cats
      .filter((c) => c.entry_type === 'revenue')
      .map((c, i) => ({
        name: c.category,
        value: c.total,
        color: [BRAND.gold, BRAND.red, BRAND.black, '#e8c547', '#8b1e2d', BRAND.muted][i % 6],
      }))
  }, [summary])

  const expenseBars = useMemo(() => {
    return (summary?.by_category || [])
      .filter((c) => c.entry_type === 'expense')
      .map((c) => ({ category: c.category, total: c.total }))
  }, [summary])

  const daily = useMemo(() => {
    return (summary?.daily || []).map((d) => ({
      ...d,
      label: d.date.slice(5),
    }))
  }, [summary])

  const costComposition = useMemo(() => {
    const expenses = summary?.total_expenses || 0
    const instructorCost = summary?.instructor_cost || 0
    const profit = Math.max(summary?.estimated_profit || 0, 0)
    const loss = Math.max(-(summary?.estimated_profit || 0), 0)
    return [
      {
        name: 'Revenue use',
        expenses,
        instructor: instructorCost,
        profit,
        loss,
      },
    ]
  }, [summary])

  const programRevenue = useMemo(() => {
    const buckets = {
      training: 0,
      postgraduate: 0,
      unassigned: 0,
    }
    for (const course of coursesQuery.data || []) {
      const amount = Number(course.net_revenue) || 0
      if (course.program_type === 'training') buckets.training += amount
      else if (course.program_type === 'postgraduate') buckets.postgraduate += amount
      else buckets.unassigned += amount
    }
    return [
      { name: 'Training', value: buckets.training, color: BRAND.gold },
      { name: 'Postgraduate', value: buckets.postgraduate, color: BRAND.red },
      { name: 'Unassigned', value: buckets.unassigned, color: BRAND.muted },
    ].filter((slice) => slice.value > 0)
  }, [coursesQuery.data])

  const removeEntry = async (entry: FinanceLedgerEntry) => {
    if (!accessToken) return
    if (!confirm(`Delete "${entry.title}"?`)) return
    try {
      await deleteFinanceEntry(entry.entry_uuid, accessToken)
      toast.success('Deleted')
      refresh()
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  const exportSummary = () => {
    if (!summary) return
    const csv = toCsv(
      ['metric', 'value', 'currency', 'range'],
      [
        ['total_revenue', summary.total_revenue, summary.currency, range],
        ['total_expenses', summary.total_expenses, summary.currency, range],
        ['instructor_cost', summary.instructor_cost, summary.currency, range],
        ['estimated_profit', summary.estimated_profit, summary.currency, range],
        ['estimated_margin_pct', summary.estimated_margin, '%', range],
      ]
    )
    downloadCsv(`local_finance_summary_${range}.csv`, csv)
  }

  const exportEntries = () => {
    const csv = toCsv(
      [
        'date',
        'type',
        'category',
        'title',
        'amount',
        'currency',
        'payment_method',
        'status',
        'offer_uuid',
        'description',
      ],
      entries.map((e) => [
        e.entry_date,
        e.entry_type,
        e.category,
        e.title,
        e.amount,
        e.currency,
        e.payment_method,
        e.status,
        e.offer_uuid,
        e.description,
      ])
    )
    downloadCsv(`local_finance_entries_${range}.csv`, csv)
  }

  if (!orgId || !accessToken) return <PageLoading />
  const overviewLoading =
    section === 'overview' &&
    (summaryQuery.isLoading || entriesQuery.isLoading || coursesQuery.isLoading)

  return (
    <div className="finance-shell flex h-screen w-full flex-col bg-[hsl(var(--dash-canvas))]">
      <div className="dash-glass z-10 flex-shrink-0 px-4 tracking-tight sm:px-10">
        <div className="pb-4 pt-6">
          <Breadcrumbs
            items={[
              {
                label: 'Finance',
                href: getUriWithOrg(orgslug, '/dash/finance'),
                icon: <Wallet size={14} />,
              },
            ]}
          />
        </div>
        <div className="my-2 flex flex-wrap items-end justify-between gap-3 py-2">
          <div>
            <div className="flex pt-1 text-2xl font-semibold tracking-tight text-[hsl(var(--dash-ink))] sm:text-[1.75rem]">
              Finance
            </div>
            <div className="flex text-sm text-[hsl(var(--dash-muted))]">
              Local reporting — ledger, P&amp;L, course profit, payroll &amp; refunds (no gateways)
            </div>
          </div>
          {section === 'overview' && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <button
                type="button"
                onClick={exportSummary}
                className="dash-glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-[hsl(var(--dash-muted))] transition-colors hover:text-[hsl(var(--dash-ink))]"
              >
                <Download size={14} /> Summary CSV
              </button>
              <button
                type="button"
                onClick={exportEntries}
                className="dash-glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-[hsl(var(--dash-muted))] transition-colors hover:text-[hsl(var(--dash-ink))]"
              >
                <Download size={14} /> Entries CSV
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="dash-lift inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-4 py-2 text-xs font-semibold text-[hsl(var(--auth-gold))] shadow-[0_4px_14px_hsl(0_0%_0%/0.2)] hover:brightness-110"
              >
                <Plus size={14} /> Add entry
              </button>
            </div>
          )}
        </div>
        <div className="mb-4">
          <PillGroup
            value={section}
            onChange={setSection}
            options={[
              ['overview', 'Overview'],
              ['pl', 'P&L'],
              ['courses', 'Courses'],
              ['payroll', 'Payroll'],
              ['refunds', 'Refunds'],
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
        {(section === 'pl' || section === 'courses') && (
          <PillGroup
            value={range}
            onChange={setRange}
            options={(['7d', '30d', '90d', 'all'] as RangeKey[]).map(
              (r) => [r, r === 'all' ? 'All time' : r] as [RangeKey, string]
            )}
          />
        )}
        {section === 'pl' && orgId && accessToken && (
          <ProfitLossPanel orgId={orgId} accessToken={accessToken} bounds={bounds} />
        )}
        {section === 'courses' && orgId && accessToken && (
          <CoursesProfitPanel orgId={orgId} accessToken={accessToken} bounds={bounds} />
        )}
        {section === 'payroll' && orgId && accessToken && (
          <PayrollPanel orgId={orgId} accessToken={accessToken} />
        )}
        {section === 'refunds' && orgId && accessToken && (
          <RefundsPanel orgId={orgId} accessToken={accessToken} />
        )}

        {overviewLoading && <OverviewSkeleton />}

        {section === 'overview' && !overviewLoading && (
          <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PillGroup
            value={range}
            onChange={setRange}
            options={(['7d', '30d', '90d', 'all'] as RangeKey[]).map(
              (r) => [r, r === 'all' ? 'All time' : r] as [RangeKey, string]
            )}
          />
          <PillGroup
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ['all', 'All'],
              ['revenue', 'Revenue'],
              ['expense', 'Expense'],
            ]}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard
            label="Revenue"
            value={fmt(summary?.total_revenue || 0, currency)}
            sub={`${summary?.revenue_count || 0} entries`}
            icon={TrendingUp}
            color="bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]"
          />
          <MetricCard
            label="Expenses"
            value={fmt(summary?.total_expenses || 0, currency)}
            sub={`${summary?.expense_count || 0} entries`}
            icon={TrendingDown}
            color="bg-[hsl(var(--dash-tile-rose))] text-[hsl(var(--dash-tile-rose-fg))]"
          />
          <MetricCard
            label="Instructor cost"
            value={fmt(summary?.instructor_cost || 0, currency)}
            sub="From work logs"
            icon={Users}
            color="bg-[hsl(var(--dash-tile-amber))] text-[hsl(var(--dash-tile-amber-fg))]"
          />
          <MetricCard
            label="Est. profit"
            value={fmt(summary?.estimated_profit || 0, currency)}
            sub="Revenue − expenses − instructors"
            icon={Wallet}
            color={
              (summary?.estimated_profit || 0) >= 0
                ? 'bg-[hsl(var(--dash-tile-lavender))] text-[hsl(var(--dash-tile-lavender-fg))]'
                : 'bg-[hsl(var(--dash-tile-rose))] text-[hsl(var(--dash-tile-rose-fg))]'
            }
          />
          <MetricCard
            label="Margin"
            value={`${(summary?.estimated_margin || 0).toFixed(0)}%`}
            sub="Of revenue"
            icon={Percent}
            color="bg-[hsl(var(--dash-tile-sky))] text-[hsl(var(--dash-tile-sky-fg))]"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <ChartCard
              title="Revenue vs expenses"
              subtitle="Daily comparison with net trend line"
            >
              {daily.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-[hsl(var(--dash-muted))]/60">
                  No entries in this range — add revenue or expenses
                </div>
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BRAND.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={BRAND.tick} />
                      <YAxis tick={{ fontSize: 11 }} stroke={BRAND.tick} />
                      <Tooltip
                        formatter={(v: any, n: any) => [fmt(Number(v) || 0, currency), n]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill={BRAND.gold}
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="expenses"
                        name="Expenses"
                        fill={BRAND.red}
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name="Net"
                        stroke={BRAND.black}
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <ChartCard
            title="Cost composition"
            subtitle="How revenue splits into costs and profit"
          >
            {(summary?.total_revenue || 0) <= 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[hsl(var(--dash-muted))]/60">
                No revenue yet
              </div>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={costComposition} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BRAND.grid} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      stroke={BRAND.tick}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 11 }}
                      stroke={BRAND.tick}
                    />
                    <Tooltip formatter={(v: any) => fmt(Number(v) || 0, currency)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      stackId="cost"
                      fill={BRAND.red}
                    />
                    <Bar
                      dataKey="instructor"
                      name="Instructor"
                      stackId="cost"
                      fill="#e8c547"
                    />
                    <Bar
                      dataKey="profit"
                      name="Profit"
                      stackId="cost"
                      fill={BRAND.gold}
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="loss"
                      name="Loss"
                      stackId="cost"
                      fill={BRAND.muted}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ChartCard title="Revenue by category" subtitle="Ledger revenue mix">
            {pieData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[hsl(var(--dash-muted))]/60">No revenue yet</div>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78}>
                      {pieData.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v) || 0, currency)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Expenses by category" subtitle="Where money goes">
            {expenseBars.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[hsl(var(--dash-muted))]/60">No expenses yet</div>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expenseBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BRAND.grid} vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke={BRAND.tick} />
                    <YAxis tick={{ fontSize: 11 }} stroke={BRAND.tick} />
                    <Tooltip formatter={(v: any) => fmt(Number(v) || 0, currency)} />
                    <Bar dataKey="total" name="Expenses" fill={BRAND.red} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Training vs postgraduate"
            subtitle="Course revenue by program type"
          >
            {programRevenue.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[hsl(var(--dash-muted))]/60">
                No course-linked revenue yet
              </div>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={programRevenue}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={78}
                    >
                      {programRevenue.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v) || 0, currency)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="dash-glass overflow-hidden rounded-[var(--dash-radius)]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--dash-border))] px-5 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--dash-ink))]">
              <Activity size={14} className="text-[hsl(var(--dash-accent))]" /> Ledger entries
            </span>
            <span className="text-xs text-[hsl(var(--dash-muted))]">{entries.length} rows</span>
          </div>
          {entries.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[hsl(var(--dash-muted))]">
              No entries yet. Click “Add entry” to record revenue or expenses.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.entry_uuid}>
                    <TableCell className="text-sm text-[hsl(var(--dash-muted))] whitespace-nowrap">{e.entry_date}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          e.entry_type === 'revenue'
                            ? 'bg-[hsl(var(--dash-tile-mint))] text-[hsl(var(--dash-tile-mint-fg))]'
                            : 'bg-[hsl(var(--dash-tile-rose))] text-[hsl(var(--dash-tile-rose-fg))]'
                        }`}
                      >
                        {e.entry_type}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{e.category}</TableCell>
                    <TableCell className="font-medium">
                      <div>{e.title}</div>
                      {e.offer_uuid && (
                        <div className="text-xs text-[hsl(var(--dash-muted))]">Offer: {e.offer_uuid}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-[hsl(var(--dash-muted))] capitalize">
                      {(e.payment_method || '—').replace('_', ' ')}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {fmt(Number(e.amount) || 0, e.currency || currency)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => void removeEntry(e)}
                        className="text-[hsl(var(--dash-muted))] hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
          </>
        )}
      </div>

      <Modal
        isDialogOpen={modalOpen}
        onOpenChange={setModalOpen}
        minHeight="md"
        dialogContent={
          orgId && accessToken ? (
            <EntryForm
              orgId={orgId}
              accessToken={accessToken}
              onDone={() => {
                setModalOpen(false)
                refresh()
              }}
            />
          ) : null
        }
        dialogTitle="Add finance entry"
        dialogDescription="Record local revenue or expenses without Stripe"
      />
    </div>
  )
}
