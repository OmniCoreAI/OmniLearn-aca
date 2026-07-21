'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Download, Lock, X } from 'lucide-react'
import { Button } from '@components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table'
import PageLoading from '@components/Objects/Loaders/PageLoading'
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

  if (isLoading) return <PageLoading />
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
          <div key={String(label)} className="bg-white border rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-lg font-bold">{fmt(Number(value), data.currency)}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
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
                <TableCell className="capitalize text-sm text-gray-500">{l.kind}</TableCell>
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

  if (isLoading) return <PageLoading />

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCourses}>
          <Download size={14} className="mr-1.5" /> Export courses CSV
        </Button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                  No course attribution yet — link ledger/worklogs to courses or set cost config
                </TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.course_uuid}>
                  <TableCell className="font-medium max-w-[220px] truncate">
                    {c.course_name || c.course_uuid}
                  </TableCell>
                  <TableCell>{c.attendees}</TableCell>
                  <TableCell>{fmt(c.net_revenue, c.currency)}</TableCell>
                  <TableCell>
                    {fmt(c.instructor_cost, c.currency)}
                    <div className="text-xs text-gray-400">{c.instructor_hours}h</div>
                  </TableCell>
                  <TableCell>
                    {fmt(c.certification_cost + c.addons_cost, c.currency)}
                  </TableCell>
                  <TableCell>{fmt(c.total_cost, c.currency)}</TableCell>
                  <TableCell
                    className={`font-semibold ${
                      c.net_profit >= 0 ? 'text-teal-700' : 'text-red-600'
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
        <div className="bg-white border rounded-xl p-5 space-y-3 max-w-xl">
          <h3 className="font-semibold text-sm">
            Cost assumptions — {editing.course_name || editing.course_uuid}
          </h3>
          <p className="text-xs text-gray-400">
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
                <span className="text-gray-600">{label}</span>
                <input
                  type="number"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
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

  if (isLoading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="month"
          className="rounded-lg border px-3 py-2 text-sm"
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
        <div className="bg-white border rounded-xl px-4 py-3">
          <div className="text-xs text-gray-500">Total hours</div>
          <div className="text-xl font-bold">{data?.total_hours ?? 0}</div>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3">
          <div className="text-xs text-gray-500">Total pay</div>
          <div className="text-xl font-bold">
            {fmt(data?.total_pay || 0, data?.currency)}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
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
                <TableCell colSpan={4} className="text-center text-gray-400 py-8">
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
                  <TableCell className="text-xs text-gray-500 max-w-[240px] truncate">
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

  if (isLoading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="font-semibold text-sm">Request refund (manual accounting)</h3>
        <p className="text-xs text-gray-400">
          No payment gateway — approval records the refund for reports only.
        </p>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
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
          className="w-full rounded-lg border px-3 py-2 text-sm"
          rows={2}
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit refund request'}
        </Button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
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
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
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
                  <TableCell className="text-sm text-gray-600 max-w-[220px] truncate">
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
