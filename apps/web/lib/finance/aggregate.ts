/**
 * Client-side finance aggregation helpers for the payments dashboard.
 * Built on Stripe charge/subscription payloads + instructor finance summary.
 */

export type DateRangeKey = '7d' | '30d' | '90d' | 'all'

export type StripeCharge = {
  id: string
  amount: number
  amount_refunded?: number
  currency?: string
  paid?: boolean
  status?: string
  created: string
  description?: string | null
  customer?: { id?: string; name?: string | null; email?: string | null } | null
  card?: { brand?: string; last4?: string } | null
  receipt_url?: string | null
}

export type FinanceKpis = {
  currency: string
  grossRevenue: number
  refunded: number
  netCollected: number
  paidCount: number
  failedCount: number
  refundCount: number
  successRate: number
  averageOrderValue: number
  instructorCost: number
  estimatedProfit: number
  estimatedMargin: number
  mrr: number
  arr: number
  activeSubscribers: number
  totalCustomers: number
  churn30d: number
}

export type DailyPoint = {
  date: string
  label: string
  gross: number
  refunded: number
  net: number
  count: number
}

export type StatusSlice = {
  name: string
  value: number
  color: string
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function rangeStart(key: DateRangeKey): Date | null {
  if (key === 'all') return null
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90
  const d = startOfDay(new Date())
  d.setDate(d.getDate() - (days - 1))
  return d
}

export function filterChargesByRange(charges: StripeCharge[], key: DateRangeKey): StripeCharge[] {
  const start = rangeStart(key)
  if (!start) return charges
  return charges.filter((c) => {
    const t = new Date(c.created).getTime()
    return !Number.isNaN(t) && t >= start.getTime()
  })
}

export function detectCurrency(charges: StripeCharge[], fallback = 'USD'): string {
  const paid = charges.find((c) => c.paid && c.currency)
  return (paid?.currency || charges[0]?.currency || fallback).toUpperCase()
}

export function aggregateFinanceKpis(
  charges: StripeCharge[],
  overview: {
    mrr?: number
    arr?: number
    active_subscribers?: number
    total_customers?: number
    churn_30d?: number
    total_revenue?: number
  } | null,
  instructorCost: number,
): FinanceKpis {
  const currency = detectCurrency(charges)

  let grossRevenue = 0
  let refunded = 0
  let paidCount = 0
  let failedCount = 0
  let refundCount = 0

  for (const ch of charges) {
    const amount = Number(ch.amount) || 0
    const refundAmt = Number(ch.amount_refunded) || 0
    if (ch.paid || ch.status === 'succeeded') {
      grossRevenue += amount
      paidCount += 1
      if (refundAmt > 0) {
        refunded += refundAmt
        refundCount += 1
      }
    } else if (ch.status === 'failed' || ch.status === 'canceled' || ch.status === 'cancelled') {
      failedCount += 1
    }
  }

  // If we have no charges in-range but overview total exists and range is "all", prefer overview.
  if (charges.length === 0 && overview?.total_revenue != null) {
    grossRevenue = Number(overview.total_revenue) || 0
  }

  const netCollected = Math.max(0, grossRevenue - refunded)
  const totalAttempted = paidCount + failedCount
  const successRate = totalAttempted > 0 ? (paidCount / totalAttempted) * 100 : 0
  const averageOrderValue = paidCount > 0 ? grossRevenue / paidCount : 0
  const estimatedProfit = netCollected - instructorCost
  const estimatedMargin = netCollected > 0 ? (estimatedProfit / netCollected) * 100 : 0

  return {
    currency,
    grossRevenue,
    refunded,
    netCollected,
    paidCount,
    failedCount,
    refundCount,
    successRate,
    averageOrderValue,
    instructorCost,
    estimatedProfit,
    estimatedMargin,
    mrr: Number(overview?.mrr) || 0,
    arr: Number(overview?.arr) || 0,
    activeSubscribers: Number(overview?.active_subscribers) || 0,
    totalCustomers: Number(overview?.total_customers) || 0,
    churn30d: Number(overview?.churn_30d) || 0,
  }
}

export function buildDailySeries(charges: StripeCharge[], key: DateRangeKey): DailyPoint[] {
  const start = rangeStart(key) ?? (() => {
    if (!charges.length) {
      const d = startOfDay(new Date())
      d.setDate(d.getDate() - 29)
      return d
    }
    const oldest = charges.reduce((min, c) => {
      const t = new Date(c.created).getTime()
      return t < min ? t : min
    }, Date.now())
    return startOfDay(new Date(oldest))
  })()

  const end = startOfDay(new Date())
  const map = new Map<string, DailyPoint>()

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    map.set(iso, {
      date: iso,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gross: 0,
      refunded: 0,
      net: 0,
      count: 0,
    })
  }

  for (const ch of charges) {
    if (!(ch.paid || ch.status === 'succeeded')) continue
    const iso = new Date(ch.created).toISOString().slice(0, 10)
    const point = map.get(iso)
    if (!point) continue
    const amount = Number(ch.amount) || 0
    const refundAmt = Number(ch.amount_refunded) || 0
    point.gross += amount
    point.refunded += refundAmt
    point.net += Math.max(0, amount - refundAmt)
    point.count += 1
  }

  return Array.from(map.values())
}

export function buildStatusSlices(charges: StripeCharge[]): StatusSlice[] {
  let paid = 0
  let refunded = 0
  let failed = 0
  let pending = 0

  for (const ch of charges) {
    const refundAmt = Number(ch.amount_refunded) || 0
    if (refundAmt > 0 && (ch.paid || ch.status === 'succeeded')) {
      refunded += 1
    } else if (ch.paid || ch.status === 'succeeded') {
      paid += 1
    } else if (ch.status === 'pending' || ch.status === 'processing') {
      pending += 1
    } else {
      failed += 1
    }
  }

  return [
    { name: 'Paid', value: paid, color: '#16a34a' },
    { name: 'Refunded', value: refunded, color: '#9333ea' },
    { name: 'Failed', value: failed, color: '#dc2626' },
    { name: 'Pending', value: pending, color: '#d97706' },
  ].filter((s) => s.value > 0)
}

export function buildOfferRevenueRows(customers: any[]): { offer: string; type: string; revenue: number; count: number; currency: string }[] {
  const map = new Map<string, { offer: string; type: string; revenue: number; count: number; currency: string }>()
  for (const item of customers || []) {
    const offer = item.offer
    if (!offer?.name) continue
    const key = String(offer.id ?? offer.name)
    const amount = Number(offer.amount) || 0
    const existing = map.get(key) || {
      offer: offer.name,
      type: offer.offer_type || 'one-time',
      revenue: 0,
      count: 0,
      currency: (offer.currency || 'USD').toUpperCase(),
    }
    // Count active/completed enrollments toward offer revenue estimate
    if (item.status === 'active' || item.status === 'completed' || item.status === 'succeeded') {
      existing.revenue += amount
      existing.count += 1
    }
    map.set(key, existing)
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}
