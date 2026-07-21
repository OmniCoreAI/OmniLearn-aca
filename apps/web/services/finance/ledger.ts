import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

export type FinanceEntryType = 'revenue' | 'expense'
export type FinanceEntryStatus = 'recorded' | 'pending' | 'cancelled'

export type FinanceLedgerEntry = {
  id: number
  org_id: number
  entry_uuid: string
  entry_type: FinanceEntryType | string
  category: string
  title: string
  amount: number
  currency: string
  entry_date: string
  description?: string | null
  payment_method?: string | null
  status: FinanceEntryStatus | string
  offer_uuid?: string | null
  course_uuid?: string | null
  created_by?: number | null
  creation_date: string
  update_date: string
}

export type FinanceLedgerSummary = {
  org_id: number
  currency: string
  range_from?: string | null
  range_to?: string | null
  total_revenue: number
  total_expenses: number
  instructor_cost: number
  estimated_profit: number
  estimated_margin: number
  entry_count: number
  revenue_count: number
  expense_count: number
  by_category: { category: string; entry_type: string; total: number; count: number }[]
  daily: { date: string; revenue: number; expenses: number; net: number }[]
}

export type FinanceEntryPayload = {
  entry_type: FinanceEntryType
  category: string
  title: string
  amount: number
  currency?: string
  entry_date: string
  description?: string
  payment_method?: string
  status?: FinanceEntryStatus
  offer_uuid?: string
  course_uuid?: string
}

export async function listFinanceEntries(
  orgId: number,
  accessToken: string,
  params?: { entry_type?: string; status?: string; date_from?: string; date_to?: string }
) {
  const qs = new URLSearchParams()
  if (params?.entry_type) qs.set('entry_type', params.entry_type)
  if (params?.status) qs.set('status', params.status)
  if (params?.date_from) qs.set('date_from', params.date_from)
  if (params?.date_to) qs.set('date_to', params.date_to)
  const suffix = qs.toString() ? `?${qs}` : ''
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/entries${suffix}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceLedgerEntry[]>
}

export async function createFinanceEntry(
  orgId: number,
  data: FinanceEntryPayload,
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/entries`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceLedgerEntry>
}

export async function updateFinanceEntry(
  entryUuid: string,
  data: Partial<FinanceEntryPayload>,
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/entries/${encodeURIComponent(entryUuid)}`,
    RequestBodyWithAuthHeader('PUT', data, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceLedgerEntry>
}

export async function deleteFinanceEntry(entryUuid: string, accessToken: string) {
  const result = await fetch(
    `${getAPIUrl()}finance/entries/${encodeURIComponent(entryUuid)}`,
    RequestBodyWithAuthHeader('DELETE', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function getFinanceSummary(
  orgId: number,
  accessToken: string,
  params?: { date_from?: string; date_to?: string; include_instructor_cost?: boolean }
) {
  const qs = new URLSearchParams()
  if (params?.date_from) qs.set('date_from', params.date_from)
  if (params?.date_to) qs.set('date_to', params.date_to)
  if (params?.include_instructor_cost === false) qs.set('include_instructor_cost', 'false')
  const suffix = qs.toString() ? `?${qs}` : ''
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/summary${suffix}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceLedgerSummary>
}

// ---- Reporting extensions (P&L, courses, payroll, refunds) ----

export type ProfitLoss = {
  org_id: number
  currency: string
  gross_revenue: number
  refunds: number
  net_revenue: number
  operating_expenses: number
  instructor_cost: number
  total_costs: number
  net_profit: number
  margin_pct: number
  lines: { label: string; amount: number; kind: string }[]
  by_category: { entry_type: string; category: string; total: number }[]
}

export type CourseProfit = {
  org_id: number
  course_uuid: string
  course_name?: string | null
  program_uuid?: string | null
  program_name?: string | null
  program_type?: 'postgraduate' | 'training' | null
  currency: string
  attendees: number
  certified_attendees: number
  ledger_revenue: number
  ledger_expenses: number
  refunds: number
  net_revenue: number
  instructor_cost: number
  instructor_hours: number
  certification_cost: number
  addons_cost: number
  other_fixed_cost: number
  total_cost: number
  net_profit: number
  margin_pct: number
  revenue_per_attendee: number
  cost_per_attendee: number
}

export type FinanceRefund = {
  id: number
  org_id: number
  refund_uuid: string
  entry_uuid: string
  entry_title?: string | null
  amount: number
  currency: string
  reason: string
  status: string
  decided_at?: string | null
  decision_note?: string | null
  creation_date: string
}

export type PayrollReport = {
  org_id: number
  month: string
  currency: string
  total_hours: number
  total_pay: number
  closed: boolean
  instructors: {
    instructor_uuid?: string | null
    instructor_name?: string | null
    hours: number
    amount: number
    currency?: string | null
    courses: string[]
  }[]
}

function rangeQs(params?: { date_from?: string; date_to?: string }) {
  const qs = new URLSearchParams()
  if (params?.date_from) qs.set('date_from', params.date_from)
  if (params?.date_to) qs.set('date_to', params.date_to)
  return qs.toString() ? `?${qs}` : ''
}

export async function getProfitLoss(
  orgId: number,
  accessToken: string,
  params?: { date_from?: string; date_to?: string }
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/profit-loss${rangeQs(params)}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result) as Promise<ProfitLoss>
}

export async function listCourseProfits(
  orgId: number,
  accessToken: string,
  params?: { date_from?: string; date_to?: string }
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/courses${rangeQs(params)}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result) as Promise<CourseProfit[]>
}

export async function upsertCourseFinanceConfig(
  orgId: number,
  data: {
    course_uuid: string
    currency?: string
    tuition_unit_amount?: number
    certification_unit_cost?: number
    addons_unit_cost?: number
    other_fixed_cost?: number
    attendees_override?: number
    certified_attendees_override?: number
  },
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/courses/config`,
    RequestBodyWithAuthHeader('PUT', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function listFinanceRefunds(
  orgId: number,
  accessToken: string,
  status?: string
) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/refunds${qs}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceRefund[]>
}

export async function createFinanceRefund(
  orgId: number,
  data: { entry_uuid: string; amount?: number; reason: string },
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/refunds`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceRefund>
}

export async function decideFinanceRefund(
  refundUuid: string,
  data: { status: 'approved' | 'rejected' | 'recorded'; decision_note?: string },
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/refunds/${encodeURIComponent(refundUuid)}/decision`,
    RequestBodyWithAuthHeader('PUT', data, null, accessToken)
  )
  return errorHandling(result) as Promise<FinanceRefund>
}

export async function getPayrollReport(
  orgId: number,
  month: string,
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/payroll?month=${encodeURIComponent(month)}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result) as Promise<PayrollReport>
}

export async function closePayrollMonth(
  orgId: number,
  month: string,
  accessToken: string
) {
  const result = await fetch(
    `${getAPIUrl()}finance/org/${orgId}/payroll/${encodeURIComponent(month)}/close`,
    RequestBodyWithAuthHeader('POST', null, null, accessToken)
  )
  return errorHandling(result) as Promise<PayrollReport>
}
