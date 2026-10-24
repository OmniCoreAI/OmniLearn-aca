'use client'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Mail, MessageSquare } from 'lucide-react'
import { ClockCountdown, PaperPlaneTilt, SkipForward, WarningCircle } from '@phosphor-icons/react'
import { AcademicPageShell, AcademicHeader, AcademicEmptyState } from '@components/Dashboard/Pages/Academic/AcademicShared'
import { StatusPill } from '@components/Dashboard/Pages/Academic/AcademicUI'
import DashStatCards from '@components/Dashboard/Shared/DashStatCards'
import DashDataTable, { ToolbarSearch, ToolbarSelect } from '@components/Dashboard/Shared/DataTable/DashDataTable'
import { AdminBreadcrumbs, useAdminContext } from '@components/Dashboard/Pages/Administration/AdminUI'
import { CommunicationTabs, useEventLabel, useNotificationCatalog } from '@components/Dashboard/Pages/Communication/CommunicationTabs'
import { getNotificationLog } from '@services/administration/administration'

const PAGE_SIZE = 50
const STATUSES = ['sent', 'failed', 'skipped', 'queued'] as const
const STATUS_TONE: Record<string, string> = { sent: 'active', failed: 'rejected', skipped: 'default', queued: 'pending' }

function DeliveryLogPage({ orgslug }: { orgslug: string }) {
  const { t, i18n } = useTranslation()
  const { orgId, access_token, ready } = useAdminContext()
  const catalog = useNotificationCatalog()
  const eventLabel = useEventLabel()
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')
  const [eventKey, setEventKey] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const params = {
    channel: channel === 'all' ? undefined : channel,
    status: status === 'all' ? undefined : status,
    event_key: eventKey === 'all' ? undefined : eventKey,
    q: q.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  }
  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'log', orgId, params],
    queryFn: () => getNotificationLog(orgId, access_token, params),
    enabled: ready,
    placeholderData: keepPreviousData,
  })
  const items = (data?.items || []) as any[]
  const total = data?.total || 0
  const counts = data?.counts || {}
  const allCount = STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0)
  const labelFor = (key: string) => eventLabel(catalog.find((e) => e.key === key)) || key
  const filtering = !!q || channel !== 'all' || status !== 'all' || eventKey !== 'all'
  // Any filter change goes back to the first page.
  const withReset = (set: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    set(value)
    setPage(1)
  }
  const when = (value: string) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value || '').slice(0, 16)
    return new Intl.DateTimeFormat(i18n.language || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  }

  return (
    <AcademicPageShell>
      <AdminBreadcrumbs
        orgslug={orgslug}
        items={[{ label: t('administration.nav.communication', 'Communication'), href: '/dash/administration/communication' }, { label: t('communication.tab_log', 'Delivery log') }]}
      />
      <AcademicHeader title={t('communication.tab_log', 'Delivery log')} subtitle={t('communication.log_desc', 'Every email and SMS the academy sent, with failures and their reason.')} />
      <CommunicationTabs orgslug={orgslug} />

      <DashStatCards
        className="mb-6"
        loading={isLoading && !data}
        stats={[
          {
            key: 'sent',
            label: String(t('communication.status_sent', 'Sent')),
            value: counts.sent ?? 0,
            icon: PaperPlaneTilt,
            tone: 'stone',
            progress: allCount ? (counts.sent ?? 0) / allCount : undefined,
            hint: allCount ? t('communication.delivered_share', '{{pct}}% delivered', { pct: Math.round(((counts.sent ?? 0) / allCount) * 100) }) : undefined,
          },
          { key: 'failed', label: String(t('communication.status_failed', 'Failed')), value: counts.failed ?? 0, icon: WarningCircle, tone: 'rose' },
          {
            key: 'skipped',
            label: String(t('communication.status_skipped', 'Skipped')),
            value: counts.skipped ?? 0,
            icon: SkipForward,
            tone: 'sand',
            hint: t('communication.skipped_hint', 'Turned off or no address'),
          },
          { key: 'queued', label: String(t('communication.status_queued', 'Queued')), value: counts.queued ?? 0, icon: ClockCountdown, tone: 'gold' },
        ]}
      />

      <DashDataTable
        rows={items}
        rowKey={(log: any) => log.log_uuid}
        loading={isLoading && !data}
        serverPaging={{ page, pageSize: PAGE_SIZE, total, onChange: setPage }}
        itemLabel={(n) => t('communication.messages_count', '{{count}} messages', { count: n })}
        toolbar={
          <>
            <ToolbarSearch value={q} onChange={withReset(setQ)} placeholder={t('communication.search_recipient', 'Search by recipient')} />
            <ToolbarSelect
              label={t('communication.channel', 'Channel')}
              value={channel}
              onChange={withReset(setChannel)}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                { value: 'email', label: t('communication.email', 'Email') },
                { value: 'sms', label: 'SMS' },
              ]}
            />
            <ToolbarSelect
              label={t('administration.common.status', 'Status')}
              value={status}
              onChange={withReset(setStatus)}
              options={[
                { value: 'all', label: t('administration.common.all', 'All') },
                ...STATUSES.map((s) => ({ value: s, label: String(t(`communication.status_${s}`, s)) })),
              ]}
            />
            <ToolbarSelect
              label={t('communication.event', 'Event')}
              value={eventKey}
              onChange={withReset(setEventKey)}
              options={[{ value: 'all', label: t('administration.common.all', 'All') }, ...catalog.map((ev) => ({ value: ev.key, label: eventLabel(ev) }))]}
            />
          </>
        }
        empty={
          <AcademicEmptyState
            compact
            icon={<PaperPlaneTilt size={24} />}
            title={filtering ? t('administration.common.no_matches', 'No matches') : t('communication.no_log', 'Nothing sent yet')}
            description={
              filtering
                ? t('administration.common.no_matches_hint', 'Try a different search or clear the filters.')
                : t('communication.no_log_hint', 'Emails and SMS appear here as soon as the academy sends them — including tests.')
            }
          />
        }
        columns={[
          {
            key: 'event',
            header: t('communication.event', 'Event'),
            primary: true,
            cell: (log: any) => (
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
                  {log.channel === 'sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-medium">{labelFor(log.event_key)}</div>
                  <div className="truncate text-[11px] text-[hsl(var(--dash-muted))]">
                    {log.channel === 'sms' ? 'SMS' : t('communication.email', 'Email')}
                    {' · '}
                    {log.template_name || t('communication.builtin', 'Built-in')}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'recipient',
            header: t('communication.recipient', 'Recipient'),
            cell: (log: any) => <span className="truncate text-[13px]">{log.recipient || '—'}</span>,
          },
          {
            key: 'subject',
            header: t('communication.subject', 'Subject'),
            hideBelow: 'lg',
            hideOnMobile: true,
            cell: (log: any) => <span className="line-clamp-1 text-[13px] text-[hsl(var(--dash-muted))]">{log.subject || '—'}</span>,
          },
          {
            key: 'status',
            header: t('administration.common.status', 'Status'),
            cell: (log: any) => (
              <div className="min-w-0">
                <StatusPill status={STATUS_TONE[log.status] || 'default'} label={String(t(`communication.status_${log.status}`, log.status))} />
                {log.error ? (
                  <div className="mt-1 line-clamp-2 max-w-xs text-[11px] text-[hsl(var(--dash-warn))]" title={log.error}>
                    {log.error}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: 'when',
            header: t('communication.when', 'When'),
            align: 'end',
            cell: (log: any) => <span className="whitespace-nowrap text-[12px] tabular-nums text-[hsl(var(--dash-muted))]">{when(log.sent_at || log.creation_date)}</span>,
          },
        ]}
      />
    </AcademicPageShell>
  )
}

export default DeliveryLogPage
