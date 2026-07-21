'use client'
import React, { useState } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import {
  getOrgCustomers,
  getStripeCharges,
  getStripeSubscriptions,
} from '@services/payments/payments'
import { Badge } from '@components/ui/badge'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import {
  CreditCard,
  ExternalLink,
  RefreshCcw,
  SquareCheck,
  Users,
  Activity,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Clock,
  Download,
} from 'lucide-react'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import UserAvatar from '@components/Objects/UserAvatar'
import { usePaymentsEnabled } from '@hooks/usePaymentsEnabled'
import UnconfiguredPaymentsDisclaimer from '@components/Pages/Payments/UnconfiguredPaymentsDisclaimer'
import { Button } from '@components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table'
import FinanceOverviewTab from '@components/Dashboard/Pages/Payments/FinanceOverviewTab'
import { downloadCsv, toCsv } from '@/lib/finance/exportCsv'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CardChip({ brand, last4 }: { brand?: string; last4?: string }) {
  const labels: Record<string, string> = {
    visa: 'Visa', mastercard: 'MC', amex: 'Amex',
    discover: 'Disc', jcb: 'JCB', unionpay: 'UP',
  }
  if (!brand) return <span className="text-gray-400">—</span>
  return (
    <div className="flex items-center space-x-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
        {labels[brand.toLowerCase()] ?? brand}
      </span>
      {last4 && <span className="text-sm text-gray-600 font-mono">••••&nbsp;{last4}</span>}
    </div>
  )
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', cls: 'bg-blue-100 text-blue-700' },
  succeeded: { label: 'Paid',      cls: 'bg-green-100 text-green-700' },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
  canceled:  { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
  refunded:  { label: 'Refunded',  cls: 'bg-purple-100 text-purple-700' },
  trialing:  { label: 'Trialing',  cls: 'bg-sky-100 text-sky-700' },
  past_due:  { label: 'Past due',  cls: 'bg-red-100 text-red-600' },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tab bar (internal)
// ---------------------------------------------------------------------------
type Tab = 'overview' | 'customers' | 'transactions' | 'subscriptions'

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview',      label: 'Overview',      icon: Activity },
  { id: 'customers',     label: 'Customers',     icon: Users },
  { id: 'transactions',  label: 'Transactions',  icon: CreditCard },
  { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCcw },
]

// ---------------------------------------------------------------------------
// Customers tab
// ---------------------------------------------------------------------------
function CustomersTab({ orgId, accessToken }: { orgId: number; accessToken: string }) {
  const { data: customers, error, isLoading } = useQuery({
    queryKey: queryKeys.payments.customers(orgId),
    queryFn: () => getOrgCustomers(orgId, accessToken),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoading />
  if (error) return <div className="p-6 text-sm text-red-500">Error loading customers</div>
  if (!customers || customers.length === 0) {
    return <Empty message="No customers yet" />
  }

  const exportCustomers = () => {
    const csv = toCsv(
      [
        'enrollment_id', 'name', 'email', 'offer', 'offer_type', 'amount', 'currency',
        'status', 'since', 'last_charge_date', 'last_charge_amount', 'next_billing',
      ],
      customers.map((item: any) => {
        const offer = item.offer
        const stripe = item.stripe
        const name = item.user?.first_name
          ? `${item.user.first_name} ${item.user.last_name ?? ''}`.trim()
          : item.user?.username
        return [
          item.enrollment_id, name, item.user?.email, offer?.name, offer?.offer_type,
          offer?.amount, offer?.currency, item.status, item.creation_date,
          stripe?.last_charge_date, stripe?.last_charge_amount, stripe?.next_billing_date,
        ]
      }),
    )
    downloadCsv('finance_customers.csv', csv)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCustomers}>
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Offer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment method</TableHead>
            <TableHead>Last charge</TableHead>
            <TableHead>Next billing</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Since</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((item: any) => {
            const offer = item.offer
            const stripe = item.stripe
            const pm = stripe?.payment_method
            return (
              <TableRow key={item.enrollment_id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <UserAvatar
                      border="border-2"
                      rounded="rounded-md"
                      avatar_url={getUserAvatarMediaDirectory(item.user?.user_uuid, item.user?.avatar_image)}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {item.user?.first_name ? `${item.user.first_name} ${item.user.last_name ?? ''}`.trim() : item.user?.username}
                      </span>
                      <span className="text-xs text-gray-400 truncate">{item.user?.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{offer?.name ?? '—'}</TableCell>
                <TableCell>
                  {offer?.offer_type === 'subscription' ? (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit"><RefreshCcw size={11} /><span>Subscription</span></Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit"><SquareCheck size={11} /><span>One-time</span></Badge>
                  )}
                </TableCell>
                <TableCell>{offer ? fmt(offer.amount, offer.currency) : '—'}</TableCell>
                <TableCell>{pm ? <CardChip brand={pm.brand} last4={pm.last4} /> : <span className="text-gray-400">—</span>}</TableCell>
                <TableCell>
                  {stripe?.last_charge_date ? (
                    <div className="flex flex-col">
                      <span className="text-sm">{fmtDate(stripe.last_charge_date)}</span>
                      {stripe.last_charge_amount != null && (
                        <span className="text-xs text-gray-400">{fmt(stripe.last_charge_amount, offer?.currency)}</span>
                      )}
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </TableCell>
                <TableCell>
                  {stripe?.next_billing_date ? (
                    <div className="flex flex-col">
                      <span className="text-sm">{fmtDate(stripe.next_billing_date)}</span>
                      {stripe.cancel_at_period_end && <span className="text-xs text-red-500">Cancels then</span>}
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </TableCell>
                <TableCell><StatusPill status={item.status} /></TableCell>
                <TableCell className="text-sm text-gray-500">{fmtDate(item.creation_date)}</TableCell>
                <TableCell>
                  {stripe?.stripe_customer_url && (
                    <a href={stripe.stripe_customer_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transactions tab (paginated, direct from Stripe)
// ---------------------------------------------------------------------------
function TransactionsTab({ orgId, accessToken }: { orgId: number; accessToken: string }) {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [cursorStack, setCursorStack] = useState<string[]>([])

  const { data, error, isLoading } = useQuery({
    queryKey: ['stripe', 'charges', orgId, cursor],
    queryFn: () => getStripeCharges(orgId, accessToken, 25, cursor),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
  })

  const goNext = () => {
    if (data?.next_cursor) {
      setCursorStack(s => [...s, cursor ?? ''])
      setCursor(data.next_cursor)
    }
  }
  const goPrev = () => {
    const stack = [...cursorStack]
    const prev = stack.pop()
    setCursorStack(stack)
    setCursor(prev || undefined)
  }

  if (isLoading) return <PageLoading />
  if (error) return <StripeUnavailable />
  if (!data?.data?.length) return <Empty message="No transactions yet" />

  const exportPage = () => {
    const csv = toCsv(
      ['date', 'customer', 'email', 'amount', 'refunded', 'currency', 'status', 'description', 'receipt_url'],
      data.data.map((ch: any) => [
        ch.created, ch.customer?.name, ch.customer?.email, ch.amount, ch.amount_refunded,
        ch.currency, ch.paid ? 'paid' : ch.status, ch.description, ch.receipt_url,
      ]),
    )
    downloadCsv('finance_transactions_page.csv', csv)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportPage}>
          <Download size={14} className="mr-1.5" /> Export page CSV
        </Button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Payment method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Refunded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((ch: any) => (
              <TableRow key={ch.id}>
                <TableCell className="text-sm text-gray-500 whitespace-nowrap">{fmtDate(ch.created)}</TableCell>
                <TableCell>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{ch.customer?.name ?? ch.customer?.email ?? '—'}</span>
                    {ch.customer?.name && ch.customer?.email && (
                      <span className="text-xs text-gray-400 truncate">{ch.customer.email}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell><CardChip brand={ch.card?.brand} last4={ch.card?.last4} /></TableCell>
                <TableCell className="font-semibold">{fmt(ch.amount, ch.currency)}</TableCell>
                <TableCell className="text-sm">
                  {ch.amount_refunded > 0 ? (
                    <span className="text-purple-600">{fmt(ch.amount_refunded, ch.currency)}</span>
                  ) : '—'}
                </TableCell>
                <TableCell><StatusPill status={ch.paid ? 'succeeded' : ch.status} /></TableCell>
                <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{ch.description ?? '—'}</TableCell>
                <TableCell>
                  {ch.receipt_url && (
                    <a href={ch.receipt_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition" title="View receipt">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={cursorStack.length === 0}>
          <ChevronLeft size={14} className="mr-1" /> Previous
        </Button>
        <Button variant="outline" size="sm" onClick={goNext} disabled={!data?.has_more}>
          Next <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subscriptions tab (direct from Stripe)
// ---------------------------------------------------------------------------
function SubscriptionsTab({ orgId, accessToken }: { orgId: number; accessToken: string }) {
  const [status, setStatus] = useState('active')

  const { data, error, isLoading } = useQuery({
    queryKey: ['stripe', 'subscriptions', orgId, status],
    queryFn: () => getStripeSubscriptions(orgId, accessToken, status),
    enabled: !!(orgId && accessToken),
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoading />
  if (error) return <StripeUnavailable />

  const statuses = ['active', 'trialing', 'past_due', 'canceled', 'all']

  const exportSubs = () => {
    if (!data?.data?.length) return
    const csv = toCsv(
      [
        'id', 'customer_name', 'customer_email', 'plan_amount', 'plan_currency', 'plan_interval',
        'status', 'period_start', 'period_end', 'cancel_at_period_end', 'created',
      ],
      data.data.map((sub: any) => [
        sub.id, sub.customer?.name, sub.customer?.email, sub.plan?.amount, sub.plan?.currency,
        sub.plan?.interval, sub.status, sub.current_period_start, sub.current_period_end,
        sub.cancel_at_period_end, sub.created,
      ]),
    )
    downloadCsv(`finance_subscriptions_${status}.csv`, csv)
  }

  return (
    <div className="space-y-3">
      {/* Status filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                status === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportSubs} disabled={!data?.data?.length}>
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
      </div>

      {(!data?.data?.length) ? <Empty message={`No ${status} subscriptions`} /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Payment method</TableHead>
                <TableHead>Current period</TableHead>
                <TableHead>Next billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((sub: any) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{sub.customer?.name ?? sub.customer?.email ?? '—'}</span>
                      {sub.customer?.name && sub.customer?.email && (
                        <span className="text-xs text-gray-400 truncate">{sub.customer.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.plan ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{fmt(sub.plan.amount, sub.plan.currency)}/{sub.plan.interval}</span>
                        {sub.plan.nickname && <span className="text-xs text-gray-400">{sub.plan.nickname}</span>}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell><CardChip brand={sub.card?.brand} last4={sub.card?.last4} /></TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                    {fmtDate(sub.current_period_start)} – {fmtDate(sub.current_period_end)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{fmtDate(sub.current_period_end)}</span>
                      {sub.cancel_at_period_end && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <Clock size={10} /> Cancels then
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><StatusPill status={sub.status} /></TableCell>
                  <TableCell className="text-sm text-gray-500">{fmtDate(sub.created)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared utility components
// ---------------------------------------------------------------------------
function Empty({ message }: { message: string }) {
  return <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-sm text-gray-400">{message}</div>
}

function StripeUnavailable() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl py-10 text-center space-y-1">
      <AlertCircle size={20} className="mx-auto text-gray-400" />
      <p className="text-sm text-gray-500">Could not reach Stripe. Check your connection or configuration.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function PaymentsCustomersPage() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const { isEnabled, isLoading } = usePaymentsEnabled()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  if (!isEnabled && !isLoading) return <UnconfiguredPaymentsDisclaimer />
  if (isLoading) return <PageLoading />

  return (
    <div className="ml-10 mr-10 mx-auto space-y-4 pb-10">
      {/* Inner tab bar */}
      <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'      && <FinanceOverviewTab orgId={org.id} accessToken={access_token} />}
        {activeTab === 'customers'     && <CustomersTab      orgId={org.id} accessToken={access_token} />}
        {activeTab === 'transactions'  && <TransactionsTab   orgId={org.id} accessToken={access_token} />}
        {activeTab === 'subscriptions' && <SubscriptionsTab  orgId={org.id} accessToken={access_token} />}
      </div>
    </div>
  )
}

export default PaymentsCustomersPage
