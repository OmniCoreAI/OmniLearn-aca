'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Download, Lock, X } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
  closePayrollMonth,
  createFinanceRefund,
  decideFinanceRefund,
  getPayrollReport,
  getProfitLoss,
  listCourseProfits,
  listFinanceEntries,
  listFinanceRefunds,
  upsertCourseFinanceConfig,
  type CourseProfit,
  type FinanceLedgerEntry,
} from '@services/finance/ledger'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'

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

type Bounds = { date_from?: string; date_to?: string }

const BRAND = {
  gold: '#c9a227',
  red: '#ce1126',
  black: '#111111',
  muted: '#6b6b6b',
  grid: '#e8e2d4',
} as const


function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="dash-glass min-w-0 overflow-hidden rounded-[var(--dash-radius)] p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--dash-muted))]">{subtitle}</p>
        </div>
        <span className="mt-0.5 h-1.5 w-8 shrink-0 rounded-full bg-gradient-to-r from-[hsl(var(--dash-accent))] via-white to-[hsl(var(--dash-warn))]" />
      </div>
      {children}
    </div>
  )
}

/** Shimmer skeleton for report panels — replaces the old blocking spinner. */
function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="dash-shimmer h-[72px] rounded-[var(--dash-radius)]" />
        ))}
      </div>
      <div className="dash-shimmer h-[320px] rounded-[var(--dash-radius)]" />
      <div className="dash-shimmer h-56 rounded-[var(--dash-radius)]" />
    </div>
  )
}

function shortLabel(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function ProfitLossPanel({
  orgId,
  accessToken,
  bounds,
}: {
  orgId: number
  accessToken: string
  bounds: Bounds
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-pl', orgId, bounds.date_from, bounds.date_to],
    queryFn: () => getProfitLoss(orgId, accessToken, bounds),
    enabled: !!orgId && !!accessToken,
  })

  if (isLoading) return <PanelSkeleton />
  if (!data) return null

  const exportPl = () => {
    downloadCsv(
      'finance_profit_loss.csv',
      toCsv(
        ['label', 'amount', 'kind', 'currency'],
        data.lines.map((l) => [l.label, l.amount, l.kind, data.currency])
      )
    )
  }

  const categoryMap = new Map<
    string,
    { category: string; revenue: number; expense: number }
  >()
  data.by_category.forEach((row) => {
    const current = categoryMap.get(row.category) || {
      category: row.category,
      revenue: 0,
      expense: 0,
    }
    if (row.entry_type === 'revenue') current.revenue += row.total
    else current.expense += row.total
    categoryMap.set(row.category, current)
  })
  const categoryChart = [...categoryMap.values()].sort(
    (a, b) => b.revenue + b.expense - (a.revenue + a.expense)
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportPl}>
          <Download size={14} className="mr-1.5" /> Export P&amp;L CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Gross revenue', data.gross_revenue],
          ['Refunds', data.refunds],
          ['Net revenue', data.net_revenue],
          ['Net profit', data.net_profit],
        ].map(([label, value]) => (
          <div key={String(label)} className="dash-lift rounded-[var(--dash-radius)] dash-glass px-4 py-3">
            <div className="text-xs text-[hsl(var(--dash-muted))]">{label}</div>
            <div className="text-lg font-bold">{fmt(Number(value), data.currency)}</div>
          </div>
        ))}
      </div>
      <ChartCard
        title="Accounting category mix"
        subtitle="Finance categories classify cash flow; academic relationships are shown under Programs and Courses."
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" tickFormatter={(value) => shortLabel(String(value), 14)} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <Tooltip
                formatter={(value) => fmt(Number(value || 0), data.currency)}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill={BRAND.gold} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill={BRAND.muted} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <div className="overflow-hidden rounded-[var(--dash-radius)] dash-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Line</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lines.map((l) => (
              <TableRow key={l.label}>
                <TableCell className="font-medium">{l.label}</TableCell>
                <TableCell className="capitalize text-sm text-[hsl(var(--dash-muted))]">{l.kind}</TableCell>
                <TableCell className="text-right font-semibold">
                  {l.kind === 'margin'
                    ? `${l.amount.toFixed(1)}%`
                    : fmt(l.amount, data.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function CoursesProfitPanel({
  orgId,
  accessToken,
  bounds,
}: {
  orgId: number
  accessToken: string
  bounds: Bounds
}) {
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useQuery({
    queryKey: ['finance-courses', orgId, bounds.date_from, bounds.date_to],
    queryFn: () => listCourseProfits(orgId, accessToken, bounds),
    enabled: !!orgId && !!accessToken,
  })

  const [editing, setEditing] = useState<CourseProfit | null>(null)
  const [form, setForm] = useState({
    tuition_unit_amount: 0,
    certification_unit_cost: 100,
    addons_unit_cost: 200,
    other_fixed_cost: 0,
    attendees_override: 25,
  })
  const [saving, setSaving] = useState(false)

  const openEdit = (row: CourseProfit) => {
    setEditing(row)
    setForm({
      tuition_unit_amount: 1000,
      certification_unit_cost: 100,
      addons_unit_cost: 200,
      other_fixed_cost: 0,
      attendees_override: Math.max(row.attendees, 1),
    })
  }

  const saveConfig = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await upsertCourseFinanceConfig(
        orgId,
        {
          course_uuid: editing.course_uuid,
          currency: editing.currency || 'EGP',
          ...form,
        },
        accessToken
      )
      toast.success('Course cost config saved')
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['finance-courses', orgId] })
    } catch (err: any) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PanelSkeleton />

  const exportCourses = () => {
    downloadCsv(
      'finance_courses_profit.csv',
      toCsv(
        [
          'course',
          'attendees',
          'net_revenue',
          'instructor_cost',
          'cert_cost',
          'addons_cost',
          'total_cost',
          'net_profit',
          'margin_pct',
        ],
        data.map((c) => [
          c.course_name || c.course_uuid,
          c.attendees,
          c.net_revenue,
          c.instructor_cost,
          c.certification_cost,
          c.addons_cost,
          c.total_cost,
          c.net_profit,
          c.margin_pct,
        ])
      )
    )
  }

  const courseChart = [...data]
    .sort((a, b) => b.net_revenue - a.net_revenue)
    .slice(0, 8)
    .map((course) => ({
      name: shortLabel(course.course_name || course.course_uuid),
      revenue: course.net_revenue,
      cost: course.total_cost,
      profit: course.net_profit,
    }))

  const programMap = new Map<
    string,
    { name: string; revenue: number; cost: number; profit: number }
  >()
  data.forEach((course) => {
    const key = course.program_uuid || `unassigned:${course.course_uuid}`
    const current = programMap.get(key) || {
      name: course.program_name || 'Unassigned course',
      revenue: 0,
      cost: 0,
      profit: 0,
    }
    current.revenue += course.net_revenue
    current.cost += course.total_cost
    current.profit += course.net_profit
    programMap.set(key, current)
  })
  const programChart = [...programMap.values()].sort(
    (a, b) => b.revenue - a.revenue
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCourses}>
          <Download size={14} className="mr-1.5" /> Export courses CSV
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Program performance"
          subtitle="Course results rolled up through actual training and postgraduate relationships."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programChart} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={145}
                  tickFormatter={(value) => shortLabel(String(value), 22)}
                />
                <Tooltip formatter={(value) => fmt(Number(value || 0), data[0]?.currency)} />
                <Legend />
                <Bar dataKey="revenue" name="Net revenue" fill={BRAND.gold} radius={[0, 4, 4, 0]} />
                <Bar dataKey="cost" name="Total cost" fill={BRAND.muted} radius={[0, 4, 4, 0]} />
                <Bar dataKey="profit" name="Net profit" fill={BRAND.black} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard
          title="Course profitability"
          subtitle="Net revenue, total cost, and profit for each related course."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseChart} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                />
                <YAxis dataKey="name" type="category" width={145} />
                <Tooltip formatter={(value) => fmt(Number(value || 0), data[0]?.currency)} />
                <Legend />
                <Bar dataKey="revenue" name="Net revenue" fill={BRAND.gold} />
                <Bar dataKey="cost" name="Total cost" fill={BRAND.muted} />
                <Bar dataKey="profit" name="Net profit" fill={BRAND.black} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
      <div className="overflow-hidden rounded-[var(--dash-radius)] dash-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Attendees</TableHead>
              <TableHead>Net revenue</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Cert + add-ons</TableHead>
              <TableHead>Total cost</TableHead>
              <TableHead>Net profit</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-[hsl(var(--dash-muted))] py-8">
                  No course attribution yet — link ledger/worklogs to courses or set cost config
                </TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.course_uuid}>
                  <TableCell className="max-w-55">
                    <div className="truncate font-medium">
                      {c.program_name || 'Unassigned'}
                    </div>
                    <div className="text-xs capitalize text-[hsl(var(--dash-muted))]">
                      {c.program_type || 'course'}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-55 truncate font-medium">
                    {c.course_name || c.course_uuid}
                  </TableCell>
                  <TableCell>{c.attendees}</TableCell>
                  <TableCell>{fmt(c.net_revenue, c.currency)}</TableCell>
                  <TableCell>
                    {fmt(c.instructor_cost, c.currency)}
                    <div className="text-xs text-[hsl(var(--dash-muted))]">{c.instructor_hours}h</div>
                  </TableCell>
                  <TableCell>
                    {fmt(c.certification_cost + c.addons_cost, c.currency)}
                  </TableCell>
                  <TableCell>{fmt(c.total_cost, c.currency)}</TableCell>
                  <TableCell
                    className={`font-semibold ${
                      c.net_profit >= 0 ? 'text-[hsl(var(--dash-tile-mint-fg))]' : 'text-red-500'
                    }`}
                  >
                    {fmt(c.net_profit, c.currency)}
                  </TableCell>
                  <TableCell>{c.margin_pct.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      Cost config
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <div className="dash-glass max-w-xl space-y-3 rounded-[var(--dash-radius)] p-5">
          <h3 className="font-semibold text-sm">
            Cost assumptions — {editing.course_name || editing.course_uuid}
          </h3>
          <p className="text-xs text-[hsl(var(--dash-muted))]">
            Example: 25 attendees × fee 1000 + snacks 200 + cert 150 cost 100 → builds revenue &amp;
            cost for DSS.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['tuition_unit_amount', 'Tuition / attendee'],
                ['certification_unit_cost', 'Cert unit cost'],
                ['addons_unit_cost', 'Add-ons / attendee'],
                ['other_fixed_cost', 'Other fixed cost'],
                ['attendees_override', 'Attendees override'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm space-y-1">
                <span className="text-[hsl(var(--dash-muted))]">{label}</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30"
                  value={(form as any)[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void saveConfig()} disabled={saving}>
              {saving ? 'Saving…' : 'Save & recompute'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PayrollPanel({
  orgId,
  accessToken,
}: {
  orgId: number
  accessToken: string
}) {
  const now = new Date()
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['finance-payroll', orgId, month],
    queryFn: () => getPayrollReport(orgId, month, accessToken),
    enabled: !!orgId && !!accessToken && !!month,
  })

  const closeMonth = async () => {
    if (!confirm(`Close payroll for ${month}? Closed months are locked.`)) return
    try {
      await closePayrollMonth(orgId, month, accessToken)
      toast.success('Payroll month closed')
      queryClient.invalidateQueries({ queryKey: ['finance-payroll', orgId, month] })
    } catch (err: any) {
      toast.error(err?.message || 'Close failed')
    }
  }

  if (isLoading) return <PanelSkeleton />

  const payrollChart = [...(data?.instructors || [])]
    .sort((a, b) => b.amount - a.amount)
    .map((instructor) => ({
      name: shortLabel(
        instructor.instructor_name || instructor.instructor_uuid || 'Instructor',
        24
      ),
      pay: instructor.amount,
    }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="month"
          className="rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!data) return
              downloadCsv(
                `payroll_${month}.csv`,
                toCsv(
                  ['instructor', 'hours', 'pay', 'currency', 'courses'],
                  data.instructors.map((i) => [
                    i.instructor_name || i.instructor_uuid,
                    i.hours,
                    i.amount,
                    i.currency,
                    (i.courses || []).join('|'),
                  ])
                )
              )
            }}
          >
            <Download size={14} className="mr-1.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => void closeMonth()} disabled={data?.closed}>
            <Lock size={14} className="mr-1.5" />
            {data?.closed ? 'Closed' : 'Close month'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="dash-lift rounded-[var(--dash-radius)] dash-glass px-4 py-3">
          <div className="text-xs text-[hsl(var(--dash-muted))]">Total hours</div>
          <div className="text-xl font-bold">{data?.total_hours ?? 0}</div>
        </div>
        <div className="dash-lift rounded-[var(--dash-radius)] dash-glass px-4 py-3">
          <div className="text-xs text-[hsl(var(--dash-muted))]">Total pay</div>
          <div className="text-xl font-bold">
            {fmt(data?.total_pay || 0, data?.currency)}
          </div>
        </div>
      </div>

      {payrollChart.length > 0 && (
        <ChartCard
          title="Instructor payroll cost"
          subtitle={`Pay by instructor for ${month} (${data?.total_hours || 0} total hours).`}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollChart} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                />
                <YAxis dataKey="name" type="category" width={145} />
                <Tooltip formatter={(value) => fmt(Number(value || 0), data?.currency)} />
                <Legend />
                <Bar dataKey="pay" name="Pay" fill={BRAND.gold} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      <div className="overflow-hidden rounded-[var(--dash-radius)] dash-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instructor</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Pay</TableHead>
              <TableHead>Courses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data?.instructors?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[hsl(var(--dash-muted))] py-8">
                  No work logs in this month
                </TableCell>
              </TableRow>
            ) : (
              data.instructors.map((i, idx) => (
                <TableRow key={i.instructor_uuid || idx}>
                  <TableCell className="font-medium">
                    {i.instructor_name || i.instructor_uuid || '—'}
                  </TableCell>
                  <TableCell>{i.hours}</TableCell>
                  <TableCell>{fmt(i.amount, i.currency || data.currency)}</TableCell>
                  <TableCell className="max-w-60 truncate text-xs text-[hsl(var(--dash-muted))]">
                    {(i.courses || []).join(', ') || '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function RefundsPanel({
  orgId,
  accessToken,
}: {
  orgId: number
  accessToken: string
}) {
  const queryClient = useQueryClient()
  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['finance-refunds', orgId],
    queryFn: () => listFinanceRefunds(orgId, accessToken),
    enabled: !!orgId && !!accessToken,
  })
  const { data: revenues = [] } = useQuery({
    queryKey: ['finance-revenue-for-refund', orgId],
    queryFn: () => listFinanceEntries(orgId, accessToken, { entry_type: 'revenue' }),
    enabled: !!orgId && !!accessToken,
  })

  const [entryUuid, setEntryUuid] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!entryUuid || !reason.trim()) {
      toast.error('Select an entry and enter a reason')
      return
    }
    setSaving(true)
    try {
      await createFinanceRefund(orgId, { entry_uuid: entryUuid, reason }, accessToken)
      toast.success('Refund requested')
      setEntryUuid('')
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['finance-refunds', orgId] })
    } catch (err: any) {
      toast.error(err?.message || 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  const decide = async (
    uuid: string,
    status: 'approved' | 'rejected' | 'recorded'
  ) => {
    try {
      await decideFinanceRefund(uuid, { status }, accessToken)
      toast.success(`Refund ${status}`)
      queryClient.invalidateQueries({ queryKey: ['finance-refunds', orgId] })
      queryClient.invalidateQueries({ queryKey: ['finance-pl', orgId] })
      queryClient.invalidateQueries({ queryKey: ['finance-summary', orgId] })
    } catch (err: any) {
      toast.error(err?.message || 'Decision failed')
    }
  }

  if (isLoading) return <PanelSkeleton />

  return (
    <div className="space-y-6">
      <div className="dash-glass max-w-xl space-y-3 rounded-[var(--dash-radius)] p-5">
        <h3 className="font-semibold text-sm">Request refund (manual accounting)</h3>
        <p className="text-xs text-[hsl(var(--dash-muted))]">
          No payment gateway — approval records the refund for reports only.
        </p>
        <select
          className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30"
          value={entryUuid}
          onChange={(e) => setEntryUuid(e.target.value)}
        >
          <option value="">Select revenue entry…</option>
          {(revenues as FinanceLedgerEntry[]).map((e) => (
            <option key={e.entry_uuid} value={e.entry_uuid}>
              {e.entry_date} — {e.title} ({fmt(e.amount, e.currency)})
            </option>
          ))}
        </select>
        <textarea
          className="w-full rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-surface))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]/30"
          rows={2}
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit refund request'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-[var(--dash-radius)] dash-glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[hsl(var(--dash-muted))] py-8">
                  No refund requests
                </TableCell>
              </TableRow>
            ) : (
              refunds.map((r) => (
                <TableRow key={r.refund_uuid}>
                  <TableCell className="font-medium">
                    {r.entry_title || r.entry_uuid}
                  </TableCell>
                  <TableCell>{fmt(r.amount, r.currency)}</TableCell>
                  <TableCell className="max-w-55 truncate text-sm text-[hsl(var(--dash-muted))]">
                    {r.reason}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{r.status}</TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void decide(r.refund_uuid, 'approved')}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void decide(r.refund_uuid, 'rejected')}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    )}
                    {r.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void decide(r.refund_uuid, 'recorded')}
                      >
                        Mark recorded
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
